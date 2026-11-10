# HANDOFF S81 (2026-11-10) - chain verified, hit areas verified, ledger CONTINUE clip fixed, ITCH_DEVLOG written, zip built

Setup: clone straight into /home/user (NOT /tmp), mv to /home/user/webapp, `bash LUMEN/game/tools/github.sh <TOKEN>`; `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium` after `sudo apt-get install` of the Debian 13 libs (HANDOFF_S79). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Checks FROM LUMEN/game. Shot tools use relative `tools/shots` paths: run them from LUMEN/game, not from tools/ (else they write to tools/tools/shots).

## DONE (all pushed)
1. **Slash chain** `tools/probe_s80_chain.mjs` fixed (calls `game.sequences.update(1/60)` + `combat.update(1/60)`): presses at 0/330/640 ms give steps 0 -> 1 -> 2 at 0/333/650 ms, ends at 1383 ms, 0 errors. Combat code needed no change. Still worth a human feel-test on a phone.
2. **Hit areas** new `tools/probe_s81_hit.mjs W H` (every visible button / chip / pill, elementFromPoint +-40 px). 568x320 and 844x390: PAY 57x51 / 65x54, season pill 41-43 px, pause 44, BUILD 44, tutor X 44, ATTACK 70, dash 60, debug tab 44. Nothing under 40 px.
3. **REAL BUG fixed**: the Ledger CONTINUE button was cut off at the bottom of a 568x320 screen once the Cloud was hired (crew line makes the left column taller; CONTINUE was always put in the left column). `ui/ledger.js`: `place()` now measures both columns and puts the foot in the SHORTER one, re-run on every `show()` (after crew/unlock content is known). New `tools/probe_s81_ledger.mjs W H` (hires the Cloud first): 568x320 CONTINUE 249-289 of 320 (was 285-325), 844x390 fine. The S80 ledger probe missed it because it never hired the Cloud.
4. **Title version string** said "S76 - jam build": `GAME_VERSION` is now `S81` (src/Game.js).
5. **1280x720 beta**: title, play, tray, crew, boss, ledger re-shot (`tools/shots/s80_final_*_1280x720.png`) - clean. All three size sheets refreshed after the ledger fix (`s80_final_sheet_568x320.png`, `_844x390.png`).
6. `docs/ITCH_DEVLOG.md` written (RULE ITCH) from the S69-S80 handoffs. Final zip per RULE Z (see the chat message for link, size, sha256).
7. Gates: `check.mjs --combat --crew --curiosity --audio` ALL OK.

## NOT DONE / observations
- **Cloud sfx**: no real files exist (checked the repo and /home/user); `crew_payoff` -> coin.ogg and `cloud_hello` -> wind_chime.ogg stay placeholders. Prompts: `lumen_sfx_prompts.txt`, `docs/SFX_LUDO_S64.md`.
- **MCP**: no modelling / rig / animation MCP tools were available again. Cloud stays procedural.
- 568x320 play screen: the Cloud tutor card sits close to BUILD and the stick demo overlaps the house roof; readable, no overlap with a button. Joystick base is drawn over the house at the spawn point (cosmetic).
- Reviewer (image model) flagged a "joystick emoji" in the tutor card at 844x390: it is the drawn `stick` icon, not an emoji.
- Not covered: every feature at 1280x720 by hand (only the six required screens + probes).
