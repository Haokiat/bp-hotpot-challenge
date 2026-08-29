# Hotpot Challenge — API Contract v1.0 (LOCKED)

Source of truth for both the frontend and backend agents. Derived from the draft
contracts in `frontend/CLAUDE.md` and `backend/CLAUDE.md`, with request/response
shapes made concrete.

- **Base URL:** `http://localhost:3000/api`
- **Content type:** `application/json` on every request and response (except `GET /api/events`).
- **Auth:** none, on every endpoint. By design (PRD §4.3).
- **Real-time method:** **SSE push, with client-side polling fallback.** Agreed
  between agents. See §Real-time.

---

## Conventions

### IDs
Opaque strings. Departments use `dept_<n>`, ingredients `ing_<n>`, score events
`evt_<n>`. Clients must treat them as opaque and never parse them.

### Error envelope
Every non-2xx response has this exact shape:

```json
{ "error": { "code": "SOUP_BASE_LOCKED", "message": "Soup base is already set for this department." } }
```

| HTTP | `code` | Meaning |
|---|---|---|
| 400 | `VALIDATION` | Missing/invalid field. `message` names the field. |
| 404 | `NOT_FOUND` | Unknown department, ingredient, or route. |
| 409 | `SOUP_BASE_LOCKED` | Soup base already set; it cannot be changed. |
| 409 | `DEPARTMENT_HAS_SCORE` | Hard delete refused because `score > 0`. |
| 409 | `NAME_TAKEN` | Another active department already uses that name. |
| 409 | `NOT_ARCHIVED` | Restore was called on a department that is not archived. |
| 409 | `ALREADY_VOIDED` | The score event has already been removed. |
| 409 | `NOT_VOIDED` | Restore was called on a score event that is not removed. |
| 500 | `INTERNAL` | Unexpected server error. |

### Objects

**Department**
```json
{
  "id": "dept_1",
  "name": "Department A",
  "score": 45,
  "soup_base": "tomato",
  "archived": false
}
```
`soup_base` is `null` until set. `score` is always a non-negative integer.

**Ingredient**
```json
{ "id": "ing_1", "name": "Broccoli", "point_value": 10, "sprite": "broccoli" }
```
`sprite` selects the ingredient's artwork from `frontend/sprites.js`. It is
display-only and never affects scoring. It may be `null`, and an unrecognised
value is allowed — the frontend falls back to a generic ingredient rather than
rendering nothing, so the real ingredient list can be loaded before its artwork
exists.

**LeaderboardEntry**
```json
{
  "id": "dept_1",
  "name": "Department A",
  "score": 45,
  "soup_base": "tomato",
  "tosses": 3,
  "rank": 1,
  "is_leader": true
}
```
`tosses` is that department's count of un-voided score events. It is a true
total, unlike `pot[]`, which is windowed — the Display Screen's current-team
card needs the real figure.
`rank` is **competition-ranked**: tied departments share the same rank and the
next rank skips (1, 1, 3). `is_leader` is `true` for *every* department holding
the top score — this is how the tie rule (PRD §7.4) reaches the UI. When all
scores are 0, `is_leader` is `false` for everyone.

**ScoreEvent**
```json
{
  "id": "evt_12",
  "department_id": "dept_1",
  "ingredient_id": "ing_2",
  "ingredient_name": "Mushroom",
  "points_awarded": 15,
  "timestamp": "2026-08-27T03:14:07.221Z"
}
```
`points_awarded` is a snapshot of the ingredient's value at scoring time, so
removing or correcting a toss stays right even if the ingredient list is
edited later.

---

## Endpoints

### `GET /api/departments`
Active departments, ordered by name.

`200` → `{ "departments": [Department, ...] }`

Archived departments are excluded. Add `?include_archived=1` to include them.
`GET /api/state` also returns them separately as `archived`, which is what the
Admin Screen's restore panel lists.

---

### `POST /api/departments`
Request: `{ "name": "Department D" }` — required, non-empty after trim, max 60 chars,
must be unique among active departments (case-insensitive).

`201` → `{ "department": Department }` (new department starts at `score: 0`, `soup_base: null`)
`400 VALIDATION` · `409 NAME_TAKEN`

---

### `PUT /api/departments/:id`
Request: `{ "name": "New Name" }` — same validation as create. Renaming never
affects score or soup base.

`200` → `{ "department": Department }`
`400 VALIDATION` · `404 NOT_FOUND` · `409 NAME_TAKEN`

---

### `DELETE /api/departments/:id`
Score-protection rule (PRD §8.2, backend brief):

- `score == 0` → hard delete.
- `score > 0` → **refused** with `409 DEPARTMENT_HAS_SCORE`. The client may retry
  with `?archive=1` to archive instead.
- `?archive=1` → always archives (`archived: true`), never deletes. Archived
  departments disappear from `/departments`, `/leaderboard`, and the SSE
  payload, but their score events are retained.

`200` → `{ "deleted": true, "archived": false }` or `{ "deleted": false, "archived": true }`
`404 NOT_FOUND` · `409 DEPARTMENT_HAS_SCORE`

---

### `POST /api/departments/:id/restore`
Undoes an archive, putting the department back on the leaderboard with every
point it had. Archiving is the safe alternative to deleting a scored
department, but on a live booth it can still be a misclick — this is the way
back.

`200` → `{ "department": Department }`
`404 NOT_FOUND` · `409 NOT_ARCHIVED`

If another department has taken the name in the meantime, the restore still
succeeds and the name is suffixed (`Finance (2)`) rather than being refused —
the points matter more than the label, and the admin can rename afterwards.

---

### `GET /api/ingredients`
`200` → `{ "ingredients": [Ingredient, ...] }` — ordered as configured (seed order).

---

### `POST /api/score`
The hot path. Logs one successful toss.

Request: `{ "department_id": "dept_1", "ingredient_id": "ing_2" }`

Adds `ingredient.point_value` to the department total, writes a ScoreEvent, and
pushes an SSE `update`.

`200` →
```json
{
  "event": ScoreEvent,
  "department": Department,
  "leaderboard": [LeaderboardEntry, ...]
}
```
Returning the leaderboard inline saves the admin screen a second round trip.

`400 VALIDATION` · `404 NOT_FOUND` (unknown department or ingredient; archived
departments are rejected as `NOT_FOUND`)

---

### `GET /api/score-events`
The toss log, newest first. This is what the Admin Screen's Recent strip and
its full history are built from.

Query: `limit` (default 50, max 500), `department_id`, `include_voided=1`.

`200` → `{ "events": [ScoreEvent, ...] }` — each row carries `department_name`,
`ingredient_name`, `sprite` and `voided`, so one call is enough to draw it.

---

### `POST /api/score/:eventId/void`
Removes one toss and subtracts its points. Reaches **any** entry by id.

`200` → `{ "event": ScoreEvent, "leaderboard": [...] }`
`404 NOT_FOUND` · `409 ALREADY_VOIDED`

The row is retained, never deleted, so this is reversible.

---

### `POST /api/score/:eventId/restore`
Puts a removed toss back and returns its points.

`200` → `{ "event": ScoreEvent, "leaderboard": [...] }`
`404 NOT_FOUND` · `409 NOT_VOIDED`

---

### `POST /api/score/:eventId/replace`
Swaps a mis-tapped ingredient. Request: `{ "ingredient_id": "ing_2" }`

The score moves by the difference between the two point values. The event keeps
its id, its place in the sequence and its timestamp — only the ingredient and
the points change, so ordering and the pot are undisturbed.

`200` → `{ "event": ScoreEvent, "leaderboard": [...] }`
`404 NOT_FOUND` · `409 ALREADY_VOIDED` (restore it first)

---

### `POST /api/departments/:id/soup-base`
Request: `{ "soup_base": "tomato" }`

Allowed values: `"tomato"`, `"mala"`, `"herbal"`, `"laksa"`. Also served by
`GET /api/soup-bases` so the frontend never hardcodes the list.

Write-once. Any later call — even with the same value — returns `409 SOUP_BASE_LOCKED`.
Visual only; never affects scoring.

`200` → `{ "department": Department }`
`400 VALIDATION` · `404 NOT_FOUND` · `409 SOUP_BASE_LOCKED`

---

### `GET /api/soup-bases`
`200` → `{ "soup_bases": [ { "id": "tomato", "name": "Tomato", "color": "#E8547A" }, ... ] }`

---

### `GET /api/leaderboard`
`200` →
```json
{
  "leaderboard": [LeaderboardEntry, ...],
  "total_score": 120,
  "total_tosses": 9,
  "announced": false,
  "active_department_id": "dept_1",
  "pot_department_id": "dept_1",
  "pot": [ { "ingredient_id": "ing_2", "department_id": "dept_1", "name": "Mushroom", "sprite": "mushroom", "event_id": "evt_12", "soup_base": "tomato" }, ... ]
}
```
Sorted by `score` descending, then `name` ascending for stable rendering.
`total_tosses` counts un-voided events. `announced` reflects `POST /api/announce`.

`pot` is what the virtual hotpot renders: the last 40 un-voided ingredients
**belonging to a single department**, oldest first. That department is reported
as `pot_department_id` — the active department, or whoever tossed most recently
if none is set. It is empty when no team has been selected and nothing has been
tossed, so a team on zero starts with an empty pot that fills as they play.

Scoping is done server-side deliberately: a global window would drop a team's
ingredients once enough other teams had played, leaving their pot looking empty
even though they had points.

---

### `POST /api/active-department`
Marks which team is physically at the booth right now. The Admin Screen sends
this on every department tap, so the Display Screen's score card flips to that
team *before* they have tossed anything.

Request: `{ "department_id": "dept_1" }` — send `null` to clear.

`200` → `{ "active_department_id": "dept_1" }`

Persisted, so a display refresh keeps it. Reads back as `null` if that
department is later archived or deleted. The admin sends this fire-and-forget:
a failure must never block scoring, it only leaves the display's card stale.

---

### `POST /api/announce`
Triggers (or clears) the winner reveal on the Display Screen. The organiser calls
the result out loud, then presses the button — the reveal is deliberately manual,
never automatic on a score change.

Request: `{ "announced": true }` (omit or send `true` to announce; `false` clears
the reveal so the game can carry on).

`200` → `{ "announced": true }`

The flag is persisted, so refreshing the Display Screen keeps the reveal up. On
announce, the Display Screen shows the final hotpot image once, for every
department flagged `is_leader` — all of them on a tie.

---

### `GET /api/state`
One-shot bootstrap so a screen can load with a single request.

`200` → `{ "departments": [...], "archived": [...], "ingredients": [...], "soup_bases": [...], "leaderboard": [...], "total_score": 0, "total_tosses": 0, "announced": false, "active_department_id": null, "pot": [...] }`

`archived` holds every archived department with its score, so the Admin Screen
can offer a one-tap restore.

---

## Real-time

### `GET /api/events` — Server-Sent Events
`Content-Type: text/event-stream`. The server sends a `retry: 3000` directive so
browsers auto-reconnect after ~3s.

Events:

| `event:` | When | `data:` |
|---|---|---|
| `hello` | Immediately on connect | Same shape as `GET /api/state` |
| `update` | After every mutation | Same shape as `GET /api/leaderboard`, plus `"reason"` and `"last_event"` |
| `ping` | Every 25s | `{ "t": 1724731200000 }` — keeps proxies from closing the stream |

`update` payload:
```json
{
  "reason": "score",
  "last_event": ScoreEvent,
  "leaderboard": [...],
  "total_score": 120,
  "total_tosses": 9,
  "pot": [...]
}
```
`reason` is one of `score`, `score_edit`, `department`, `soup_base`, `announce`,
`active_department`. `last_event` is
the ScoreEvent for `reason: "score"` (used to trigger the drop animation), and
`null` otherwise.

### Polling fallback
The Display Screen polls `GET /api/leaderboard` every 2000ms **whenever the SSE
stream is not in `readyState: OPEN`**, and stops polling once SSE reconnects.
This is the entire "no offline mode, but degrade gracefully" story — no extra
server work needed, since both paths return the same shape.

---

## Static routes (same server, not under `/api`)

| Path | Serves |
|---|---|
| `/` | Redirect → `/admin` |
| `/admin` | Admin Screen (laptop) |
| `/display` | Display Screen (projector) |

---

## Out of scope — deliberately absent

No participant endpoints, no missed-toss logging, no negative points, no
end-of-game endpoint, no export/reporting, no session reset, no offline sync.
