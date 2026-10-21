# HANDOFF 10B — Integrate systems (DONE 2026-10-19, chat 4)

## Done
- `src/Game.js` (≈ 310 lines, GLUE only — rules stay in 4A/4B/5/6A): `createSandbox(game, opts)` → Island v2 + scenery (landmarks/decor/nature baked
  by 10A `bakeStatic`, cells blocked for Build + flow field) + **Economy (4B `makeEconomy`, autoSeason) + BuildSystem (5) + CustomerSystem (6A) +
  HeroController with 3A moves + 3B abilities**, one `sb.update(dt)` registered on the game loop. `opts`: `{ headless, seasonSeconds, seed,
  zonesUnlocked, maxActive, starterStalls, balance }`. Returns `sb = { game, island, eco, build, cust, hero, vfx, world, helpers, coins, keys, ability, stats, log }`.
- **P1 debug keys** (`sb.keys.*`, DOM-free so check.mjs drives them): `pick(i)` 1–9 · `build()` B (enter place mode for the pick) · `rotate()` R ·
  `confirm()` click/tap · `exit()` Esc · `demolish()` X nearest · `upgrade()` U nearest · `endSeason()` E → `printLedger(report)` to console ·
  `hire()` H · `unlock()` Z (buys zone upgrade, free fallback in sandbox). 3 starter stalls placed; `eco.state.stalls` synced from `build.placed`.
- **wireEconomy**: `build:placed` → `eco.spend` + stalls count · `cust:paid` → tip coin · `eco:season` → `sb.stats.reports[]`; season scheduler
  (`installScheduler`): one `pickEvent()` at day 45 % (absorbed → `eco:absorbed` when the shield is armed), a Too-Good Deal (`eco.offerScam`) at 70 % on
  odd seasons, auto-`refuseOffer` at season end.
- **P2 abilities → economy** (`sb.ability(name)`, 5 s cooldown, emits `sandbox:ability {name, effect}`):
  `coinMagnetDash` collects tip coins ≤ 2.2 u → `eco.earn` (idle → auto-aims at the nearest coin, dash ≤ 6 u) · `haggleShout` charges the target's stall:
  next sale price ×1.1 + demand ×1.3 (wrapped `eco.sell`) · `growthStomp` all-stall demand pulse ×(1+pct) for 12 s · `bubbleShield` arms 30 s, next
  scheduled event absorbed · `fogSweep` → `eco.pushFog(strength)` · `ledgerFlash` reveals the pending scam's true cost → `eco.refuseOffer`.
  Tip coins = ONE InstancedMesh (1 dc, max 32); walk-over pickup ≤ 0.7 u.
- **P3** `hireHelper`: `eco.buyUpgrade('helper_<type>')` → `makeHelper` + `HelperAnimator` work loop (idle→work→carry→happy) at the nearest owned stall.
- `demo_sandbox.html`: pick/build/end/hire/zone/wave + 6 ability buttons, live economy readout, 7-line bus log, `window.game/sb/eco/build/cust`.
- `check.mjs --sandbox`: headless 2 accelerated seasons + E → 3 reports no NaN · 41 sales · 3 events · scam offered + expired · all 6 abilities
  assert an economy effect · hire → helper no NaN · 3391 frames in ~0.9 s. Full suite (`--props … --world --sandbox`) **ALL OK**.
- Smoke (once): `demo_sandbox.html` keys 1,B,E,H,Q → **ERRORS none**, 6 shots in `screenshots/10B_sandbox/`.

## Missing
- Nothing from the prompt. Not in scope (10C): UI mount (HUD/jars/ledger/dialogue) on the same bus events; StorySystem hookup.

## Measured
- Browser (software GL, 1280×720): draw calls 169 at load → 253 after 1 build + 1 helper + magnet; tris 83 k → 104 k; meshes 184 → 252. fps 20 is the
  headless-Chromium floor, not a real number. The ≤ 150 dc target stays with **11A** (see HANDOFF_10A). Headless: 246 meshes at start.
- Economy with 3–4 stalls, no jars, 2 × 30 s seasons: sales 41, S1/S2 ★0 (debt grows — expected with default BALANCE at 30 s seasons; 90 s in the demo).

## Suspected
- `sb.eco.sell` wrapper assumes `eco.stallInfo(key)?.fair` exists when a haggled sale arrives with `price == null` (falls back to 5).
- `check.mjs` fogSweep assertion uses the `sandbox:ability` event rather than a fog01 delta: a season end inside the 1 s window re-adds fog.

## Notes for the integrator (10C)
- Mount UI on `game.bus` only: `eco:season` (LedgerReport) · `eco:event` · `eco:scam` / `eco:scamResult` · `eco:absorbed` · `cust:paid` · `build:placed/denied` ·
  `eco:denied {reason|why, cost, spark}` · `sandbox:ability/tip/hired/denied/pick`. Drive input through `sb.keys.*` and `sb.ability(name)` — no DOM in Game.js.
- `createSandbox(game, { headless: true })` gives a mockVfx + no pack1/pack2, so tests need no WebGL. Pass `seasonSeconds` to speed seasons.
- Jars are untouched by the sandbox (`spend/save/invest/protect = 0`): 10C's jar sliders → `eco.allocate` is the only missing economy input.
