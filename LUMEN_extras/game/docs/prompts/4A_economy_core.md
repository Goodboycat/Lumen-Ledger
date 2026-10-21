# Chat 4A — Economy core (PURE JS, no Three, no DOM)
Needs: GAME_BIBLE.md + API_CONTRACTS.md §B Economy only (no need to read Foundation code)
Owned (only these files): game/src/systems/economy.js, game/tests/economy.test.mjs
Read (API_CONTRACTS): §B Economy; import only `../core/EventBus.js`
Export: exactly the §B Economy class + `BALANCE` constants object

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- state, tick(dt) (season = 150 s), sell() with demand curve `sold = base × clamp(1.6 − price/fair, 0.1, 1.5) × mood`, canAfford/spend, allocate(jars) with validation, endSeason() → LedgerReport with savings 5 %/season, loan 20 %/season compounding, stars 0–3.
- `node tests/economy.test.mjs` with ≥ 10 asserts printing PASS/FAIL (run it — this is your smoke test).
### P2 — should ship (≈ 25 credits)
- takeLoan/repay, fog01 rules (+0.08/season with debt, −0.1 when debt 0 & save > threshold), Protect jar absorbs losses, Invest 8 %±4 %, isWin/isLose, serialize/deserialize.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- applyEvent/offerScam/acceptOffer skeleton reading from `EVENTS`/`SCAMS` maps (Chat 4B fills content).

## Demo page `game/tests/economy.test.mjs`
No demo page — the Node test IS the proof. Also a 20-line `tests/economy.sim.mjs` that plays 10 seasons with a naive strategy and prints the ledger per season.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs tests/economy.test.mjs --shots --close`.

## Handoff `docs/HANDOFF_4A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
