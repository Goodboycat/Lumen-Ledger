# Chat 17A — Regions.js: 7 regions, gates, load/unload, return paths
Needs: 15C cull.js (visible/paused pattern) · 15B vitals (edge fall → nearest pier) · 10B createSandbox      Blocked-by: 16B
Owned (only these files): src/world/regions/Regions.js (new), src/world/regions/index.js (barrel, new), data/regions.json (new), tests/regions.test.mjs (new), check.mjs (additive `--regions`)
Read (max 8 credits): START_HERE.md → VISION_V2.md §2 (island v3 table + ascii map) → this → API_CONTRACTS "world/Island.js" → HANDOFF_17Z Notes → Game.js lines 46–130 (createSandbox) only
Export (API_CONTRACTS "Regions (17A)", ≤ 6 lines):
  `createRegions({ scene, island, bus, flags:()=>Object }) → R` · `R.list: Region[]` · `R.current` (id) · `R.at(x,z) → id|null` · `R.isLand(x,z)` (hub island ∪ loaded region grounds)
  `R.register(id, { group, isLand(x,z), anchors:{enter, pier, campfire}, returnPath:{from:Vector3, to:Vector3} })` (biome IDs call this; hub = 17B)
  `R.gates: Gate[]` ({from, to, need, pos, open:bool}) · `R.canOpen(gate) = hasFlag(flags(), need)` · `R.tryEnter(gateId) → 'open'|'locked'|'noregion'`
  `R.update(dt, heroPos)` — tracks region, swaps `group.visible`, pauses/resumes `userData.animators`, fires events
  bus: `region:enter {id, from}` · `region:gate {id, state:'locked'|'open', need}` · `region:load {id}` · `region:unload {id}` · `region:return {id}` (return path used)
  `hasFlag(flags, need)` pure: need = `{power?, mission?, keys?, rep?}` → every present key must hold (flags.powers has power · flags.missions has mission · flags.keys ≥ keys · flags.rep ≥ rep)

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `data/regions.json`: the 7 rows of VISION §2 as data — `{id, name, num, center:[x,z], radius, atmosphere, gateFrom, need, returnPath, enemies:[], boss, reward}`.
  Layout (hub at 0,0 r 11; others are placeholders 17B–23A refine): rootwood (−34,0) r 12 · crags (34,0) r 12 · tidepools (0,34) r 12 · mines (−24,−26) r 11 · orchard (0,−40) r 12 · citadel (30,−36) r 10.
  Gates: hub→rootwood `{mission:'T2-1'}` · hub→crags `{power:'sparkTether'}` · hub→tidepools `{power:'electricOrb', rep:2}` · hub→mines `{power:'bubbleWalk'}` · hub→orchard `{power:'lumenLantern', mission:'T4-2'}` · orchard→citadel `{keys:4, power:'heatStomp'}`.
- `Regions.js`: `createRegions` reads the json, builds a `Gate` per row (pos = point on the `from` region's rim toward `to`), `hasFlag`, `at(x,z)` by nearest center within radius (hub wins ties),
  `register` for region groups, `update` that enters/leaves regions (one frame debounce), toggles `visible`, pauses `userData.animators[]` via `.paused = true`, emits the bus events. Unregistered regions are "sealed": `at()` returns their id but `tryEnter` → 'noregion'.
- `tests/regions.test.mjs` (node:test, no Three): hasFlag truth table (6 cases) · at() hub/rootwood/null · gates 6, all locked with empty flags · tryEnter after flags → 'open' + `region:gate open`.
- `check.mjs --regions` additive `17A REGIONS` (see below).
### P2 — should ship (≈ 15 credits)
- Return paths: `R.useReturn(id)` teleports `heroPos` to the hub-side `to` point and emits `region:return` — only when the region is current and `returnPath.unlocked` (set by the biome ID when Pip reaches the far side).
- `R.nearestPier(x,z)` — for 15B edge fall: returns the pier anchor of the current region (hub pier default). Pure, used by vitals through sb.
### P3 — nice to have (≈ 10 credits, only if P1+P2 are written to disk)
- Gate hint: `R.hintFor(gate) → string` ("Needs Spark Tether" / "Pay 100 debt — ask Tally-Owl") from a small table keyed by need; biome/UI IDs read it, 17A does not touch ui/.

## Demo page: none — pure logic, `tests/regions.test.mjs` + check.mjs. (17E ships `demo_world3.html` for the whole skeleton.)

## check.mjs section `--regions` (additive; name it `17A REGIONS`)
- import `src/world/regions/index.js`; createRegions with a stub island (`isLand: (x,z)=>x*x+z*z<121`) and `flags = {powers:new Set(), missions:new Set(), keys:0, rep:0}` → 7 regions, 6 gates, all locked.
- hero at (0,0,1) → update 2 frames → `current === 'hub'`, 1 `region:enter`. Move to (−34,0,0) with rootwood unregistered → `tryEnter` 'noregion'; register a Group → update → `region:load rootwood`, hub group hidden, `region:unload hub`.
- flags.powers.add('sparkTether') → `canOpen(hub→crags)` true, others false; `{keys:4}` alone does NOT open citadel (needs heatStomp too).
- `isLand(−34,0)` false before register, true after (region isLand delegated). `destroy()` → 0 bus listeners (use the same listener-count trick as the audio gate).
- run ≤ 1 s.

## Budgets (per item, draw calls incl. outline): Regions.js adds 0 meshes (gate posts are 17B's). Gate objects are data only.
## Content rules that bite here: gates are never "paywalls" — the need text always names the action (power / mission), never a Spark price (Bible §2 / VISION §4).
## Handoff `docs/HANDOFF_17A.md`: Done / Missing / Measured / Suspected / Notes for the integrator (≤ 15 lines; tell 17B–17E and 18A the `register` shape and the flag names: powers = sparkTether electricOrb bubbleWalk lumenLantern heatStomp).
