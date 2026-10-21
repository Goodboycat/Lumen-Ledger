# HANDOFF 5 — Build & placement (closed by the chain chat on 2026-10-17; original chat 5 was axed after writing the files)

## Done
- `src/systems/build.js` — `BuildSystem(game, { island, economy?, catalog, vfx? })` exactly per API_CONTRACTS §B Build.
  - P1: `enter(propId)` → transparent toon ghost (green `#66ff88` / red `#ff5566`, alpha 0.55) + grid pad, snaps to 1 u cells,
    footprint × `island.isLand` × occupancy check, `confirm()` → `place()` → **buildPlace** Sequence 610 ms
    (drop 180 inQuad from +2 u / land 90 outCubic squash 0.80 + dust ring + pop "−cost" + shake 0.12 / pop 220 outBack / settle 120).
    `placed` Map (anchor cell key), `cells` Map (every occupied cell), `occupied(x,z)`, `stalls()` (world-space counter + 4 queue slots), `nearest(x,z)`.
  - P2: `rotate()` (rot 0..3, odd rot swaps footprint), `demolish(at)` (50 % refund of cost incl. upgrades, **buildDemolish** 340 ms
    anticipation 120 outBack → shrink 220 inBack, dust burst, group removed on exit), `upgrade(at)` → `economy.stallLevelUp` cost (stallL2 90 / stallL3 180 fallback)
    → the stall's own `userData.setLevel(lvl, {animate:true})` (1A). Cost via `economy.stallCost(id)` → `catalog[id].cost` → 0; `canAfford` stub when no economy.
  - P3: touch flow (`moveTo(x,z)`, `Input.press('build')` via `input.onAction` confirms), `setDebug(on)` InstancedMesh occupancy overlay,
    `serialize()` / `load(list)` (free, no charge) / `clear()`.
  - Events on `game.bus`: `build:enter/exit/ghost/placed/removed/upgraded/denied` (`denied.why` ∈ blocked · cannot afford · max level · …).
- `demo_build.html` — 1–9 pick stall, B build mode, R rotate, click place, X demolish, U upgrade nearest, D debug overlay; starter market via `load()`; `window.game` set; fps/draw-call stats.
- `tools/check.mjs --build` — 9 headless checks (ghost · confirm/sequence · denied · rotate/exit · upgrade L1→L3 · stalls() slots · demolish refund · serialize/load/debug/clear · stub economy + touch). ALL OK.

## Missing
- Nothing from P1–P3. Browser smoke on demo_build.html was not run (chat axed) — the integrator (10A) should run `smoke.mjs demo_build.html` once.

## Measured (headless)
- Ghost = 1 pad + 3 ghost meshes (≤ 4 dc, outline-free). Placed props keep their own 1A/1D budgets (stall ≤ 10 dc, decor ≤ 6 dc).
- buildPlace 610 ms, buildDemolish 340 ms, place drop height 1.98 u. Debug overlay = 1 InstancedMesh regardless of cell count.

## Suspected
- `demolish()` refunds `round(cost × 0.5)` where cost includes upgrade spend — decide in 10B whether upgrades should refund.

## Notes for the integrator (10A/10B)
- Construct after Island + Economy: `new BuildSystem(game, { island, economy, catalog: PROP_CATALOG, vfx })`; call `build.update(dt)` each frame.
- Customers (6A) should read `build.stalls()[i].slots.counter / .queue[k]` (world Vector3s) — they are recomputed from the group transform.
- Save: `build.serialize()` → JSON list `{id,cx,cz,rot,level}`; restore with `build.load(list)` (no spark moves).
