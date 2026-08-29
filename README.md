# Hotpot Challenge — Handoff to Claude Code

## What's in here

```
hotpot-challenge/
├── hotpot-challenge-prd.md   ← full PRD (read this for complete context)
├── frontend/
│   └── CLAUDE.md             ← frontend agent's brief (auto-loaded by Claude Code)
└── backend/
    └── CLAUDE.md             ← backend agent's brief (auto-loaded by Claude Code)
```

Claude Code automatically reads any `CLAUDE.md` in the folder you launch it from — no need to paste this in manually.

## How to start

1. **Lock the API contract first.** Open one terminal, `cd backend`, run `claude`, and ask it to turn the draft contract in its brief into a final `api-contract.md` at the project root (one level up from `frontend/` and `backend/`). Both agents should treat that file as the source of truth from then on.

2. **Open a second terminal for the frontend agent.** `cd frontend`, run `claude`.

3. **Kick off each session** with something like:
   > Read CLAUDE.md, ../hotpot-challenge-prd.md, and ../api-contract.md. Outline your build plan before writing any files.

4. **Review each plan before approving changes.** Claude Code asks permission before editing files by default.

## Still pending (see PRD, Section 9)

- Final ingredient list with point values
- Final department list

Both agents are using placeholder data for these until the real lists arrive — swap it in without needing to change the data model.
