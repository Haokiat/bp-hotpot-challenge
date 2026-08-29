// HTTP layer: JSON API under /api, SSE stream at /api/events, and the two
// static screens. Zero npm dependencies — node:http only.
import { createServer } from 'node:http';
import { readFile, stat } from 'node:fs/promises';
import { extname, join, normalize, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createStore, ApiError } from './store.js';

const here = dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = join(here, '..', 'frontend');
const PORT = Number(process.env.PORT ?? 3000);
const PING_MS = 25_000;

const store = createStore();

// ---------------------------------------------------------------- SSE ------
const clients = new Set();

function sse(res, eventName, data) {
  res.write(`event: ${eventName}\ndata: ${JSON.stringify(data)}\n\n`);
}

// Called after every mutation. reason drives what the display animates.
function broadcast(reason, lastEvent = null) {
  const payload = { reason, last_event: lastEvent, ...store.boardPayload() };
  for (const res of clients) {
    try {
      sse(res, 'update', payload);
    } catch {
      clients.delete(res);
    }
  }
}

setInterval(() => {
  const beat = { t: Date.now() };
  for (const res of clients) {
    try {
      sse(res, 'ping', beat);
    } catch {
      clients.delete(res);
    }
  }
}, PING_MS).unref();

// ------------------------------------------------------------- helpers -----
function sendJson(res, status, body) {
  const buf = Buffer.from(JSON.stringify(body));
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Content-Length': buf.length,
    'Cache-Control': 'no-store',
    'Access-Control-Allow-Origin': '*',
  });
  res.end(buf);
}

function sendError(res, err) {
  if (err instanceof ApiError) {
    return sendJson(res, err.status, { error: { code: err.code, message: err.message } });
  }
  console.error('[hotpot] unhandled:', err);
  return sendJson(res, 500, {
    error: { code: 'INTERNAL', message: 'Something went wrong on the server.' },
  });
}

async function readBody(req) {
  const chunks = [];
  let size = 0;
  for await (const chunk of req) {
    size += chunk.length;
    if (size > 64 * 1024) throw new ApiError(400, 'VALIDATION', 'Request body too large.');
    chunks.push(chunk);
  }
  if (!chunks.length) return {};
  try {
    return JSON.parse(Buffer.concat(chunks).toString('utf8'));
  } catch {
    throw new ApiError(400, 'VALIDATION', 'Request body must be valid JSON.');
  }
}

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.webp': 'image/webp',
  '.ico': 'image/x-icon',
};

async function serveStatic(res, relPath) {
  // normalize + prefix check keeps `..` from escaping the frontend directory.
  const full = join(PUBLIC_DIR, normalize(relPath).replace(/^(\.\.[/\\])+/, ''));
  if (!full.startsWith(PUBLIC_DIR)) return sendJson(res, 404, notFoundBody());
  try {
    const info = await stat(full);
    if (!info.isFile()) throw new Error('not a file');
    const body = await readFile(full);
    res.writeHead(200, {
      'Content-Type': MIME[extname(full)] ?? 'application/octet-stream',
      'Content-Length': body.length,
      'Cache-Control': 'no-cache',
    });
    res.end(body);
  } catch {
    sendJson(res, 404, notFoundBody());
  }
}

const notFoundBody = () => ({ error: { code: 'NOT_FOUND', message: 'Not found.' } });

// -------------------------------------------------------------- routes -----
async function handleApi(req, res, url) {
  const path = url.pathname.replace(/^\/api/, '') || '/';
  const method = req.method;
  const seg = path.split('/').filter(Boolean); // e.g. ['departments','dept_1','soup-base']

  // --- SSE -----------------------------------------------------------------
  if (method === 'GET' && path === '/events') {
    res.writeHead(200, {
      'Content-Type': 'text/event-stream; charset=utf-8',
      'Cache-Control': 'no-cache, no-transform',
      Connection: 'keep-alive',
      'Access-Control-Allow-Origin': '*',
      'X-Accel-Buffering': 'no',
    });
    res.write('retry: 3000\n\n');
    sse(res, 'hello', store.state());
    clients.add(res);
    req.on('close', () => clients.delete(res));
    return;
  }

  if (method === 'GET' && path === '/state') return sendJson(res, 200, store.state());
  if (method === 'GET' && path === '/health') {
    return sendJson(res, 200, {
      ok: true,
      uptime_s: Math.round(process.uptime()),
      clients: clients.size,
      durability: {
        journal: store.journal.path,
        snapshots: store.snapshots.status(),
      },
    });
  }
  if (method === 'GET' && path === '/ingredients') {
    return sendJson(res, 200, { ingredients: store.listIngredients() });
  }
  if (method === 'GET' && path === '/soup-bases') {
    return sendJson(res, 200, { soup_bases: store.soupBases() });
  }
  if (method === 'GET' && path === '/leaderboard') {
    return sendJson(res, 200, store.boardPayload());
  }

  // --- departments ---------------------------------------------------------
  if (seg[0] === 'departments' && seg.length === 1) {
    if (method === 'GET') {
      const includeArchived = url.searchParams.get('include_archived') === '1';
      return sendJson(res, 200, { departments: store.listDepartments(includeArchived) });
    }
    if (method === 'POST') {
      const body = await readBody(req);
      const department = store.addDepartment(body.name);
      broadcast('department');
      return sendJson(res, 201, { department });
    }
  }

  if (seg[0] === 'departments' && seg.length === 2) {
    const id = decodeURIComponent(seg[1]);
    if (method === 'PUT') {
      const body = await readBody(req);
      const department = store.renameDepartment(id, body.name);
      broadcast('department');
      return sendJson(res, 200, { department });
    }
    if (method === 'DELETE') {
      const archive = url.searchParams.get('archive') === '1';
      const result = store.removeDepartment(id, { archive });
      broadcast('department');
      return sendJson(res, 200, result);
    }
  }

  if (seg[0] === 'departments' && seg[2] === 'restore' && method === 'POST') {
    const department = store.restoreDepartment(decodeURIComponent(seg[1]));
    broadcast('department');
    return sendJson(res, 200, { department });
  }

  if (seg[0] === 'departments' && seg[2] === 'soup-base' && method === 'POST') {
    const body = await readBody(req);
    const department = store.setSoupBase(decodeURIComponent(seg[1]), body.soup_base);
    broadcast('soup_base');
    return sendJson(res, 200, { department });
  }

  // --- scoring -------------------------------------------------------------
  if (path === '/score' && method === 'POST') {
    const body = await readBody(req);
    const { event, department } = store.logScore(body.department_id, body.ingredient_id);
    broadcast('score', event);
    return sendJson(res, 200, { event, department, leaderboard: store.leaderboard() });
  }

  // Which team is at the booth. Sent by the admin on every department tap so
  // the display flips before that team has tossed anything.
  if (path === '/active-department' && method === 'POST') {
    const body = await readBody(req);
    const result = store.setActiveDepartment(body.department_id ?? null);
    broadcast('active_department');
    return sendJson(res, 200, result);
  }

  if (path === '/announce' && method === 'POST') {
    const body = await readBody(req);
    const result = store.setAnnounced(body.announced !== false);
    broadcast('announce');
    return sendJson(res, 200, result);
  }

  // The toss log the admin corrects from.
  if (method === 'GET' && path === '/score-events') {
    return sendJson(res, 200, {
      events: store.listScoreEvents({
        limit: url.searchParams.get('limit') ?? 50,
        departmentId: url.searchParams.get('department_id'),
        includeVoided: url.searchParams.get('include_voided') === '1',
      }),
    });
  }

  // Correcting ONE entry by id. seg is ['score', '<id>', '<action>'].
  if (seg[0] === 'score' && seg.length === 3 && method === 'POST') {
    const eventId = decodeURIComponent(seg[1]);
    if (seg[2] === 'void') {
      const r = store.voidScoreEvent(eventId);
      broadcast('score_edit');
      return sendJson(res, 200, { ...r, leaderboard: store.leaderboard() });
    }
    if (seg[2] === 'restore') {
      const r = store.restoreScoreEvent(eventId);
      broadcast('score_edit');
      return sendJson(res, 200, { ...r, leaderboard: store.leaderboard() });
    }
    if (seg[2] === 'replace') {
      const body = await readBody(req);
      const r = store.replaceScoreEvent(eventId, body.ingredient_id);
      broadcast('score_edit');
      return sendJson(res, 200, { ...r, leaderboard: store.leaderboard() });
    }
  }

  return sendJson(res, 404, notFoundBody());
}

const server = createServer(async (req, res) => {
  const url = new URL(req.url, `http://${req.headers.host ?? 'localhost'}`);

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    });
    return res.end();
  }

  try {
    // Boundary matters: `/api.js` is a static asset, not an API route.
    if (url.pathname === '/api' || url.pathname.startsWith('/api/')) {
      return await handleApi(req, res, url);
    }

    if (url.pathname === '/') {
      res.writeHead(302, { Location: '/admin' });
      return res.end();
    }
    if (url.pathname === '/admin') return await serveStatic(res, 'admin.html');
    if (url.pathname === '/display') return await serveStatic(res, 'display.html');
    return await serveStatic(res, url.pathname);
  } catch (err) {
    sendError(res, err);
  }
});

// Ctrl+C / kill: take a final snapshot and flush the journal before exiting.
// (A hard SIGKILL or power cut is already covered — synchronous=FULL means
// every acknowledged score is on disk before the API responds.)
let closing = false;
for (const sig of ['SIGINT', 'SIGTERM']) {
  process.on(sig, () => {
    if (closing) process.exit(0);
    closing = true;
    console.log('\n  Saving and shutting down…');
    try { store.close(); } catch (err) { console.error('  close failed:', err.message); }
    process.exit(0);
  });
}

// A single unexpected throw must never take the booth offline mid-event.
process.on('uncaughtException', (err) => console.error('[hotpot] uncaught:', err));
process.on('unhandledRejection', (err) => console.error('[hotpot] unhandled rejection:', err));

server.headersTimeout = 0;
server.requestTimeout = 0;
server.keepAliveTimeout = 0; // SSE streams must never be reaped

// Startup failures must be loud and fatal. Without this the uncaughtException
// handler below would swallow EADDRINUSE, leaving the organiser with a process
// that looks alive but serves nothing.
server.on('error', (err) => {
  if (err.code === 'EADDRINUSE') {
    console.error(`\n  ✗ Port ${PORT} is already in use.`);
    console.error('    The server is probably already running — open http://localhost:' + PORT + '/admin');
    console.error(`    To restart it, stop the other one first, or run: PORT=3001 npm start\n`);
  } else {
    console.error('\n  ✗ Server failed to start:', err.message, '\n');
  }
  process.exit(1);
});

server.listen(PORT, () => {
  console.log(`\n  🍲 Hotpot Challenge server running`);
  console.log(`     Admin   → http://localhost:${PORT}/admin`);
  console.log(`     Display → http://localhost:${PORT}/display`);
  console.log(`     Scores are saved to disk on every action, with a journal and rolling snapshots.\n`);
});
