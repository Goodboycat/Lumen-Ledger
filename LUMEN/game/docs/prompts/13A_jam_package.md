# Chat 13A — Jam package
Needs: 11B master + GDD
Owned (only these files): game/README.md, docs/ITCH_PAGE.md, docs/BUDGET.md, docs/SUBMISSION_CHECKLIST.md
Read (API_CONTRACTS): GDD, HANDOFFs
Export: all four docs

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- itch.io page copy (title, tagline "Make FinLit Fun", 150-word pitch, controls, FinLit lessons list), Game Budget sheet (dev months, roles, tools, audio, QA, marketing — jam requirement).
### P2 — should ship (≈ 25 credits)
- README (how to run, structure, credits), submission checklist mapping every itch.io requirement to a file.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Screenshot shot list (6 shots with camera positions).

## Demo page `game/docs/`
No demo.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs docs/ --shots --close`.

## Handoff `docs/HANDOFF_13A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
