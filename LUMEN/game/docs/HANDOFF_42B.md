# HANDOFF 42B — Jars are places: walk, press E, deposit (MASTER_PLAN_V6 phase 42, 2026-11-03)
Two chats: P1 + P2 (jarsWorld.js, Game.js dispatcher, jars summary panel, verbChain deposit step, HUD at-risk tint, gate) by chat A (axed before closing); full-suite verification, Protect-bark fix, funnel measure, this handoff + close by chat B. All pushed.

## Done
- `src/systems/jarsWorld.js` (new, pure): `createJarsWorld({bus, eco, jars:W.jars, hero, vfx, sequences?, labels?, camera?, onSpill?}) → J` · `J.near()` (closest jar ≤ `NEAR_R` 1.3 u) · `J.deposit(jar, amt?)` → `eco.allocate` + `jarFill` Sequence + `coinFly` + pop · `J.withdraw(jar, amt?)` (Invest refuses mid-season → `jars:locked` + wobble) · `J.press()/J.release()` (tap = deposit `DEPOSIT_STEP` 10 ✦ or the rest of the pouch; hold ≥ `HOLD_S` 0.6 s = withdraw, repeats every `REPEAT_S` 0.25 s; walking away releases) · `J.spillPouch(frac)` → `min(10 %, SPILL_CAP 8)` to the ground via `onSpill` · `J.register(id, mesh)` (5th jar) · `J.update(dt)` (near-change event, hold timer, DOM tags) · `J.destroy()`.
- Bus: `jars:deposit {jar, amount, spark, jars}` · `jars:withdraw` · `jars:near {jar|null}` · `jars:locked {jar}` · `jars:empty {jar}` (pouch 0 → no `eco:denied` noise) · `jars:spill {amount}`.
- DOM jar tags (≤ 4, one per jar, class `ll-jar-tag <id>` + `.near`), projected like 41A barks, visible ≤ `LABEL_R` 4 u, text "Save · 30 ✦  E · put 10 in" / "(take 10)" while holding.
- `Game.js installJarsWorld(sb)` after `wireEconomy` (eco:jar → setFill stays the fill truth) · **`sb.interact()` = the one dispatcher**: jar > (42D: till > Baron > scam NPC) > null; `sb.interactRelease()` on E keyup / ✋ release · E key + touch ✋ route through it and fall back to their old behaviour only on `null` · `onSpill` drops ≤ 4 ground tips around Pip, `sb.stats.spilled`.
- `ui/jars.js` **summary mode by default**: 4 read-only bars + current split %, preset buttons → hint chips ("Owl suggests 50/30/10/10"), no APPLY, no pause. `?sliders=1` → legacy slider/APPLY path (`ui:jar:apply` still rebalances — accessibility fallback + tests).
- `verbChain.js` `deposit` step: setup lights the lantern nearest the Save jar + bark "Carry it to the Save jar by the cottage, press E"; done = any `jars:deposit`.
- `ui/hud.js` pouch **at-risk** tint: `enemy:wave` → `.at-risk`, cleared on `enemy:gone` / `home` / season / `game:start`; `jars:spill` → shake.
- **P2 shipped**: hold-E withdraw with Invest lock + wobble + Owl bark "Locked till the ledger." · Protect-jar bark when an event is absorbed — both paths: Bubble Shield (`eco:absorbed`) and the jar itself (`eco:event` with `effect.absorbed > 0`, chat B fix).
- `tools/gates/jarsworld.mjs` + `check.mjs --jarsworld` ("42B JARS WORLD"): near spend/save/null · 35 ✦ → 10,10,10,5 + empty · Invest hold locked · Save hold 10 then repeat · walk-away release · spill 100 → 92 · +0 meshes · destroy 0 listeners · `register('festival')` · panel default 0 APPLY vs `summary:false` legacy. `--ui` jars block tests the legacy path. **Full flag set ALL OK** (chat B).

## Measured
- `funnel.mjs --synthetic 20` (tools/shots/funnel_synthetic_42B.json): Spark-through-hands **87.6 %** (42A 81.8 %, 40B baseline 0 %) · modalSeconds 0.0 · firstSale median 7.2 s · firstStall 30.0 s (scripted) · s2 150.2 s · s3 300.3 s.
- `tFirstDeposit`: **not measured** — the synthetic player never walks to a jar (no deposit script in funnel.mjs). Add a `deposit` beat to the headless script in 45Z before quoting it.
- Budgets: 0 new meshes · DOM tags 4 · `installJarsWorld` 17 lines (≤ 40) · jars.js summary delta ≤ 30 lines · hud.js tint 6 lines.

## Missing
- `demo_jars_world.html` (prompt's demo page) not written — the gate covers every rule headlessly. Eyeball in `index.html?debug`: walk to a jar by the cottage, tap E, hold E.
- P3 jar glow by fill (`userData.setGlow`) skipped — the 1D jar material exposes no `setGlow`; `setFill` already raises the liquid, which reads well enough.
- No browser screenshot of the jar tags / summary panel.

## Suspected
- With the APPLY path gone, a player who never finds the jars will end S1 with everything in the pouch → the 4A event rules hit the pouch, not Protect. The verbChain `deposit` step teaches it once; if the funnel later shows `jars.*` ≈ 0 at S2 for real players, add a second Owl bark on the first `enemy:wave` ("Your pouch is at risk — the jars by the cottage are safe").
- `jars:near` fires on every change — fine at 60 Hz, but if 43 adds many jars consider throttling the DOM tag text update.

## Notes for the integrator
- **42C** (Collector contact): call `sb.jarsWorld.spillPouch()` on contact; it handles the cap, the ground tips and `jars:spill` (HUD shake + stats). Jars are never touched by contact.
- **42D**: extend `sb.interact()` in `installJarsWorld` — order is jar > till > Baron > scam NPC; return a non-null string to stop the key handler's fall-through.
- **43** night market: `sb.jarsWorld.register('festival', mesh)` + teach `eco` the id (`JARS` list in economy.js) or deposits are denied; `JAR_NAMES.festival` already exists.
