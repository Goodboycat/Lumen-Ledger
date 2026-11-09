# HANDOFF S70 (2026-11-09) - "I paid the Baron 45 and it did not count as a star"

**Setup**: `bash LUMEN/game/tools/github.sh <TOKEN>`. Clone straight into /home/user/webapp. NEVER clone the repo into /tmp: /tmp is a 493 MB tmpfs, a 479 MB clone fills it and Playwright's Chromium download then fails with "Download failure". Sandbox RAM is ~1 GB: run gates one flag at a time (a single `check.mjs` with all 48 flags was OOM-killed). Chromium: `cd tools && npm i playwright@1.47.0 && npx playwright install chromium`; server `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`.

## The bug (root cause)
With `pierPays` (the real game) `economy.endSeason()` scored the 3 stars the instant the clock ended, BEFORE the Baron was paid. The interest paid at the pier (and any debt repaid there) therefore never reached the report: the debt goal (`paidInterest`) stayed false, the repay landed in the NEXT season's ledger, and `unlocks` banked the provisional stars.

## The fix
- `economy.js`: `_scoreSeason()` (pure, shared), `_pierReport()`, `closePier(why)`. In pier mode the report carries `pier:{pending,paid,shortfall,repaid}`; `settleInterest()` and `repay()` write into the CLOSED season; `closePier()` re-scores stars/goals + refreshes debt/spark/jars/netWorth and emits `eco:stars {season,stars,from,report,why}`. Idempotent. A still-open report is closed by the next `endSeason`, and on win/lose.
- `baronPier.js` `done()` calls `eco.closePier(why)` BEFORE `pier:done`, so the ledger the player sees is final.
- `unlocks.js`: ignores provisional stars (`r.pier.pending`) and adds the final ones on `eco:stars` (ability unlock card now matches the stars shown).
- `story.js`: on `eco:stars` the queued ledger lines swap to the final variant (low/default/high). `Game.js`: season pop "Season N ★n" shows no star while pending.
- Proof: `tests/economy.test.mjs` +10 asserts (98 total), `tools/gates/pier.mjs` full-game assert, real browser rig `tools/shot_s70_baron.mjs W H` (844x390 run: before pay 2 stars, after 3 stars, goal row "Debt held down - paid the Baron's 15", errors []). Shots `tools/shots/s70_*`.

## Also done
- Focus now saved (`snapshot().focus`, additive v4 field, restored in applySnapshot) + test.
- Pier chip uses touch wording ("tap the Baron again") on `body.is-touch`.
- My own slip, fixed: a `//` comment in `ui/hud.js` broke the file for ONE pushed commit (512ae77); fixed in the next commit, `node --check` + `--ui --pier` green.

## Verification state
All 48 `check.mjs` flags were run one by one on commit 1a21e9b: all ALL OK (log in /tmp, not kept). After that only `ui/hud.js` changed (touch wording + syntax fix): `--ui --pier` re-run green. `node --test tests/*.test.mjs` 105 pass.

## NOT done / next
- Screenshot review of the whole beginner flow was only done for the pier + ledger at 844x390 (looks right: HUD chip legible, 3 stars + checklist visible, no overlap). NOT reviewed: 568x320, 1280x720, title screens.
- The pier chip and the ledger "pending" frame were not shown on a phone with the new touch text (strings only changed).
- Pier "short" case: ledger text for the debt goal when interest was unpaid says "PAY x at the pier" - good, but the player can no longer fix it after the visit; consider a hint at pier:due ("pay it = star").
- S70 credits screen after THE END, Wishes + Neighbours, Regions: untouched.
- Gameplay question from S69 (passive 3-stall player sells 11-22 units in S3): still needs a human look.
- No new in-game art / no MCP model work this chat (no new glyphs or 3D assets).
