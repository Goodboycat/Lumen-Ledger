# HANDOFF 42A — Tills: customers pay the stall, Pip collects (MASTER_PLAN_V6 phase 42, 2026-11-03)
Two chats: P1 + P2 (till.js, economy/customers glue, Game.js installTills, HUD chip, ledger tax row, gate) by chat A (axed before closing); gate verification, stale `--enemies` fix, this handoff + close by chat B. All pushed.

## Done
- `src/systems/till.js` (new, pure + coin-layer adapter): `createTills({bus, eco, build, vfx, coinLayer, stats}) → T` · `T.get(id)`, `T.pay(id, amount, meta)`, `T.collect(id, 'walk'|'magnet'|'helper'|'sweep')`, `T.spill(id, n)`, `T.sweep(tax)`, `T.tickHelpers(dt, helpers)`, `T.remove(id)` (stall destroyed → money to pouch, entry dropped). Constants `TILL_CAP 40` (+20/level via `tillCap(level)`), `SPILL_PCT 0.5`, `SWEEP_TAX 0.10`, `HELPER_EVERY 12`, `COINS_PER_STACK 8`.
- `economy.js` `sell(..., {toTill:true})`: ledger `sales/units` still count, `_addSpark` skipped, returns `{ok, amount, price, mood, toTill}`; `eco:sale` carries `toTill:true`.
- `customers.js`: the single pay call → `sell(..., {toTill:true})` then `this.till.pay(s.id, r.amount, {type})` when `sb.cust.till` is set (sandboxes without tills keep the old direct-pouch path). 20 % ground tip unchanged.
- `Game.js installTills(sb)`: coin layer on the existing `sb.coins` InstancedMesh (ground coins first, till stacks after; one `setMatrixAt` pass) · walk-over collect ≤ 1.1 u from the counter front · `coinMagnetDash` collects every till within `TILL_MAGNET` of the dash (stack's first coin stands in for the till) · season end = `T.sweep()` **before** `endSeason` (no income double count) · helper tick · `sb.stats.tillCollected` · `destroySandbox` cleans up.
- `ui/hud.js`: "on counters N" chip next to the Spark chip, hidden at 0, `.hot` pulse while any till ≥ 60 % cap. `ui/ledger.js`: red row "Left on counters: −10 % (Collector tax)", hidden when 0 (`check --ui` now expects 6 rows).
- **P2 shipped**: season sweep with 10 % tax (row above) · helpers seated at a stall empty its till every 12 s.
- `tools/gates/till.mjs` + `check.mjs --till` ("42A TILLS"): 1 headless season → every `eco:sale` toTill, pouch untouched by sales, Σ `till:change` = ledger income; walk +40 / magnet +24; 45 ✦ into an L1 till → `till:full`, ≥ 2 ground coins; sweep 40 − tax 4; +0 meshes (shared InstancedMesh); helper + remove; `destroySandbox` 0 leaks.
- Side fix (chat B): `check.mjs --enemies` was red since 41C — the S1 Collector has hp 1 / reward 2 (`ENEMY_RULES.collectorS1`), so the "2 hits → defeat" probe now follows `E.rulesFor(c)`; the Baron probe froze the clock with `config.seasonSeconds = 1e9`, which the 41C curve ignores → also sets `seasonSecondsOverride`. Full flag set ALL OK.

## Measured
- Spark through Pip's hands (telemetry `sparkHandled/sparkTotal`), scripted hero collecting every 10 s, 1 season: **157/192 = 81.8 %** (PLAN §5 target ≥ 80 %; 40B baseline was 0 %).
- Gate season: 12 sales, 95 ✦ paid → 79 ✦ on counters + 16 ✦ overflow (one L1 till hit the 40 cap → FULL, 6 coins spilled). Income path unchanged in total (ledger.sales == Σ till deltas), so S1 income vs 41C is ± 0 % at the ledger; the pouch now lags until Pip collects.

## Missing
- `demo_till.html` (prompt's demo page) not written — the gate covers every rule headlessly; a browser demo costs credits this chat did not have. Eyeball in `index.html?debug`: sell something, watch coins stack on the counter, walk into it.
- P3 till sign with drawn digits: skipped (icon atlas has no digits).
- No browser screenshot of the stacks / chip / red ledger row (no Playwright here).

## Suspected
- Till stacks share `sb.coins`' InstancedMesh capacity (`COIN_MAX`); 12 stalls × 8 coins + ground tips could reach the cap in late seasons → then the oldest ground tips simply do not render (no crash). If it shows, raise `COIN_MAX` by 96.
- Helper auto-collect every 12 s is strong: with 3 helpers the "on counters" lesson almost disappears. Consider 20 s if the funnel shows `tillCollected` ≈ 0 for players with helpers.

## Notes for the integrator
- **42B** (pouch at risk): the pouch (`eco.state.spark`) is the at-risk pool; till money is NOT at risk until 42C. `till:collect {how}` is the moment Spark becomes vulnerable.
- **42C** (Collector raids tills): `T.get(id)` for the richest till = `Math.max` over `T.tills` by `amount`; `T.spill(id, n)` already drops n ground tips and emits `till:change`. `till:full` is the "raid me" signal.
- **43** (tills per season script): `tillCap(level)` and `SWEEP_TAX` are the only knobs; keep `eco:sale.toTill` true everywhere so 40A's ratio stays meaningful.
