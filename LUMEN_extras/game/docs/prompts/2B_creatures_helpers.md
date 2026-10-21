# Chat 2B — Creatures: 6 Helpers
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) + 2A work (already in the folder) (use CreatureAnimator; if absent, copy makeGlimmer + write a minimal idle/work)
Owned (only these files): game/src/assets/creatures/helpers.js, game/demo_helpers.html
Read (API_CONTRACTS): §A glimmer.js, SquashStretch, Sequencer · §B Creatures
Export: `makeHelper(type) → Group`, `HELPER_TYPES`, `HelperAnimator(root, type)` same interface as CreatureAnimator with anims idle/work/carry/happy

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Tally-Owl (glasses, ledger) + Pack-Mole (carries crate) + Spark-Bee (hover + wing buzz). idle + work loop (800 ms, job-specific) each. ≤ 600 tris.
### P2 — should ship (≈ 25 credits)
- Guard-Tortoise (shell shield), Scout-Fox (pointing), Gardener-Snail (glow-plants). carry + happy anims for all.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Job VFX hooks: `ctx.vfx.sparks` on work beat.

## Demo page `game/demo_helpers.html`
6 helpers performing work loops; keys switch anim.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_helpers.html --shots --close`.

## Handoff `docs/HANDOFF_2B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
