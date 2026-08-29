# Running the Hotpot Challenge app

## Start it

```bash
cd "hotpot-challenge" && npm start
```

That's it — **no `npm install`**. The backend uses only Node's built-in modules
(`node:http`, `node:sqlite`), so there is nothing to download or compile on the
booth laptop. Requires **Node 22.5 or newer** (`node --version`).

| Screen | URL | Where it goes |
|---|---|---|
| Admin | http://localhost:3000/admin | The organiser's laptop |
| Display | http://localhost:3000/display | The projector / large screen |

Open the display on the projector as a second browser window (the admin screen
has an **Open display ↗** button), then put it full-screen with `F11` /
`Cmd+Ctrl+F`.

Both screens work entirely on the laptop over `localhost` — **the app keeps
running even if venue WiFi drops**, which covers the risk flagged in PRD §8.1.
The only external request is the Google Fonts stylesheet; load each screen once
before the event so the fonts cache, and there are system fallbacks regardless.

---

## Operating it during the event

1. Tap the **department**.
2. On that department's first toss only, tap a **soup base** (visual only, locks after).
3. Tap the **ingredient** that was tossed. Points apply immediately — there is no confirm step.

**Shortcuts:** keys `1`–`9` fire ingredients.

**To fix a mistake**, tap the toss in the **Recent** strip at the bottom of the
admin screen — remove it, or swap it for the right ingredient. "View all" opens
the full log if the mistake was several players ago. A removed toss can be
restored, so nothing is lost.

**Announce winner** sits in the top bar, always in reach. It names the winning
department before it fires, so you can check it is the right one, then reveals
the final hotpot on the display — for all of them on a tie. Press it again to
clear the reveal if the game carries on.

Rapid taps are **queued, not dropped** — every toss lands, in order, even during
a rush.

---

## Swapping in the real data (PRD §9)

Edit **`backend/seed.js`** only — no schema or API change is needed.

```bash
# stop the server, then:
rm -rf backend/data
npm start          # re-seeds from seed.js
```

Departments can also be added, renamed, or removed live from the admin sidebar,
so the starting list does not have to be final.

Point values must be **positive integers**; the server refuses to seed otherwise.

### Ingredient artwork

Each ingredient carries a `sprite` key that picks its illustration from
`frontend/sprites.js`. Available today:

`broccoli` · `mushroom` · `carrot` · `shrimp-ball` · `fish-tofu` ·
`cabbage` · `corn` · `meatball` · `generic`

An ingredient whose `sprite` is missing or unrecognised falls back to `generic`,
so the real list can be loaded before its artwork exists — nothing renders blank.

To add a new one: add a `<symbol id="ing-yourkey">` in `frontend/sprites.js`,
then set `sprite: 'yourkey'` in `seed.js`. Artwork is inline SVG, so it looks
identical on every machine — unlike emoji, which the operating system draws
differently on macOS and Windows.

---

## Data safety — scores cannot be lost

Every score is written to disk **before** the admin screen shows it confirmed.
Three independent layers protect the event:

| Layer | What it is | What it saves you from |
|---|---|---|
| **1. SQLite, `synchronous = FULL`** | `backend/data/hotpot.db` (WAL). Every commit is fsynced before the API responds. | Crash, force-quit, **power cut**, pulled battery |
| **2. Append-only journal** | `backend/data/events.jsonl` — one fsynced line per action, plain text | Database file corrupted or deleted; also a paper trail for disputes |
| **3. Rolling snapshots** | `backend/data/snapshots/` — a full copy at startup, then every 60s when something changed, plus one on clean shutdown. Last 20 kept. | Corruption, accidental deletion, rolling back a run of bad corrections |

### Verified, not assumed

| Scenario | Result |
|---|---|
| Browser refresh / F5 mid-event | All scores restored — the browser holds no state |
| Tab closed or crashed | Same |
| **WiFi drops** | **No effect** — the server runs on the laptop over `localhost` |
| Server killed with `kill -9` | 400/400 scores recovered |
| **Database file deleted entirely** | Rebuilt from the journal: 2460 pts / 189 tosses, every department identical |
| Database file corrupted | Restored from the newest snapshot |

Cost of all this: **4.57ms per scoring action** — against a ~1 second target.

> **WiFi caveat.** This holds because the projector is driven by the *same
> laptop over HDMI*. If you run the display from a second machine over the
> network, a WiFi drop leaves that screen stale (it shows a "Reconnecting…"
> pill). The scores themselves are still safe on the laptop.

> **Never back up `hotpot.db` on its own while the server is running.** In WAL
> mode the newest scores live in `hotpot.db-wal`, so that one file is
> incomplete. Copy the whole `backend/data/` folder, or use a file from
> `snapshots/` — those are always complete.

### Recovering

Run these with the **server stopped**:

```bash
node backend/restore.js list
```

Shows the journal size and available snapshots.

```bash
node backend/restore.js verify
```

Checks the live database against the journal and reports any mismatch. Worth
running once before the event, and any time something looks wrong.

```bash
node backend/restore.js from-snapshot
```

Restores the newest snapshot (or pass a filename). The database it replaces is
kept alongside as `.replaced-*`, so this is never destructive.

```bash
node backend/restore.js from-journal
```

Last resort — rebuilds the entire database by replaying `events.jsonl`. Needs
nothing but that text file.

`GET /api/health` reports journal path and snapshot count if you want to check
the safety net is live mid-event.

**Deleting a department that has scored is blocked** — the admin is offered
*Archive* instead, which takes it off the leaderboard but keeps its points and
history intact (PRD §8.2).

---

## Checking it still works

### Before the event — run this

```bash
npm run preflight
```

Walks an organiser's real path through the app end to end and prints a plain
verdict: booth start-up, one participant's full run, correcting a mis-tapped
toss, editing the
department list live, delete protection, the crowd screen, a tie for first
place, the winner announcement, and a full hour of peak rush.

**Safe to run at any time, including on event day.** It starts its own
throwaway server on port 3987 with a temporary database and deletes it
afterwards — verified: the event's database and journal are byte-identical
before and after a run. It never connects to the live server, so it cannot
touch a real score.

Finishes with either `✓ Ready for the event` or a list of what failed.

### After a code change

```bash
npm test
```

39 unit checks covering scoring, log corrections, tie handling, department
score-protection, soup-base locking, journal integrity, full recovery from a
deleted database, and a simulated 5-hour load (1250 scoring actions).

`npm test` exercises the data layer directly; `npm run preflight` goes over real
HTTP and SSE, so it also covers routing, JSON shapes, and the live push the
projector depends on. Run both.

---

## What's where

```
hotpot-challenge/
├── api-contract.md        ← locked API contract, source of truth for both sides
├── package.json
├── backend/
│   ├── server.js          ← HTTP routing, SSE broadcast, static serving
│   ├── store.js           ← all business rules
│   ├── db.js              ← SQLite schema
│   ├── durability.js      ← journal + rolling snapshots
│   ├── restore.js         ← recovery tool (list / verify / from-snapshot / from-journal)
│   ├── seed.js            ← ★ placeholder data — edit this when the real lists arrive
│   ├── test.js            ← unit checks (npm test)
│   ├── preflight.js       ← pre-event end-to-end check (npm run preflight)
│   └── data/              ← hotpot.db, events.jsonl, snapshots/ (created on first run)
└── frontend/
    ├── admin.html         ← Admin Screen (laptop)
    ├── display.html       ← Display Screen (projector)
    ├── sprites.js         ← ingredient artwork (inline SVG symbols)
    ├── api.js             ← shared client: SSE + polling fallback
    └── tokens.css         ← shared design tokens
```
