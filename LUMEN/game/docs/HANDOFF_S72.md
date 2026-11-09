# HANDOFF S72 (2026-11-09) - short-pay fix at the pier, pier/want chip tests, passive S3 playtest

**Setup** (same as S71): `bash LUMEN/game/tools/github.sh <TOKEN>` (clones into /home/user/webapp). Browser: `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium` + apt libs (Debian 13: `libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2t64 libnss3 libcups2 libxfixes3`). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`.

## Done
1. **Short-pay fix** (`src/systems/baronPier.js`, `ui/hud.js`). Finding: the season-end till sweep runs BEFORE the Baron arrives, so "collect tills while he waits" has nothing to collect. What a short player CAN do is take Spark out of a Save/Spend/Protect jar (the jars panel `↩`) or grab a tip coin. So: while he waits (`phase 'wait'`, not yet settled) every `eco:spark` gain re-checks the pouch and emits `pier:pouch {spark, interest, canPay, need, jar}`; the chip updates live ("need N more · jar ↩ helps" -> "pay it all = star", salmon -> yellow). While SHORT, each gain also gives back `PIER.graceStep` (4 s) of countdown, up to `PIER.graceMax` (12 s) in total, charged only for time really returned (`pier:grace`). `pier:due` now carries `jar` (withdrawable cash: spend+save+protect; Invest is locked mid-season). Jar advice only shows when jars hold cash.
2. **Chip overlap fixed**: a wrapped pier chip used to be drawn on top of the want chip stack (seen in `tools/shots/s72_short_844x390.png` before the fix). `placeChips()` in hud.js pushes `.ll-chips` below the pier chip while it shows, resets on done/skip/start.
3. **Max 2 want chips at once** (a passive S3 player met 4 stacked "Nobody sells X" chips).
4. **Tests**: `tests/pier.test.mjs` (13): pier grace logic with a stub economy + HUD pier chip text/short class/flip + want chip text/icon/ttl/cap. Total `node --test tests/*.test.mjs` = 124/124. Gates `--pier --ui --economy --customers --seasons --crew --curiosity` ALL OK.
5. **Real-browser rig** `tools/shot_s72_short.mjs W H` (844x390): short pouch (spark 0, 58 in Save) -> Baron waits -> chip "need 30 more" salmon -> withdraw 40 from Save -> chip flips to "pay it all", grace 12 -> 8 -> pay -> 2 stars, shortfall 0, errors [].
6. **Passive S3 playtest** `tools/probe_s71_wants.mjs [N] [seasonSeconds]` (replaces the stub; headless, real createLumenGame + pierPays, 3 starter stalls, no input except paying the Baron). 4 seeds, season 150 s:
   - units sold: S1 11-17, S2 16-20, **S3 10-15 (mean 12.5)** (matches the handoff's 11-22 range, slightly lower)
   - **S3: 17-20 customers walk away "noStall"** (cloth, toy, pottery, lantern are wanted, starter stalls are fruit/bread/tea). S2 only 3-4. So the passive player's income falls S2 -> S3 and S3 earns 0 stars; debt stays 300 (never repaid), pouch ends ~100-190.
   - The want chip now appears in S2 (first unmet want) and S3 (up to 4 kinds, capped at 2 visible).
7. Screens reviewed at 844x390 this chat: title, play view + want chip, pier chip (short + collected), Baron ledger (3 stars), credits card (fits, no scroll). All readable; no overlaps after fix 2.

## Not done / next
- **Balance question for the S3 passive player**: 17-20 of ~30 customers leave unserved in S3. Is that intended pressure ("build more stalls") or a wall for beginners? Consider a one-time tutor card at S3 pointing at BUILD when noStall >= 6 (the chip says WHAT, nothing says HOW cheap). Needs a real human play.
- Credits: still no scrolling roll and no music.
- Not reviewed on a real device: 844x390 pier chip on a physical phone (only emulated), credits on a device.
- Untouched: Wishes + Neighbours, Regions, cinematic polish.
- No new procedural icons / MCP model work this chat (nothing needed them; the jar hint uses the existing drawn `↩` via iconize).
