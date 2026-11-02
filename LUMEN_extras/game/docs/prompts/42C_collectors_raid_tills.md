# Chat 42C — Collectors raid tills, not Pip
Needs: S16 enemies (`EnemySystem`, states, `spawnWave`, `targets()`) · 42A `T.get/T.spill` · 42B `J.spillPouch` · 3B bubbleShield · 41C S1 Collector      Blocked-by: 42B
Owned (only these files): src/systems/enemies.js (Collector FSM: `seek` → `raid` → `carry` → `flee`; Baron unchanged), src/systems/till.js (`steal(stallId, n)` / `refund(stallId, n)`, ≤ 20 lines), ui/hud.js (threat arrow + "raid!" chip, ≤ 25 lines), src/Game.js (wave hook passes `tills`, ≤ 10 lines), check.mjs (additive `--raid`)
Read (max 8 credits): START_HERE.md → MASTER_PLAN_V6.md §1 → this → enemies.js 1–60 (rules) + 160–235 (spawn/targets) + 300–340 (contact) → HANDOFF_42A/42B Notes → heroAbilities bubbleShield hook (3B) in Game.js wireAbilities
Export (API_CONTRACTS "Raids (42C)", ≤ 6 lines):
  Collector FSM: `seek` (walk to the richest till within 14 u, re-evaluated every 2 s) → `raid` (stand at the counter 1.2 s, telegraph: fogPuff + sign shake) → takes `RAID_TAKE = min(till, 6 + season)` ✦ → `carry` (coin stack mesh on its head, speed ×0.8, walks to the pier) → `flee` off-island = money **gone** (ledger row "Raided: −N").
  Sword hit while `carry` → drops everything as ground tips (`T.spill`-style via `sb.dropTip`) + stun 0.6 s; 2nd hit defeats (existing). Hit while `raid` → cancels the raid. `bubbleShield` armed while Pip is ≤ 2 u of a till → that till is immune for the shield duration (the shield finally protects *something*).
  Contact with Pip: no longer costs 1 ✦ from the pouch directly — it calls `J.spillPouch(0.1)` (coins hit the floor, Pip can pick them up; a 2nd Collector nearby can too).
  bus `raid:start {stallId, enemyId}` · `raid:take {stallId, amount}` · `raid:drop {amount, x, z}` · `raid:escaped {amount}` · HUD threat arrow points at the active raider when off-screen.
  Baron (S ≥ 6) keeps his own fight; his minions use the Collector FSM.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `enemies.js`: replace the Collector's `chase Pip` with the FSM above (keep the `chase` name for `targets()` compatibility or extend the filter to `seek|raid|carry`). Pathing: reuse the existing stranded/land checks; the counter point = stall slot front (42A `T.get(id).pos`). A Collector with no reachable till (no stalls) falls back to the old chase.
- `till.js`: `steal` (returns taken amount, emits `raid:take`, updates the stack), `refund` (used when the raid is cancelled before `carry`).
- Carry visual: 1 coin instance from the shared mesh parented above the enemy head (a `carryCoin` slot per enemy; ≤ 1 dc total since instanced).
- `ui/hud.js`: threat arrow (DOM triangle at the screen edge toward the raider) + a red "RAID — Bread stall" chip; both vanish on drop/defeat/escape.
- `check.mjs --raid` (below).
### P2 — should ship (≈ 12 credits)
- Ledger: "Raided −N" / "Recovered +N" rows (ledger.js rows come from `eco.ledger`; add `raided`/`recovered` to `_freshLedger` — economy.js ≤ 4 lines allowed).
- Scam tie-in prep for 42D: a Collector in `seek` within 3 u of Pip can be `interact`ed → it emits `enemy:talk {id}` (42D attaches the pitch).
### P3 — nice to have (≈ 5 credits)
- Helpers (10B P3) seated at a raided stall throw one coin at the raider (hero `throwCoin` clip reused) → +0.5 stun. Flavour only.

## Demo page: `game/demo_raid.html` — 2 stalls with 30 ✦ each, key N spawns a Collector, watch seek→raid→carry; Space bonks; W shield; stats: tills / carried / escaped.

## check.mjs section `--raid` (additive; name it `42C RAIDS`)
- headless sandbox, 2 stalls, tills 30/10 → spawn 1 Collector → it enters `seek` toward the 30 till (assert target id) → `raid:start` → `raid:take` amount = min(30, 6+season) → state `carry` with speed < walk speed.
- scripted sword hit during `carry` → `raid:drop` amount equal, ≥ 1 ground coin at the enemy position, till unchanged (still minus the take), enemy stunned.
- no hit: enemy reaches the pier → `raid:escaped`, `eco.ledger.raided` += amount.
- shield armed with Pip ≤ 2 u of the 30 till → the raider re-targets the 10 till. Contact with Pip → `jars:spill`/pouch spill event, pouch unchanged by direct subtraction.
- S1 (41C): exactly one Collector, hp 1, the whole raid loop is ≤ 25 s simulated; destroy → 0 leaks.

## Budgets: +0 dc (carry coin instanced); HUD arrow DOM.
## Content rules that bite here: a raid is always telegraphed ≥ 1.2 s and readable (puff + sign shake + arrow) — readable randomness (PLAN §0); money lost to a raid is shown leaving, never silently deducted.
## Handoff `docs/HANDOFF_42C.md`: Done / Missing / Measured (% of raids stopped by a scripted "average" hero; income delta vs 42A) / Suspected / Notes for the integrator (42D: `enemy:talk`; 43: per-season raid counts/takes live in the season script, not in ENEMY_RULES).
