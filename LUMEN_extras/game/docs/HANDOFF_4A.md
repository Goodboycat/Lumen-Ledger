# HANDOFF 4A — Economy core (`src/systems/economy.js`, `tests/economy.test.mjs`, `tests/economy.sim.mjs`)

PURE JS (no Three, no DOM). Imports only `../core/EventBus.js`. Default export + named `Economy`, `BALANCE`, `EVENTS`, `SCAMS`, `UPGRADES`, `demand()`, `makeRng()`.

## Done (P1 + P2 + P3 — everything in the 4A prompt)
- **P1** `state {spark, jars{spend,save,invest,protect}, debt, fog01, season, day01, reputation, stalls, lighthouseLit, ended}` ·
  `tick(dtSeconds)` (season = 150 s, auto-`endSeason()` at day01 ≥ 1 unless `opts.autoSeason=false` → clock parks at 1 for the Ledger button) ·
  `sell(stallId, glimmerType, price, {baseMul})` with demand `base × clamp(1.6 − price/(fair·tolerance), 0.1, 1.5) × mood`, deterministic rounding (seeded RNG), wallet cap per Glimmer type, reputation drift (fair ≤ 1.1·fair → +0.02, gouge ≥ 1.4·fair → −0.05) → `{paid, mood, sold, fair, happy}` ·
  `canAfford / spend / earn / buyStall / stallCost / addStall` · `allocate(jarDeltas)` validated (unknown jar, NaN, jar < 0, pouch < 0 → false + `eco:denied`) ·
  `endSeason()` → LedgerReport `{season, income, expenses, interestEarned, interestPaid, investReturn, investRate, upkeep, saved, invested, protected, absorbed, loansTaken, repaid, sales, units, events, scams*, debt, debtBefore, fog01, fogDelta, spark, jars, netWorth, reputation, lessonId, stars 0..3}`.
  Save 5 %/season · loan 20 %/season compounding · stars: income ≥ 1.25×expenses / saved ≥ 20 or debt went down / debt & fog did not grow.
- **P2** `takeLoan` (min 10, max 600 total) / `repay` (capped by debt and pouch) · fog rules (+0.08/season with debt; −0.10 when debt 0 & save ≥ 150; −0.02 extra when debt 0 & protect > 0) ·
  `applyLoss(amount, reason, {useProtect})`: Protect jar absorbs (up to balance), then pouch, then Spend jar, rest becomes forced debt (upkeep deliberately skips Protect — it is insurance for shocks, not rent) ·
  Invest 8 % ± 4 % · `isWin()` (fog ≤ 0, debt 0, season > seasonsToWin; `winRequiresSeasons:false` = Endless) / `isLose()` (fog ≥ 1 or debt > 2×maxLoan) · `serialize()` / `Economy.deserialize(json, config, opts)` (v1, restores state, ledger, history, pendingOffer) · `summary()` for HUD · `pushFog(strength)` hook for Fog Sweep.
- **P3** `applyEvent(id)` reads `EVENTS` (effect object or `fn(eco, rng)`; keys spark/investPct/fog/reputation/debt/jars; negative spark goes through Protect) · `offerScam(id?)` → offer + `eco:scam` · `acceptOffer()` (cost lost — Protect does NOT cover scams; `amount` loans come in at hidden `trueRate` → `state.scamRate` used by endSeason) · `refuseOffer()` (fog −0.02) · `buyUpgrade(id)`. Skeleton content: 4 EVENTS, 2 SCAMS, 2 UPGRADES — **4B replaces/extends via `new Economy(BALANCE, { events, scams, upgrades })` or by editing the maps**.
- Bus events: `eco:spark eco:jar eco:fog eco:season eco:event eco:scam eco:win eco:lose` (contract) + `eco:sale eco:loan eco:denied eco:scamResult eco:upgrade`. Pass `{ bus }` in opts for an isolated bus (tests); default is the global `bus`.
- `tests/economy.test.mjs` → **80 PASS, 0 FAIL**. `tests/economy.sim.mjs [seed]` → 10-season table, sensible strategy wins at S10 (fog 0.00, 3★ from S3). `tools/check.mjs --economy` (additive) runs the test file as a child process + sensible-wins / borrow-everything-loses sims + serialize round-trip + all 10 bus events seen.

## Missing
- Nothing from the 4A list. Content is skeleton-only by design (4B: ≥ 8 EVENTS, 6 SCAMS, UPGRADES tree, tuned BALANCE, balance.md, 3-strategy sim).
- No demo page (prompt: "the Node test IS the proof"). Browser QA skipped — pure logic, nothing to render.

## Measured
- 0 draw calls / 0 tris (pure logic). `node tests/economy.test.mjs` ≈ 0.2 s. check.mjs --economy ≈ 0.5 s.
- Sim seed 1: S1 income 240 / debt 200→24 · S2 debt 0 · S3 fog 0.31 · S6 fog 0.00 · S10 save 2981, invest 1336, protect 597, net worth 5167 → WIN. Borrow-everything (100/season, spend 90 %): fog 0.43→0.83, LOSE at S6–7.

## Suspected / notes
- Balance is intentionally generous (the sensible sim gets 3★ from S3 and fog 0 by S6). 4B should tighten (`startDebt`, `fogRelief`, `saveThreshold`, stall `base`) so win lands at S10±1 rather than early-fog-0 + waiting. `winRequiresSeasons` keeps the story at 10 seasons regardless.
- `sell()` at price 0 sells units for 0 Spark and still counts as "happy" (reputation up). Harmless; 7A should clamp the price slider ≥ 1.
- Stars rule 2 uses `ledger.saved` (Spark moved INTO Save this season) — moving it back out does not undo it.

## Notes for the integrator (10B)
- `new Economy(BALANCE, { seed?, autoSeason: false })` → call `eco.tick(dt)` each frame; when `eco.state.day01 >= 1` show the Ledger Review and call `eco.endSeason()` on the button. Or leave `autoSeason` on and listen to `eco:season`.
- BuildSystem: `eco.buyStall('fruit')` (accepts `'stall_fruit'` too) pays + counts upkeep; `eco.removeStall()` on demolish; pass `{ baseMul: 1.5 | 2.2 }` to `sell()` for stall L2/L3 (see `UPGRADES`).
- CustomerSystem: `eco.sell(stallId, glimmerType, price)` per paying Glimmer; `result.happy` drives the happy/sad clip, `result.paid` the coin fly amount. `eco.mood(type)` for browsing behaviour. `demand(price, fair, base, mood, tolerance)` is exported for a live demand preview in the price UI.
- Abilities: fogSweep → `eco.pushFog(strength)`; bubbleShield → `eco.applyEvent(id)` already routes losses through Protect; ledgerFlash → `eco.pendingOffer.trueRate / cost` for the "TRUE COST" reveal, then `eco.refuseOffer()` / `eco.acceptOffer()`.
- Save (10D): `eco.serialize()` string → `Economy.deserialize(json, BALANCE, { bus })`.
