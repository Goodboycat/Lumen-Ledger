# HANDOFF S86 (2026-11-10) - free-trial in Ledger + Cloud chip, jars fit on phone landscape

Setup (same as S85): clone https://github.com/Goodboycat/Lumen-Ledger into /home/user (move the template webapp aside to webapp_old, mv the clone to /home/user/webapp), `bash LUMEN/game/tools/github.sh <TOKEN>`. Browser libs per HANDOFF_S79, then `cd LUMEN/game/tools && npm i playwright@1.47.0` and `npx playwright install chromium` (separate commands). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Run checks and shots FROM LUMEN/game. Never `pkill -f chromium`. Push with `bash tools/wip.sh "<what>"`.
User decisions: IGNORE the Cloud crew pet face (keep the existing one). IGNORE docs/ITCH_DEVLOG.md (RULE ITCH is waived).

## DONE (all pushed, check.mjs --combat --crew --curiosity --audio --strangers --story --economy --pier ALL OK)
1. Ledger: new row `subscription` ("Free-trial renewal (auto-charged)") in ui/ledger.js LEDGER_ROWS (now 9 rows; check.mjs expects 9). report.expenses already INCLUDES the renewal (applyLoss adds it), so the Expenses row shows expenses minus subscription: Net never counts it twice. The row is hidden when 0.
2. HUD: Cloud chip id 'sub' (icons trialcard + spark, red "-20"). eco:subscription stores the payload; the chip speaks on `ui:continue` (NOT ui:ledger:close: the Boon Draft covers the HUD right after the Ledger). Cleared on game:title. ui/hud.js.
3. Real-tap probe tools/probe_s86_sub.mjs 568 320: accept freeTrial -> subs on the books -> season end -> Ledger row visible (568x320 viewed, nothing clipped) -> CONTINUE -> Boon pick -> chip visible (viewed).
4. Deals tested in the browser with real taps (tools/probe_s85_deal.mjs, now scoped to .ll-dlg-choice; the old selector hit the HUD PAY button): parcelFee accept = -35 Spark + red Fooled chip; bringAFriend accept = -70 Spark + red Fooled chip. ledgerFlash on parcelFee (tools/probe_s86_flash.mjs): real tap on the touch chip -> answer pill "TRUE COST 35", pending offer refused.
5. Jars panel (ui/touch.css, new block before "hide Foundation's inline help line"): on landscape max-height 420 the rows are compact, footer/hint/debt row are hidden, fade mask removed. 568x320: 4 rows fit (was 2), 844x390 also 4 rows, no scroll (tools/probe_s86_jars.mjs W H tag; viewed).
6. GAME_VERSION = 'S86'. Final shots tools/shot_s80_final.mjs at 844x390, 568x320, 1280x720 re-taken (tools/shots/s80_final_*). Zip rebuilt (441 files, 11 MB, sha256 2bf3cb1b2ea5a8f1..), uploaded as lumen-ledger-web.zip.

## Probe gotchas learned
- Touch ability chips are display:none while the HUD reveal is staged: `ui.reveal.revealAll({quiet:true})`, plus `lg.sb.unlocks.abilities.add(name); lg.syncAbilities()`.
- Jar rows only exist when the jar is built: `ui.jars.show('save')` etc.; panel is display:none with only Spend.
- A season with debt opens the Baron pier phase; set `lg.sb.eco.state.debt = 0; interestOwed = 0` then day01 = 0.999 to get straight to the Ledger.
- tapText must be scoped to `.ll-dlg-choice`, never all buttons.

## NOT done / next (suggested order)
1. Beginner-friendly review of the final shots flagged (by a screenshot reviewer, NOT yet verified by hand): at 568x320 play the tutorial "Drag the stick" demo joystick sits close to/over the BUILD button; the HUD PAY badge looks cramped inside the Spark capsule; Ledger at 568x320 is tight vertically (CONTINUE hugs the bottom edge, pills close to the divider). View s80_final_2_play_568x320.png and s80_final_6_ledger_568x320.png yourself and fix only real problems.
2. Not re-tested in browser: ledgerFlash / accept path for the other new deals (fakeCharity, fogLevy accept, freeTrial flash). The economy and story gates cover their data.
3. Scam NPC / Baron model does not look different per deal (cosmetic).
4. itch.io live build unverified; real-phone test pending (S85 items: season-end Baron seek, deal chip, no accidental cinematic skip; S86: free-trial chip, jars panel).
