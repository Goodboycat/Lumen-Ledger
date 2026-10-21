# HANDOFF 4B — Economy content & balance (`src/systems/economyData.js`, `docs/balance.md`, `tests/economy.sim.mjs`)

PURE JS, no Three, no DOM. `economyData.js` imports only `./economy.js` (4A). 4A's skeleton maps are untouched; 4B content is
wired through the 4A constructor: `makeEconomy(opts)` ≡ `new Economy(BALANCE_TUNED, { events: EVENTS, scams: SCAMS, upgrades: UPGRADES, ...opts })`.
(First half was written by a chat that got axed; this chat finished P2/P3, the sim, check.mjs and docs.)

## Done (P1 + P2 + P3)
- **P1 content** — `EVENTS` ×10 (`id title text finlit lesson effect season weight insurable?`; 2 are `effect(eco)` functions: `baronTax` scales with debt, `lighthouseFlicker` rewards a full Save jar) · `SCAMS` ×6 Too-Good Deals (`pitch` = what the Collector says, `tell` = the tell-tale sign for Ledger Flash / Scout Fox, `text` = true cost; 1 loan at hidden 35 %, 5 cash losses, one with a token payout) · all lesson ids ∈ `BALANCE.lessons`. Every event and scam is applied through the 4A API in `check.mjs`.
- **P2 balance** — `BALANCE_TUNED` (startSpark 100, startDebt 260, startFog 0.40, fogPerDebtSeason 0.07, fogRelief 0.12, saveThreshold 200, upkeep 14 + 7/stall, maxLoan 500, per-stall fair/base/cost for all 12). 20-seed sweep: **sensible win@10 ×17 / win@11 ×3 · borrow-everything lose@3–5 ×20 · hoarder lose@8–10 ×19**. Full reasoning + tables in `docs/balance.md`.
- **P3 upgrades** — `UPGRADES` ×11 (`kind: stall | helper | zone`, `cost`, `upkeep`, `requires: [ids | 'season:N']`, `effect`) + `canBuyUpgrade(eco, id, owned)` → `{ ok, why }` + `pickEvent(eco, season)` (weighted, season-gated, uses `eco.rng`) + `EVENT_IDS / SCAM_IDS / UPGRADE_IDS`.
- **Sim** `tests/economy.sim.mjs [seed] [--base] [--sweep]` — 3 strategies (sensible / borrow / hoarder) × 10–12 seasons, prints the Ledger table per season, `--sweep` = 20-seed histogram incl. the season fog first hits 0. Exports `run(name, seed, print, balance?)` + `STRATEGIES` so tuners and check.mjs can import it.
- **check.mjs `--economy`** now has an additive `ECONOMY (4B)` block: content shape, every event + scam through the bus, pickEvent gate, canBuyUpgrade (requires / season / cost / owned), `buyUpgrade` from the tree, 10-seed sweep targets (sensible ∈ win@9–11, borrow all lose, hoarder ≥ 8/10 lose). → **ALL OK ✅**

## Missing
- Nothing from the 4B prompt. No demo page (pure logic; the prompt's "demo" is the sim table). Browser QA skipped by design (nothing to render, 0 draw calls).

## Measured
- 0 tris / 0 draw calls. `node tools/check.mjs --economy` ≈ 0.6 s (incl. 30 sim runs). `tests/economy.sim.mjs --sweep` ≈ 0.3 s.
- Seed 1 sensible: debt 0 at S4, fog 0.62 peak at S5, fog 0.00 at S10, net worth 2897, 6 stalls, 3★ from S6. Base 4A values for comparison: fog 0 at S7, hoarder never loses.

## Suspected / notes
- Helper and zone `effect`s are data only — 4A `buyUpgrade` charges and emits `eco:upgrade`; nobody applies `upkeepMul`, `interestBonus`, `protectBonus`, `baseMulAll`, `reputationBonus` yet. 10B should read `UPGRADES[id].effect` on `eco:upgrade` and keep its own `ownedUpgrades` Set (persist it beside `eco.serialize()`; 4A state does not store upgrades). Helper `upkeep` likewise must be added by the integrator (suggest `eco.spend(sum, 'helpers')` right before `endSeason()`).
- `canBuyUpgrade` deliberately lets stall upgrades repeat (one per stall); BuildSystem tracks levels per stall.
- The sim sells 18 + 5/stall visits per season at fair price with full mood; real players will sell less. If playtests miss S10, lower `saveThreshold` → 150 first (see balance.md knobs).
- `BALANCE_TUNED.stalls` keeps 4A's `glimmers` and `lessons` untouched.

## Notes for the integrator (10B / 7A / 6A / 8B)
- Construct with `import { makeEconomy, pickEvent, canBuyUpgrade, EVENTS, SCAMS, UPGRADES } from './systems/economyData.js'` → `const eco = makeEconomy({ seed, autoSeason: false })`. Do **not** `new Economy(BALANCE)` in the game — that gives the untuned 4A skeleton.
- Cadence (balance.md): 1 event/season via `eco.applyEvent(pickEvent(eco))` at day01 ≈ 0.5 (not before the first sale on S1); scam offers on S2/4/5/7/9 via `eco.offerScam()` → UI shows `offer.pitch`, Ledger Flash / Scout Fox shows `offer.tell`, then `acceptOffer()` / `refuseOffer()`.
- Toast / Ledger card text: `EVENTS[id].text` (what happened) + `.finlit` (one-line lesson). 8A/8B own the long-form lesson text keyed by `lesson`.
- Price UI (7A): per-stall fair prices are `eco.stallInfo(id).fair`; `demand()` from 4A previews units. Expected Spark/visit at fair ≈ `0.6 × base × fair`.
- Build menu (5 / 7A): costs `eco.stallCost(id)`, upgrades `UPGRADES[id].cost` gated by `canBuyUpgrade(eco, id, owned)` (`why` is 'owned' | 'cost' | 'season:N' | 'needs <id>').
