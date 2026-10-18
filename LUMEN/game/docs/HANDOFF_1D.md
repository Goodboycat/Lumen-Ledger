# HANDOFF 1D — Decor props (2026-10-17)

## Done (all 3 tiers, 20 props, all baked with mergeGroup, all ≤ 6 draw calls incl. outline)
- **P1** jar_spend / jar_save / jar_invest / jar_protect (`makeJar(kind)`; `userData.setFill(0..1)`, `.fill`, `.jarKind`, `.color`, `.glow`),
  fence_post, fence_rail (1 tile, owns the post at x-0.5 → chain at 1-tile pitch along X, add a fence_post at the end), crate, barrel.
- **P2** fence_gate (2×1, leaves ajar), lantern_post + lantern_hanging (`userData.setLit(bool)`, `.lit`, `.glass`; toon amber ↔ flatMat glow),
  sign_arrow (points +X), sign_board, sign_hanging (swings), bench (2×1), path_dirt + path_stone (flat 1×1 slabs, top ≈ y 0.04–0.06).
- **P3** banner_string (2×1, 7 flags wave), flower_pot, water_trough (2×1).
- `makeJarFillSequence(jar, { from, to, onDone }) → Sequence` — anticipation 120 inOutCubic → fill 400 outCubic → wobble 200 outElastic (720 ms).
- `swayDecor(t)` drives banner flags + hanging sign + hanging lantern (pure fn of time). `userData.dispose()` unregisters.
- Registered in `src/assets/props.js` (`registerProps(DECOR_PROPS)` + `export *`), exports `DECOR_IDS`, `JAR_IDS`, `LANTERN_IDS`, `JAR_KINDS`, `JAR_LABELS`.
- `demo_decor.html` (J fill jars staggered 90 ms · K empty · L lanterns · 1/2/3/0 rows · tap = fill/toggle). `window.game` set.
- `tools/check.mjs --props` now has a **DECOR (1D)** section: every prop ≤ 10 dc, jars setFill 0/0.5/1 + jarFill 1 s headless (reaches wobble,
  ends fill=1, body scale back to 1, no NaN), lanterns setLit swaps toon↔flat, sway props no NaN.

## Missing
- Nothing from the prompt. Not done (not asked): jar "coin drop" particle on fill (9A VFX can hook `onDone`).

## Measured (`node tools/check.mjs --props`, seed 3)
jar_* 620–688 t / 3 dc (merged body + kept glow disc + 1 hull) · fence_post 36 t / 2 dc · fence_rail 48 t / 2 dc · fence_gate 180 t / 2 dc ·
crate 272 t / 2 dc · barrel 200 t / 2 dc · lantern_post 200 t / 4 dc · lantern_hanging 236 t / 6 dc · sign_arrow 108 t / 2 dc ·
sign_board 484 t / 2 dc · sign_hanging 392 t / 4 dc · bench 96 t / 2 dc · path_dirt 84 t / 2 dc · path_stone 60 t / 2 dc ·
banner_string 324 t / 4 dc · flower_pot 312 t / 2 dc · water_trough 168 t / 4 dc.
Smoke (headless Chromium, software GL): demo_decor.html **ERRORS: none**, 167 draw calls with 30 props + island + Pip, 40k tris. Screenshots in `screenshots/1D_decor/`.

## Suspected
- Jar emblem glyphs (slot / dome / arrow / shield) are tiny at the game camera; the colored band + lid knob carry the identity. If 7A wants jar icons in the HUD, use CSS, not the mesh.
- Jars at 620+ tris because of 10-seg cylinders + torus rim; fine for 4 instances, don't scatter 50 of them.

## Notes for the integrator (10A)
- Jars: place with `makeProp('jar_save', { fill: 0.3 })`, then drive `userData.setFill(jar.balance / jar.capacity)` from economy; use `makeJarFillSequence` for the Ledger Review moment (play via `game.sequences.play(seq, jar)`).
- Lanterns: call `setLit(isNight)` on all `LANTERN_IDS` instances when the day/night cycle flips. Tree lanterns (1B) are separate.
- Call `swayDecor(game.time)` once per frame (like 1B `swayAll`).
- Path tiles sit at y 0.02–0.06 above the island tile top; if the Island v2 tile top is not y=0, offset them.
- Fences: `fence_rail` at x, x+1, x+2 … then `fence_post` at lastX+0.5. Rotate the parent group for Z-running fences.
