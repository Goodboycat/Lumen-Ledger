# HANDOFF S71 (2026-11-09) - Baron short-pay hint, credits after THE END, "Nobody sells X" chip

**Setup**: `bash LUMEN/game/tools/github.sh <TOKEN>`; clone straight into /home/user/webapp (NEVER /tmp: 493 MB tmpfs). Browser: `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium`, then apt libs (Debian 13: `libatk1.0-0 libatk-bridge2.0-0 libatspi2.0-0 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2t64 libnss3 libcups2 libxfixes3`). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Run gates ONE flag at a time (46 flags, ~75 s total); write logs to /home/user, not /tmp.
Note: `git add -A -- . ':!path'` with an ignored path exits non-zero and breaks `&&` chains: use plain `git add -A`.

## Done
1. **Short-pay hint** (`ui/hud.js` `pierChipDue`, `src/systems/baronPier.js`): `pier:due` now carries `spark` + `canPay`. Chip reads "BARON AT THE PIER - 15 due - pay it all = star - 20 s"; when the pouch cannot cover it the chip turns salmon (`.ll-pier-chip.short`) and reads "short = no star". The Baron's arrival line adds "(Pay it all = star.)" in S1-S3 when affordable. Seen at 568x320 (`tools/shots/s70_pier_568x320.png`); pay rig `shot_s70_baron.mjs 568 320`: 3 stars, errors [].
2. **Credits after THE END** (`ui/credits.js`, `ui/credits.css`, wired in `ui/index.js`, `index.html`): `game:won` (now carries `stars`) opens a card above the title: trophy, "THE END / You lit the Lighthouse!", star total x/30, the 10 lessons with a rosette each, thank-you line, BACK TO TITLE (Enter/Space/Esc/tap). 2 columns on phone landscape, compact at <=340 px tall. `tests/credits.test.mjs` (6). Shots `tools/shots/s71_credits_{568x320,844x390,1280x720}.png` (rig `tools/shot_credits.mjs`): fits, no scroll, Enter returns to title, errors [].
3. **New procedural art** (`ui/icons.js`): `trophy`, `rosette`, `confetti`. Made via `node tools/icons_shot.mjs trophy rosette confetti` (side-by-side screenshot -> sliced PNGs in `ui/icons/`, manifest updated). Confetti was redrawn once (ink swallowed the small strips).
4. **S3 beginner question - answer**: the Owl's "Nobody sells tea" line never reached beginners. The bark layer has been unmounted since S58 and `ui.barks` is undefined, so neither the Owl line nor the want bubble was drawn. Fix: `customers._owlWant` now also emits `hud:chip {want, text:"Nobody sells tea! Build one.", ttl:7}` (once per want per season); `hud.js` renders it with the drawn stall icon and removes it after `ttl`. Seen at 568x320 (`s71_want_568x320.png`, rig `tools/shot_want.mjs`).

## Verification
All 46 `check.mjs` flags one by one: ALL OK (the `--barks` "FAIL" in my loop was a grep artifact: its section prints after ALL OK; exit 0, no FAIL text). `node --test tests/*.test.mjs`: 111/111. Beginner-flow shots 568x320 / 844x390 / 1280x720 via `shot_s69.mjs`: errors [] each.

## Screenshot review (phone landscape first)
- 568x320 title: logo + PLAY legible, nothing overlaps. Play view: Spark/debt/PAY, season pill, pause, Focus, power chip, BUILD, sword all visible; joystick demo + tutor card do not touch. Want chip sits under the Spark pill, clear of the season pill.
- 1280x720 play view: HUD small but clean; WASD keycaps + tutor card readable; ability chips + BUILD at the bottom centre.
- Not looked at again this chat: 844x390 title, ledger with the new pier hint on a phone, the credits card on a real device.

## Not done / next
- Human playtest of a passive 3-stall S3 player (11-22 units): the chip now explains why customers leave, but nobody has played it. `tools/probe_s71_wants.mjs` is only a stub.
- Short-pay: the hint shows, but there is still no way to fix a short pouch after the Baron arrives (the clock is held). Option: let the player sell/collect tills while he waits.
- No test gate for the pier chip text / want chip (only real-browser rigs).
- Credits: no scroll-up roll or music; "Wishes + Neighbours", "Regions", cinematic polish untouched.
- No MCP model/rig/animation work (nothing here needed 3D).
