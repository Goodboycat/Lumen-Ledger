# Chat 3A — Hero moves set 1
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game)
Owned (only these files): game/src/anim/heroAnims.js, game/demo_heromoves.html
Read (API_CONTRACTS): §A HeroController.js (read `_buildSwordAttack` fully, copy its style), Sequencer, SquashStretch, VFX · §B Hero anims
Export: `HERO_MOVES`, `makeMove(name, ctx) → Sequence`, `attachMoves(hero) → hero.playMove(name)` (helper in YOUR file; do not edit HeroController)

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- hammer (anticipation 180 raise → strike 90 inQuart → impact: hit-stop 40 + dust + shake 0.15 → recovery 220), dash (80 squash → 160 stretch 1.3/0.85 travel 3 u → 180 settle + dust trail), celebrate (2 jumps + arm raise + `ctx.vfx.confetti?.burst`).
### P2 — should ship (≈ 25 credits)
- build (loop hammer ×3 then pop), pickUp, carry (loop, arms up + walkBob), throwCoin.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- sad, stunned (stars orbit via tiny flatMat icos).

## Demo page `game/demo_heromoves.html`
Keys 1–9 trigger moves on Pip; T slow-mo.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_heromoves.html --shots --close`.

## Handoff `docs/HANDOFF_3A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
