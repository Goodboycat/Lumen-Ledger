# HANDOFF 42C — Collectors raid tills, not Pip (MASTER_PLAN_V6 phase 42, 2026-11-03)
Three chats: P1–P5 by chats A/B (axed mid-HUD), P6 + P2 + docs + close by chat C. All pushed to origin/main.

## Done
- `src/systems/enemies.js` Collector FSM (`ENEMY_RULES.raid`): `seek` (richest non-shielded till ≤ 14 u, re-evaluated every 2 s, sidesteps a stall that blocks the straight line) → `raid` (stand at the counter 1.2 s telegraph: fogPuff + sign shake, `raid:start`) → `T.steal` takes `min(till, 6 + season)` (`raid:take`) → `carry` (instanced coin stack over the head via `carryCoin` slot, speed × 0.8, walks to the pier) → off-island = `raid:escaped`, `eco.ledger.raided += N`. No till with money → the old `chase`. Baron untouched; his minions use the FSM.
- Sword hit while `carry` → everything dropped as ≤ 4 ground tips (`sb.dropTip`) + 0.6 s stun, `raid:drop`, `ledger.recovered` when Pip picks them up. Hit mid-telegraph → `raid:cancel` + `T.refund`. Bubble Shield armed with Pip ≤ 2 u of a till → that till is immune → the raider cancels (`why:'shield'`) and re-targets. Contact with Pip → `J.spillPouch(0.1)` (min 1 ✦, ≤ 8) — never a direct pouch subtraction; `sb.stats.spilled`.
- `src/systems/till.js`: `steal(stallId, n) → taken` (`raid:take`, `till:change {how:'raid'}`) · `refund(stallId, n)` (`how:'refund'`).
- `src/Game.js`: raid deps wired (tills getter, `spillPouch`, `stallName/stallSign`, `project`, `carryCoin`, `isShielded`); `sb.interact()` order is now **jar > talk > (42D till / Baron)**.
- `ui/hud.js` + `ui/hud.css` (chat C): red chip `.ll-raid-chip` under the pouch ("⚠ RAID — Fruit stand" / orange "⚠ CARRYING 7 ✦ — bonk it!") + `.ll-raid-arrow` ➤ at the screen edge toward the raider when off-screen (`raid:threat` projected `screen {x,y,behind}`, re-emitted at 5 Hz while raid/carry). Both vanish on `raid:end` / `enemy:gone` / `game:start`. Mounted on the HUD root, not inside the header, so the arrow can sit on any edge.
- Ledger: `economy.js _freshLedger` has `raided` / `recovered`; `ui/ledger.js` rows "Raided (Collectors ran off with it) −N" / "Recovered (dropped by bonked raiders) +N", hidden at 0 → `LEDGER_ROWS` = 8. `check.mjs --ui` ledger test updated (row count + `ROW_WAIT` 90 × 8).
- **P2** (chat C): `EnemySystem.talkable(r = 3)` → nearest `seek` Collector ≤ r u of Pip; `talk(r)` emits `enemy:talk {id, enemyId, stallId}`; `sb.interact()` returns `'talk'` — 42D attaches the scam pitch.
- `tools/gates/raid.mjs` + `check.mjs --raid` ("42C RAIDS", 8 sections): seek → stall_fruit · telegraph · take 7 · carry 1.3 u/s · pier → escaped · hit mid-carry drops 7 as 4 tips + stun · hit mid-telegraph cancels (till keeps 25) · shield immune → re-target → carry · contact spills 3 (jars untouched, 0 → nothing) · empty tills → chase / filled → seek / sendHome mid-carry still escapes · P2 talk 1.5 u yes / 6 u no / `sb.interact()` = 'talk' · destroy clean. **`check.mjs --all` ALL OK** (chat C).
- Docs: API_CONTRACTS "Raids (42C)", README_pipeline row 42C ✅, this handoff.

## Measured
- Gate stats for one `--raid` run: raids 6 · raided 14 · raidDrops 1 · recovered 7 · escaped 2 · raidsCancelled 2 · spilled 7. S1 raid loop (land → seek → raid → carry → pier) well under 25 s simulated.
- **% of raids stopped by a scripted "average" hero — NOT measured.** funnel.mjs has no bonk-the-carrier beat; add one in 45Z (walk to `raid:threat.screen` target, swing twice) before quoting a number.
- **Income delta vs 42A — NOT measured** (same reason; the synthetic player never leaves money on counters long enough to be raided).
- Budgets: +0 draw calls (carry coin is one instance of the shared coin mesh) · HUD +2 DOM nodes · hud.js 42C delta ≈ 18 lines (≤ 25) · Game.js ≈ 9 lines (≤ 10) · till.js ≈ 14 lines (≤ 20) · economy.js 2 lines (≤ 4).

## Missing
- `game/demo_raid.html` (prompt's demo page) not written — the gate covers every rule headlessly. Eyeball in `index.html?debug`: leave a till ≥ 10 ✦, wait for the S1 Collector (day 0.55), watch puff + sign shake → coin on its head → red chip + arrow.
- **No browser screenshot** of the chip / arrow (credits). First thing for the next chat with browser budget: `bash tools/setup_browser.sh` + `tools/hero_shots.mjs` with a raid forced, check the arrow is not hidden behind the HUD header on 640 px.
- P3 (helpers at a raided stall throw a coin → +0.5 stun) skipped — flavour only.
- The chip shows the *first* live raid only; with 2+ simultaneous raiders (S3+) the others get no arrow. Acceptable for now; if it confuses, cycle the chip every 2 s.

## Suspected
- The `raid:threat` `screen` projection uses `deps.project` → `camera`; headless it is `null` and the HUD hides the arrow (guarded). In the real game check that `project` returns pixels, not NDC, otherwise the arrow pins to the top-left — the gate cannot see this.
- `enemy:talk` fires only from `sb.interact()`; the E key handler falls through to its old behaviour on `null`, so a seeking Collector 3 u away now *eats* the E press that might have been meant for a jar 1.3 u away — order is jar first, so only when no jar is near. Fine, but 42D should decide whether a till press should outrank talk.
- Ledger "Raided" rows make the sensible-band sim slightly harder; the `--economy` sim still wins at S10 (unchanged — raids are not in the headless economy sim). Re-check the hoarder band once 43 scripts per-season raid counts.

## Notes for the integrator
- **42D** (scams / tills interact): extend `sb.interact()` in `installJarsWorld` after the `talk` line; listen to `enemy:talk {enemyId, stallId}` and open the pitch dialogue; `E.list.find(e => e.id === enemyId)` for the mesh/anchor. A pitched Collector should probably stop seeking for the pitch duration — set `e.state = 'idle'`-like via a new `E.hold(id, s)` (not written).
- **43** (night market / seasons): per-season raid counts and `takeBase` live in the season script, not `ENEMY_RULES` — pass `{ take, count }` through `spawnWave(season, opts)`; `register('festival')` jars are never raided (raids only touch tills).
- **44Z/45Z**: add a `bonk-carrier` beat to `funnel.mjs` and measure raids-stopped % + income delta; add a raid to `hero_shots.mjs` for the itch page (the carry coin + red chip is the most readable "money leaving" shot the game has).
