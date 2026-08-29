// Shared API client for both screens. Implements api-contract.md v1.0.
const BASE = '/api';

export class ApiError extends Error {
  constructor(code, message, status) {
    super(message);
    this.code = code;
    this.status = status;
  }
}

async function request(method, path, body) {
  let res;
  try {
    res = await fetch(BASE + path, {
      method,
      headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
      body: body === undefined ? undefined : JSON.stringify(body),
    });
  } catch {
    throw new ApiError('OFFLINE', 'Cannot reach the server. Is it still running?', 0);
  }
  const data = await res.json().catch(() => ({}));
  if (!res.ok) {
    const e = data.error ?? {};
    throw new ApiError(e.code ?? 'INTERNAL', e.message ?? 'Something went wrong.', res.status);
  }
  return data;
}

export const api = {
  state: () => request('GET', '/state'),
  leaderboard: () => request('GET', '/leaderboard'),
  departments: () => request('GET', '/departments'),
  ingredients: () => request('GET', '/ingredients'),

  addDepartment: (name) => request('POST', '/departments', { name }),
  renameDepartment: (id, name) => request('PUT', `/departments/${encodeURIComponent(id)}`, { name }),
  removeDepartment: (id, { archive = false } = {}) =>
    request('DELETE', `/departments/${encodeURIComponent(id)}${archive ? '?archive=1' : ''}`),
  setSoupBase: (id, soup_base) =>
    request('POST', `/departments/${encodeURIComponent(id)}/soup-base`, { soup_base }),

  score: (department_id, ingredient_id) => request('POST', '/score', { department_id, ingredient_id }),
  announce: (announced = true) => request('POST', '/announce', { announced }),
  restoreDepartment: (id) => request('POST', `/departments/${encodeURIComponent(id)}/restore`),

  // Correcting the toss log — remove, restore or re-point any entry by id.
  scoreEvents: ({ limit = 50, departmentId = null, includeVoided = false } = {}) => {
    const p = new URLSearchParams({ limit: String(limit) });
    if (departmentId) p.set('department_id', departmentId);
    if (includeVoided) p.set('include_voided', '1');
    return request('GET', `/score-events?${p}`);
  },
  voidScore: (id) => request('POST', `/score/${encodeURIComponent(id)}/void`),
  restoreScore: (id) => request('POST', `/score/${encodeURIComponent(id)}/restore`),
  replaceScore: (id, ingredient_id) =>
    request('POST', `/score/${encodeURIComponent(id)}/replace`, { ingredient_id }),
  setActiveDepartment: (department_id) => request('POST', '/active-department', { department_id }),
};

/**
 * Live connection: SSE push, with a polling fallback that runs only while the
 * stream is down. Both paths deliver the same payload shape, so callers never
 * need to know which one is feeding them.
 */
export function connectLive({ onState, onUpdate, onStatus }) {
  let poll = null;
  let status = null;

  const setStatus = (next) => {
    if (next === status) return;
    status = next;
    onStatus?.(next);
  };

  const startPolling = () => {
    if (poll) return;
    poll = setInterval(async () => {
      try {
        onUpdate?.({ reason: 'poll', last_event: null, ...(await api.leaderboard()) });
        setStatus('polling');
      } catch {
        setStatus('offline');
      }
    }, 2000);
  };

  const stopPolling = () => {
    clearInterval(poll);
    poll = null;
  };

  const es = new EventSource(`${BASE}/events`);

  es.addEventListener('hello', (e) => {
    stopPolling();
    setStatus('live');
    onState?.(JSON.parse(e.data));
  });

  es.addEventListener('update', (e) => {
    stopPolling();
    setStatus('live');
    onUpdate?.(JSON.parse(e.data));
  });

  es.addEventListener('ping', () => setStatus('live'));

  // EventSource retries on its own (server sends retry: 3000). Polling covers
  // the gap in between so the projector never sits on a stale board.
  es.onerror = () => {
    setStatus('reconnecting');
    startPolling();
  };

  return {
    close() {
      stopPolling();
      es.close();
    },
  };
}
