# HANDOFF 41D — Two abilities at start, four earned by stars (MASTER_PLAN_V6 phase 41, 2026-11-02)
Two chats: P1 (unlocks.js, Game.js glue, save v2, HUD chips, ledger card, tests) by chat A (axed before closing); P2 + P3 + story-check fix + this handoff by chat B. All pushed.
## Done
- `src/systems/unlocks.js` (new, pure-ish): `ABILITY_START = ['coinMagnetDash','bubbleShield']`, `ABILITY_UNLOCKS` growthStomp ★3 · ledgerFlash ★6 · haggleShout ★9 · fogSweep ★12, `ABILITY_ORDER`, `starsFor(id)`, `installUnlocks(sb, bus, {all})` → wraps `sb.ability` (`'locked'` + bus `ability:locked {name,stars,have}`), `eco:season` stars → `starsTotal` → max ONE unlock per season → bus `ability:unlock {id,stars,key,title,lesson}`, `eco:win` → all six (P3 endless playground), `restore(snap)` / `serialize()` / `destroy()`.
- `Game.js`: `installUnlocks` in `createSandbox` (headless sandboxes default `allAbilities:true` so `--sandbox/--game` stay green; real game gated), `lg.syncAbilities()` → bus `ui:abilities {abilities,starsTotal}` on `game:state` + `ability:unlock`, `applySnapshot` restores the set.
- `save.js` `SAVE_VERSION 2`: `abilities[]`, `starsTotal`; v1 → starters + 0; `describe()` prints "n/6 abilities".
- `ui/abilityChips.js` + `.css` (new, DOM only, 0 meshes): six chips Q–G, locked = dim + "★3", pop on unlock, shake on `ability:locked`/`sandbox:denied`, radial cooldown; mounted in `ui/index.js`.
- `ui/ledger.js`: "NEW ABILITY — <title> [<key>]" reward card with the FINLIT one-liner, once per `ability:unlock`, after the stars count-up. CONTINUE unchanged.
- **P2** `data/story.json` `barks.abilityUnlock[id]` 4 Owl lines; `story.js` holds the id from `ability:unlock` and fires `barkGroup('abilityUnlock', id)` on `ui:continue` (review closes → bark in the world). `ui/touch.js` locked chips hidden (`.locked`), pop on unlock, `flashDenied` on `ability:locked`.
- `tests/unlocks.test.mjs` 5 pass · `check.mjs --unlocks`.
- Side fix: `check.mjs --story` ticked 0.55 × 150 s for the S1 mid bark; S1 is 70 s since 41C so the season ended first → now uses `seasonSecondsFor(BALANCE, s)`. Full `check.mjs` ALL OK.
## Measured
- `funnel.mjs --synthetic 10 --season 2` (tools/shots/funnel_synthetic_41D.json): abilities used S1–S2 = **0** — the synthetic player never presses Q–G (telemetry has no `ability` step either). Target "≥ 1" is unmeasurable until `play.mjs --script funnel` (browser) exists → 45Z. No balance change (s2 2.2 s / s3 4.3 s game-clock as before).
## Missing
- No browser screenshot of chips / ledger card (no Playwright in this sandbox). Open `index.html?debug` and end S1 with 3 ★ to eyeball the card + Owl bark.
- `ui/hud.js` untouched: the prompt asked for chips in hud.js; chat A put them in a separate `ui/abilityChips.js` (cleaner, same DOM). Keep.
- `?debug` stats line does not print `abilities`/`starsTotal` yet (trivial, same place as 41C's seasonSeconds note).
## Suspected
- 3 ★ per ledger is rare for a new player → fogSweep (★12) may never unlock in a 10-season run for most players. If 42x funnel shows < 50 % reach growthStomp by S3, lower to 2/4/6/8.
- Resume of a v1 save mid-run gives starters only — intended, but the player loses abilities they had. Acceptable (v1 saves predate the gate).
## Notes for the integrator
- 42A: dash (`coinMagnetDash`) is the collect verb — it is a starter, always available.
- 42C: shield (`bubbleShield`) protects the till you stand at — starter.
- Any new ability: add to `ABILITY_ORDER` + `ABILITY_UNLOCKS` + FINLIT; chips/touch/ledger/save follow automatically.
