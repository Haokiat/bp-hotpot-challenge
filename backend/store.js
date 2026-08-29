// All business rules live here. server.js only does HTTP; this module owns the
// data. Every function is synchronous — node:sqlite is a sync API, and at
// ~250 actions/hour there is no reason to add async complexity.
import { connect, nextCounter, DB_PATH } from './db.js';
import { INGREDIENTS, DEPARTMENTS, SOUP_BASES } from './seed.js';
import { createJournal, startSnapshots } from './durability.js';
import { dirname } from 'node:path';

const POT_SIZE = 40; // how many recent ingredients the virtual hotpot shows
const MAX_NAME = 60;

export class ApiError extends Error {
  constructor(status, code, message) {
    super(message);
    this.status = status;
    this.code = code;
  }
}

const badRequest = (m) => new ApiError(400, 'VALIDATION', m);
const notFound = (m = 'Not found.') => new ApiError(404, 'NOT_FOUND', m);

export function createStore(path) {
  const db = connect(path);

  // In-memory stores (tests) get no-op durability — nothing to protect.
  const inMemory = path === ':memory:';
  const dataDir = inMemory ? null : dirname(path ?? DB_PATH);
  const journal = inMemory
    ? { append() {}, close() {}, path: null }
    : createJournal(dataDir);
  const snapshots = inMemory
    ? { markDirty() {}, take: () => ({ ok: true, reason: 'noop' }), status: () => ({}), stop() {}, dir: null }
    : startSnapshots(db, dataDir);

  // Every mutation is recorded to the append-only journal AND flags a snapshot.
  const record = (type, data) => { journal.append(type, data); snapshots.markDirty(); };

  seedIfEmpty(db, record);

  // ---- prepared statements (compiled once, reused for the whole event) ----
  const q = {
    deptById: db.prepare('SELECT * FROM departments WHERE id = ?'),
    deptsActive: db.prepare('SELECT * FROM departments WHERE archived = 0 ORDER BY name COLLATE NOCASE'),
    deptsAll: db.prepare('SELECT * FROM departments ORDER BY archived, name COLLATE NOCASE'),
    nameTaken: db.prepare(
      'SELECT id FROM departments WHERE archived = 0 AND lower(name) = lower(?) AND id != ?'
    ),
    insertDept: db.prepare(
      'INSERT INTO departments (id, name, score, soup_base, archived, created_at) VALUES (?, ?, 0, NULL, 0, ?)'
    ),
    renameDept: db.prepare('UPDATE departments SET name = ? WHERE id = ?'),
    deleteDept: db.prepare('DELETE FROM departments WHERE id = ?'),
    archiveDept: db.prepare('UPDATE departments SET archived = 1 WHERE id = ?'),
    unarchiveDept: db.prepare('UPDATE departments SET archived = 0, name = ? WHERE id = ?'),
    deptsArchived: db.prepare('SELECT * FROM departments WHERE archived = 1 ORDER BY name COLLATE NOCASE'),
    setSoup: db.prepare('UPDATE departments SET soup_base = ? WHERE id = ?'),
    bumpScore: db.prepare('UPDATE departments SET score = score + ? WHERE id = ?'),

    ingById: db.prepare('SELECT * FROM ingredients WHERE id = ?'),
    ingAll: db.prepare('SELECT * FROM ingredients ORDER BY sort_order'),

    insertEvent: db.prepare(
      'INSERT INTO score_events (id, department_id, ingredient_id, points_awarded, timestamp, voided, seq) VALUES (?, ?, ?, ?, ?, 0, ?)'
    ),
    // Still used by currentTeamId(): with no team selected, the pot follows
    // whoever tossed most recently.
    lastLiveEvent: db.prepare(
      'SELECT * FROM score_events WHERE voided = 0 ORDER BY seq DESC LIMIT 1'
    ),
    voidEvent: db.prepare('UPDATE score_events SET voided = 1 WHERE id = ?'),
    unvoidEvent: db.prepare('UPDATE score_events SET voided = 0 WHERE id = ?'),
    eventById: db.prepare(`
      SELECT e.*, d.name AS department_name, i.name AS ingredient_name, i.sprite
      FROM score_events e
      JOIN departments d ON d.id = e.department_id
      JOIN ingredients i ON i.id = e.ingredient_id
      WHERE e.id = ?
    `),
    repointEvent: db.prepare(
      'UPDATE score_events SET ingredient_id = ?, points_awarded = ? WHERE id = ?'
    ),
    // The toss log the admin corrects from. Joined so one call gives the UI
    // everything it needs to draw a row.
    eventsList: db.prepare(`
      SELECT e.id, e.department_id, e.ingredient_id, e.points_awarded,
             e.timestamp, e.voided, e.seq,
             d.name AS department_name, i.name AS ingredient_name, i.sprite
      FROM score_events e
      JOIN departments d ON d.id = e.department_id
      JOIN ingredients i ON i.id = e.ingredient_id
      WHERE (:dept IS NULL OR e.department_id = :dept)
        AND (:includeVoided = 1 OR e.voided = 0)
      ORDER BY e.seq DESC
      LIMIT :limit
    `),
    liveCount: db.prepare('SELECT COUNT(*) AS n FROM score_events WHERE voided = 0'),
    tossesByDept: db.prepare(
      'SELECT department_id, COUNT(*) AS n FROM score_events WHERE voided = 0 GROUP BY department_id'
    ),
    getSetting: db.prepare('SELECT value FROM settings WHERE key = ?'),
    putSetting: db.prepare('INSERT INTO settings (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value'),

    // The pot belongs to ONE team — the one at the booth — so it is scoped by
    // department. Scoping here rather than in the client matters: a global
    // window would drop a team's ingredients once enough other teams had
    // played, and their pot would look empty despite them having points.
    potRows: db.prepare(`
      SELECT e.id AS event_id, e.ingredient_id, e.department_id, i.name, i.sprite, d.soup_base
      FROM score_events e
      JOIN ingredients i ON i.id = e.ingredient_id
      JOIN departments d ON d.id = e.department_id
      WHERE e.voided = 0 AND d.archived = 0 AND e.department_id = ?
      ORDER BY e.seq DESC LIMIT ?
    `),
  };

  // ---- serialisers ----
  const dept = (r) =>
    r && {
      id: r.id,
      name: r.name,
      score: r.score,
      soup_base: r.soup_base,
      archived: r.archived === 1,
    };

  const ing = (r) =>
    r && { id: r.id, name: r.name, point_value: r.point_value, sprite: r.sprite };

  const event = (r) =>
    r && {
      id: r.id,
      department_id: r.department_id,
      ingredient_id: r.ingredient_id,
      ingredient_name: q.ingById.get(r.ingredient_id)?.name ?? null,
      points_awarded: r.points_awarded,
      timestamp: r.timestamp,
    };

  // ---- validation helpers ----
  function cleanName(raw, selfId = '') {
    if (typeof raw !== 'string') throw badRequest('`name` must be a string.');
    const name = raw.trim().replace(/\s+/g, ' ');
    if (!name) throw badRequest('`name` must not be empty.');
    if (name.length > MAX_NAME) throw badRequest(`\`name\` must be ${MAX_NAME} characters or fewer.`);
    if (q.nameTaken.get(name, selfId)) {
      throw new ApiError(409, 'NAME_TAKEN', `A department named "${name}" already exists.`);
    }
    return name;
  }

  function requireDept(id, { allowArchived = false } = {}) {
    const row = q.deptById.get(String(id ?? ''));
    if (!row) throw notFound('Unknown department.');
    if (row.archived === 1 && !allowArchived) throw notFound('Unknown department.');
    return row;
  }

  // ---- reads ----
  function listDepartments(includeArchived = false) {
    return (includeArchived ? q.deptsAll : q.deptsActive).all().map(dept);
  }

  function listIngredients() {
    return q.ingAll.all().map(ing);
  }

  // Competition ranking: ties share a rank and the next rank skips (1, 1, 3).
  // Every department on the top score is flagged is_leader — this is how the
  // "all tied departments win" rule (PRD 7.4) reaches the UI.
  function leaderboard() {
    const rows = q.deptsActive.all();
    const tosses = new Map(q.tossesByDept.all().map((r) => [r.department_id, r.n]));
    rows.sort((a, b) => b.score - a.score || a.name.localeCompare(b.name, undefined, { sensitivity: 'base' }));
    const top = rows.length ? rows[0].score : 0;
    let rank = 0;
    let prev = null;
    return rows.map((r, i) => {
      if (r.score !== prev) {
        rank = i + 1;
        prev = r.score;
      }
      return {
        id: r.id,
        name: r.name,
        score: r.score,
        soup_base: r.soup_base,
        tosses: tosses.get(r.id) ?? 0,
        rank,
        is_leader: top > 0 && r.score === top,
      };
    });
  }

  // Whose pot is on screen: the admin's selection, else whoever tossed last so
  // a display refresh mid-event is never blank. Mirrors the display's own
  // fallback, kept here so both agree.
  function currentTeamId() {
    return activeDepartmentId() ?? q.lastLiveEvent.get()?.department_id ?? null;
  }

  function pot() {
    const teamId = currentTeamId();
    if (!teamId) return [];
    // Query is newest-first for the LIMIT; the pot renders oldest-first.
    return q.potRows
      .all(teamId, POT_SIZE)
      .reverse()
      .map((r) => ({
        event_id: r.event_id,
        ingredient_id: r.ingredient_id,
        department_id: r.department_id,
        name: r.name,
        sprite: r.sprite,
        soup_base: r.soup_base,
      }));
  }

  // The winner reveal is admin-triggered, not automatic — the organiser calls
  // the moment out loud, then flips this (frontend brief: "triggered on
  // announcement"). Persisted so a display refresh keeps the reveal up.
  function isAnnounced() {
    return q.getSetting.get('announced')?.value === '1';
  }

  function setAnnounced(on) {
    q.putSetting.run('announced', on ? '1' : '0');
    record('announce', { announced: on });
    return { announced: on };
  }

  // Which team is physically at the booth right now. Set by the admin the
  // moment they pick a department, so the display flips before that team has
  // tossed anything. Persisted so a display refresh keeps it.
  function activeDepartmentId() {
    const id = q.getSetting.get('active_department')?.value || null;
    if (!id) return null;
    // A department that was archived or deleted is no longer "playing".
    const row = q.deptById.get(id);
    return row && row.archived === 0 ? id : null;
  }

  function setActiveDepartment(id) {
    if (id === null || id === '') {
      q.putSetting.run('active_department', '');
      record('active_department', { department_id: null });
      return { active_department_id: null };
    }
    const row = requireDept(id);
    q.putSetting.run('active_department', row.id);
    record('active_department', { department_id: row.id });
    return { active_department_id: row.id };
  }

  function boardPayload() {
    const board = leaderboard();
    return {
      leaderboard: board,
      total_score: board.reduce((s, d) => s + d.score, 0),
      total_tosses: q.liveCount.get().n,
      announced: isAnnounced(),
      active_department_id: activeDepartmentId(),
      pot_department_id: currentTeamId(),
      pot: pot(),
    };
  }

  function state() {
    return {
      departments: listDepartments(),
      archived: listArchived(),
      ingredients: listIngredients(),
      soup_bases: SOUP_BASES,
      ...boardPayload(),
    };
  }

  // ---- writes ----
  function addDepartment(name) {
    const clean = cleanName(name);
    const id = `dept_${nextCounter(db, 'dept')}`;
    q.insertDept.run(id, clean, new Date().toISOString());
    record('department_add', { department_id: id, name: clean });
    return dept(q.deptById.get(id));
  }

  function renameDepartment(id, name) {
    const row = requireDept(id);
    const clean = cleanName(name, row.id);
    q.renameDept.run(clean, row.id);
    record('department_rename', { department_id: row.id, from: row.name, to: clean });
    return dept(q.deptById.get(row.id));
  }

  // Score protection (PRD 8.2): a department that has scored is never hard
  // deleted, because its score events must stay intact for the history.
  function removeDepartment(id, { archive = false } = {}) {
    const row = requireDept(id);
    if (archive) {
      q.archiveDept.run(row.id);
      record('department_archive', { department_id: row.id, name: row.name, score: row.score });
      return { deleted: false, archived: true };
    }
    if (row.score > 0) {
      throw new ApiError(
        409,
        'DEPARTMENT_HAS_SCORE',
        `"${row.name}" has ${row.score} points. Archive it instead of deleting.`
      );
    }
    q.deleteDept.run(row.id);
    record('department_delete', { department_id: row.id, name: row.name });
    return { deleted: true, archived: false };
  }

  // Undo an archive. Archiving is the safe alternative to deleting a scored
  // department, but on a live booth it can still be a misclick — this puts the
  // team and every one of its points straight back on the leaderboard.
  function restoreDepartment(id) {
    const row = q.deptById.get(String(id ?? ''));
    if (!row) throw notFound('Unknown department.');
    if (row.archived === 0) {
      throw new ApiError(409, 'NOT_ARCHIVED', `"${row.name}" is already on the leaderboard.`);
    }
    // Another department may have taken the name while this one was away.
    // Never fail the restore over a name clash — the points matter more, so
    // suffix it and let the admin rename afterwards.
    let name = row.name;
    if (q.nameTaken.get(name, row.id)) {
      let n = 2;
      while (q.nameTaken.get(`${name} (${n})`, row.id)) n++;
      name = `${name} (${n})`;
    }
    q.unarchiveDept.run(name, row.id);
    record('department_restore', { department_id: row.id, name, score: row.score });
    return dept(q.deptById.get(row.id));
  }

  function listArchived() {
    return q.deptsArchived.all().map(dept);
  }

  function setSoupBase(id, soupBase) {
    const row = requireDept(id);
    if (row.soup_base !== null) {
      throw new ApiError(
        409,
        'SOUP_BASE_LOCKED',
        `"${row.name}" already chose ${row.soup_base}. Soup base cannot be changed.`
      );
    }
    if (!SOUP_BASES.some((s) => s.id === soupBase)) {
      throw badRequest(`\`soup_base\` must be one of: ${SOUP_BASES.map((s) => s.id).join(', ')}.`);
    }
    q.setSoup.run(soupBase, row.id);
    record('soup_base', { department_id: row.id, name: row.name, soup_base: soupBase });
    return dept(q.deptById.get(row.id));
  }

  function logScore(departmentId, ingredientId) {
    const d = requireDept(departmentId);
    const i = q.ingById.get(String(ingredientId ?? ''));
    if (!i) throw notFound('Unknown ingredient.');

    const id = `evt_${nextCounter(db, 'evt')}`;
    const seq = nextCounter(db, 'seq');
    // points_awarded snapshots the value at scoring time, so removing a toss
    // stays correct even if the ingredient list is edited afterwards.
    q.insertEvent.run(id, d.id, i.id, i.point_value, new Date().toISOString(), seq);
    q.bumpScore.run(i.point_value, d.id);
    record('score', {
      event_id: id, seq,
      department_id: d.id, department_name: d.name,
      ingredient_id: i.id, ingredient_name: i.name,
      points: i.point_value,
      score_after: q.deptById.get(d.id).score,
    });

    return {
      event: event(db.prepare('SELECT * FROM score_events WHERE id = ?').get(id)),
      department: dept(q.deptById.get(d.id)),
    };
  }

  const scoreEvent = (r) => ({
    id: r.id,
    department_id: r.department_id,
    department_name: r.department_name,
    ingredient_id: r.ingredient_id,
    ingredient_name: r.ingredient_name,
    sprite: r.sprite,
    points_awarded: r.points_awarded,
    timestamp: r.timestamp,
    voided: r.voided === 1,
  });

  /* ---- correcting the log -------------------------------------------------
     These three are the only way to correct a logged toss. During a live event
     the organiser mis-taps — a double tap, or the wrong ingredient noticed
     several players later — so any entry can be fixed by id.
     Nothing is ever hard-deleted: a voided event keeps its row, so a mis-tap on
     "remove" is itself reversible. */

  function listScoreEvents({ limit = 50, departmentId = null, includeVoided = false } = {}) {
    const n = Math.min(500, Math.max(1, Number(limit) || 50));
    return q.eventsList
      .all({ dept: departmentId ?? null, includeVoided: includeVoided ? 1 : 0, limit: n })
      .map(scoreEvent);
  }

  function requireEvent(id) {
    const row = q.eventById.get(String(id ?? ''));
    if (!row) throw notFound('Unknown score event.');
    return row;
  }

  function voidScoreEvent(id) {
    const row = requireEvent(id);
    if (row.voided === 1) {
      throw new ApiError(409, 'ALREADY_VOIDED', 'That toss has already been removed.');
    }
    q.voidEvent.run(row.id);
    q.bumpScore.run(-row.points_awarded, row.department_id);
    record('score_void', {
      event_id: row.id, department_id: row.department_id, points: row.points_awarded,
    });
    return { event: scoreEvent({ ...row, voided: 1 }) };
  }

  function restoreScoreEvent(id) {
    const row = requireEvent(id);
    if (row.voided === 0) {
      throw new ApiError(409, 'NOT_VOIDED', 'That toss is already counted.');
    }
    // The department must still be able to hold the points.
    requireDept(row.department_id, { allowArchived: true });
    q.unvoidEvent.run(row.id);
    q.bumpScore.run(row.points_awarded, row.department_id);
    record('score_unvoid', {
      event_id: row.id, department_id: row.department_id, points: row.points_awarded,
    });
    return { event: scoreEvent({ ...row, voided: 0 }) };
  }

  // Swap an entry's ingredient in place. The row keeps its id, its position in
  // the sequence and its timestamp, so ordering and the pot are unchanged —
  // only the ingredient and the points move.
  function replaceScoreEvent(id, ingredientId) {
    const row = requireEvent(id);
    if (row.voided === 1) {
      throw new ApiError(409, 'ALREADY_VOIDED', 'Restore that toss before you change it.');
    }
    const ing = q.ingById.get(String(ingredientId ?? ''));
    if (!ing) throw notFound('Unknown ingredient.');

    const delta = ing.point_value - row.points_awarded;
    q.repointEvent.run(ing.id, ing.point_value, row.id);
    if (delta !== 0) q.bumpScore.run(delta, row.department_id);
    record('score_replace', {
      event_id: row.id,
      department_id: row.department_id,
      from_ingredient_id: row.ingredient_id,
      to_ingredient_id: ing.id,
      from_points: row.points_awarded,
      to_points: ing.point_value,
    });
    return { event: scoreEvent({ ...row, ingredient_id: ing.id, points_awarded: ing.point_value,
      ingredient_name: ing.name, sprite: ing.sprite, voided: 0 }) };
  }

  return {
    db,
    listDepartments,
    listIngredients,
    soupBases: () => SOUP_BASES,
    leaderboard,
    boardPayload,
    state,
    addDepartment,
    renameDepartment,
    removeDepartment,
    restoreDepartment,
    listArchived,
    setSoupBase,
    logScore,
    listScoreEvents,
    voidScoreEvent,
    restoreScoreEvent,
    replaceScoreEvent,
    isAnnounced,
    setAnnounced,
    activeDepartmentId,
    setActiveDepartment,
    journal,
    snapshots,
    close: () => { snapshots.stop(); journal.close(); db.close(); },
  };
}

function seedIfEmpty(db, record = () => {}) {
  const hasIng = db.prepare('SELECT COUNT(*) AS n FROM ingredients').get().n > 0;
  if (!hasIng) {
    INGREDIENTS.forEach((row, idx) => {
      const id = `ing_${nextCounter(db, 'ing')}`;
      if (!Number.isInteger(row.point_value) || row.point_value <= 0) {
        throw new Error(`seed.js: "${row.name}" needs a positive integer point_value.`);
      }
      db.prepare(
        'INSERT INTO ingredients (id, name, point_value, sprite, sort_order) VALUES (?, ?, ?, ?, ?)'
      ).run(id, row.name, row.point_value, row.sprite ?? null, idx);
      record('seed_ingredient', { ingredient_id: id, name: row.name, point_value: row.point_value, sprite: row.sprite ?? null, sort_order: idx });
    });
  }

  const hasDept = db.prepare('SELECT COUNT(*) AS n FROM departments').get().n > 0;
  if (!hasDept) {
    for (const name of DEPARTMENTS) {
      const id = `dept_${nextCounter(db, 'dept')}`;
      db.prepare(
        'INSERT INTO departments (id, name, score, soup_base, archived, created_at) VALUES (?, ?, 0, NULL, 0, ?)'
      ).run(id, name, new Date().toISOString());
      record('seed_department', { department_id: id, name });
    }
  }
}
