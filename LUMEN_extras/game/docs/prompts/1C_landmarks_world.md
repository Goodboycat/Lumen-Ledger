# Chat 1C — Props: Landmarks & Island v2
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) (has 1A)
Owned (only these files): game/src/assets/props/landmarks.js, game/src/world/Island.js (EXTEND, keep every existing export), game/demo_landmarks.html
Read (API_CONTRACTS): §A Island.js (read fully), geo, Toon, VFX, Sequencer · §B Props
Export: `LANDMARK_PROPS`, `makeLighthouse() → Group` with `userData.setState("dark"|"flicker"|"lit")`; Island v2: `island.zones = [{id, center, radius, unlocked}]`, `island.unlockZone(i, {game, vfx})`, `island.isLand(x,z)` honors zones, `island.gridCells() → [{x,z}]`

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Island v2: ground tiles become ONE merged mesh per zone (≤ 2 draw calls per zone; Foundation Island is ~200 draw calls — this is the biggest perf win in the project). 4 zones: start (r 11) + 3 lobes. Hidden zones are not in isLand.
- `unlockZone(i)` Sequence: anticipation 200 dip −0.4 inQuad → rise 500 outBack from y −3 → settle 150 + dust ring + pop text.
### P2 — should ship (≈ 25 credits)
- Lighthouse (3 states; lit = flatMat lamp + slow-rotating beam cone, additive), Pip's cottage, pier over water (planks + posts).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Baron's Fog Tower ×3 (purple, crooked, chimney puffing fog spheres via a tiny pool), bridge between zones, cliff walls, waterfall strip.

## Demo page `game/demo_landmarks.html`
Island v2 with lighthouse on the far lobe. Key Z unlocks next zone, L cycles lighthouse state. Print draw calls BEFORE/AFTER your ground merge in the handoff.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_landmarks.html --shots --close`.

## Handoff `docs/HANDOFF_1C.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
