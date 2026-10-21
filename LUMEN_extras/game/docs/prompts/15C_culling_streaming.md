# Chat 15C — Distance culling + region streaming hooks
Needs: 11A perf.js (CreatureLOD pattern) · 10A bake.js · 1C Island zones      Blocked-by: 15A
Owned (only these files): src/systems/cull.js (new), src/core/Game.js (ONE hook: `game.cull?.update(dt)` after sequences — frozen file, log in CHANGE_REQUESTS),
  src/Game.js (`installCull(lg)` section), src/systems/perf.js (CreatureLOD reads `cull.isVisible` — additive), demo_cull.html, docs/PERF.md (append), check.mjs (additive)
Read: START_HERE → VISION_V2 §7 + §1.6 → this → API_CONTRACTS "perf (11A)" → HANDOFF_11A Notes.
Export (API_CONTRACTS "CULL (15C)"):
  `createCull({camera, focus:()=>Vector3, dist:34, hyst:3}) → { add(obj, {kind:'prop'|'creature'|'vfx', radius, onShow, onHide}), remove, update(dt), isVisible(obj), stats:{shown,hidden}, setDist, regions }`
  `cull.regions.register(id, group, {bounds, onLoad, onUnload})` · `cull.regions.setActive(id)` (loads it + neighbours listed in `bounds.neighbors`, unloads the rest)
  bus: `cull:region {id, prev}`

## Why (user rule): "props and entities can disappear at some distance from the player camera view to help". Island v3 (phase 17) is 6× bigger;
without this a 2018 phone cannot hold it. Culling = hide beyond `dist` from the camera focus point (hero), with hysteresis and a 200 ms scale-in on return.

## Build in THIS order. wip.sh after EVERY file.
### P1 — must ship (≈ 25 credits)
- cull.js: registry of objects with world-space radius; `update(dt)` runs ≤ 1/3 of the registry per frame (round-robin, ≤ 0.3 ms budget) · beyond `dist + hyst`
  → `visible=false` + `onHide()` (animators call `pause()`); inside `dist` → `visible=true`, `onShow()`, scale-in Sequence 200 ms outBack (reuse one Tween per object, no alloc).
  Baked batches (`bake.js` groups) are culled as whole batches by their bounding sphere. Instanced fields are NOT culled (one draw call anyway).
- Game.js `installCull`: register every live prop (`W.live`), every creature (customers on spawn / helpers / villains), decor; hero + its own targets never culled;
  `cull.focus` = hero position. Customers hidden by cull keep simulating (FSM) but skip `anim.update`.
- `check.mjs --cull`: 200 fake objects on a ring; focus at centre → counts; move focus 60 u → ≥ 90 % hidden; move back → all visible after 2 s; animator `pause` called.
### P2 — should ship (≈ 15 credits)
- `regions`: a region = a `THREE.Group` + bounds + neighbours; `setActive(id)` keeps active + neighbours in the scene, removes the rest (`scene.remove`, geometry kept),
  fires `onLoad/onUnload` (phase 17 uses it to spawn/despawn enemies). Transition = 400 ms fade of the leaving group's materials' `opacity` is NOT allowed (toon mats are
  opaque) → use scale-down 250 ms inQuad then remove.
- perf.js: CreatureLOD skips culled creatures (saves the distance test twice).
### P3 — nice to have (≈ 10 credits)
- `?debug` overlay line: `cull 112/340 · region hub` · `docs/PERF.md` "15C" table: before/after draw calls on demo_world with focus at each zone centre.

## Demo `demo_cull.html`: demo_world scene + cull; keys 1/2/3 teleport focus to zone centres, C toggles cull, R toggles region mode (3 fake regions = 3 zones). Shows shown/hidden.
## check.mjs section `15C CULL` (`--cull`). Budgets: cull adds 0 meshes; demo_world with cull ≤ 110 dc when focus is at a zone centre (record, don't chase).
## Content rules: none. 
## Handoff `docs/HANDOFF_15C.md`: Done / Missing / Measured (dc with/without) / Suspected / Notes (tell 17A the `regions` contract and the `onLoad` timing).
