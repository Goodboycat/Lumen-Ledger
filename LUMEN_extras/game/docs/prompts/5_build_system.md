# Chat 5 — Build & placement
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) incl. 1A (4A optional — stub canAfford)
Owned (only these files): game/src/systems/build.js, game/demo_build.html
Read (API_CONTRACTS): §A Input.pointerWorld/onTap, Island.isLand, Game, VFX · §B Props (PROP_CATALOG, slots, setLevel), Economy · export §B Build
Export: exactly §B Build

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- enter(propId) ghost (green/red transparent toon), snap 1 u grid, footprint + isLand check, confirm → place Sequence (drop from +2 inQuad 180 → land squash 0.8 → outBack 220 + dust ring + pop "−cost"). `placed` Map, `stalls()`, events.
### P2 — should ship (≈ 25 credits)
- rotate 90°, demolish (50 % refund + shrink Sequence), upgrade(stall) → setLevel animated, cost check via economy.canAfford.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Touch flow: tap moves ghost, Input.press("build") confirms; occupancy debug overlay.

## Demo page `game/demo_build.html`
1–9 pick stall type, B build mode, R rotate, click place, X demolish, U upgrade nearest.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_build.html --shots --close`.

## Handoff `docs/HANDOFF_5.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
