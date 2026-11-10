# HANDOFF S84 (2026-11-10) - replay bug (speed button + tutorial), sfx tuning, jars panel

Setup (same as S83): clone https://github.com/Goodboycat/Lumen-Ledger into /home/user, move the template webapp aside, mv clone to /home/user/webapp, `bash LUMEN/game/tools/github.sh <TOKEN>`. Browser libs per HANDOFF_S79, `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium`. Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Run checks and shots FROM LUMEN/game. Never `pkill -f chromium`.

## DONE (all pushed)
1. **Replay bug (user report from itch.io: after replay / Continue / Play, no tutorial guide and the speed button does not work).** Reproduced locally with Playwright (tools/probe_s84_replay.mjs, probe_s84_reload.mjs, probe_s84_b.mjs, probe_s84_c.mjs). Three causes:
   - **Speed button ate real taps.** S80 added an invisible 40 px hit pseudo-element on the season pill (`.ll-season.is-tappable::after`, hud.css) that covers the speed button. A real touch/mouse tap opened the season card instead of speeding up; probes that call `.click()` never saw it. Fix: `.ll-season .ll-speed { position: relative; z-index: 3 }` plus its own ::after hit area (hud.css). Verified with `touchscreen.tap`: speed 1 -> 2, season card stays closed.
   - **Returning player had the speed button (and jars / stars / powers) hidden.** ui/reveal.js stages widgets on a "first run" = `lumen.tutorialDone !== '1'`, but NOTHING ever wrote that key. Fix: `tut:done` writes it and reveals speed; `game:start` also treats a profile with any tutor card seen as returning (reveal.js).
   - **Verb tutorial cards stayed silent on replay.** tutor counts/seen persist in the save, so `verb:*` cards were already "retired" while the verb chain froze the season clock waiting for the player. Fix: new `tutor.forget(prefix)` (ui/tutor.js); verbChain `V.start` calls `lg.ui.tutor.forget('verb:')` so every PLAY / CONTINUE into the chain re-teaches it.
   - After the fix: PLAY and CONTINUE after a reload both show the speed button, a real tap works, tutor card visible (probe_s84_b.mjs story|continue).
   - NOT verified on itch.io itself: the page is password protected and the download key link only serves the build zip, so I could not open the live iframe. The repro is local; please re-test the new zip on itch (hard refresh, or clear site data once).
2. **Sfx tuning (by reasoning; still not heard).** Audio.js DEFAULT_EVENTS: jar_deposit cd .12 vol .85; jar_withdraw cd .2 vol .85 (hold repeat is .25 s); tutor_show cd 1.5 vol .6; sword_swing cd .2 vol .85; till_collect cd .25 vol .75 (quieter layer under coin); ledger_stamp cd .14 vol .85. **New triggers:** `ui:jars:toggle` -> jar_tap (ui/jars.js header tap), `tutor:hand` -> hand_tap (emitted once when the cloud hand appears, ui/tutor.js). check.mjs --audio now probes both (38 triggers). ALL OK with --combat --crew --curiosity --audio.
3. **Jars panel reviewed open for the first time** (tools/probe_s84_jars.mjs W H shot -> tools/shots/s84_jars_WxH.png). The old shot tool never showed it (panel is `hidden` until a jar is built; shot_s83_jars.mjs now calls ui.jars.show). Found and fixed:
   - grid auto-placement bug: `.ll-jar-pct` is row-locked so it took the wide column and pushed name + slider into the 42 px column ("Spend 80" clipped, 53 px rows). Every cell is now pinned (jars.css).
   - short-landscape block (`max-height: 420px`): compact 35 px rows, 204 px wide, 20 px touch strip for the slider (base.css had a 32 px touch rule that won).
   - Result: 844x390 shows all 4 rows + scroll for the footer; 568x320 shows Spend + Save, rest scrolls (cap 94 px); 1280x720 shows everything incl. Debt row and PAY. No overlap with pause, stats chip, dash or attack.
4. GAME_VERSION S84. Zip rebuilt (436 files, 11 MB, sha256 62b015336cddd91e...), uploaded as lumen-ledger-web.zip. Shots re-taken: tools/shots/s80_final_*_{844x390,568x320,1280x720}.png, s84_jars_*.

## Seen / not done
- Cloud crew pet face: not started (no MCP modelling tools exist).
- Sounds still verified by bus probes only, not by ear.
- At 568x320 the open jars panel shows only 2 rows before scrolling (cap from touch.css:58). Could raise the cap or fold footer; deliberate trade-off to keep the dash button clear.
- Tutorial card positions on replay were checked by state + screenshot at 844x390 / 568x320 only on the first card (verb:move).
- ITCH_DEVLOG.md not updated for S84 (replay bug fix would be a nice short paragraph).
- Real-phone test pending.

## NEXT
1. Ask the user to retest the itch build (replay -> Play / Continue -> speed button, tutorial card).
2. Optional: Cloud pet face; listen pass on sfx volumes; raise the jars cap at 568x320.
3. Rebuild zip (`bash tools/itch_zip.sh`) after any change, upload as lumen-ledger-web.zip.
