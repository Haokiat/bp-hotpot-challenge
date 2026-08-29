// Covers every backend acceptance criterion in backend/CLAUDE.md.
// Runs against an in-memory DB: node backend/test.js
import { createStore, ApiError } from './store.js';
import { connect } from './db.js';

let pass = 0;
let fail = 0;

function check(label, fn) {
  try {
    fn();
    pass++;
    console.log(`  ✓ ${label}`);
  } catch (err) {
    fail++;
    console.log(`  ✗ ${label}\n      ${err.message}`);
  }
}

function eq(actual, expected, what = 'value') {
  const a = JSON.stringify(actual);
  const e = JSON.stringify(expected);
  if (a !== e) throw new Error(`${what}: expected ${e}, got ${a}`);
}

function throwsCode(fn, code) {
  try {
    fn();
  } catch (err) {
    if (!(err instanceof ApiError)) throw new Error(`expected ApiError, got ${err}`);
    if (err.code !== code) throw new Error(`expected code ${code}, got ${err.code}`);
    return;
  }
  throw new Error(`expected throw with code ${code}, but nothing was thrown`);
}

const fresh = () => createStore(':memory:');
const byName = (s, n) => s.listDepartments().find((d) => d.name === n);
const ingByName = (s, n) => s.listIngredients().find((i) => i.name === n);

console.log('\nSeed & data model');
check('seeds 5 placeholder ingredients with varying point values', () => {
  const s = fresh();
  const ings = s.listIngredients();
  eq(ings.length, 5, 'ingredient count');
  const values = new Set(ings.map((i) => i.point_value));
  if (values.size < 2) throw new Error('point values should vary, not be a flat rate');
  if (ings.some((i) => i.point_value <= 0)) throw new Error('all point values must be positive');
});

check('seeds 3 placeholder departments at score 0', () => {
  const s = fresh();
  eq(s.listDepartments().length, 3, 'department count');
  if (s.listDepartments().some((d) => d.score !== 0)) throw new Error('should start at 0');
  if (s.listDepartments().some((d) => d.soup_base !== null)) throw new Error('soup base starts null');
});

console.log('\nScoring');
check('adds the correct points and creates a ScoreEvent', () => {
  const s = fresh();
  const d = byName(s, 'Department A');
  const i = ingByName(s, 'Mushroom'); // 15
  const { event, department } = s.logScore(d.id, i.id);
  eq(department.score, 15, 'score after one toss');
  eq(event.points_awarded, 15, 'points_awarded');
  eq(event.department_id, d.id, 'event department');
  eq(event.ingredient_name, 'Mushroom', 'event ingredient name');
});

check('accumulates across multiple participants in one department', () => {
  const s = fresh();
  const d = byName(s, 'Department A');
  s.logScore(d.id, ingByName(s, 'Broccoli').id); // 10
  s.logScore(d.id, ingByName(s, 'Shrimp ball').id); // 20
  const { department } = s.logScore(d.id, ingByName(s, 'Mushroom').id); // 15
  eq(department.score, 45, 'cumulative score');
});

check('keeps departments independent', () => {
  const s = fresh();
  s.logScore(byName(s, 'Department A').id, ingByName(s, 'Broccoli').id);
  s.logScore(byName(s, 'Department B').id, ingByName(s, 'Shrimp ball').id);
  eq(byName(s, 'Department A').score, 10, 'A');
  eq(byName(s, 'Department B').score, 20, 'B');
  eq(byName(s, 'Department C').score, 0, 'C');
});

check('rejects an unknown department or ingredient', () => {
  const s = fresh();
  throwsCode(() => s.logScore('dept_nope', ingByName(s, 'Broccoli').id), 'NOT_FOUND');
  throwsCode(() => s.logScore(byName(s, 'Department A').id, 'ing_nope'), 'NOT_FOUND');
});

console.log('\nCorrecting the log');
check('removes one toss by id and subtracts exactly its points', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  s.logScore(a.id, ingByName(s, 'Broccoli').id);       // 10
  const second = s.logScore(a.id, ingByName(s, 'Shrimp ball').id).event; // 20 -> 30
  s.voidScoreEvent(second.id);
  eq(byName(s, 'Department A').score, 10, 'score after removal');
});

check('reaches an OLD toss, not just the most recent', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  const first = s.logScore(a.id, ingByName(s, 'Shrimp ball').id).event; // 20
  s.logScore(a.id, ingByName(s, 'Broccoli').id);                       // 10 -> 30
  s.logScore(a.id, ingByName(s, 'Carrot').id);                         // 10 -> 40
  s.voidScoreEvent(first.id);                                          // remove the FIRST
  eq(byName(s, 'Department A').score, 20, 'only the chosen toss was removed');
});

check('a removed toss can be restored with its points', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  const e = s.logScore(a.id, ingByName(s, 'Mushroom').id).event; // 15
  s.voidScoreEvent(e.id);
  eq(byName(s, 'Department A').score, 0, 'removed');
  s.restoreScoreEvent(e.id);
  eq(byName(s, 'Department A').score, 15, 'restored');
});

check('refuses to remove or restore twice', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  const e = s.logScore(a.id, ingByName(s, 'Broccoli').id).event;
  throwsCode(() => s.restoreScoreEvent(e.id), 'NOT_VOIDED');
  s.voidScoreEvent(e.id);
  throwsCode(() => s.voidScoreEvent(e.id), 'ALREADY_VOIDED');
  throwsCode(() => s.replaceScoreEvent(e.id, ingByName(s, 'Carrot').id), 'ALREADY_VOIDED');
});

check('swaps a mis-tapped ingredient and adjusts by the difference', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  const e = s.logScore(a.id, ingByName(s, 'Shrimp ball').id).event; // 20
  s.replaceScoreEvent(e.id, ingByName(s, 'Broccoli').id);           // -> 10
  eq(byName(s, 'Department A').score, 10, 'adjusted by the delta');
  const row = s.listScoreEvents({ limit: 1 })[0];
  eq(row.ingredient_name, 'Broccoli', 'log shows the corrected ingredient');
  eq(row.id, e.id, 'keeps its id, so its place in the order is unchanged');
});

check('never drives a score negative', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  const e = s.logScore(a.id, ingByName(s, 'Broccoli').id).event;
  s.voidScoreEvent(e.id);
  if (s.listDepartments().some((d) => d.score < 0)) throw new Error('negative score appeared');
});

check('removes the corrected ingredient from the pot', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  s.setActiveDepartment(a.id);
  s.logScore(a.id, ingByName(s, 'Broccoli').id);
  const m = s.logScore(a.id, ingByName(s, 'Mushroom').id).event;
  eq(s.boardPayload().pot.map((p) => p.name), ['Broccoli', 'Mushroom'], 'pot before');
  s.voidScoreEvent(m.id);
  eq(s.boardPayload().pot.map((p) => p.name), ['Broccoli'], 'pot after');
  eq(s.boardPayload().total_tosses, 1, 'toss count');
});
console.log('\nDepartment management');
check('adds, renames, and rejects duplicate or empty names', () => {
  const s = fresh();
  const d = s.addDepartment('  Engineering   Team ');
  eq(d.name, 'Engineering Team', 'name is trimmed and collapsed');
  eq(d.score, 0, 'starts at zero');
  const renamed = s.renameDepartment(d.id, 'Platform Team');
  eq(renamed.name, 'Platform Team', 'renamed');
  throwsCode(() => s.addDepartment('department a'), 'NAME_TAKEN'); // case-insensitive
  throwsCode(() => s.addDepartment('   '), 'VALIDATION');
  throwsCode(() => s.addDepartment('x'.repeat(61)), 'VALIDATION');
});

check('renaming preserves score and soup base', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  s.setSoupBase(a.id, 'mala');
  s.logScore(a.id, ingByName(s, 'Shrimp ball').id);
  const renamed = s.renameDepartment(a.id, 'Renamed Dept');
  eq(renamed.score, 20, 'score kept');
  eq(renamed.soup_base, 'mala', 'soup base kept');
});

check('hard-deletes a department only while its score is zero', () => {
  const s = fresh();
  const d = s.addDepartment('Temp Dept');
  eq(s.removeDepartment(d.id), { deleted: true, archived: false }, 'delete result');
  if (byName(s, 'Temp Dept')) throw new Error('should be gone');
});

check('blocks deleting a department that has scored', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  s.logScore(a.id, ingByName(s, 'Broccoli').id);
  throwsCode(() => s.removeDepartment(a.id), 'DEPARTMENT_HAS_SCORE');
  eq(byName(s, 'Department A').score, 10, 'score survived the refused delete');
});

check('archives a scored department instead, keeping its history', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  s.logScore(a.id, ingByName(s, 'Broccoli').id);
  eq(s.removeDepartment(a.id, { archive: true }), { deleted: false, archived: true }, 'archive result');
  if (byName(s, 'Department A')) throw new Error('archived dept should leave the active list');
  if (s.leaderboard().some((d) => d.name === 'Department A')) throw new Error('should leave leaderboard');
  if (!s.listDepartments(true).some((d) => d.name === 'Department A')) {
    throw new Error('should still exist when archived are included');
  }
  eq(s.boardPayload().pot.length, 0, 'archived departments drop out of the pot');
});

check('an archived department can be restored with its points intact', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  s.setSoupBase(a.id, 'mala');
  s.logScore(a.id, ingByName(s, 'Shrimp ball').id); // 20
  s.removeDepartment(a.id, { archive: true });
  eq(s.listArchived().map((d) => d.name), ['Department A'], 'archived list');

  const back = s.restoreDepartment(a.id);
  eq(back.archived, false, 'archived flag');
  eq(back.score, 20, 'score preserved');
  eq(back.soup_base, 'mala', 'soup base preserved');
  if (!byName(s, 'Department A')) throw new Error('not back on the active list');
  if (!s.leaderboard().some((d) => d.id === a.id)) throw new Error('not back on the leaderboard');
  eq(s.listArchived().length, 0, 'archived list is empty again');
});

check('restoring re-enables scoring into that department', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  s.logScore(a.id, ingByName(s, 'Broccoli').id);
  s.removeDepartment(a.id, { archive: true });
  throwsCode(() => s.logScore(a.id, ingByName(s, 'Broccoli').id), 'NOT_FOUND');
  s.restoreDepartment(a.id);
  const { department } = s.logScore(a.id, ingByName(s, 'Broccoli').id);
  eq(department.score, 20, 'scoring works again');
});

check('restore survives another department taking the name meanwhile', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  s.logScore(a.id, ingByName(s, 'Shrimp ball').id);
  s.removeDepartment(a.id, { archive: true });
  s.addDepartment('Department A'); // name is free again, someone reuses it
  const back = s.restoreDepartment(a.id);
  eq(back.score, 20, 'points still restored');
  eq(back.name, 'Department A (2)', 'suffixed rather than refused');
  eq(s.listDepartments().filter((d) => d.name.startsWith('Department A')).length, 2, 'both exist');
});

check('restoring a department that was never archived is refused', () => {
  const s = fresh();
  throwsCode(() => s.restoreDepartment(byName(s, 'Department A').id), 'NOT_ARCHIVED');
  throwsCode(() => s.restoreDepartment('dept_nope'), 'NOT_FOUND');
});

check('refuses to score into an archived department', () => {
  const s = fresh();
  const d = s.addDepartment('Gone');
  s.removeDepartment(d.id, { archive: true });
  throwsCode(() => s.logScore(d.id, ingByName(s, 'Broccoli').id), 'NOT_FOUND');
});

console.log('\nSoup base');
check('sets once, locks after, and stays visual only', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  const before = a.score;
  const d = s.setSoupBase(a.id, 'tomato');
  eq(d.soup_base, 'tomato', 'soup base set');
  eq(d.score, before, 'scoring untouched by soup base');
  throwsCode(() => s.setSoupBase(a.id, 'mala'), 'SOUP_BASE_LOCKED');
  throwsCode(() => s.setSoupBase(a.id, 'tomato'), 'SOUP_BASE_LOCKED'); // even the same value
});

check('rejects an unknown soup base', () => {
  const s = fresh();
  throwsCode(() => s.setSoupBase(byName(s, 'Department A').id, 'chicken'), 'VALIDATION');
});

console.log('\nLeaderboard & ties');
check('sorts by score descending, then name', () => {
  const s = fresh();
  s.logScore(byName(s, 'Department C').id, ingByName(s, 'Shrimp ball').id); // 20
  s.logScore(byName(s, 'Department A').id, ingByName(s, 'Broccoli').id); // 10
  eq(s.leaderboard().map((d) => d.name), ['Department C', 'Department A', 'Department B'], 'order');
});

check('marks EVERY department tied for the top as a winner', () => {
  const s = fresh();
  const shrimp = ingByName(s, 'Shrimp ball').id; // 20
  s.logScore(byName(s, 'Department A').id, shrimp);
  s.logScore(byName(s, 'Department B').id, shrimp);
  s.logScore(byName(s, 'Department C').id, ingByName(s, 'Broccoli').id); // 10
  const board = s.leaderboard();
  eq(board.filter((d) => d.is_leader).map((d) => d.name), ['Department A', 'Department B'], 'winners');
  eq(board.map((d) => d.rank), [1, 1, 3], 'competition ranking skips after a tie');
});

check('flags nobody as leader while every score is zero', () => {
  const s = fresh();
  if (s.leaderboard().some((d) => d.is_leader)) throw new Error('no winner at 0-0-0');
});

check('shows all departments with no top-N cutoff', () => {
  const s = fresh();
  for (let i = 0; i < 15; i++) s.addDepartment(`Dept ${i}`);
  eq(s.leaderboard().length, 18, 'all 18 departments listed');
});

check('reports total score and toss count', () => {
  const s = fresh();
  s.logScore(byName(s, 'Department A').id, ingByName(s, 'Mushroom').id); // 15
  s.logScore(byName(s, 'Department B').id, ingByName(s, 'Broccoli').id); // 10
  const p = s.boardPayload();
  eq(p.total_score, 25, 'total score');
  eq(p.total_tosses, 2, 'total tosses');
});

console.log('\nDurability & load');
check('point value is snapshotted, so removal survives an ingredient edit', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  const ing = ingByName(s, 'Broccoli');
  const e = s.logScore(a.id, ing.id).event; // 10
  s.db.prepare('UPDATE ingredients SET point_value = 999 WHERE id = ?').run(ing.id);
  s.voidScoreEvent(e.id);
  eq(byName(s, 'Department A').score, 0, 'used the snapshotted 10, not the new 999');
});

check('caps the pot at 40 while the score keeps accumulating', () => {
  const s = fresh();
  const a = byName(s, 'Department A');
  const i = ingByName(s, 'Broccoli').id;
  for (let n = 0; n < 60; n++) s.logScore(a.id, i);
  const p = s.boardPayload();
  eq(p.pot.length, 40, 'pot is windowed');
  eq(p.total_tosses, 60, 'toss count is not');
  eq(byName(s, 'Department A').score, 600, 'score is not');
});

check('handles a full event load (1250 actions) quickly', () => {
  const s = fresh();
  const depts = [];
  for (let i = 0; i < 15; i++) depts.push(s.addDepartment(`Load Dept ${i}`).id);
  const ings = s.listIngredients().map((i) => i.id);
  const t0 = performance.now();
  for (let n = 0; n < 1250; n++) {
    s.logScore(depts[n % depts.length], ings[n % ings.length]);
    if (n % 50 === 0) s.boardPayload(); // display refresh
  }
  const ms = performance.now() - t0;
  eq(s.boardPayload().total_tosses, 1250, 'all actions logged');
  if (ms > 5000) throw new Error(`5h of load took ${ms.toFixed(0)}ms — too slow`);
  console.log(`      (1250 scoring actions in ${ms.toFixed(0)}ms — a full 5-hour event)`);
});

console.log('\nDurability (on-disk: journal + snapshots)');
{
  const { mkdtempSync, rmSync, existsSync, readFileSync, readdirSync } = await import('node:fs');
  const { join } = await import('node:path');
  const { tmpdir } = await import('node:os');

  const dir = mkdtempSync(join(tmpdir(), 'hotpot-dur-'));
  const dbPath = join(dir, 'hotpot.db');
  const disk = createStore(dbPath);
  const jlines = () =>
    readFileSync(join(dir, 'events.jsonl'), 'utf8').split('\n').filter(Boolean).map(JSON.parse);

  check('writes a snapshot at startup, so there is always a restore point', () => {
    const snaps = readdirSync(join(dir, 'snapshots')).filter((f) => f.endsWith('.db'));
    if (!snaps.length) throw new Error('no startup snapshot');
  });

  check('journals the seed, so a replay starts from the same baseline', () => {
    const types = jlines().map((r) => r.type);
    eq(types.filter((t) => t === 'seed_ingredient').length, 5, 'seeded ingredients');
    eq(types.filter((t) => t === 'seed_department').length, 3, 'seeded departments');
  });

  check('journals every score with the points and resulting total', () => {
    const a = disk.listDepartments().find((d) => d.name === 'Department A');
    const i = disk.listIngredients().find((x) => x.name === 'Mushroom'); // 15
    disk.logScore(a.id, i.id);
    const last = jlines().pop();
    eq(last.type, 'score', 'type');
    eq(last.points, 15, 'points');
    eq(last.score_after, 15, 'score_after');
    eq(last.department_name, 'Department A', 'department');
    eq(last.ingredient_name, 'Mushroom', 'ingredient');
    if (!last.t) throw new Error('missing timestamp');
  });

  check('journals a removal and a correction as their own records', () => {
    const a = disk.listDepartments().find((d) => d.name === 'Department A');
    const ings = disk.listIngredients();
    const e = disk.logScore(a.id, ings[1].id).event;      // Mushroom 15
    disk.replaceScoreEvent(e.id, ings[0].id);             // -> Broccoli 10
    const swap = jlines().pop();
    eq(swap.type, 'score_replace', 'replace type');
    eq([swap.from_points, swap.to_points], [15, 10], 'points before and after');
    disk.voidScoreEvent(e.id);
    const gone = jlines().pop();
    eq(gone.type, 'score_void', 'void type');
    eq(gone.points, 10, 'points reversed');
  });

  check('journals department edits and soup base', () => {
    const d = disk.addDepartment('Journal Test');
    disk.setSoupBase(d.id, 'laksa');
    disk.renameDepartment(d.id, 'Renamed In Journal');
    disk.removeDepartment(d.id, { archive: true });
    const types = jlines().slice(-4).map((r) => r.type);
    eq(types, ['department_add', 'soup_base', 'department_rename', 'department_archive'], 'sequence');
  });

  check('an id counter that has fallen behind is repaired on open', () => {
    // A counter below the real maximum makes the next insert REUSE an id that
    // is already in the journal. Replaying that journal then produces wrong
    // scores, silently. A restore run against a live server can cause exactly
    // this, so every open drags the counters forward.
    const cdir = mkdtempSync(join(tmpdir(), 'hotpot-ctr-'));
    const cpath = join(cdir, 'hotpot.db');
    const s1 = createStore(cpath);
    const a1 = s1.listDepartments()[0];
    const first = s1.logScore(a1.id, s1.listIngredients()[0].id).event.id;
    s1.db.prepare("UPDATE counters SET value = 0 WHERE name = 'evt'").run();
    s1.close();

    const s2 = createStore(cpath);                       // reopen — repair happens here
    const a2 = s2.listDepartments()[0];
    const next = s2.logScore(a2.id, s2.listIngredients()[0].id).event.id;
    eq(next === first, false, `next id (${next}) must not reuse ${first}`);
    const ids = s2.listScoreEvents({ limit: 50, includeVoided: true }).map((e) => e.id);
    eq(ids.length, new Set(ids).size, 'every event id is unique');
    s2.close();
    rmSync(cdir, { recursive: true, force: true });
  });

  check('journal survives losing the database entirely (full replay)', () => {
    const a = disk.listDepartments().find((d) => d.name === 'Department A');
    const ings = disk.listIngredients();
    for (let n = 0; n < 25; n++) disk.logScore(a.id, ings[n % ings.length].id);
    const mid = disk.listScoreEvents({ limit: 5 })[3];
    disk.voidScoreEvent(mid.id);          // remove one from the middle
    disk.replaceScoreEvent(disk.listScoreEvents({ limit: 1 })[0].id, ings[3].id);
    const expected = disk.listDepartments().find((d) => d.name === 'Department A').score;
    const expectedTosses = disk.boardPayload().total_tosses;
    disk.close();

    // Nuke the database — journal only.
    for (const ext of ['', '-wal', '-shm']) rmSync(dbPath + ext, { force: true });
    if (existsSync(dbPath)) throw new Error('database should be gone');

    // Replay exactly as backend/restore.js from-journal does: connect() to a
    // bare database, NOT createStore() — createStore would re-seed and append
    // fresh seed rows to the journal we are about to replay.
    const records = jlines();
    const rebuilt = connect(dbPath);
    const put = {
      ing: rebuilt.prepare('INSERT OR REPLACE INTO ingredients (id,name,point_value,sprite,sort_order) VALUES (?,?,?,?,?)'),
      dept: rebuilt.prepare('INSERT OR REPLACE INTO departments (id,name,score,soup_base,archived,created_at) VALUES (?,?,0,NULL,0,?)'),
      rename: rebuilt.prepare('UPDATE departments SET name=? WHERE id=?'),
      arch: rebuilt.prepare('UPDATE departments SET archived=1 WHERE id=?'),
      soup: rebuilt.prepare('UPDATE departments SET soup_base=? WHERE id=?'),
      bump: rebuilt.prepare('UPDATE departments SET score = score + ? WHERE id=?'),
      ev: rebuilt.prepare('INSERT OR REPLACE INTO score_events (id,department_id,ingredient_id,points_awarded,timestamp,voided,seq) VALUES (?,?,?,?,?,0,?)'),
      void: rebuilt.prepare('UPDATE score_events SET voided=1 WHERE id=?'),
      unvoid: rebuilt.prepare('UPDATE score_events SET voided=0 WHERE id=?'),
      repoint: rebuilt.prepare('UPDATE score_events SET ingredient_id=?, points_awarded=? WHERE id=?'),
    };
    rebuilt.exec('DELETE FROM score_events; DELETE FROM departments; DELETE FROM ingredients');
    for (const r of records) {
      if (r.type === 'seed_ingredient') put.ing.run(r.ingredient_id, r.name, r.point_value, r.sprite ?? r.emoji ?? null, r.sort_order ?? 0);
      else if (r.type === 'seed_department' || r.type === 'department_add') put.dept.run(r.department_id, r.name, r.t);
      else if (r.type === 'department_rename') put.rename.run(r.to, r.department_id);
      else if (r.type === 'department_archive') put.arch.run(r.department_id);
      else if (r.type === 'soup_base') put.soup.run(r.soup_base, r.department_id);
      else if (r.type === 'score') { put.ev.run(r.event_id, r.department_id, r.ingredient_id, r.points, r.t, r.seq); put.bump.run(r.points, r.department_id); }
      // 'undo' is retained so journals written before it was removed still replay.
      else if (r.type === 'undo') { put.void.run(r.event_id); put.bump.run(-r.points, r.department_id); }
      else if (r.type === 'score_void') { put.void.run(r.event_id); put.bump.run(-r.points, r.department_id); }
      else if (r.type === 'score_unvoid') { put.unvoid.run(r.event_id); put.bump.run(r.points, r.department_id); }
      else if (r.type === 'score_replace') {
        put.repoint.run(r.to_ingredient_id, r.to_points, r.event_id);
        put.bump.run(r.to_points - r.from_points, r.department_id);
      }
    }
    const got = rebuilt.prepare("SELECT score FROM departments WHERE name = 'Department A'").get();
    const gotTosses = rebuilt.prepare('SELECT COUNT(*) n FROM score_events WHERE voided = 0').get().n;
    rebuilt.close();
    eq(got.score, expected, 'rebuilt score');
    eq(gotTosses, expectedTosses, 'rebuilt toss count');
  });

  rmSync(dir, { recursive: true, force: true });
}

console.log(`\n${fail === 0 ? '✓ all green' : '✗ FAILURES'} — ${pass} passed, ${fail} failed\n`);
process.exit(fail === 0 ? 0 : 1);
