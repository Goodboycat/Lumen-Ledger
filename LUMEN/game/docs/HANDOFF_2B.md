# HANDOFF — Chat 2B: 6 Helpers + HelperAnimator  ✅ DONE (2026-10-17, finished by chat 2B-fix/2C)

Verified: `node tools/check.mjs --creatures` ALL OK — all 6 helpers build; every clip (idle/work/carry/happy/walk + the 6 inherited
CreatureAnimator clips) runs 2 s headless per type with no NaN pose; ≥ 2 work beats fire per 2 s; crate is visible during `carry`.

## Delivered (owned files)
- `src/assets/creatures/helpers.js`
  - `makeHelper(type, { seed, size, outline })` → Group (feet pivot). `userData.parts = { body, torso, head, headMesh, face, tool, toolMesh,
    held, shell, shadow, wingL/wingR (bee), tail (fox) }`, `userData.type / info / hover / height`.
  - `HELPER_TYPES` (6) · `HELPER_ANIMS` = idle · work · carry · happy · walk · `HELPER_INFO` (name, job, color, wage, effect, blurb — data for 4A/5/7A).
  - `HelperAnimator(root, type, { vfx, onWork, onCoin })` extends CreatureAnimator → same `.play/.update/.moodTint/.faceTo/.faceToNow/.hit/.current/.timeScale`.
    `onWork(worldPos)` fires once per 800 ms work loop on the job beat; `vfx.sparks.burst` (+ dust for mole/tortoise) on the beat. `.carrying` mirrors the crate.
    Every clip except `carry` hides the crate. Phase tables (ms · easing) are in the file header.
  - `measureHelper` (= measureCreature re-export).
- `src/assets/creatures/index.js` — barrel exports helpers.js.
- `demo_helpers.html` — 6 helpers in a row doing their work loops facing Pip; keys 1–9 = clips, T slow-mo, H team ×12 (carriers walk, perf proof),
  M mood sweep, tap = hit + angry + hit-stop, WASD moves Pip. Shows fps · draw calls · per-helper tris/dc · live work-beat counter. `window.game` set.
- `tools/check.mjs --creatures` helpers section (shared tool; additive only).

## Measured (at rest, incl. outlines; hidden carry crate counted in meshes but not drawn → subtract 2 while not carrying)
| helper | tris | meshes+hulls | dc at rest | dc carrying |
|---|---|---|---|---|
| tallyOwl | 1046 | 8+4 | 10 | 12 |
| packMole | 1069 | 8+4 | 10 | 12 |
| sparkBee | 1296 | 10+4 | 12 | 14 |
| guardTortoise | 1235 | 8+4 | 10 | 12 |
| scoutFox | 1230 | 9+5 | 12 | 14 |
| gardenerSnail | 1428 | 8+4 | 10 | 12 |
Tris exceed the 600 target (same reason as Glimmers: Foundation `G.sphere` segment counts); draw calls — the real limit — are at/under 12 at rest.
If 11A needs tris: lower sphere segments in the BUILD kits (9×7 → 7×5 halves it).

## Missing
- Nothing from P1/P2. P3 (job VFX hooks) shipped as `vfx.sparks` on beat. Browser smoke: see HANDOFF_2C (one run covers both demos if BROWSER OK).

## Notes for integrator (4A, 5, 10B)
- Hire flow: `makeHelper(type)` → place at a stall → `new HelperAnimator(g, type, { vfx, onWork: () => economy.applyHelperEffect(type) })` → `.play('work')`.
- Mover (5/6A) sets `root.position` + `anim.faceTo(next)`; use `carry` while hauling (480 ms hop ≈ 1.2 u/s), `work` when parked.
- `sparkBee` hovers via `userData.hover` (body y offset added in update, shadow shrinks) — do not raise `root.position.y` for it.
- `moodTint` clones materials per helper (same as 2A); fine for ≤ 20 helpers.
