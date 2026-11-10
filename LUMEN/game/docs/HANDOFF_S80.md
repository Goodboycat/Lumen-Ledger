# HANDOFF S80 (2026-11-10) - A2 fixed, E beta pass + final shots done, ITCH_DEVLOG STILL TO WRITE

Setup: clone into /home/user, mv to /home/user/webapp, `bash LUMEN/game/tools/github.sh <TOKEN>`; `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium` + apt libs (HANDOFF_S79). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Checks from LUMEN/game. No MCP modelling tools were available again (Cloud stays procedural).

## DONE (all pushed)
- **S77-A2 fruit - real cause found.** (1) The probes placed stalls with `silent:true`, which emits no `build:placed`, so the flow field and `_usableSlots` caches were stale: customers "stuck" and re-picked (fruit 10 first picks + 6 stuck re-picks, 4 resolved). Probes now call `C.reroute()` after placing (`probe_s77_fast`, `probe_s80_fruit`, `probe_s80_stuck`). Result: fruit 11 picks / 13 resolved (7 paid), tea 5/6, 0 re-picks. (2) A REAL bug: a customer in state `leave` standing on a blocked cell never reached the spawn point and held a `maxActive` slot for ever (every wave ended on the 6000-step cap with 1 active). `customers.js` leave case now snaps to the nearest walkable cell and despawns after 4 s without progress (`c.leaveStuck`). Waves now end in ~230-315 steps, active 0.
- **Refusals (bread/tool/sparkExchange) are design, not a bug**: `probe_s80_demand.mjs` shows expected units/visit at fair price: haggler 0.1-0.34, saver 0.25-0.77, critic 0.27-0.86 (critics refuse above fair x1.1), expensive stalls (tool fair 27 in S6, sparkExchange 20) <1 unit for most types. No change.
- **S77-E beta + final shots** (`tools/shot_s80_final.mjs W H` -> `tools/shots/s80_final_{1_title,2_play,3_tray,4_crew,5_boss,6_ledger}_WxH.png`, sheets `s80_final_sheet_568x320.png` / `_844x390.png`). Fixes found by the review:
  - tutor card at 568x320: icon hidden, one line, clear of BUILD (`ui/tutor.css`)
  - tap targets: PAY chip hit area 51 px, season pill 41 px (invisible `::after`, `ui/hud.css`), season banner buttons 40 px (`ui/seasons.css`), verified by `probe_s80_hit.mjs`
  - 844x390 shop tray covered the Spark pill + PAY (tray top y=26): grid capped at 108 px, top now y=82 (`ui/build.css`)
  - the drawn stick demo floated over the open tray (hidden while `body.ll-tray-open`) and over the Cloud chips (hidden while chips show, <=360 px tall)
  - ledger at 568x320 checked (`probe_s80_ledger.mjs`): CONTINUE fully visible, 40 px.
- **S77-B2 chip icons**: reviewed at 568x320 (`s80_chips_crop2.png`): storm / jar / sad-face / tea / hammer / lantern / sack icons are readable; no change needed beyond the stick-demo overlap above.
- **Cloud sfx**: `crew_payoff` (on `crew:payoff`, placeholder file coin.ogg) and `cloud_hello` (on `sandbox:hired` with type cloud, placeholder wind_chime.ogg) wired in `Audio.js` + `manifest.json`; `check.mjs --audio` OK. Replace the files with the Ludo.ai ones (`lumen_sfx_prompts.txt`, docs/SFX_LUDO_S64.md).
- `check.mjs --combat --crew --curiosity` ALL OK (run before the sfx edit; `--audio` OK after it).

## NOT DONE
- **ITCH_DEVLOG.md still to write** (RULE ITCH, do it LAST). Facts: S69 four stale gates, S70 pier stars bug, S71 credits + "Nobody sells X" chip, S73 unserved tutor card + scrolling credits, S74 debt 1300 + Baron hunts + boss music layer, S75 six player fixes (ground tap, focus 3x slower, jar pick), S76 title ghost UI + Baron entourage, S77 Cloud chips + pickStall fairness, S78 sword rekey + Cloud crew + SFX list, S79 Cloud bright + fetch rules, S80 this file. Screenshots: tools/shots/s80_final_*.
- **RULE Z final zip** (`bash tools/itch_zip.sh`, name lumen-ledger-web.zip) not built: run after the devlog.
- **Slash chain slash1 -> slash2 -> spin**: `tools/probe_s80_chain.mjs` is written but INCONCLUSIVE: it ticks `game.update`, which does not exist; sequences are driven by `game.sequences.update(dt)` + `sb.combat.update(dt)` (see `core/Game.js _frame`). Fix the probe to call those two with dt=1/60 and press `combat.attack()` at 0/330/640 ms, expect steps 0,1,2. Then watch it on a real phone.
- Cloud MCP model/rig: only if MCP exists.
- Full beta pass was over the six required screens + chips + HUD buttons, not every feature at 1280x720.
