// Score-loss protection. Three independent layers, so no single failure —
// crash, power cut, corrupted file, fat-fingered delete — takes the event down.
//
//   1. synchronous = FULL  (in db.js) — every commit is fsynced before the API
//      responds, so a power cut cannot lose an acknowledged score.
//   2. journal (here)      — an append-only JSONL record of every mutation,
//      fsynced per line. Independent of SQLite: if the .db is ever lost or
//      corrupted, the whole event replays from this text file.
//   3. snapshots (here)    — a periodic VACUUM INTO copy of the database.
//      Recovery is copying one file back.
import { openSync, writeSync, fsyncSync, closeSync, mkdirSync, readdirSync, rmSync, statSync } from 'node:fs';
import { join } from 'node:path';

/* ------------------------------------------------------------- journal ---- */

export function createJournal(dir) {
  mkdirSync(dir, { recursive: true });
  const path = join(dir, 'events.jsonl');
  // 'a' = append only. The fd stays open for the life of the process; we never
  // rewrite or truncate, so an earlier line can't be lost by a later failure.
  let fd = openSync(path, 'a');

  return {
    path,
    append(type, data) {
      if (fd === null) return;
      const line = JSON.stringify({ t: new Date().toISOString(), type, ...data }) + '\n';
      try {
        writeSync(fd, line);
        // fsync per action: at ~250 actions/hour the cost is irrelevant, and it
        // means the journal is never behind the database.
        fsyncSync(fd);
      } catch (err) {
        // A journal failure must never block scoring — the DB is still the
        // source of truth. Log loudly and carry on.
        console.error('[hotpot] journal write failed:', err.message);
      }
    },
    close() {
      if (fd === null) return;
      try { fsyncSync(fd); closeSync(fd); } catch {}
      fd = null;
    },
  };
}

/* ----------------------------------------------------------- snapshots ---- */

const KEEP = 20;

export function startSnapshots(db, dir, { intervalMs = 60_000, mirrorDir = null } = {}) {
  const snapDir = join(dir, 'snapshots');
  mkdirSync(snapDir, { recursive: true });

  let dirty = false;
  let lastError = null;

  const stamp = () =>
    new Date().toISOString().replace(/[-:]/g, '').replace(/\..+/, '').replace('T', '-');

  function prune(target) {
    try {
      const files = readdirSync(target)
        .filter((f) => f.startsWith('hotpot-') && f.endsWith('.db'))
        .sort();
      for (const f of files.slice(0, Math.max(0, files.length - KEEP))) {
        rmSync(join(target, f), { force: true });
      }
    } catch {}
  }

  function take(reason = 'interval') {
    const file = `hotpot-${stamp()}.db`;
    const dest = join(snapDir, file);
    try {
      // Fold the WAL back into the main .db first. Without this, hotpot.db on
      // its own is stale mid-event (recent scores sit in hotpot.db-wal), and
      // anyone copying just that one file would lose them.
      try { db.exec('PRAGMA wal_checkpoint(PASSIVE)'); } catch {}
      db.prepare('VACUUM INTO ?').run(dest);
      prune(snapDir);
      lastError = null;
      return { ok: true, file, bytes: statSync(dest).size, reason };
    } catch (err) {
      // Most likely cause is a same-second filename collision; harmless.
      lastError = err.message;
      return { ok: false, error: err.message, reason };
    }
  }

  // One at startup, so there is always a restore point from the moment the
  // server came up — never an empty snapshot folder.
  take('startup');

  // After that, only snapshot when something actually changed, so an idle
  // booth doesn't fill the disk with identical copies.
  const timer = setInterval(() => {
    if (!dirty) return;
    dirty = false;
    take('interval');
  }, intervalMs);
  timer.unref();

  return {
    dir: snapDir,
    markDirty() { dirty = true; },
    take,
    status: () => ({
      dir: snapDir,
      count: (() => { try { return readdirSync(snapDir).filter((f) => f.endsWith('.db')).length; } catch { return 0; } })(),
      lastError,
      pending: dirty,
    }),
    stop() { clearInterval(timer); if (dirty) take('shutdown'); },
  };
}
