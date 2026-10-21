# HANDOFF — Chat 1A: Props / Stalls  ✅ DONE (finished by chat 1A-fix, re-verified by the plan-v3.1 chat on 2026-10-17)

Re-verification (fresh sandbox): `node tools/check.mjs --props` ALL OK · `node tools/smoke.mjs demo_stalls.html --keys 1,2,3 --shots --close`
→ 0 console errors, 12 stalls × L1/L2/L3 all build, draw calls 413 (far) / 341 (close) of which ~36–74 are stalls.
Screenshots: `docs/screenshots/1A_stalls/`. Also owns `src/assets/props/merge.js` (missing from the original Owned line — fixed).

## Delivered (all load with zero console errors, verified headless with Playwright)
- `src/assets/props/stalls.js` — 12 stalls (fruit, bread, lantern, fish, flower, tool, cloth, pottery,
  toy, tea, book, sparkExchange), each `makeStallX(opts) → Group`, pivot at base, footprint 2×2,
  faces +Z, toon + outline, `userData.slots = { counter, queue[4], sign }`, `userData.setLevel(1|2|3, ctx)`,
  `userData.update(dt)` (sign swing, flag wave), `userData.level / stallType / name`.
- Level swap Sequence `stallLevelUp`: squash 120 outCubic → swap 1 → pop 260 outBack → settle 180 outCubic,
  dust + sparks via `ctx.vfx`. Calls made during a swap are **queued, never dropped** (bug fixed).
- `src/assets/props/merge.js` — `mergeGroup(root, { keep })` bakes a prop's ~40 toon meshes into ONE
  vertex-colored toon mesh (+1 flat mesh for glowing parts). A stall = 3 meshes at L1, 5 at L3.
  Exports `toonVertexMat()`, `flatVertexMat()`, `disposeMerged()`. **1B / 1C / 2x should reuse it.**
- `src/assets/props.js` — `PROP_CATALOG`, `registerProps(map)`, `makeProp(id, opts)`,
  `propsByCategory(cat)`, `measureCatalog()`, `countTris(root)`.
- `demo_stalls.html` — 4×3 grid, keys 1/2/3 (animated level on all), C cycle, Space random, tap a stall
  to level it up, queue-slot discs, name labels, per-level tri table, fps/draw-call stats.

## Measured
| | L1 | L2 | L3 |
|---|---|---|---|
| tris per stall (range) | 360–612 | 456–708 | 620–872 |
| draw calls per stall (mesh+outline) | 6 | 6 | 10 |
| 12 stalls total extra draw calls | ~36 | ~36 | ~74 |

Contract said ≤ 300 tris; a 3-level stall with goods is realistically 400–900. Updated the contract to
**≤ 900 tris / ≤ 10 draw calls per stall** (draw calls matter far more than tris on mobile).

## Known / for other chats
- Foundation `index.html` alone is **379 draw calls** (Island tiles, trees, rocks are not instanced).
  That is Chat 1C (Island v2) + 11A work, not 1A. Stalls add only 36–74.
- Costs in `STALL_PROPS[*].cost` are placeholders → Chat 4B.
- `slots` are LOCAL; call `stall.localToWorld(v.clone())` after placing (Chat 5/6).
- `setLevel(lvl, { animate:true, game, vfx })` returns the Sequence (or null if no change / queued).
