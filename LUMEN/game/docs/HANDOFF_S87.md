# HANDOFF S87 (2026-11-10) - paying the Baron now counts (stars), chip colour, Ledger numbers

Setup (same as S86): clone https://github.com/Goodboycat/Lumen-Ledger into /home/user (move template webapp to webapp_old, mv clone to /home/user/webapp), `bash LUMEN/game/tools/github.sh <TOKEN>`. Browser libs per HANDOFF_S79, then `cd LUMEN/game/tools && npm i playwright@1.47.0` and `npx playwright install chromium` (separate commands). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Run checks and shots FROM LUMEN/game. Never `pkill -f chromium`. Push with `bash tools/wip.sh "<what>"`.
User decisions: IGNORE the Cloud crew pet face. IGNORE docs/ITCH_DEVLOG.md (RULE ITCH waived).

## USER BUG (fixed): "season 3, I pay the Baron what he asks, get a check but the UI is still red, and the Ledger doesn't count a star. Do 1.25x stars register in other seasons?"
Root causes found (all reproduced headless in tests/economy.test.mjs "S87" block + in the browser):
1. **Next-season debtStart was stale** (src/systems/economy.js closePier). endSeason() opens the NEW ledger with debtStart = debt at that instant, BEFORE the Baron collects. A shortfall at the pier (or any repay) changes the debt afterwards, so next season looked like "debt went up" and the debt star (goal 3) could not be earned even when the player paid in full. Fix: closePier() re-bases `ledger.debtStart = debt + ledger.repaid - ledger.loansTaken` (not for why='next').
2. **Chip stayed red** (ui/hud.js). The `.short` class was only toggled by pierChipDue (due/pouch/tick); pier:paid / pier:seek / pier:repaid never removed it, and baronPier ignored pouch top-ups while he was still walking in ('arrive' phase), so a tip/jar withdraw left "need N more" red even with a full pouch. Fix: pier:paid/seek/repaid remove `.short`, pier:short removes `.repay` and adds `.short`; CSS `.repay:not(.short)` green; baronPier eco:spark listener also runs in 'arrive' (grace seconds are only spent in 'wait').
3. **Ledger numbers did not add up to the star rule.** report.income already contains Save interest / Invest gain / recovered raid drops and report.expenses already contains loan interest / free-trial renewal / Collector tax / raided Spark, yet the Ledger listed them again as their own rows and summed everything (Net double counted). Fix (ui/ledger.js): the big Sales/Expenses rows show only the REST, Net = income - expenses (+ negative invest) = exactly what the 1.25x goal compares. check.mjs expectations updated (298 / 124).
4. **1.25x goal now visible**: goal carries income/expenses/need; checklist reads "Earned 408, spent 28 - 1.25x met" or "Earn N (1.25x your M spent) - you made K". Epsilon added to the comparison (exactly 1.25x counts).
5. **Honest star promise**: pier chip says "pay it all + repay N = star" when forced debt (upkeep the pouch could not cover) stands (pier:due/pier:pouch carry holdNeed), "repay N more = star" after paying; failed debt goal reads "Debt rose N - repay N at the pier to hold it" (goal.rise). Browser-verified at 568x320 (probe topup mode).
6. Tests: economy.test.mjs 113 PASS (new S87 block incl. 6-season run), pier.test.mjs 18 pass. check.mjs --combat --crew --curiosity --audio --strangers --story --economy --pier ALL OK.
7. Probe: `node tools/probe_s87_pier.mjs <season> <W> <H> <full|short|topup>` (real taps decline the stranger "Not today", walks Pip next to the Baron, prints chip class + colour before/after, Ledger goals + rows, saves shots/s87_pier_*). Verified S3 568x320 full (chip green, 3 stars), S6 844x390 full, S1 short.

## S80-final review (item 1 of the S86 list): viewed 568x320 play + ledger, 844x390 play + ledger. NOT real problems: tutorial joystick demo sits above BUILD with a visible gap; PAY badge sits on its own row in the Spark capsule; Ledger CONTINUE ends ~30 px above the bottom edge. Left unchanged.
GAME_VERSION = 'S87'. Final shots re-taken (tools/shots/s80_final_*) at 844x390, 568x320, 1280x720.

## NOT done / next (suggested order)
1. Browser accept for fakeCharity + fogLevy and ledgerFlash for freeTrial (tools/probe_s85_deal.mjs <id> 568 320 accept; tools/probe_s86_flash.mjs <id>); view the 844x390 journal PNG (tools/probe_s85_journal.mjs 844 390). NOTE for any probe: from season 3 a Stranger charity dialogue can open at season end and block the Baron; decline it with a real tap on "Not today" (see probe_s87_pier.mjs skip()).
2. Scam NPC / Baron look different per deal (cosmetic, procedural only).
3. Real-phone test pending: pier chip green after paying in S3+, "repay N = star" hint, Ledger 1.25x row text, free-trial chip, jars panel.
4. A season whose pier is skipped (no debt, nothing owed) scores final at endSeason - unchanged and fine.
5. itch.io live build unverified.
