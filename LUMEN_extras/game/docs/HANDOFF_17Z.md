# HANDOFF 17Z — plan phase 17 "World v3 skeleton" (2026-11-01, chat 17)
Z-chat deliverable: the full prompts of phase 17 (format `_FORMAT_V2.md`), no code. Written while chat 16B finished the sword combo.

## Done
- [x] `docs/prompts/17A_regions.md` — `src/world/regions/Regions.js`: 7-region registry, hero region tracking, gates (power / mission / keys), load/unload hooks, return paths, bus `region:*`
- [x] `docs/prompts/17B_hub_region.md` — `src/world/regions/hub.js`: Glowmarket as region 1 (wraps Island v2), 6 gate posts on the rim, pier + meadow anchors
- [x] `docs/prompts/17C_puzzles_base.md` — `src/puzzles/`: Switch, Door, Pylon, Anchor, Mirror, Platform + `PuzzleSystem` (links, solve events)
- [x] `docs/prompts/17D_map_data.md` — `src/world/Map.js`: map-screen data (discovered regions, markers, "seen but unreachable"), save-friendly
- [x] `docs/prompts/17E_world_wiring.md` — `installRegions(sb)` in Game.js + cull streaming hook + `demo_world3.html` + playtest slice
- [x] README "Next": `17Z 17A 17B 17C 17D 17E` appended (LUMEN/README.md, bottom) · this HANDOFF

## Missing
- nothing for 17Z itself. Phases 18–30 still need their own Z-prompts (`<N>Z_plan_phase.md` — 18Z is next after 17E).

## Notes for the integrator (17A–17E chats)
- Island v2 (`src/world/Island.js`) stays the **hub ground**. Regions 2–7 are NEW groups positioned around it (see 17A's layout table);
  they do not reuse Island zones. `island.isLand` keeps answering only for the hub; `Regions.isLand(x,z)` is the union (17A).
- Gates are the only way between regions in v3 (closed paths). A gate = {from, to, need}. `need` is one of
  `{power:'sparkTether'}` · `{mission:'T2-1'}` · `{keys:4}` · `{rep:2}` combined with `&&`. The unlock *truth* lives in `sb.flags`
  (17A exports `hasFlag(sb, need)`), so 18D+ (powers) and 24E (missions) just set flags — no Regions.js edits.
- Load/unload = `group.visible` + animators paused (same pattern as 15C culling). Nothing is disposed between regions.
- Every region has `returnPath` (a one-way shortcut back to the hub that opens from the far side) — 17A stores it, biome IDs build the prop.
- No new three.js materials: use `flatMat`/`PALETTE` from `core/Toon.js`. Budgets per `_FORMAT_V2.md`.
