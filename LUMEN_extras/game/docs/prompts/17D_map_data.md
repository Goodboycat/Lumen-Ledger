# Chat 17D — Map.js: map-screen data, discovery, "seen but unreachable"
Needs: 17A Regions (ids, gates, bus) · 17C puzzles (door ids as markers) · 10D save (shape only, no edits)      Blocked-by: 17A
Owned (only these files): src/world/Map.js (new), tests/map.test.mjs (new), data/regions.json (+ `map:{x,y,icon}` per region — additive keys only), check.mjs (additive `--map`)
Read (max 8 credits): START_HERE.md → VISION_V2.md §2 "Closed paths / treasures" (last paragraph) → this → API_CONTRACTS "Regions (17A)", "Save (Chat 10)" → HANDOFF_17A Notes
Export (API_CONTRACTS "Map (17D)", ≤ 6 lines):
  `createMap({ bus, regions:R }) → M` · `M.state = { discovered:Set<id>, visited:Set<id>, markers:Map<id,Marker>, seen:Set<markerId> }`
  `Marker = { id, region, kind:'gate'|'treasure'|'key'|'campfire'|'boss'|'return'|'shop', pos:[x,z], need?:Need, state:'hidden'|'seen'|'reachable'|'done' }`
  `M.addMarker(marker)` (biome IDs call it when they build a nook) · `M.see(markerId)` (hero within `SEE_DIST = 7` u or camera framed it) · `M.done(markerId)`
  `M.view() → { regions:[{id, name, num, x, y, icon, state:'hidden'|'discovered'|'visited'|'current'}], markers:[…with state], gates:[{from,to,open,need,hint}] }` — pure data for ui/map (26C)
  `M.serialize() → json` · `M.restore(json)` · bus: `map:discover {id}` · `map:marker {id, state}` · `map:reachable {id}` (a seen marker's need just became satisfiable — the "go back!" ping)
  listens: `region:enter` → visited+discovered · `region:gate` → gates mirror · `puzzle:solved`/`puzzle:door` → marker done when `marker.puzzle === groupId`

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `data/regions.json`: add `map:{x,y,icon}` per region = normalized 0..1 screen coords following the VISION §2 ascii map (hub 0.5,0.55 · rootwood 0.15,0.55 · crags 0.85,0.55 · tidepools 0.5,0.9 · mines 0.25,0.25 · orchard 0.5,0.1 · citadel 0.85,0.15) and icons `market tree bolt wave pick snow tower` (names that `ui/icons.js` already draws or will — check `ICON_NAMES`, add nothing to icons.js).
- `Map.js`: `createMap` subscribes to 17A/17C events, keeps the sets, `addMarker/see/done`, `view()`; a region becomes `discovered` when the hero enters it OR stands at its gate post (`region:gate` with hub as from → the `to` region is discovered as a silhouette). Hub starts discovered+visited.
- `tests/map.test.mjs` (node:test, no Three, bus stub): enter rootwood → discovered+visited, `map:discover` once · gate locked event → target discovered but not visited · marker lifecycle hidden→seen→reachable→done with the right bus events · serialize/restore round trip equals · unknown region id ignored without throwing.
- `check.mjs --map` additive `17D MAP` (see below).
### P2 — should ship (≈ 15 credits)
- `M.update(dt, heroPos)` — auto-`see` markers within `SEE_DIST` of the hero in the current region; `reachable` re-evaluation on `flags` change: `M.recheck(flags)` → every seen marker whose `hasFlag(flags, need)` turned true emits `map:reachable` once (this is the backtracking hook; UI 26C shows the ping).
- Completion: `M.completion() → { markers:{done,total}, regions:{visited,total}, pct }` — finite game (VISION §1.7).
### P3 — nice to have (≈ 10 credits, only if P1+P2 are written to disk)
- `M.pathHint(targetRegion) → [regionIds]` — BFS over gates from current region ignoring locks (so the UI can draw a dotted route) + `blockedAt` = first locked gate on it.

## Demo page: none — pure logic, `tests/map.test.mjs` + `--map`. (ui/map.* is 26C; 17E's demo prints `M.view()` JSON in its stats overlay.)

## check.mjs section `--map` (additive; name it `17D MAP`)
- regions.json: 7 rows, every row has `map.x/y ∈ [0,1]` and `map.icon ∈ ICON_NAMES` (import ui/icons.js) — the icon assert is what keeps 26C from drawing a missing glyph.
- createMap with the real 17A `createRegions` (stub island) → `view().regions` hub `current`, others `hidden` · emit `region:gate {id:'hub-rootwood', state:'locked'}` → rootwood `discovered`.
- 3 markers in rootwood, `see` two, `recheck` with `powers.add('heatStomp')` → the one with `need:{power:'heatStomp'}` → `map:reachable` once; `done` → completion `1/3`.
- `serialize` → JSON string ≤ 2 KB for 40 markers · `restore` on a fresh map reproduces `view()` deep-equal · `destroy()` → 0 listeners · run ≤ 1 s.

## Budgets (per item, draw calls incl. outline): 0 meshes. Serialized map ≤ 2 KB at 40 markers (save v2 budget 29C).
## Content rules that bite here: a marker's `need` text is always an action ("needs Heat Stomp"), never a Spark price; "treasure" nooks are finite — `completion()` must count them, not an "unlimited" pool (VISION §1.7).
## Handoff `docs/HANDOFF_17D.md`: Done / Missing / Measured / Suspected / Notes for the integrator (≤ 15 lines; tell 18A–23A the `addMarker` call to make per nook and 26C the exact `view()` shape; tell 29C the serialize key is `map`).
