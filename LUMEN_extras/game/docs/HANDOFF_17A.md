# HANDOFF 17A — Regions.js: 7 regions, gates, load/unload, return paths (2026-11-01, chat 17)

## Done (P1 + P2 + P3)
- [x] `data/regions.json` — 7 rows (hub / rootwood / crags / tidepools / mines / orchard / citadel) with center, radius, atmosphere, gateFrom, need, returnPath, enemies, boss, reward
- [x] `src/world/regions/Regions.js` — `createRegions({scene, island, bus, flags, data})`: `list`, `current`, `at`, `isLand` (hub ∪ registered grounds), `register`, `gates` (pos on the from-rim), `canOpen`, `tryEnter` (open | locked | noregion), `update` (1-frame debounce, visible + animators paused), `useReturn` / `unlockReturn`, `nearestPier`, `hintFor`, `destroy`; pure `hasFlag`, `emptyFlags`, `POWER_NAMES`, `loadRegions(url)` for the browser
- [x] `src/world/regions/index.js` barrel · `tests/regions.test.mjs` (node --test, 4 pass) · `check.mjs --regions` "17A REGIONS" (4 ms)

## Missing
- nothing from the prompt. Not wired into Game.js yet (that is 17E `installRegions(sb)`); no meshes (gate posts = 17B).

## Measured
- 0 meshes, 0 draw calls; gate runs in 4 ms.

## Suspected
- `at()` uses nearest-center-within-radius; hub also wins when `island.isLand(x,z)` is true outside r 11. Region circles of 17B+ must not overlap, or `at()` flickers at the seam (debounce only covers 1 frame).

## Notes for the integrator (17B–17E, 18A)
- **register shape**: `R.register(id, { group, isLand(x,z), anchors:{ enter, pier, campfire }, returnPath:{ from, to, unlocked } })`. Pass the Node-parsed json as `data` (browser: `await loadRegions()`).
- **flags truth** = `sb.flags = { powers:Set, missions:Set, keys:number, rep:number }`; powers are `sparkTether electricOrb bubbleWalk lumenLantern heatStomp` (`POWER_NAMES`). 18D+ adds to `powers`, 24E to `missions`; nobody edits Regions.js.
- Gate ids are `'from>to'` (`hub>crags`, `orchard>citadel`). `tryEnter` emits `region:gate` every call (locked | open); the biome's gate prop listens for the `open` state.
- Hub pier default `HUB_PIER = (0,0,10)`; 17B should `register('hub', { anchors:{ pier } })` with Island v2's real pier so 15B edge falls land right.
- `hintFor` texts name the action ("Needs Spark Tether", "Finish quest T2-1") — never a Spark price (Bible §2). UI reads `R.hintFor(gate)`.
