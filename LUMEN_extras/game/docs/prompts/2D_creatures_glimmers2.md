# Chat 2D — Creatures: 8 more Glimmer variants
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) + 2A work (already in the folder)
Owned (only these files): game/src/assets/creatures/glimmers2.js, game/demo_glimmers2.html
Read (API_CONTRACTS): §B Creatures, 2A glimmers.js (copy its pattern exactly)
Export: `GLIMMER_VARIANTS_2 = { impulse, haggler, kid, elder, tourist, critic, collector, newbie }` registered into GLIMMER_TYPES via `registerVariants()`

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- impulse (spiral eyes + sparkles), haggler (visor), kid (propeller cap), elder (glasses + cane).
### P2 — should ship (≈ 25 credits)
- tourist (camera + hat), critic (notepad), collector (jar), newbie ("?" bubble).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Per-type idle flourish (kid propeller spins, elder leans on cane).

## Demo page `game/demo_glimmers2.html`
All 12 variants in a circle using 2A animator; keys cycle anims.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_glimmers2.html --shots --close`.

## Handoff `docs/HANDOFF_2D.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
