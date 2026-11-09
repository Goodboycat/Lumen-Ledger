# HANDOFF S73 (2026-11-09) - S3 walk-away BUILD card, credits roll + music

**Setup** (same as S72): `bash LUMEN/game/tools/github.sh <TOKEN>`; browser: `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium` + apt libs (Debian 13 list in HANDOFF_S72). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`.
Browser rigs are slow (swiftshader, 40-90 s): start them with `setsid -f node tools/x.mjs W H > /tmp/x.log 2>&1 < /dev/null` and poll the log; a foreground run over 2 min kills the tool call. Never `pkill -f chrom` (it matches your own shell).

## Done
1. **S3 passive-player question answered with a nudge, not a rebalance.** `customers.js` counts walk-aways (`noStall`) per season (`_seasonNoStall`, reset on season change) and emits ONE `cust:unserved {count, season, want}` at `UNSERVED_AT = 6`. New tutor card `cust:unserved` (data/tutor.json): "Customers want other stalls. Tap BUILD." with the hand on the BUILD button, closes when the tray opens or a stall is placed. Passive S3 probe: fires at 6 walk-aways in every seed (they reach 17-20).
2. **Tutor `urgent` flag** (`ui/tutor.js` `show()`): a one-shot event card with `urgent: true` replaces an info card that is up (was dropped behind `cust:want` - found in the real browser) and QUEUES behind a verb step (never replaces it, never lost). Tests: `tests/tutor.test.mjs` 15 (2 new). Tests must call `tutor.destroy()` or node --test hangs on the live timer.
3. **Credits roll + music** (`ui/credits.js/.css`): the thank-you line is now a looping CSS-only scrolling roll (`ROLL`, 7 true credit lines, masked top/bottom, static list under reduce-motion). `ui:credits:music` is emitted on show and again when `ui:title:open` fires underneath (the title returns right after `game:won` and would start its own music). `core/Audio.js` maps `ui:credits:music -> music 'credits'` and `ui:credits:close -> 'title'`; `audio/manifest.json` has a new `credits` entry (victory.ogg, looped, vol .55; no new asset). Tests: `tests/credits.test.mjs` 7.
4. `GAME_VERSION = 'S73'`. Rig `tools/shot_s73_unserved.mjs W H` (real browser: S3, wave, waits for the card, screenshots it). Total `node --test tests/*.test.mjs` = 127/127; `tools/wip.sh ... --tutor --ui` ALL OK.
5. Screens reviewed this chat: title 844x390, credits 568x320 (roll clear of lessons + button, no scroll), want/unserved card 844x390 and 568x320, pier chip 844x390. An image review of the 568x320 play view found nothing high: card readable, hand points at BUILD.

## Review notes (not fixed, existing look)
- 568x320: the unserved card wraps to 3 lines and sits over the lower path; fine, but a shorter or wider card would be tidier.
- Top-left HUD pills ("on counters", "debt", "PAY") are small on a 568 px phone; the empty season stars top-right are very pale. Medium/low; needs a real phone look.
- Market cluster in S3 is busy.

## Not done / next
- Credits music has not been heard on a device (muted rigs); `credits` loop = victory.ogg, may want its own track. Roll not seen on a real phone.
- A human playtest of the S3 card (does a beginner actually tap BUILD, build the wanted stall, and recover?).
- The 568x320 title shot (`tools/shot_title.mjs 568 320`) was not re-run this chat (a chained rig died); 844x390 title looks fine.
- Untouched: Wishes + Neighbours, Regions, cinematic polish. No new icons/MCP model work this chat (nothing needed them).
