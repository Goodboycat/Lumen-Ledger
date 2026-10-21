# Chat 9A — VFX pack 1
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game)
Owned (only these files): game/src/vfx/pack1.js, game/demo_vfx1.html
Read (API_CONTRACTS): §A VFX.js (read fully, mimic pool pattern), geo, Toon · §B VFX pack
Export: `installPack1(vfx)` sets vfx.coinBurst, coinFly, confetti, sparkTrail, savingSparkle, levelRing

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- coinFly(from, to, onArrive) (arc outQuad, spin, squash on arrival) + coinBurst (InstancedMesh pool). Zero per-frame allocation.
### P2 — should ship (≈ 25 credits)
- confetti (40 quads, gravity + flutter), levelRing (expanding torus fade).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- sparkTrail, savingSparkle.

## Demo page `game/demo_vfx1.html`
Keys fire each effect at Pip; ≤ 2 ms/frame at 200 particles.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_vfx1.html --shots --close`.

## Handoff `docs/HANDOFF_9A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
