# HANDOFF — Chat 1B: Props / Nature  ✅ DONE (verified by the 1C chat on 2026-10-17)

Re-verification: `node tools/check.mjs --props` ALL OK (24 nature entries build), `demo_nature.html` smoke test
0 console errors (screenshots in `docs/screenshots/1B_nature/`).

## Delivered
- `src/assets/props/nature.js` — 8 trees, 10 rocks, 6 bushes (`NATURE_PROPS`, 24 ids, category `nature`), each
  `makeX({seed, scale, outline, sway}) → Group`, pivot at base, baked with `mergeGroup` (1–2 meshes + hulls).
  `userData.sway(t)` on every prop (crown ±0.03 rad), `swayAll(t)` drives all props + fields, `setWindEnabled()`.
- `makeFlowerField(count, areaFn, {seed})` → ONE InstancedMesh (5 colors, shader wind, 1 draw call).
- `makeGrassTufts(count, areaFn, {seed})` → ONE InstancedMesh (shader wind, 1 draw call).
- `makeRandomNature(r)` convenience; `NATURE_COLORS` palette. Registered in `src/assets/props.js`.
- `demo_nature.html` — showcase rows + 50 scattered + 300 flowers + 200 tufts; keys N/R/L/1/2/3/0.

## Measured (from check.mjs)
Trees 100–260 tris / 2 meshes (base + crown) → 4 draw calls incl. outline. Rocks 36–132 tris / 1 mesh → 2 dc.
Bushes 60–260 tris / 1–2 meshes. Fields: 1 dc each regardless of count.

## Notes for integrator (10A)
- Call `swayAll(game.time)` once per frame. Dispose scattered props with `g.userData.dispose()` (removes swayer).
- `makeFlowerField/GrassTufts` use `opts.radius` (default 11) as the scatter square — pass a bigger radius for Island v2 lobes
  (e.g. 28) or call once per zone with that zone's `areaFn`.
