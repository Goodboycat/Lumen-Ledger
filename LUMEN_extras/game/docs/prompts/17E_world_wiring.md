# Chat 17E — World v3 wiring: installRegions, streaming, demo, playtest slice
Needs: 17A Regions · 17B hub · 17C puzzles · 17D map · 15C cull.js · 15B vitals (nearestPier) · 10B createSandbox      Blocked-by: 17A 17B 17C 17D
Owned (only these files): src/Game.js (`installRegions(sb)` + 3 lines in createSandbox/destroySandbox/isBored), src/systems/cull.js (biome streaming hook, ≤ 20 lines), src/entities/HeroController.js (isLand → `sb.regions.isLand ∪ puzzles.platformAt`, ≤ 10 lines), demo_world3.html (new), tools/play.mjs `--script world3` (new script only), check.mjs (additive `--world3`)
Read (max 8 credits): START_HERE.md → VISION_V2.md §2 + §7 → this → HANDOFF_17A/17B/17C/17D "Notes for the integrator" ONLY → Game.js createSandbox (lines 46–130) + installRunWires head
Export (API_CONTRACTS "World wiring (17E)", ≤ 6 lines):
  `installRegions(sb) → sb.regions (17A R) · sb.hubRegion (17B) · sb.puzzles (17C PZ) · sb.map (17D M) · sb.flags = { powers:Set, missions:Set, keys:0, rep:()=>eco.rep }`
  `sb.flags` is THE unlock truth: 18D+ do `sb.flags.powers.add('sparkTether')`, 24E `sb.flags.missions.add('T2-1')`, key nooks `sb.flags.keys++` → `sb.regions` + `sb.map.recheck` react on the next update (no bus needed)
  hero `isLand(x,z)` = `sb.regions.isLand(x,z) || !!sb.puzzles.platformAt(x,z)`; platform delta applied in `installRegions`'s update, before the hero's own move
  bus: `world:ready {regions:7, gates:6}` once per sandbox · cull: `cull:stream {id, on}` when a region group is streamed in/out (15C)
  Save v2 (29C) will read `{ flags, map: sb.map.serialize() }` from `sb.worldState()` — ship `worldState()`/`restoreWorld(d)` stubs here (P2)

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- Game.js `installRegions(sb)`: createRegions (island, flags) → installHubRegion → createPuzzles → createMap; `sb.update` chain gets `regions.update(dt, heroPos)` → `puzzles.update` → `hubRegion.update` → `map.update` (P2);
  the hero's `isLand` closure now points at the union; `destroySandbox` destroys all four (0 listeners — check.mjs asserts). `lg.isBored()` stays true inside the hub only (regions.current === 'hub').
- cull.js: `streamRegion(group, on)` = the existing visible/paused toggle + `cull:stream` event, called from 17A's `region:load/unload`; the hub never streams out while a Glimmer is active (customers live there).
- `demo_world3.html`: the whole skeleton — hub island + 6 gate posts + 6 placeholder region discs (flat toon cylinders r 12 at the 17A centers, each with a campfire placeholder and one 17C piece) + Pip. Keys: `1–6` grant flags
  (sparkTether electricOrb bubbleWalk lumenLantern heatStomp + mission T2-1/T4-2 via `M`/`K` = keys++), `G` teleport to the nearest gate, `R` use return path, `P` print `sb.map.view()` to the stats overlay. `window.game` set.
- `check.mjs --world3` additive `17E WORLD3` (see below).
### P2 — should ship (≈ 15 credits)
- `sb.worldState()` / `sb.restoreWorld(d)` — flags + map round trip (pure); `map.update(dt, heroPos)` wired; `vitals` edge-fall respawn uses `sb.regions.nearestPier` when present (one line in installRunWires, guarded).
- `tools/play.mjs --script world3` (Playwright, ≤ 4 shots, 25-credit cap): start demo → walk to the rootwood gate (locked bump, purple lamp) → press 1 → arch rises → walk through → `region:enter rootwood` → `R` back to hub. Shots to `LUMEN_extras/screenshots/17E_world3/`.
### P3 — nice to have (≈ 10 credits, only if P1+P2 are written to disk)
- Gate approach camera: entering a gate's 4 u radius eases `camera.zoom` 1.25 → 1.1 and nudges the follow target 1.5 u toward the gate (Tween 400 ms), back on leave — reuses GameCamera API, no new camera code.

## Demo page `game/demo_world3.html` (above). Stats: current region · flags · open gates · map discovered/visited · dc count. Must stay ≤ 180 dc with all six discs loaded.

## check.mjs section `--world3` (additive; name it `17E WORLD3`)
- `createSandbox` headless (reuse the `--sandbox` harness) → `sb.regions` 7 regions, 6 gates, `world:ready` once, hero `isLand(0,1)` true, `isLand(−34,0)` false (rootwood unregistered in the real game until 18A).
- register a stub rootwood group → `sb.flags.missions.add('T2-1')` → 1 s → hub→rootwood gate open (`region:gate open`), arch visible; move hero to (−34,0,0) → `region:enter rootwood`, `cull:stream {hub,off}`… then back to (0,0,1) → hub streams on.
- a 17C Platform added at (5,0,5) → `isLand(5,5)` true; hero standing on it for 1 s moved with it (delta applied).
- `destroySandbox` → bus listener count equals the pre-sandbox count · whole gate ≤ 3 s.

## Budgets (per item, draw calls incl. outline): region placeholder disc ≤ 2 · demo total ≤ 180 · installRegions adds 0 per-frame allocations (reuse Vector3s).
## Content rules that bite here: streaming a region out never despawns a Glimmer mid-purchase; the hub market keeps running while Pip is away (VISION §1.3) — do not pause `cust`/`eco` on `region:unload hub`.
## Handoff `docs/HANDOFF_17E.md`: Done / Missing / Measured / Suspected / Notes for the integrator (≤ 15 lines; this is the handoff 18Z reads first — list the exact 6 lines a biome ID must write to plug in: register, addMarker, puzzles.add, flags, returnPath, anchors).
