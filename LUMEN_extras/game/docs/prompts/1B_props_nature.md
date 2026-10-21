# Chat 1B — Props: Nature (trees, rocks, bushes, flower field)
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) (has 1A: use src/assets/props/merge.js)
Owned (only these files): game/src/assets/props/nature.js, game/demo_nature.html
Read (API_CONTRACTS): §A geo.js, Toon, Outline, Island · §B Props (registerProps, mergeGroup)
Export: `export const NATURE_PROPS = { tree_round: {make, footprint:[1,1], category:"nature"}, ... }` + `makeFlowerField(count, areaFn) → InstancedMesh` + `swayAll(t)`

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- 3 trees (round, cone, double-ball) + 3 rocks (ico/dodeca + moss cap) + 2 bushes, each `makeX(opts) → Group`, baked with mergeGroup, pivot at base, ≤ 150 tris, ≤ 4 draw calls incl. outline.
- `userData.sway(t)`: rotate the crown group ±0.03 rad (cheap wind).
### P2 — should ship (≈ 25 credits)
- 5 more trees (palm-ish glow tree, blossom, tall, bush-tree, lantern tree w/ flatMat fruit) + 7 more rocks (seeded variation via rng/vary) + 4 more bushes.
- `makeFlowerField(count, areaFn)`: ONE InstancedMesh (5 colors via instanceColor), ≤ 2 draw calls total.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- `makeGrassTufts(count, areaFn)` instanced; sway via per-frame instanceMatrix for ≤ 200 instances or a tiny vertex shader `onBeforeCompile`.

## Demo page `game/demo_nature.html`
Island + every nature prop in rows + a 300-flower field + ~50 random trees/rocks scattered with island.isLand. Key N cycles sway on/off. Target ≤ 80 draw calls total.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_nature.html --shots --close`.

## Handoff `docs/HANDOFF_1B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
