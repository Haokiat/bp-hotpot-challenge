# Hotpot Challenge — Backend Agent Brief

*Full requirements and rationale live in `hotpot-challenge-prd.md` — read that for the complete picture, including risks and why decisions were made. This brief pulls out only what's directly relevant to backend work.*

---

## Your Scope

Build the data model, scoring logic, and API that the Admin Screen and Display Screen (both built by the frontend agent) will call. There is no participant-facing surface — this is a single admin input path feeding a real-time leaderboard.

---

## ⚠️ Before You Start Building

**Coordinate with the frontend agent first, on:**
- The exact **API endpoint shapes**. The draft contract below is a starting point, not final — confirm the real request/response shapes together before implementing them.
- The **real-time update method** for the Display Screen — WebSocket push vs. polling. Agree on one approach with the frontend agent before building it.

Do not treat the draft contract below as locked in.

---

## Data Model

No individual participant records are needed — scores are tracked at the **department level only**.

**Department**
| Field | Type | Notes |
|---|---|---|
| `id` | string/UUID | |
| `name` | string | Editable by admin, including mid-event |
| `score` | integer | Cumulative, positive only |
| `soup_base` | string \| null | Set once, then locked |

**Ingredient**
| Field | Type | Notes |
|---|---|---|
| `id` | string/UUID | |
| `name` | string | |
| `point_value` | integer | Positive only. Values vary by ingredient — not a flat rate. |

**ScoreEvent** (log entry — needed to support Undo)
| Field | Type | Notes |
|---|---|---|
| `id` | string/UUID | |
| `department_id` | string | |
| `ingredient_id` | string | |
| `points_awarded` | integer | Copy of the ingredient's value at time of scoring |
| `timestamp` | datetime | |

---

## Business Rules to Implement

- **Scoring:** logging an ingredient adds its point value to the department's total immediately, and creates a ScoreEvent.
- **Undo:** reverses the **most recent** ScoreEvent only — subtract its points from the department, and void or remove the log entry.
- **Soup base:** settable once per department. Reject any attempt to change it after it's set.
- **Department delete:** block deleting a department once its score is greater than zero, or archive it instead of a hard delete. (This protects score history if the admin edits the department list mid-event — approved approach.)
- **Ties:** the leaderboard must support multiple departments tied for first place — all of them are winners, no arbitrary tiebreaker applied.
- **No individual participant tracking** — department-level tally only.
- **No negative points or deductions** — all point values and totals stay positive.
- **No tracking of missed tosses** — only admin-logged (successful) selections count.

---

## Suggested API Contract (draft — confirm with the frontend agent first)

```
GET    /departments                → list all departments with current scores
POST   /departments                → add a department { name }
PUT    /departments/:id            → edit a department { name }
DELETE /departments/:id            → remove a department (blocked/archived if score > 0)

GET    /ingredients                → list all ingredients (name + point value)

POST   /score                      → log a toss { department_id, ingredient_id }
                                      → adds points, creates a ScoreEvent, returns updated department + leaderboard
POST   /score/undo                 → reverses the most recent ScoreEvent

POST   /departments/:id/soup-base  → sets the soup base { soup_base } (once only)

GET    /leaderboard                → all departments, sorted by score, ties included
```

---

## Non-Functional Notes Relevant to Backend

- Must stay stable for ~5 hours of continuous use without a restart.
- Must handle an estimated 200–250 scoring actions per hour without noticeable slowdown.
- No offline mode — assume stable venue WiFi. There's no fallback built for a dropped connection.
- No login or authentication required on any endpoint.
- No data export or reporting endpoints needed.
- No session-reset endpoint needed — this is a single continuous event.

---

## Explicitly Out of Scope — do not build these

- Individual participant tracking.
- Missed-toss tracking.
- Negative points or score deductions.
- An end-of-game interaction endpoint/flow.
- Data export or reporting.
- A reset function between sessions.
- Offline mode or background sync.

---

## Placeholder Data (seed for dev/test — not final)

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

Swap this for the confirmed lists once they arrive (see `hotpot-challenge-prd.md`, Section 9 — Pending Inputs). The data model above should not need to change when that happens.

---

## Acceptance Criteria (backend-relevant)

- Scoring endpoint adds the correct points, creates a ScoreEvent, and updates the department's total.
- Undo endpoint reverses only the most recent ScoreEvent, correctly restoring the prior score.
- Department create/edit/remove all work, and delete respects the score-protection rule.
- Leaderboard reflects all departments and correctly shows multiple winners on a tie.
- Soup base can be set once per department and is locked after that.
- System holds up under ~200–250 scoring actions/hour for ~5 hours without degrading.
