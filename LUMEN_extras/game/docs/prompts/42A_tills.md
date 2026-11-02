# Chat 42A — Tills: customers pay the stall, Pip collects
Needs: 6A customers (`economy.sell` at customers.js:376) · 10B coins (`sb.dropTip`/`collectCoin`, coin InstancedMesh, COIN_MAX) · 3B coinMagnetDash · 41C · 40A (`till:` reason)      Blocked-by: 41D
Owned (only these files): src/systems/till.js (new), src/systems/customers.js (the pay call only, ≤ 10 lines), src/Game.js (`installTills(sb)` ≤ 50 lines; `wireAbilities` magnet radius includes tills), ui/hud.js (pouch vs "on counters" chip, ≤ 15 lines), check.mjs (additive `--till`)
Read (max 8 credits): START_HERE.md → MASTER_PLAN_V6.md §1, §5–§6 → this → Game.js 276–346 (coins + abilities) → customers.js 360–390 (pay) → economy.js 201–245 (sell/earn/_addSpark) → build.js `stalls()` slot shape
Export (API_CONTRACTS "Tills (42A)", ≤ 6 lines):
  `createTills({ bus, eco, build, vfx, coinLayer }) → T` · `T.get(stallId) → { stallId, amount, pos:{x,z}, counterY }` · `T.pay(stallId, amount, meta)` (customers call this; **economy.sell still computes price/demand/mood but no longer calls earn** — it returns `{amount}` and emits `eco:sale {stallId, amount, toTill:true}`)
  `T.collect(stallId, how:'walk'|'magnet') → amount` → `eco.earn(amount, 'till:'+how)` (40A counts it as "through Pip's hands") · `T.spill(stallId, n)` → n ground tips via `sb.dropTip` (overflow / Collector raid 42C)
  `TILL_CAP = 40` ✦ per stall level 1 (+20 per level); above cap new sales spill 50 % to the ground and the stall sign flashes "FULL" · bus `till:change {stallId, amount}` · `till:collect {stallId, amount, how}` · `till:full {stallId}`
  Visual: ≤ 8 coin instances per till stacked on the counter (reuse `sb.coins` InstancedMesh with a `till` flag; a 9th+ coin raises the stack scale instead) + DOM count chip only when > 8.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `economy.js` (allowed edit, ≤ 10 lines): `sell()` gains `opts.toTill`; when true it skips `_addSpark` and returns `{ ok, amount, price, mood }`; `ledger.sales/units` still increment (the ledger reports sales, the pouch reports cash — that difference IS the lesson).
- `till.js`: pure state + the coin-layer adapter. `pay` adds to `amount`, emits `till:change`, asks `coinLayer.setStack(stallId, n, pos)`. `collect` zeroes, earns, VFX `coinFly` from counter to Pip (9A). Cap/spill rule.
- `customers.js`: the single `economy.sell(...)` call becomes `sell(..., { toTill:true })` then `this.till?.pay(s.id, r.amount, { type:c.type })`; the 20 % tip drop stays as is (tips on the ground were already physical).
- `Game.js installTills`: creates T with `coinLayer` built on the existing `sb.coins` InstancedMesh (tills use indices after the ground coins; `syncCoins` composes both); walk-over collect when Pip is ≤ 1.1 u from the counter front; `coinMagnetDash` collects every till within 2.2 u of the dash path (this is why dash is a starter ability, 41D). `sb.stats.tillCollected` for telemetry.
- `ui/hud.js`: the Spark chip shows the pouch; a second small chip "on counters: N" (sum of tills) pulses when any till ≥ 60 % cap.
- `check.mjs --till` (below).
### P2 — should ship (≈ 12 credits)
- Season end: uncollected till money is **not** lost — it is swept into the pouch at the ledger with a ledger row "Left on counters: −10 % (Collector tax)"; the row is red so leaving money out has a visible cost (42C makes it a real risk).
- Helpers (10B P3) seated at a stall auto-collect that stall's till every 12 s → their hire price now buys something the player can feel.
### P3 — nice to have (≈ 5 credits)
- Till sign (decor sign prop) above each stall shows the amount as a tiny texture-less number using the drawn-icon digits from S38 (if the icon atlas has digits; else skip).

## Demo page: `game/demo_till.html` — 3 stalls, key P pays a random till 5 ✦, walk/dash collects, F fills to cap to show the spill; `window.game`, stats: pouch / counters / spilled.

## check.mjs section `--till` (additive; name it `42A TILLS`)
- headless sandbox 1 season (70 s): every `eco:sale` has `toTill:true`; `eco.state.spark` does NOT change on sales; sum of `till:change` deltas = ledger.sales income.
- move hero to a stall front → `till:collect how:'walk'`, pouch += amount; `sb.ability('coinMagnetDash')` next to another till → `how:'magnet'`.
- pay 45 ✦ into a level-1 till → `till:full`, ≥ 2 ground coins spawned (spill), amount ≤ TILL_CAP.
- telemetry (40A) ratio `sparkHandled/sparkTotal` after the season ≥ 0.8 when a scripted hero collects every 10 s (PLAN §5 target); print it.
- meshes: +0 (shared InstancedMesh); `destroySandbox` → 0 leaks.

## Budgets: 0 new draw calls (shared coin mesh); DOM chips ≤ stalls count.
## Content rules that bite here (PLAN §6): Spark only moves when the player sees it move — a sale puts coins on a counter, never a number in the header; the header changes only when Pip collects.
## Handoff `docs/HANDOFF_42A.md`: Done / Missing / Measured (sparkHandled ratio; S1 income unchanged ± 5 % vs 41C) / Suspected / Notes for the integrator (42B: pouch is the at-risk pool; 42C: `T.get` richest till + `T.spill`; 43: tills per season script).
