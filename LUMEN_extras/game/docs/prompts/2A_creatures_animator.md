# Chat 2A — Creatures: CreatureAnimator + 4 Glimmer variants
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game)
Owned (only these files): game/src/assets/creatures/animator.js, game/src/assets/creatures/glimmers.js, game/demo_glimmers.html
Read (API_CONTRACTS): §A glimmer.js (read fully), SquashStretch, Sequencer, Toon · §B Creatures
Export: `CreatureAnimator(root)` .play(name) .update(dt) .moodTint(t) .faceTo(vec3) .current ; `makeGlimmerVariant(type, opts)` ; `GLIMMER_TYPES`

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- CreatureAnimator with idle (breathe loop), walk (hop loop 420 ms: squash 0.9 → stretch 1.12 apex → land squash + dust), happy (jump+spin 600), sad (droop 500, hold). Phase tables in comments. Works on plain makeGlimmer().
- 4 variants: regular (scarf), saver (piggy backpack), spender (shopping bags), vip (crown + cape). Each ≤ 450 tris, accessories baked with mergeGroup, body kept live for squash.
### P2 — should ship (≈ 25 credits)
- pay (lean + coin toss 400), browse (look L/R loop), wait (foot-tap loop), angry (shake + red tint 500). moodTint lerps body color sad→happy.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Blink (random eye scale-y 80 ms), idle variations, shadow blob disc.

## Demo page `game/demo_glimmers.html`
Variants in a row; keys 1–8 play each anim on all; T toggles slow-mo 0.25.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_glimmers.html --shots --close`.

## Handoff `docs/HANDOFF_2A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
