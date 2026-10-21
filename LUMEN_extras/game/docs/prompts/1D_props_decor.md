# Chat 1D — Props: Decor (fences, lanterns, crates, jars, signs, bench, paths)
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) (has 1A)
Owned (only these files): game/src/assets/props/decor.js, game/demo_decor.html
Read (API_CONTRACTS): §A geo.js, Toon, Outline · §B Props (registerProps, mergeGroup)
Export: `export const DECOR_PROPS = {...}` (category:"decor"), each `makeX(opts) → Group`

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- The 4 Jar props (Spend red · Save green · Invest blue · Protect gold): chunky clay jar + lid + flat colored emblem, `userData.setFill(0..1)` scales an inner flatMat disc. These are the FinLit centrepiece — make them readable from the game camera.
- Fence post, fence rail segment (1 tile), crate, barrel. mergeGroup everything.
### P2 — should ship (≈ 25 credits)
- Fence gate, post lantern + hanging lantern (`userData.setLit(bool)` swaps toon→flatMat glass), 3 signs (arrow, board, hanging), bench, 2 path tiles (dirt, stone) as flat 1×1 slabs y=0.02.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Market banner string (flags between two posts, waving via rotation), flower pot, water trough.

## Demo page `game/demo_decor.html`
All decor props in a grid; keys J (jar fill animate 0→1 with a Sequence: anticipation 120 → fill 400 outCubic → wobble 200), L (lanterns lit toggle).
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_decor.html --shots --close`.

## Handoff `docs/HANDOFF_1D.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
