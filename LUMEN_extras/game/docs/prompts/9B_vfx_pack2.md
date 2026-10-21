# Chat 9B — VFX pack 2: Debt Fog
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) incl. 1C
Owned (only these files): game/src/vfx/pack2.js, game/demo_vfx2.html
Read (API_CONTRACTS): §A VFX.js, Island v2 · §B VFX pack
Export: `installPack2(vfx)` sets vfx.fog (setCoverage(fog01)), debtPulse, coinRain, lighthouseBeam, vignette

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Debt Fog: a ring of purple translucent toon blobs (InstancedMesh ≤ 60) at the island edge whose inward reach = fog01; bob + drift; setCoverage animates with outCubic 600 ms.
### P2 — should ship (≈ 25 credits)
- debtPulse (red vignette pulse via DOM overlay), coinRain (reuse coin pool).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- lighthouseBeam sweep, win celebration fog recede Sequence.

## Demo page `game/demo_vfx2.html`
Slider/keys set fog01 0→1.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_vfx2.html --shots --close`.

## Handoff `docs/HANDOFF_9B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
