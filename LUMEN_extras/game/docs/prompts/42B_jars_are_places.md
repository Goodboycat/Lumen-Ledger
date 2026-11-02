# Chat 42B — Jars are places: walk, press E, deposit
Needs: 1D jars (`W.jars`, `setFill`, `jarFill` Sequence) · 7A jar sliders (`ui:jar:apply`, `rebalance`) · 4A `eco.allocate` · 42A pouch · 41B `deposit` verb step      Blocked-by: 42A
Owned (only these files): src/systems/jarsWorld.js (new), src/Game.js (`installJarsWorld(sb)` ≤ 40 lines + E-key interact dispatch), ui/jars.js (summary mode, ≤ 30 lines), ui/jars.css, ui/hud.js (pouch "at risk" tint ≤ 8 lines), ui/tutorial.js (the `deposit` step `setup/done` only), check.mjs (additive `--jarsworld`)
Read (max 8 credits): START_HERE.md → MASTER_PLAN_V6.md §1, §6 → this → Game.js 155–160 (jars placed) + 221–250 (wireEconomy `eco:jar`) → economy.js 294–336 (allocate + jar rules) → ui/jars.js header → HANDOFF_42A Notes
Export (API_CONTRACTS "Jars world (42B)", ≤ 6 lines):
  `createJarsWorld({ bus, eco, jars:W.jars, hero, vfx }) → J` · `J.near() → 'spend'|'save'|'invest'|'protect'|null` (≤ 1.3 u from a jar) · `J.deposit(jar, amount)` → `eco.allocate({[jar]:+amount})` + `jarFill` Sequence + `coinFly` · `J.withdraw(jar, amount)` (hold E 0.6 s; Save/Invest withdraw obey economy rules: invest locked until season end, save free)
  Deposit amount per tap = `DEPOSIT_STEP = 10` ✦ or the whole pouch if < 10; holding E repeats every 0.25 s. bus `jars:deposit {jar, amount}` · `jars:withdraw {jar, amount}` · `jars:near {jar|null}` (HUD prompt "E · put 10 ✦ in Save")
  Pouch is **at risk**: a Collector contact (42C) knocks `min(10 %, 8 ✦)` of the pouch to the ground; jars are never touched by contact. `eco.state.jars` remains the truth; the slider panel becomes a read-only summary + the presets (presets now *walk* nothing — they just show the target split; the player must carry the coins).
  Interact key: E (desktop) / the ✋ touch button (7C) — one `sb.interact()` dispatcher in Game.js: jar > till > Baron (42D) > scam NPC (42D) > nothing.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `jarsWorld.js`: proximity, deposit/withdraw, fill sync (`setFill` already listens to `eco:jar` in wireEconomy — keep that as the truth, J only triggers `allocate`). Jar labels: a small DOM tag over each jar (projected like 41A barks) showing the name + amount, visible only when Pip is ≤ 4 u.
- `Game.js`: `sb.interact()` dispatcher + E key (keydown once; hold detection for withdraw) + touch ✋ button → `interact`. `installJarsWorld` after `wireEconomy`. Remove the APPLY path from the gameplay flow: `ui:jar:apply` still works (tests, accessibility fallback with `?sliders=1`) but the panel defaults to summary mode.
- `ui/jars.js` summary mode: 4 bars (read-only), the current split %, the preset buttons become hint chips ("Owl suggests 50/30/10/10") — no APPLY. Opening the panel does not pause.
- `ui/tutorial.js` `deposit` step: `setup` lights the Save jar (lantern `setLit` on the nearest lantern + a bark "Carry it to the Save jar"), `done` = `jars:deposit` seen.
- `check.mjs --jarsworld` (below).
### P2 — should ship (≈ 12 credits)
- Season end: the Protect jar is the only one that absorbs an event (unchanged 4A rule) — add a bark at the Protect jar when an event is absorbed so the spatial choice pays back visibly.
- Withdraw with hold-E; Invest refuses mid-season with a jar "wobble" + bark "Locked till the ledger."
### P3 — nice to have (≈ 5 credits)
- Jar glow intensity by fill (emissive step on the 1D jar material via `userData.setGlow` if present; else skip).

## Demo page: `game/demo_jars_world.html` — 4 jars, pouch starts 60 ✦, E deposits, hold E withdraws, key K simulates a Collector contact (pouch spill); stats: pouch / 4 jars.

## check.mjs section `--jarsworld` (additive; name it `42B JARS WORLD`)
- headless sandbox: hero at (−8, 3) → `J.near() === 'spend'`; move to (−7, 3) → 'save'; (0,0) → null.
- pouch 35: `interact()` ×4 at Save → 3 × `jars:deposit 10` + 1 × 5; `eco.state.jars.save` += 35; pouch 0; the 5th tap → `eco:denied` not thrown.
- withdraw: hold at Invest mid-season → refused (no delta); at Save → `jars:withdraw 10`.
- `ui:jar:apply` still rebalances (legacy path) · the jars panel mounted with domshim has 0 APPLY buttons by default · destroy → 0 listeners.

## Budgets: 0 new meshes (jars exist); DOM tags ≤ 4.
## Content rules that bite here (PLAN §1): budgeting is a walk, not a slider — no path in the normal flow may move Spark into a jar without Pip carrying it there.
## Handoff `docs/HANDOFF_42B.md`: Done / Missing / Measured (tFirstDeposit in the 41B chain; `funnel.mjs --synthetic 20`) / Suspected / Notes for the integrator (42C: pouch spill API `J.spillPouch(frac)`; 42D: `sb.interact()` order; 43: night market can add a 5th "Festival" jar via `register`).
