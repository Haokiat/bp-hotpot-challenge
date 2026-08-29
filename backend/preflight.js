// PRE-EVENT CHECK — walks an organiser's real path through the app end to end,
// over HTTP and SSE, and reports whether the build behaves as the PRD requires.
//
//   npm run preflight
//
// SAFE TO RUN ANY TIME, INCLUDING ON EVENT DAY.
// It starts its own throwaway server on its own port with a temporary database,
// then deletes it. It never reads, writes or even connects to the event's real
// data. Nothing here can touch a live score.
//
// Complements `npm test`, which exercises the store directly and never crosses
// the network layer — this covers routing, JSON shapes, and the SSE push that
// the projector screen depends on.
import { spawn } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

const here = dirname(fileURLToPath(import.meta.url));
const PORT = Number(process.env.PREFLIGHT_PORT ?? 3987);
const BASE = `http://localhost:${PORT}`;
const API = `${BASE}/api`;

let pass = 0, fail = 0;
const check = (label, fn) => {
  try { fn(); pass++; console.log(`  \x1b[32m✓\x1b[0m ${label}`); }
  catch (e) { fail++; console.log(`  \x1b[31m✗ ${label}\x1b[0m\n      ${e.message}`); }
};
const eq = (a, b, what = 'value') => {
  if (JSON.stringify(a) !== JSON.stringify(b)) {
    throw new Error(`${what}: expected ${JSON.stringify(b)}, got ${JSON.stringify(a)}`);
  }
};

async function req(method, path, body) {
  const r = await fetch(API + path, {
    method,
    headers: body ? { 'Content-Type': 'application/json' } : undefined,
    body: body ? JSON.stringify(body) : undefined,
  });
  return { status: r.status, body: await r.json().catch(() => ({})) };
}
const get = (p) => req('GET', p);
const post = (p, b) => req('POST', p, b);

// ---------------------------------------------------------------- setup ----
const dataDir = mkdtempSync(join(tmpdir(), 'hotpot-preflight-'));
let server;

async function startServer() {
  server = spawn(process.execPath, [join(here, 'server.js')], {
    env: { ...process.env, PORT: String(PORT), HOTPOT_DB: join(dataDir, 'preflight.db') },
    stdio: ['ignore', 'ignore', 'pipe'],
  });
  let stderr = '';
  server.stderr.on('data', (d) => { stderr += d; });

  for (let n = 0; n < 100; n++) {
    await new Promise((r) => setTimeout(r, 100));
    if (server.exitCode !== null) {
      throw new Error(`server exited (${server.exitCode}).\n${stderr.trim()}`);
    }
    try {
      if ((await fetch(`${API}/health`)).ok) return;
    } catch { /* not up yet */ }
  }
  throw new Error(`server did not start on port ${PORT} within 10s.\n${stderr.trim()}`);
}

function cleanup() {
  server?.kill('SIGKILL');
  try { rmSync(dataDir, { recursive: true, force: true }); } catch { /* best effort */ }
}
process.on('exit', cleanup);
process.on('SIGINT', () => { cleanup(); process.exit(130); });

// ------------------------------------------------------------------ SSE ----
// The projector screen is driven entirely by this stream, so the check watches
// it directly rather than trusting the HTTP responses alone.
const pushed = [];
async function openStream() {
  const r = await fetch(`${API}/events`);
  const reader = r.body.getReader();
  const dec = new TextDecoder();
  let buf = '';
  (async () => {
    try {
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;
        buf += dec.decode(value, { stream: true });
        let i;
        while ((i = buf.indexOf('\n\n')) >= 0) {
          const chunk = buf.slice(0, i);
          buf = buf.slice(i + 2);
          const ev = /^event: (.+)$/m.exec(chunk)?.[1];
          const data = /^data: (.+)$/m.exec(chunk)?.[1];
          if (ev) pushed.push({ ev, data: data ? JSON.parse(data) : null });
        }
      }
    } catch { /* stream closed at teardown */ }
  })();
}
const mark = () => pushed.length;
async function waitPush(from, pred, ms = 2000) {
  const t0 = Date.now();
  while (Date.now() - t0 < ms) {
    const hit = pushed.slice(from).find(pred);
    if (hit) return hit;
    await new Promise((r) => setTimeout(r, 20));
  }
  return null;
}

// ----------------------------------------------------------------- run -----
console.log('\n\x1b[1mHot Pot Challenge — pre-event check\x1b[0m');
console.log(`(isolated server on :${PORT}, temporary database — your event data is untouched)`);

await startServer();
await openStream();

console.log('\n\x1b[1m1. Booth start-up\x1b[0m  (PRD 7.3, 7.6)');
{
  const admin = await fetch(`${BASE}/admin`);
  check('admin screen loads with no login or PIN', () => eq(admin.status, 200, 'status'));
  const disp = await fetch(`${BASE}/display`);
  check('display screen loads', () => eq(disp.status, 200, 'status'));
  const hello = await waitPush(0, (s) => s.ev === 'hello');
  check('display receives its opening state over SSE', () => {
    if (!hello) throw new Error('no hello event on the stream');
  });
  check('placeholder data is loaded and usable', () => {
    if (!hello.data.ingredients.length) throw new Error('no ingredients seeded');
    if (!hello.data.departments.length) throw new Error('no departments seeded');
  });
  const ings = hello.data.ingredients;
  check('point values vary by ingredient and are all positive', () => {
    if (new Set(ings.map((i) => i.point_value)).size < 2) throw new Error('all values identical');
    if (ings.some((i) => i.point_value <= 0)) throw new Error('a value is zero or negative');
  });
  check('every ingredient has artwork (or a safe fallback)', () => {
    if (ings.some((i) => !('sprite' in i))) throw new Error('an ingredient has no sprite field');
  });
}

const dept = (await post('/departments', { name: 'Preflight Team' })).body.department;

console.log('\n\x1b[1m2. One participant, start to finish\x1b[0m  (PRD 3, 7.2, 7.5)');
{
  await post('/active-department', { department_id: dept.id });
  const from = mark();
  const soup = await post(`/departments/${dept.id}/soup-base`, { soup_base: 'mala' });
  check('first participant picks the team soup base', () => eq(soup.body.department.soup_base, 'mala', 'soup base'));
  const soupPush = await waitPush(from, (s) => s.ev === 'update' && s.data.reason === 'soup_base');
  check('  └ it reaches the projector immediately', () => {
    if (!soupPush) throw new Error('soup base was not pushed');
  });

  const ings = (await get('/ingredients')).body.ingredients;
  let expected = 0;
  for (let n = 0; n < 5; n++) {
    const ing = ings[n % ings.length];
    const before = mark();
    const r = await post('/score', { department_id: dept.id, ingredient_id: ing.id });
    if (r.status !== 200) throw new Error(`scoring failed with ${r.status}`);
    expected += ing.point_value;
    const up = await waitPush(before, (s) => s.ev === 'update' && s.data.reason === 'score');
    if (!up) throw new Error('a score was not pushed to the display');
  }
  const row = (await get('/leaderboard')).body.leaderboard.find((d) => d.id === dept.id);
  check('5 tosses add up to the right total', () => eq(row.score, expected, 'score'));
  check('the team toss count is right', () => eq(row.tosses, 5, 'tosses'));

  const sixth = await post('/score', { department_id: dept.id, ingredient_id: ings[0].id });
  check('a 6th toss is NOT blocked (5-per-player is managed onsite, PRD 3)', () => eq(sixth.status, 200, 'status'));

  const pot = (await get('/leaderboard')).body.pot;
  check('ingredients drop into the virtual pot automatically', () => {
    if (!pot.some((p) => p.department_id === dept.id)) throw new Error('nothing from this team in the pot');
  });

  const relock = await post(`/departments/${dept.id}/soup-base`, { soup_base: 'laksa' });
  check('soup base cannot be changed once chosen', () => eq(relock.body.error.code, 'SOUP_BASE_LOCKED', 'error code'));
}

console.log('\n\x1b[1m3. When the operator makes a mistake\x1b[0m  (PRD 7.3)');
{
  const scoreNow = async () =>
    (await get('/leaderboard')).body.leaderboard.find((d) => d.id === dept.id).score;

  // The organiser double-taps an ingredient. They must be able to fix that
  // entry directly, not only the most recent one.
  const log = (await get(`/score-events?limit=10&department_id=${dept.id}`)).body.events;
  const older = log[2];
  const before = await scoreNow();
  const swap = await post(`/score/${older.id}/replace`, { ingredient_id: 'ing_1' });
  check('a mis-tapped ingredient can be swapped, even a few tosses back', () => {
    eq(swap.status, 200, 'status');
    eq(swap.body.event.ingredient_name, 'Broccoli', 'ingredient changed');
  });
  // Resolve every await BEFORE check(): check() is synchronous and does not
  // await, so an async body's assertion would never run and would count as a
  // pass regardless of the result.
  const afterSwap = await scoreNow();
  check('  └ the score moves by exactly the difference', () =>
    eq(afterSwap - before, 10 - older.points_awarded, 'delta'));

  const removed = await post(`/score/${older.id}/void`);
  const afterRemove = await scoreNow();
  check('a toss can be removed outright', () => eq(removed.status, 200, 'status'));
  check('  └ and its points come off the total', () => eq(afterRemove, afterSwap - 10, 'score'));

  const putBack = await post(`/score/${older.id}/restore`);
  const afterRestore = await scoreNow();
  check('a removal is itself reversible', () => eq(putBack.status, 200, 'status'));
  check('  └ the points come back', () => eq(afterRestore, afterSwap, 'score'));
  const bad = await post('/score', { department_id: 'dept_nope', ingredient_id: 'ing_1' });
  check('a mistyped request fails safely with a readable message', () => {
    eq(bad.status, 404, 'status');
    if (!bad.body.error?.message) throw new Error('no human-readable message');
  });
}

console.log('\n\x1b[1m4. Changing the department list mid-event\x1b[0m  (PRD 4.1, 8.2)');
{
  const tmp = (await post('/departments', { name: 'Temporary Team' })).body.department;
  const ren = await req('PUT', `/departments/${tmp.id}`, { name: 'Renamed Team' });
  check('a department can be renamed live', () => eq(ren.status, 200, 'status'));
  const del = await req('DELETE', `/departments/${tmp.id}`);
  check('an unscored department can be removed live', () => eq(del.body.deleted, true, 'deleted'));

  const blocked = await req('DELETE', `/departments/${dept.id}`);
  check('deleting a department that has SCORED is refused', () => {
    eq(blocked.status, 409, 'status');
    eq(blocked.body.error.code, 'DEPARTMENT_HAS_SCORE', 'error code');
  });
  const still = (await get('/leaderboard')).body.leaderboard.find((d) => d.id === dept.id);
  check('  └ its points survived the refused delete', () => {
    if (!still) throw new Error('the department disappeared');
  });
  const archived = await req('DELETE', `/departments/${dept.id}?archive=1`);
  check('it can be archived instead, keeping its history', () => eq(archived.body.archived, true, 'archived'));

  const state = (await get('/state')).body;
  const banked = state.archived.find((d) => d.id === dept.id);
  check('an archived department is listed for restore, with its points', () => {
    if (!banked) throw new Error('not offered for restore');
    if (banked.score <= 0) throw new Error('its points were lost');
  });
  const back = await post(`/departments/${dept.id}/restore`);
  check('an accidental archive can be undone in one step', () => {
    eq(back.status, 200, 'status');
    eq(back.body.department.archived, false, 'archived flag');
    eq(back.body.department.score, banked.score, 'score restored exactly');
  });
  const onBoard = (await get('/leaderboard')).body.leaderboard.some((d) => d.id === dept.id);
  check('  └ and it is back on the leaderboard', () => {
    if (!onBoard) throw new Error('still missing from the leaderboard');
  });
}

console.log('\n\x1b[1m5. The crowd-facing screen\x1b[0m  (PRD 7.4)');
{
  const lb = (await get('/leaderboard')).body;
  const active = (await get('/departments')).body.departments.length;
  check(`every active department is shown (${active}) — no top-N cutoff`, () =>
    eq(lb.leaderboard.length, active, 'leaderboard length'));
  check('the board is sorted by score, highest first', () => {
    const s = lb.leaderboard.map((d) => d.score);
    for (let i = 1; i < s.length; i++) if (s[i] > s[i - 1]) throw new Error('out of order');
  });
}

console.log('\n\x1b[1m6. A tie for first place\x1b[0m  (PRD 4.4, 7.4)');
{
  const a = (await post('/departments', { name: 'Tie One' })).body.department;
  const b = (await post('/departments', { name: 'Tie Two' })).body.department;
  const ings = (await get('/ingredients')).body.ingredients;
  const big = ings.reduce((m, i) => (i.point_value > m.point_value ? i : m));
  const top = (await get('/leaderboard')).body.leaderboard[0].score;
  const rounds = Math.floor(top / big.point_value) + 1;
  for (const d of [a, b]) {
    for (let n = 0; n < rounds; n++) await post('/score', { department_id: d.id, ingredient_id: big.id });
  }
  const lb = (await get('/leaderboard')).body.leaderboard;
  const winners = lb.filter((d) => d.is_leader);
  check('BOTH tied departments are marked as winners', () => eq(winners.length, 2, 'winner count'));
  check('  └ they share rank 1', () => eq(winners.map((w) => w.rank), [1, 1], 'ranks'));
  check('  └ no arbitrary tiebreaker was applied', () => eq(winners[0].score, winners[1].score, 'scores'));

  const from = mark();
  await post('/announce', { announced: true });
  const push = await waitPush(from, (s) => s.ev === 'update' && s.data.reason === 'announce');
  check('announcing the winner reaches the projector', () => {
    if (!push) throw new Error('announcement was not pushed');
    eq(push.data.announced, true, 'announced flag');
  });
  await post('/announce', { announced: false });
}

console.log('\n\x1b[1m7. A full hour of peak rush\x1b[0m  (PRD 5, 7.6)');
{
  const deps = (await get('/departments')).body.departments;
  const ings = (await get('/ingredients')).body.ingredients;
  const N = 250; // the top of the PRD's estimated 200-250 actions/hour
  const t0 = Date.now();
  for (let n = 0; n < N; n++) {
    await post('/score', { department_id: deps[n % deps.length].id, ingredient_id: ings[n % ings.length].id });
  }
  const per = (Date.now() - t0) / N;
  check(`${N} scoring actions stay well inside the 1s response target`, () => {
    if (per > 50) throw new Error(`${per.toFixed(1)}ms per action is too slow`);
  });
  console.log(`      \x1b[2m${per.toFixed(1)}ms per scoring action\x1b[0m`);
  const h = (await get('/health')).body;
  check('server is still healthy afterwards', () => eq(h.ok, true, 'ok'));
  check('durability net is armed (journal + snapshots)', () => {
    if (!h.durability?.journal) throw new Error('no journal path reported');
  });
}

const total = pass + fail;
console.log(
  fail === 0
    ? `\n\x1b[32m\x1b[1m✓ Ready for the event\x1b[0m — ${pass}/${total} checks passed\n`
    : `\n\x1b[31m\x1b[1m✗ ${fail} check${fail === 1 ? '' : 's'} failed\x1b[0m — ${pass}/${total} passed. Do not run the event until these are fixed.\n`
);
cleanup();
process.exit(fail === 0 ? 0 : 1);
