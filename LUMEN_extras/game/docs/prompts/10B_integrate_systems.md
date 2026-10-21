# Chat 10B — Integrate systems
Needs: 10A master (already contains 4A,4B,5,6A,6B)
Owned (only these files): game/src/Game.js (new: wires systems), game/demo_sandbox.html
Read (API_CONTRACTS): HANDOFFs of 4–6
Export: a playable sandbox season with debug keys (no UI)

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Economy + Build + Customers running together on Island v2; debug keys: B build, 1–9 pick, E end season (prints LedgerReport to console).
### P2 — should ship (≈ 25 credits)
- Hero abilities affect economy (haggleShout → price boost etc.) via bus.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Helper creatures hired via key H do their job loop near stalls.

## Demo page `game/demo_sandbox.html`
Play 2 seasons without errors.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_sandbox.html --shots --close`.

## Handoff `docs/HANDOFF_10B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
