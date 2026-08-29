#!/usr/bin/env node
// Recovery tool. Run with the server STOPPED.
//
//   node backend/restore.js list                  — show snapshots and journal size
//   node backend/restore.js from-snapshot [file]  — restore from a snapshot (default: newest)
//   node backend/restore.js from-journal          — rebuild the database by replaying events.jsonl
//   node backend/restore.js verify                — check the live DB against the journal
//
// from-journal is the last resort: it needs nothing but the text file, and
// reproduces every score, undo, rename, archive and soup base in order.
import { readFileSync, readdirSync, copyFileSync, existsSync, rmSync, statSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { DatabaseSync } from 'node:sqlite';
import { connect } from './db.js';

const here = dirname(fileURLToPath(import.meta.url));
const DATA = process.env.HOTPOT_DATA ?? join(here, 'data');
const DB = join(DATA, 'hotpot.db');
const JOURNAL = join(DATA, 'events.jsonl');
const SNAPS = join(DATA, 'snapshots');

const die = (m) => { console.error(`\n  ✗ ${m}\n`); process.exit(1); };
const snapshots = () =>
  existsSync(SNAPS) ? readdirSync(SNAPS).filter((f) => f.endsWith('.db')).sort() : [];

function readJournal() {
  if (!existsSync(JOURNAL)) die(`No journal at ${JOURNAL}`);
  const lines = readFileSync(JOURNAL, 'utf8').split('\n').filter(Boolean);
  const recs = [];
  let skipped = 0;
  for (const line of lines) {
    // A power cut can leave the final line half-written; drop only that.
    try { recs.push(JSON.parse(line)); } catch { skipped++; }
  }
  return { recs, skipped };
}

// Replay the journal into a fresh database.
function rebuild(target) {
  const { recs, skipped } = readJournal();
  if (existsSync(target)) rmSync(target, { force: true });
  for (const ext of ['-wal', '-shm']) rmSync(target + ext, { force: true });

  const db = connect(target);
  const put = {
    ing: db.prepare('INSERT OR REPLACE INTO ingredients (id,name,point_value,sprite,sort_order) VALUES (?,?,?,?,?)'),
    dept: db.prepare('INSERT OR REPLACE INTO departments (id,name,score,soup_base,archived,created_at) VALUES (?,?,0,NULL,0,?)'),
    rename: db.prepare('UPDATE departments SET name=? WHERE id=?'),
    del: db.prepare('DELETE FROM departments WHERE id=?'),
    arch: db.prepare('UPDATE departments SET archived=1 WHERE id=?'),
    unarch: db.prepare('UPDATE departments SET archived=0, name=? WHERE id=?'),
    soup: db.prepare('UPDATE departments SET soup_base=? WHERE id=?'),
    bump: db.prepare('UPDATE departments SET score = score + ? WHERE id=?'),
    ev: db.prepare('INSERT OR REPLACE INTO score_events (id,department_id,ingredient_id,points_awarded,timestamp,voided,seq) VALUES (?,?,?,?,?,0,?)'),
    void: db.prepare('UPDATE score_events SET voided=1 WHERE id=?'),
    unvoid: db.prepare('UPDATE score_events SET voided=0 WHERE id=?'),
    repoint: db.prepare('UPDATE score_events SET ingredient_id=?, points_awarded=? WHERE id=?'),
    setting: db.prepare('INSERT INTO settings (key,value) VALUES (?,?) ON CONFLICT(key) DO UPDATE SET value=excluded.value'),
    counter: db.prepare('UPDATE counters SET value=? WHERE name=?'),
  };

  const counters = { dept: 0, ing: 0, evt: 0, seq: 0 };
  const bumpCounter = (name, id) => {
    const n = Number(String(id).split('_')[1]);
    if (Number.isFinite(n) && n > counters[name]) counters[name] = n;
  };

  let applied = 0;
  for (const r of recs) {
    switch (r.type) {
      case 'seed_ingredient':
        // `?? r.emoji` keeps journals written before the sprite rename replayable.
        put.ing.run(r.ingredient_id, r.name, r.point_value, r.sprite ?? r.emoji ?? null, r.sort_order ?? 0);
        bumpCounter('ing', r.ingredient_id); break;
      case 'seed_department':
      case 'department_add':
        put.dept.run(r.department_id, r.name, r.t);
        bumpCounter('dept', r.department_id); break;
      case 'department_rename': put.rename.run(r.to, r.department_id); break;
      case 'department_delete': put.del.run(r.department_id); break;
      case 'department_archive': put.arch.run(r.department_id); break;
      case 'department_restore': put.unarch.run(r.name, r.department_id); break;
      case 'score_void':    put.void.run(r.event_id); put.bump.run(-r.points, r.department_id); break;
      case 'score_unvoid':  put.unvoid.run(r.event_id); put.bump.run(r.points, r.department_id); break;
      case 'score_replace':
        put.repoint.run(r.to_ingredient_id, r.to_points, r.event_id);
        put.bump.run(r.to_points - r.from_points, r.department_id);
        break;
      case 'soup_base': put.soup.run(r.soup_base, r.department_id); break;
      case 'score':
        put.ev.run(r.event_id, r.department_id, r.ingredient_id, r.points, r.t, r.seq);
        put.bump.run(r.points, r.department_id);
        bumpCounter('evt', r.event_id);
        if (r.seq > counters.seq) counters.seq = r.seq;
        break;
      case 'undo':
        put.void.run(r.event_id);
        put.bump.run(-r.points, r.department_id);
        break;
      case 'announce': put.setting.run('announced', r.announced ? '1' : '0'); break;
      case 'active_department': put.setting.run('active_department', r.department_id ?? ''); break;
      default: continue;
    }
    applied++;
  }
  for (const [name, value] of Object.entries(counters)) put.counter.run(value, name);

  const totals = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(score),0) s FROM departments WHERE archived=0').get();
  const tosses = db.prepare('SELECT COUNT(*) n FROM score_events WHERE voided=0').get().n;
  db.close();
  return { applied, skipped, departments: totals.n, total: totals.s, tosses };
}

/**
 * Refuse to touch the database while the server is running.
 *
 * The running server holds its own connection. Replacing the file underneath it
 * leaves it writing to a deleted copy, and on the next restart the id counters
 * can be behind what was already issued — which makes new events REUSE ids that
 * already exist in the journal. Replaying that journal then produces the wrong
 * scores, silently. A header comment is not enough protection for a tool an
 * organiser may reach for under pressure on event day.
 */
async function serverIsRunning() {
  const port = Number(process.env.PORT ?? 3000);
  try {
    const c = new AbortController();
    const t = setTimeout(() => c.abort(), 700);
    const r = await fetch(`http://localhost:${port}/api/health`, { signal: c.signal });
    clearTimeout(t);
    return r.ok;
  } catch {
    return false;
  }
}

const [cmd, arg] = process.argv.slice(2);

if (['from-journal', 'from-snapshot', 'verify'].includes(cmd) && (await serverIsRunning())) {
  die(
    `The server is still running.\n` +
    `    Stop it first, then run this again.\n` +
    `    Rebuilding underneath a live server corrupts the id sequence and the journal.`
  );
}

if (cmd === 'list') {
  const snaps = snapshots();
  console.log(`\n  Data directory: ${DATA}`);
  console.log(`  Live database:  ${existsSync(DB) ? `${statSync(DB).size} bytes` : 'MISSING'}`);
  if (existsSync(JOURNAL)) {
    const { recs, skipped } = readJournal();
    console.log(`  Journal:        ${recs.length} records${skipped ? `, ${skipped} unreadable` : ''}`);
  } else console.log('  Journal:        MISSING');
  console.log(`  Snapshots:      ${snaps.length}`);
  for (const f of snaps.slice(-10)) console.log(`                    ${f}`);
  console.log();

} else if (cmd === 'from-snapshot') {
  const snaps = snapshots();
  if (!snaps.length) die('No snapshots found.');
  const pick = arg ?? snaps[snaps.length - 1];
  const src = join(SNAPS, pick);
  if (!existsSync(src)) die(`No such snapshot: ${pick}`);
  if (existsSync(DB)) copyFileSync(DB, `${DB}.replaced-${Date.now()}`);
  for (const ext of ['-wal', '-shm']) rmSync(DB + ext, { force: true });
  copyFileSync(src, DB);
  const db = new DatabaseSync(DB);
  const t = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(score),0) s FROM departments WHERE archived=0').get();
  db.close();
  console.log(`\n  ✓ Restored from ${pick} — ${t.n} departments, ${t.s} points total.`);
  console.log('    The previous database was kept alongside it as .replaced-*\n');

} else if (cmd === 'from-journal') {
  if (existsSync(DB)) copyFileSync(DB, `${DB}.replaced-${Date.now()}`);
  const r = rebuild(DB);
  console.log(`\n  ✓ Rebuilt from journal — ${r.applied} records applied${r.skipped ? `, ${r.skipped} skipped` : ''}.`);
  console.log(`    ${r.departments} departments, ${r.total} points, ${r.tosses} tosses.\n`);

} else if (cmd === 'verify') {
  if (!existsSync(DB)) die('No live database to verify.');
  const tmp = join(DATA, '.verify.db');
  const j = rebuild(tmp);
  const db = new DatabaseSync(DB);
  const live = db.prepare('SELECT COUNT(*) n, COALESCE(SUM(score),0) s FROM departments WHERE archived=0').get();
  const liveTosses = db.prepare('SELECT COUNT(*) n FROM score_events WHERE voided=0').get().n;
  db.close();
  for (const ext of ['', '-wal', '-shm']) rmSync(tmp + ext, { force: true });

  const match = live.s === j.total && liveTosses === j.tosses && live.n === j.departments;
  console.log(`\n  live database : ${live.n} departments, ${live.s} points, ${liveTosses} tosses`);
  console.log(`  journal replay: ${j.departments} departments, ${j.total} points, ${j.tosses} tosses`);
  console.log(match ? '\n  ✓ Journal and database agree.\n' : '\n  ✗ MISMATCH — investigate before the event.\n');
  process.exit(match ? 0 : 1);

} else {
  console.log(`
  Hotpot Challenge — recovery tool (run with the server stopped)

    node backend/restore.js list                   show snapshots and journal size
    node backend/restore.js verify                 check the database against the journal
    node backend/restore.js from-snapshot [file]   restore from a snapshot (default: newest)
    node backend/restore.js from-journal           rebuild the database from events.jsonl
`);
}
