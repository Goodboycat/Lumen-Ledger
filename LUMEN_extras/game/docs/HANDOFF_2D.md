# HANDOFF — Chat 2D: 8 more Glimmer variants  ✅ DONE (2026-10-17, finished by the 2D/3A fix chat)

The original 2D chat wrote `glimmers2.js` + the check.mjs GLIMMERS-2 section and was axed before the demo/handoff.
This chat added `demo_glimmers2.html`, this file, the README row. No code in glimmers2.js was changed.

Verified: `node tools/check.mjs --props --creatures` ALL OK — all 8 variants build, kit baked, ≤ 12 dc, all 8 clips +
flourish run 1.5 s headless, no NaN pose; `makeGlimmerAny` ×12 and `registerVariants` (8 added) pass.

## Delivered (owned files)
- `src/assets/creatures/glimmers2.js`
  - `GLIMMER_VARIANTS_2 = { impulse, haggler, kid, elder, tourist, critic, collector, newbie }` — builders `(kit, live, r)`.
  - `makeGlimmerVariant2(type, { seed, color, size, outline, compact })` — same return shape as 2A: Group at feet pivot,
    `userData.parts.{body, kit, live}`, `userData.type`, `userData.info`, **`userData.update(dt)`** (idle flourish — call every frame).
  - `makeGlimmerAny(type, opts)` — **use this for all 12 types** (routes to 2A for regular/saver/spender/vip). Always has `update(dt)`.
  - `FLOURISH[type](root, t, dt)` — continuous, delta-time idle flourish table (header comment has the per-type numbers).
  - `registerVariants(target?)` — pushes the 8 names into `GLIMMER_TYPES`; optionally injects 2A-signature builders into a map.
  - `GLIMMER_VARIANTS_READY_2` (8), `ALL_GLIMMER_VARIANTS` (12, same order as GLIMMER_INFO).
- `demo_glimmers2.html` — all 12 in a ring around Pip (gold label = new in 2D); keys 1–8 clips, T slow-mo, C crowd ×24 (all 12 types),
  M mood sweep, R spin ring, tap = hit; `window.game` set; stats + per-variant tris/dc table.
- `tools/check.mjs --creatures` GLIMMERS-2 section (additive).

## Measured (incl. outlines, seed 3)
| variant | tris | dc | live |
|---|---|---|---|
| impulse | 1362 | 10 | sparkle ring |
| haggler | 1114 | 9 | — |
| kid | 1318 | 11 | propeller |
| elder | 1434 | 10 | cane |
| tourist | 1500 | 10 | camera flash |
| critic | 1024 | 11 | pencil |
| collector | 1230 | 10 | jar coins |
| newbie | 1376 | 10 | "?" bubble |
All ≤ 12 dc. Tris above the 600 target because of the Foundation sphere body (see 2A CHANGE_REQUEST).

## Missing
- Nothing from P1/P2/P3. Browser QA: see summary (one smoke run at the end of this chat, shared with 3A).

## Suspected
- `registerVariants(target)` cannot inject into 2A's private `BUILD` map (module-private). Until 10A applies the CHANGE_REQUEST,
  `makeGlimmerVariant('kid')` from 2A returns the regular-scarf fallback; `makeGlimmerAny('kid')` is correct. 6A: use `makeGlimmerAny`.

## Notes for the integrator (6A / 10A)
- Call `g.userData.update(dt)` each frame alongside `CreatureAnimator.update(dt)` or the live accessories freeze (harmless, but flat).
- `live` is parented to `body` so it follows squash/stretch; `kit` is the static baked accessory mesh.
- Crowd of 24 mixed types + 12 ring ≈ 36 Glimmers ≈ 350 dc in the demo — fine for a demo, 10A/11A should InstancedMesh crowds > 10.
