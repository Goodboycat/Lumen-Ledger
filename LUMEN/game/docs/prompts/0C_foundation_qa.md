# Chat 0C — Foundation QA
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game)
Owned (only these files): bug fixes in game/src/core, anim, entities (runtime bugs only); docs/QA_0C.md
Read (API_CONTRACTS): §A
Export: patched Foundation + QA_0C.md fix list

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Run tools/smoke.mjs on index.html; fix any error; verify sword attack timings; verify touch joystick on 390×844 viewport.
### P2 — should ship (≈ 25 credits)
- Measure fps/draw calls; note the Island draw-call problem for 1C; confirm hit-stop and shake.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- 10-second screen recording instructions.

## Demo page `game/index.html`
Smoke tool output pasted in QA_0C.md.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs index.html --shots --close`.

## Handoff `docs/HANDOFF_0C.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
