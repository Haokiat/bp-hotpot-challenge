# Hotpot Challenge (It's HOT!) — Product Requirements Document

*This document reflects confirmed decisions as of the latest review. Nothing is still pending external input — see Section 9.*

> **Revision — 30 Aug 2026.** The leaderboard now shows only the **top three
> departments**, not the whole field (§4.4, §7.4). This reverses a previously
> confirmed decision. It was changed after testing, at the organiser's request:
> three large rows read far better from the back of a room than fifteen small
> ones. The tie rule is unaffected — see §4.4 for what happens on a tie, and
> what the change gives up.

> **Revision — 30 Aug 2026.** Both pending inputs are now **confirmed and
> loaded** (§9): sixteen ingredients priced 10 to 50 points, and thirteen
> departments. Section 9 has no outstanding items.

> **Revision — 28 Aug 2026.** The **Undo** requirement (previously §4.3, §7.3)
> has been replaced by **toss history correction**. Undo could only reverse the
> single most recent action; the replacement can correct *any* logged toss.
> This is a change to a previously confirmed decision — see §4.3 for what the
> system now does and why.

---

## 1. Objective

To develop a web-based score-tracking application that supports a live, physical team game during an event. The system mirrors physical gameplay actions in a virtual interface, tracks department-based cumulative scores, and displays a real-time leaderboard.

---

## 2. Usage Context

- Used onsite during a live event.
- Operated by one organiser/admin at the booth, using a **laptop**.
- Players participate physically. System input is manual. Scores are computed automatically.
- One game session runs at any point in time.
- No backup admin device or backup admin person is planned for this event. This is a single point of operation (see Section 8, Risks).
- Running two admin stations in parallel, for two departments at once, is a "nice-to-have" for a future event. It is **not required** for this build.

---

## 3. Game Concept Summary

**Participant actions:**
- The participant draws a physical ingredient (for example, broccoli or mushroom) from a box.
- The participant physically tosses the ingredient into a real pot.
- Each participant tosses up to **5 ingredients**. The app does not warn or block the admin at this limit — it is managed manually onsite.

**Organiser (admin) action:**
- The organiser manually selects the corresponding ingredient in the web app.
- Only successful tosses are logged. The app does not track missed tosses.

**System actions:**
- The first participant of a department/team chooses a soup base. This choice applies to the whole department for the rest of the event. It is a **visual choice only** and does not affect scoring.
- The system adds the virtual ingredient to a digital hotpot. This happens **automatically**, in the order the admin selects ingredients. The system does not need to replicate the exact physical order or timing of the tosses.
- The system automatically assigns points to the participant's department/team.
- The system updates cumulative team scores and the leaderboard in real time.
- The system displays the final hotpot image once, for the **winning department only** (not one image per department).

---

## 4. Functional Requirements

### 4.1 Team / Department Management
- Pre-configured list of departments/teams (approximately 15 teams). This list **can change before the event**.
- The admin can add, edit, or remove departments through the admin interface, including live during the event.
- Each participant is associated with one department.
- Multiple participants from the same department contribute to a shared cumulative score.
- The system tracks scores at the **department level only** — it does not track individual participants.

### 4.2 Ingredient & Scoring Logic
- Configurable ingredient list: ingredient name and point value.
- **The final ingredient list and point values will be provided later.** The system should support a placeholder/test dataset until this is confirmed (see Section 9).
- Point values **vary by ingredient** — some ingredients are worth more than others.
- All point values are **positive**. There are no point deductions or negative scores.
- When an ingredient is selected, points are added to the selected department's total.
- The ingredient is visually added to the virtual hotpot **automatically**, as soon as the admin selects it. No manual drag-and-drop action is required from the admin.
- Scores persist and accumulate across the event.

### 4.3 Admin (Operator) Interface
The admin can:
- Select the department/team (list of departments to be provided, and editable by the admin).
- Select the ingredient corresponding to the physical toss.
- **Correct any logged scoring action** — remove a toss that should not have been
  counted, or change it to the ingredient that was actually tossed.
- Add, edit, or remove departments, including live during the event.

**On correcting tosses.** The original requirement was an Undo that reversed the
most recently logged action. That only helps if the organiser notices
immediately. The common error at a live booth is a double tap, or the wrong
ingredient spotted a few participants later — by which point Undo would mean
reversing several correct actions to reach the wrong one, then re-entering them.

The system therefore lets the admin correct any entry in the toss log directly:
- The most recent tosses are shown continuously on the admin screen, so a
  mistake is visible as it happens.
- The full log is reachable for a correction found long after the fact.
- Removing a toss is itself reversible — nothing is deleted, so a mistaken
  correction can be put back with its points.

This covers everything Undo covered, and more. It is a change to a previously
confirmed decision, made after the organiser flagged the double-tap case.

Access:
- The admin interface is **open access at the booth station**. No login or PIN is required.

### 4.4 Score Display & Leaderboard
- Real-time score counter displayed prominently.
- Department-level leaderboard visible during gameplay, showing the **top three departments**.

**On showing only the top three.** The original requirement was to show every
department at once, with no cutoff. With around fifteen departments that meant
fifteen small rows on a projector, which the organiser found hard to read from
the back of the room during testing. Three rows use the same space, so each is
far larger and readable at a distance.

What this gives up: a department outside the top three does not appear on the
leaderboard at all. Its scoring is still visible — the ingredient drops into the
pot and the "Now Playing" card shows the team, its running score and its toss
count — but the crowd cannot see its standing. The organiser accepted this
after testing.

Two rules protect fairness:
- **A tie is never broken to fit the cut.** Ranking is competition-style, so if
  several departments are level in the top three places, all of them are shown,
  even if that means more than three rows.
- **Departments on zero are not shown.** Before anyone scores, every department
  is level on nothing, so the board shows a "no scores yet" message rather than
  an arbitrary three.

The footer states the cut plainly — for example "Top 3 of 15 departments" — so
the crowd knows the board is not the whole field.
- Leaderboard and score counter update **automatically** — no manual refresh is needed.
- If two or more departments tie for the highest score, the system recognises **all tied departments as winners**.

### 4.5 Visual & UX Requirements
- The virtual hotpot visually shows ingredients being added.
- Cute/playful aesthetic preferred (optional but desirable). The reference design (Section 6) is a **general mood board for style direction**, not a fixed style to replicate exactly.
- Simple animation on ingredient addition.
- End-of-game interaction (for example, a closing visual) is **not required** for this build.

---

## 5. Non-Functional Requirements

- Web-based, browser accessible, no installation required. Runs on the admin's laptop.
- Stable for continuous use across approximately **5 hours**.
- Supports an estimated **200–250 scoring actions per hour** without noticeable slowdown.
- Minimal latency between admin input and score display.
- Designed for projector / large-screen display.
- Venue WiFi is confirmed stable. **Offline support is not required.**
- No data export or report is required at the end of the event.
- No reset between event days/sessions is required — this is a single continuous session.

---

## 6. Design System

This design system comes from the "BP President's Challenge – BP Games Paradise" reference poster, used as a **general mood board** for style direction (not a fixed style to replicate exactly). Colour values are best-estimate reads from the image, not exact brand codes. Please confirm the final hex values with your design or brand team before build.

### 6.1 Colour Palette

**Base**
| Role | Colour | Approx. Hex |
|---|---|---|
| Background | Warm cream | `#F7F0DE` |
| Primary text / headers | Deep navy | `#1B3A6B` |
| Primary banner fill | Deep navy | `#1B3A6B` |

**Accent colours (one per game / section)**
| Section | Colour | Approx. Hex |
|---|---|---|
| Hot Pot Challenge | Leaf green | `#4A9B4E` |
| Wheel of Fortune | Sky blue | `#4FA8D8` |
| Lucky Dice | Warm orange | `#F5821F` |
| Highlight / stars | Gold | `#F5C518` |
| Hearts / friendship accent | Coral pink | `#E8547A` |
| Confetti accent | Purple | `#8B5FBF` |

For the Hotpot Challenge app, use **leaf green** as the primary accent colour, since the app maps to the "Hot Pot Challenge" card in the reference.

### 6.2 Typography

- **Display / headline font:** A bold, rounded sans-serif. Examples: Baloo 2, Fredoka, or Poppins ExtraBold. Use for page titles, the scoreboard headline, and banner labels. Set headlines in uppercase, like the poster.
- **Body font:** A clean, rounded sans-serif. Examples: Poppins Regular/Medium, or Nunito Sans. Use for lists, instructions, and admin UI labels.
- Keep body text left-aligned. Keep headlines and banners centre-aligned, like the poster.

### 6.3 Components

- **Ribbon banners:** Solid navy or accent-colour bar with white bold text inside. Use a slight wave or brush-stroke edge, not a plain rectangle. Use this style for the leaderboard title and section headers.
- **Numbered badges:** A solid circle with a bold number inside, in the section's accent colour. Use this for step numbers in any "How to Play" or admin instructions.
- **Cards:** White or very light cards, rounded corners (16–24px radius), soft drop shadow, with a thin colour-wash border in the accent colour. Use for each department's leaderboard row or score card.
- **Buttons:** Rounded (pill-shaped or 12px+ radius), solid accent colour fill, white bold text, small drop shadow. Match the "trophy banner" style from the poster for primary actions (for example, "Confirm Score").
- **Icons:** Simple, flat, friendly icon style — trophy, heart, star, people. Use white icons on navy or accent-colour backgrounds, matching the poster's bottom bar.

### 6.4 Illustration Style

- Flat, playful, slightly 3D illustrations (not photographic). The hotpot, ingredients, and any mascot should follow this style.
- Optional decorative elements: confetti dots, small stars, tropical leaf accents in page corners. Use sparingly, only on the main leaderboard/display screen — keep the admin input screen clean and simple for fast use.

### 6.5 Layout Notes for This App

- **Admin screen** (laptop): Prioritise large, easy-to-click buttons for department and ingredient selection. Keep decoration minimal here — the admin needs speed and accuracy, not visual flourish.
- **Display/projector screen:** Use the full playful style — banners, badges, confetti, big bold leaderboard text. Text must stay readable from a distance, so keep font sizes large (48px+ for headline scores) and contrast high (dark navy on cream, or white on navy).

### 6.6 Motion

- Use short, bouncy animations (200–400ms) for ingredient-added and score-updated events. This matches the playful tone of the reference poster.
- Avoid long or slow transitions — the leaderboard must feel instant to the crowd watching the screen.

---

## 7. Acceptance Criteria

### 7.1 Team / Department Management
- The system stores a list of departments/teams (approximately 15 to start).
- The admin can add, edit, or remove a department at any time, including live during the event.
- The system adds each scoring action to the correct department's cumulative total.
- Scores from multiple participants in the same department combine into one shared running total.
- The system does not create or store individual participant records — department-level tally only.

### 7.2 Ingredient & Scoring Logic
- The system stores a configurable ingredient list, each with a name and a point value. A placeholder dataset is used until the final list and values are confirmed (see Section 9).
- Point values differ across ingredients — the system supports different values per ingredient, not one flat value for all.
- The system only accepts positive point values. It does not support negative points or deductions.
- When the admin selects an ingredient, the system adds the ingredient's point value to the selected department's total immediately.
- When the admin selects an ingredient, the system adds it to the virtual hotpot display automatically, without a separate drag-and-drop step from the admin.
- The system does not track or log missed tosses — only admin-confirmed selections count.
- The system keeps accumulated scores without loss or reset for the duration of the event.

### 7.3 Admin (Operator) Interface
- The admin can select a department/team from the current list.
- The admin can select the ingredient that matches the physical toss.
- The admin can remove any logged scoring action, restoring the affected department's score to the value it would have had without it.
- The admin can change any logged scoring action to a different ingredient; the department's score moves by the difference between the two point values.
- The admin is asked to confirm before an ingredient is changed, since this rewrites a score already shown on the leaderboard.
- A removed scoring action can be restored, returning its points to the department.
- Removing or changing a scoring action does not disturb the order of the remaining log.
- The admin interface loads without requiring a login or PIN.
- The admin can add, edit, or remove a department from the interface at any time, including mid-event.

### 7.4 Score Display & Leaderboard
- The system displays a real-time score counter prominently on the screen.
- The leaderboard displays the top three departments, ranked by score.
- If a tie places more than three departments in the top three positions, every tied department is shown; a tie is never broken to fit the cut.
- Before any department has scored, the leaderboard shows a "no scores yet" message rather than an arbitrary selection.
- The leaderboard states how many departments exist in total, so the top-three cut is evident to anyone watching.
- The leaderboard and score counter update automatically after each scoring action, with no manual refresh required.
- If two or more departments finish with the same top score, the system marks all of them as winners.

### 7.5 Visual & UX Requirements
- The virtual hotpot visually displays ingredients as they are added.
- Ingredient addition triggers a simple animation.
- The system allows the first participant of each department to select a soup base. This choice applies to the whole department and does not change scoring.
- The interface follows the general style direction set out in Section 6, without needing to match the reference poster exactly.
- The system does not include an end-of-game interaction screen (not required for this build).
- Upon the winning department being announced, the system displays a single final hotpot image for that department only.

### 7.6 Non-Functional Requirements
- The system runs in a standard web browser on a laptop, with no separate installation step.
- The system stays stable for at least 5 hours of continuous use without needing a restart.
- The system handles at least 200–250 scoring actions per hour without noticeable slowdown to the admin or the display screen.
- The system keeps latency between admin input and score display to a minimum (exact numeric target still to be set — a good working baseline is under 1 second, to confirm with the dev team).
- The display view is sized and formatted for projector or large-screen use.
- The system does not include an offline mode; it assumes a stable venue WiFi connection.
- The system does not include a data export or reporting function.
- The system does not include a reset function between sessions — this build supports a single continuous session only.

---

## 8. Risks and Uncertainties

These are risks the team should plan around, even though the related decisions have now been made.

### 8.1 Technical / Architecture Risks
- **Stable WiFi is an assumption, not a guarantee.** The decision not to build offline support relies on the venue's WiFi holding up for the full event. If it drops, there is no fallback — the team should confirm this with venue IT ahead of time as a mitigation step outside the app itself.
- **Ingredient list and point values are still pending** (see Section 9). Full scoring logic can be built against a placeholder dataset now, but final testing can't be completed until the real data arrives. This creates a tight window for QA once the list is confirmed.

### 8.2 Live-Event / Operational Risks
- **Single admin, single device, no backup.** If the laptop fails, or the admin needs to step away, there is currently no fallback device or person. This is an accepted risk for this event — worth a quick contingency chat with the events team (for example, a spare laptop on standby) even if it's outside the app's scope.
- **Open access on the admin interface.** With no login or PIN, anyone at the booth could use the admin screen if left unattended. Since this is accepted for simplicity, physical control of the laptop becomes the main safeguard.
- **Live editing of the department list during the event.** Allowing the admin to add, edit, or remove departments mid-event is convenient, but removing or renaming a department that already has a score could cause confusion or data loss. Recommend the build either blocks deletion of a department with an existing score, or archives it instead of deleting it outright.
- **Multiple winners on a tie.** This is a simple rule for the system to apply, but it has a knock-on effect for the event itself — the organisers will need enough prizes ready in case more than one department ties for first place. Worth flagging to the event operations team.

### 8.3 Scope / Delivery Risks
- **Late-arriving ingredient data.** The final ingredient list and point values are still to come. If they arrive close to the event date, there will be limited time to test the real scoring numbers before go-live.
- **Decorative scope.** The playful aesthetic is confirmed as a general mood board rather than an exact match, which gives helpful flexibility — but without a hard cap on animation or decoration work, there's still some risk of extra polish time creeping into the schedule. Worth setting a simple cut-off (for example, "ship with core animations first, add extras only if time allows").

### 8.4 Design / Brand Risks
- **Design system colours and fonts are estimated from a reference image**, not confirmed brand assets. If they don't match approved BP brand guidelines, some visual rework may be needed after design sign-off.

---

## 9. Pending Inputs

**None.** Both items that were outstanding are now confirmed and loaded. They
are recorded below.

The department list can still change: the admin can add, rename, archive and
restore departments directly in the app, including live during the event.

### Resolved — final department list (confirmed 30 Aug 2026)

Thirteen departments, loaded exactly as supplied:

BP · CHROO · Corp Comms · Cumulus · HI · HRP · HRPS · LDS · PCG · PST ·
ServiceSG · SPR · WD

### Resolved — final ingredient list (confirmed 30 Aug 2026)

Sixteen ingredients, loaded into the system. All point values are positive and
vary by ingredient, as §4.2 requires.

| Ingredient | Points | | Ingredient | Points |
|---|---|---|---|---|
| Crab | 50 | | Mushroom | 15 |
| Shabu Beef | 40 | | Carrot | 15 |
| Pork Ribs | 30 | | Tomato | 15 |
| Rice | 25 | | Capsicum | 10 |
| Cabbage | 20 | | Red Pepper | 10 |
| Corn | 20 | | Eggplant | 10 |
| Broccoli | 20 | | Green Chilli | 10 |
| Potato | 15 | | Peas | 10 |

Each ingredient has its own drawn illustration, so the operator can tell them
apart at a glance and the pot on the display screen shows what was actually
tossed.
