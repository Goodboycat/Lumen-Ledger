# HANDOFF 6A — Customer AI (2026-10-17)

## Done
- `src/systems/flowfield.js` — **PURE JS** (no Three). `FlowField({ isLand, isBlocked })`: 8-neighbour Dijkstra-lite distance field per target
  cell (straight 1 / diagonal 1.4, **no corner cutting**), LRU cache (24 targets), `get(tx,tz)`, `direction(field,x,z)` (look-ahead smoothing),
  `distance()`, `nearestWalkable()`, `invalidate()`. Walkable = `island.isLand && !build.occupied`.
- `src/systems/customers.js` — `CustomerSystem(game, { island, build, economy, creatures:{ makeGlimmer, CreatureAnimator }, vfx, maxActive })`
  exactly per API_CONTRACTS §B Customers (+ `spawnOne(type)`, `setPrice(stallId, p)`, `price()/fair()`, `setSpawnPoint()`, `clear()`, `byState()`, `serialize()/load()`).
  - P1: FSM spawn(pier = `island.landEdge(0,-1)`) → pickStall → walk (flow field + separation 0.7 u + arrive slow-down, slides along blocked cells)
    → queue slot (4 per stall, from `build.stalls()[i].slots.queue`, shuffles forward) → browse 1500 ms → pay (`economy.sell(stallId, type, price)` →
    `cust:paid {paid, sold, price, fair, mood, reaction, at}` + gold "+N" pop + `onCoin` hook) → happy/sad/angry → leave to pier → despawn → **pool** (reused). maxActive 20 (hard cap 40).
  - P2: mood from price/fair: ≤0.9 → mood 1.0 happy · ≤1.1 → 0.75 happy · ≤1.4 → 0.35 sad · >1.4 → 0.1 angry (`cust:angry`); nothing sold → sad.
    `anim.moodTint()` applied. Type preferences `PREFS` (12 types × stall kinds), weighted pick = pref / (1+queue) / (1+dist/12) + jitter. Speed per type (kid/impulse fast, elder slow).
  - P3: give-up: no stalls 3 s → angry "no stall" · all queues full > 0.6·patience → "full" · in queue > patience (14 s × GLIMMER_INFO.patience) → "waited".
    `spawnWave(season, n?)` uses the `WAVES` table (S1 6 regular/newbie/kid … S6+ 14 with vip/critic/collector), 0.45 s apart. Stall demolished under a queue → re-pick.
  - Sequences: `custSpawn` (pop 260 outBack → settle 120) and `custLeave` (shrink 220 inBack) + dust puffs. Listens `build:placed/removed`, `island:unlock` → flow cache invalidate + reroute.
- `demo_customers.html` — 3 stalls pre-placed via `build.load()`, auto wave of 10 every 15 s (Enter = wave now, 1 = spawn one, Shift+S = season+, C = clear),
  price sliders per stall (watch the reaction change), event log, `window.game` + stats.
- `tools/check.mjs --customers` — 5 headless checks: FlowField reach/corner-cut/cache · 1 regular full FSM (browse 1500 ms, spark +paid, pool reuse) ·
  wave of 20 (cap, queue ≤ 4, ≥ 16 paid, all leave, never on water / in a footprint, no NaN) · price→mood table · prefs/speed + demolish-under-walker + no-stall give-up. ALL OK.

## Missing
- Nothing from P1–P3. 6B (customer feel) owns polish: coin-fly to hero (hook `vfx.coinFly` is already called when 9A registers it), speech bubbles, crowd murmurs.

## Measured
- smoke `demo_customers.html`: **ERRORS: none**. 104 dc idle (island + 3 stalls + Pip) → 167 dc with 7 Glimmers on screen (≈ 8–11 dc per Glimmer, 2A/2D budgets).
  20 Glimmers ≈ +200 dc → 11A should switch crowds to the 2A `compactGlimmer` + shared-material path or InstancedMesh bodies when > 10 are visible.
- Headless fps n/a; swiftshader 20 fps with 7 Glimmers (CPU GL, not representative).

## Suspected
- Spawn point is `landEdge(0,-1)` (−Z edge). If 10A puts the pier elsewhere, call `cust.setSpawnPoint(x,z)` after Island/landmarks are placed.
- Economy `sell()` can return `sold: 0` at a fair price for low-wallet types (kid) when base demand rounds down → they leave "sad" without paying. Intended, but 4B may want `base ≥ 1`.

## Notes for the integrator (10B)
- Construct after Build: `new CustomerSystem(game, { island, build, economy, vfx, creatures: { makeGlimmer: (t) => makeGlimmerAny(t), CreatureAnimator } })`; `cust.update(dt)` each frame.
- Trigger `cust.spawnWave(eco.state.season)` on `eco:season` (and a first one at game start). Set prices from the 7B ledger UI via `cust.setPrice(stallId, price)`.
- HUD counts: `cust.count`, `cust.totals { spawned, paid, sparkEarned, left, angry, gaveUp }`. Events: `cust:spawn / cust:paid / cust:left / cust:angry / cust:wave / cust:state`.
