// SQLite persistence. Uses node:sqlite (built into Node 22.5+) so the whole
// backend runs with zero npm dependencies — nothing to install or compile on
// the booth laptop, which matters for the 5-hour single-device event (PRD 8.2).
import { DatabaseSync } from 'node:sqlite';
import { mkdirSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));

export const DB_PATH = process.env.HOTPOT_DB ?? join(here, 'data', 'hotpot.db');

function open(path) {
  if (path !== ':memory:') mkdirSync(dirname(path), { recursive: true });
  const db = new DatabaseSync(path);
  // WAL keeps reads fast while writes land, and survives an abrupt power loss
  // far better than the default rollback journal.
  db.exec('PRAGMA journal_mode = WAL');
  db.exec('PRAGMA foreign_keys = ON');
  // FULL, not NORMAL: every commit is fsynced before the write returns, so a
  // sudden power cut cannot lose a score the admin already saw confirmed.
  // Measured cost is ~65ms spread across a whole 5-hour event.
  db.exec('PRAGMA synchronous = FULL');
  return db;
}

const SCHEMA = `
CREATE TABLE IF NOT EXISTS departments (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  score     INTEGER NOT NULL DEFAULT 0,
  soup_base TEXT,
  archived  INTEGER NOT NULL DEFAULT 0,
  created_at TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS ingredients (
  id          TEXT PRIMARY KEY,
  name        TEXT NOT NULL,
  point_value INTEGER NOT NULL,
  sprite      TEXT,
  sort_order  INTEGER NOT NULL DEFAULT 0
);

CREATE TABLE IF NOT EXISTS score_events (
  id             TEXT PRIMARY KEY,
  department_id  TEXT NOT NULL REFERENCES departments(id),
  ingredient_id  TEXT NOT NULL REFERENCES ingredients(id),
  points_awarded INTEGER NOT NULL,
  timestamp      TEXT NOT NULL,
  voided         INTEGER NOT NULL DEFAULT 0,
  seq            INTEGER NOT NULL
);

CREATE INDEX IF NOT EXISTS idx_events_live ON score_events(voided, seq DESC);
CREATE INDEX IF NOT EXISTS idx_events_dept ON score_events(department_id);

CREATE TABLE IF NOT EXISTS counters (
  name  TEXT PRIMARY KEY,
  value INTEGER NOT NULL
);

CREATE TABLE IF NOT EXISTS settings (
  key   TEXT PRIMARY KEY,
  value TEXT NOT NULL
);
`;

export function connect(path = DB_PATH) {
  const db = open(path);
  db.exec(SCHEMA);
  for (const name of ['dept', 'ing', 'evt', 'seq']) {
    db.prepare('INSERT OR IGNORE INTO counters (name, value) VALUES (?, 0)').run(name);
  }
  reconcileCounters(db);
  return db;
}

/**
 * Drag each id counter up to at least the highest id already in the table.
 *
 * A counter that sits BELOW the real maximum makes the next insert reuse an id
 * that already exists. In the score_events table that is a primary-key clash,
 * but the append-only journal has no such constraint — it would simply gain a
 * second record for the same event id, and replaying it would produce the wrong
 * scores. That is a silent, unrecoverable corruption of the event's results.
 *
 * The counters can fall behind after a restore, so this runs on every open. It
 * only ever moves them forward.
 */
function reconcileCounters(db) {
  const highest = (table, prefix) => {
    const rows = db.prepare(`SELECT id FROM ${table}`).all();
    let max = 0;
    for (const { id } of rows) {
      const n = Number(String(id).startsWith(prefix) ? String(id).slice(prefix.length) : NaN);
      if (Number.isInteger(n) && n > max) max = n;
    }
    return max;
  };

  const floors = {
    dept: highest('departments', 'dept_'),
    ing: highest('ingredients', 'ing_'),
    evt: highest('score_events', 'evt_'),
    seq: db.prepare('SELECT COALESCE(MAX(seq), 0) AS n FROM score_events').get().n,
  };

  const read = db.prepare('SELECT value FROM counters WHERE name = ?');
  const write = db.prepare('UPDATE counters SET value = ? WHERE name = ?');
  for (const [name, floor] of Object.entries(floors)) {
    const current = read.get(name)?.value ?? 0;
    if (current < floor) {
      console.warn(
        `[hotpot] ${name} counter was ${current} but ids reach ${floor} — moved it forward to avoid reusing an id.`
      );
      write.run(floor, name);
    }
  }
}

// Monotonic id/sequence source. Kept in the DB so ids stay unique across a
// server restart mid-event.
export function nextCounter(db, name) {
  db.prepare('UPDATE counters SET value = value + 1 WHERE name = ?').run(name);
  return db.prepare('SELECT value FROM counters WHERE name = ?').get(name).value;
}
