# HANDOFF — Chat 2A: CreatureAnimator + 4 Glimmer variants  ✅ DONE (2026-10-17)

Verified: `node tools/check.mjs --creatures` ALL OK (12 types build; all 8 clips run 1.5 s headless on each).
Browser: `demo_glimmers.html` loads with **0 JS errors** (Playwright console capture; only a favicon 404).
Screenshots: none (Playwright/Chromium not installed in sandbox; skipped per policy — no tweak loop).

## Delivered (owned files)
- `src/assets/creatures/animator.js` — `CreatureAnimator(root, { vfx?, onCoin? })`
  `.play(name, ctx?)` · `.update(dt)` · `.moodTint(0..1)` · `.faceTo(vec3)` (smooth yaw) · `.faceToNow(vec3)` · `.hit(dir, power)` ·
  `.current` (clip name) · `.timeScale` (HitStop-compatible) · `.mood` · `.facing`. `CREATURE_ANIMS` = 8 names.
  One-shots (happy/sad*/pay/angry) return to the previous loop automatically. *sad is a hold-loop until another play().
  Phase tables (ms · easing) are in the header comment. All clips are `Sequence`s; poses set absolutely → frame-rate independent.
  Works on ANY creature with `userData.parts.body` (2B helpers / 2C villains can reuse it as-is).
- `src/assets/creatures/glimmers.js` — `makeGlimmerVariant(type, { seed, color, size, outline, compact })`, `GLIMMER_TYPES` (12),
  `GLIMMER_INFO` (name/color/size/budget/patience per type — data for 4A/6A), `GLIMMER_VARIANTS_READY` = regular, saver, spender, vip,
  `compactGlimmer(root)` (bakes Foundation body 3 meshes → 1, eyes 4 → 1; 13 dc → 6 dc), `measureCreature(g)`.
  The 8 unbuilt types (2D) fall back to the "regular" scarf kit with their own colour → nothing crashes if 6A spawns them early.
- `src/assets/creatures/index.js` — barrel. 2B/2C: add `export * from './helpers.js'` / `'./villains.js'`.
- `demo_glimmers.html` — 4 variants in a row facing Pip; keys 1–8 = clips, T slow-mo 0.25, C crowd ×24 (perf proof), M mood sweep, tap = hit+angry+hit-stop.
- `tools/check.mjs --creatures` flag (shared tool; additive only).

## Measured (incl. outlines)
| variant | tris | draw calls |
|---|---|---|
| regular | 874 | 8 |
| saver | 978 | 10 |
| spender | 1082 | 8 |
| vip | 1082 | 10 |
Tris are above the 450 target (Foundation sphere body alone is ~600 tris) but draw calls — the real phone limit — are well under the 12 budget.
If 11A needs tris, lower `G.sphere` segments in Foundation glimmer.js (CHANGE_REQUEST added) or let 2D pass `size`-based LOD.

## Missing
- P3 idle variations (only breathe + random blink shipped). Shadow blob is Foundation's (scales with hop).
- 8 remaining variants' accessory kits → Chat 2D (pattern: add `BUILD[type] = (kit, r) => {...}`; ≤ 8 meshes, baked automatically).

## Suspected / notes for integrator (6A, 10A)
- `moodTint` clones each tintable material per creature (so tints don't bleed through the toonMat cache). For crowds > 50, 6A may prefer
  one shared material per (type, moodBucket). Not an issue at 24 (demo).
- `pay` emits `onCoin(worldPos)` at the toss instant — 6A hooks the coin-fly-to-Pip there. `vfx.sparks.burst` already fires.
- Walking: the animator only animates; the mover (6A) sets `root.position` and calls `anim.faceTo(nextPos)`. Walk hop = 420 ms → ~1.4 u/s looks right.
- `hit()` still works like Foundation `GlimmerController.hit` (squash + jiggle + red flash) so HeroController targets can be swapped to animators.
