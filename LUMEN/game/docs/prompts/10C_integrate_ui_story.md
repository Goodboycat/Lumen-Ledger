# Chat 10C — Integrate UI + story + state machine
Needs: 10B master (already contains 7A,7B,7C,8A,8B)
Owned (only these files): game/src/Game.js, game/index.html, game/ui/index.js
Read (API_CONTRACTS): HANDOFFs of 7–8
Export: index.html = the game: Title → Tutorial → Season loop → Ledger → Ending → Endless

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Mount all UI, wire bus events both ways, state machine with Title → Season → Ledger loop.
### P2 — should ship (≈ 25 credits)
- Story lines at season start/mid/end, lesson card in Ledger, ending at win.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Endless mode, pause/settings.

## Demo page `game/index.html`
Full run to season 3 headless via smoke tool keys.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs index.html --shots --close`.

## Handoff `docs/HANDOFF_10C.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
