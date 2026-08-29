# Hotpot Challenge — Frontend Agent Brief

*Full requirements and rationale live in `hotpot-challenge-prd.md` — read that for the complete picture, including risks and why decisions were made. This brief pulls out only what's directly relevant to frontend work.*

---

## Your Scope

Build two screens:
1. **Admin Screen** (laptop) — the input surface for one organiser at the booth.
2. **Display Screen** (projector) — read-only, public-facing leaderboard.

No participant-facing screen. No login on either screen.

---

## ⚠️ Before You Start Building

**Coordinate with the backend agent first, on:**
- The exact **API endpoint shapes**. The draft contract below is a starting point, not final — confirm the real request/response shapes together before wiring anything up.
- The **real-time update method** for the Display Screen — WebSocket push vs. polling. Agree on one approach with the backend agent before building the update logic.

Do not build against the draft contract as if it's locked in.

---

## Game Flow You're Building For

1. Admin selects a department, then an ingredient, on the Admin Screen.
2. Points are added to that department's total. The ingredient animates into the virtual hotpot **automatically** — no drag-and-drop step from the admin.
3. The Display Screen leaderboard updates on its own, right away.
4. The first participant of each department picks a soup base once — visual only, applies to the whole department, doesn't affect scoring.
5. If two or more departments tie for first place, **all of them** are shown as winners.
6. At the end, the winning department's final hotpot image is shown once.

---

## Screens & Required UI

### Admin Screen
- Department selector, built from the live department list.
- Add / Edit / Remove department controls (available at any time, including mid-event).
- Ingredient selector.
- **Undo button** — reverses the last logged scoring action.
- Soup base selection — shown once per department, for its first scoring action only.
- No login screen, no PIN entry.

### Display Screen
- Real-time score counter, displayed prominently.
- Leaderboard — **all departments shown at once**, no top-N cutoff, updates on its own.
- Virtual hotpot with ingredient-added animation.
- Tie handling — all tied departments visually marked as winners, not just one.
- Final hotpot image — shown once, for the winning department(s) only, triggered on announcement.

---

## Design System (tokens)

Reference: "BP President's Challenge – BP Games Paradise" poster, used as a general mood board — not an exact match. Confirm final hex values with brand/design before shipping.

**Colours**
| Role | Hex |
|---|---|
| Background (cream) | `#F7F0DE` |
| Primary text / navy | `#1B3A6B` |
| Primary accent (leaf green, for this app) | `#4A9B4E` |
| Gold (highlights) | `#F5C518` |
| Coral pink (accents) | `#E8547A` |
| Purple (confetti accents) | `#8B5FBF` |

**Typography**
- Headlines/banners: bold rounded sans-serif, uppercase (Baloo 2, Fredoka, or Poppins ExtraBold).
- Body/labels: clean rounded sans-serif (Poppins Regular/Medium, or Nunito Sans).

**Components**
- Ribbon banners: solid colour bar, white bold text, soft wave edge — for headers and the leaderboard title.
- Numbered circle badges, accent colour, white bold number.
- Rounded cards (16–24px radius), soft shadow, thin accent-colour border — one per department row.
- Pill-shaped buttons, solid accent fill, white bold text.
- Short, bouncy animations (200–400ms) on score/ingredient updates.

**Screen-specific direction**
- **Admin Screen:** minimal decoration, large tap targets, built for speed and accuracy over style.
- **Display Screen:** full playful style, large bold text (48px+ for scores), high contrast, readable from a distance on a projector.

---

## Non-Functional Notes Relevant to Frontend

- Runs in a standard browser on the admin's laptop — no install step.
- Update from an admin action to the Display Screen should feel near-instant (~under 1 second is a working target — confirm once the real-time method is picked).
- No offline fallback is built. A simple "reconnecting…" state is a nice-to-have if it's cheap to add, not a requirement.
- No login/auth UI needed anywhere.

---

## Explicitly Out of Scope — do not build these

- Individual participant tracking (department-level only).
- Missed-toss tracking.
- Negative points or score deductions.
- An end-of-game interaction screen.
- Data export or reporting.
- A reset function between sessions.
- Offline mode or background sync.

---

## Placeholder Data (for building/testing now — not final)

**Example ingredients**
| Name | Point value |
|---|---|
| Broccoli | 10 |
| Mushroom | 15 |
| Carrot | 10 |
| Shrimp ball | 20 |
| Fish tofu | 10 |

**Example departments**
| Name |
|---|
| Department A |
| Department B |
| Department C |

Swap this for the confirmed lists once they arrive (see `hotpot-challenge-prd.md`, Section 9 — Pending Inputs).

---

## Suggested API Contract (draft — confirm with the backend agent first)

```
GET    /departments                → list all departments with current scores
POST   /departments                → add a department { name }
PUT    /departments/:id            → edit a department { name }
DELETE /departments/:id            → remove a department (blocked/archived if score > 0)

GET    /ingredients                → list all ingredients (name + point value)

POST   /score                      → log a toss { department_id, ingredient_id }
POST   /score/undo                 → reverses the most recent scoring action

POST   /departments/:id/soup-base  → sets the soup base { soup_base } (once only)

GET    /leaderboard                → all departments, sorted by score, ties included
```

---

## Acceptance Criteria (frontend-relevant)

- Admin can select a department and an ingredient, and log a score in one action.
- Admin can undo the last logged action.
- Admin can add, edit, or remove a department at any time, including mid-event.
- Ingredient animates into the hotpot automatically — no manual drag step required.
- Leaderboard shows all departments at once and updates on its own.
- Tied departments are all shown as winners, not just one.
- Soup base can be set once per department and is visual only.
- Final hotpot image displays once, for the winning department(s) only.
