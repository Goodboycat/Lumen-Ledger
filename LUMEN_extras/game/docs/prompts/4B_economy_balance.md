# Chat 4B — Economy content & balance
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) incl. 4A
Owned (only these files): game/src/systems/economyData.js, game/docs/balance.md, game/tests/economy.sim.mjs (extend)
Read (API_CONTRACTS): §B Economy + 4A economy.js + HANDOFF_4A tunables
Export: `EVENTS` (≥ 8), `SCAMS` (6 Too-Good Deals with tell-tale signs), `UPGRADES` tree, tuned `BALANCE`, per-stall fair prices & costs

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- 6 scams + 8 events with FinLit lesson text; wire into 4A applyEvent/offerScam.
### P2 — should ship (≈ 25 credits)
- Tune BALANCE so the sim reaches win at season 10±1 with a sensible strategy and loses with "borrow everything". Document in balance.md.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- UPGRADES tree (stall L2/L3 costs, helper hire costs, zone unlock costs).

## Demo page `game/tests/economy.sim.mjs`
Sim prints 3 strategies × 10 seasons table.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs tests/economy.sim.mjs --shots --close`.

## Handoff `docs/HANDOFF_4B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
