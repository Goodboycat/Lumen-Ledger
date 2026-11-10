# HANDOFF S83 (2026-11-10) - full real sfx pack wired, real boss loops, bolder Pip face

Setup (same as S82): clone https://github.com/Goodboycat/Lumen-Ledger into /home/user, move the template webapp aside, mv clone to /home/user/webapp, `bash LUMEN/game/tools/github.sh <TOKEN>`. Browser libs per HANDOFF_S79, then `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium`. Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Run checks and shots FROM LUMEN/game. Never `pkill -f chromium`.

## DONE (all pushed)
1. **35 real Ludo.ai sfx + 2 boss loops** from Lumenledgersfx.zip: ogg mono q4, silence trimmed, limited, vol set from measured mean loudness (-19 dB target) in `audio/manifest.json`. New ids: jar_deposit/withdraw/unlock/locked/spill/tap, tutor_show/dismiss, hand_tap, sword_swing/hit, dash, till_collect, price_up/down, stranger_arrive/talk, deal_accept, deal_fair_ok, owl_hoot, place_confirm/blocked, tab_switch, card_select, storm_chip, crew_walkin, ledger_stamp/total, debt_pay, debt_free, hot_ding, cold_ding, pause_open, joystick_on, title_play, season_end_win/ok. Each has a synth fallback.
2. **Boss music**: `music/boss_fight.ogg` (84 bpm, C, 22.857 s, bar-exact) and `boss_fight_endless.ogg` (transposed +6 st to F# to sit on island_endless, 20.0 s). Old procedural stems replaced.
3. **Audio.js**: ~30 new DEFAULT_EVENTS rows; new rule fields `also: [{sfx, delay, vol}]` (delayed follow-up, timers cleared on destroy) and pick() variants now inherit the row cooldown. `eco:jar` deltas are silent (jars:* own the sound; exposed hit -> jar_spill). New emit sites: `ui:ledger:row|total|stars` (ui/ledger.js), `scam:talk` (scamNpc.interact), `ui:joy` (touch.js joyStart).
4. **check.mjs --audio** now probes 36 triggers (each plays its own file, files exist, eco:jar silence, enemy combat:hit no sword_hit, silent jar restore, delayed also). ALL OK with --combat --crew --curiosity --audio.
5. **Face readability** (568x320 verified with face_play_shot): brow 0.25x0.108, mouth ribbon 0.074 thick, neutral smile flatter (mc .55), stronger `focus` (squint, brows angled, mouth flat, bigger tongue), sweat drop bigger and more saturated blue.
6. **Shots re-taken** 844x390, 568x320, 1280x720 (`tools/shots/s80_final_*`, `s83_sheet_*`, `s83_jars_*`, `s70_pier_*`, `s71_credits_1280x720.png`). Read by eye: ledger fits at 568x320, tray scrolls, HUD has no overlap, credits and pier fine at 1280x720. New tool `tools/shot_s83_jars.mjs W H`.
7. GAME_VERSION S83. ITCH_DEVLOG.md updated.

## Seen / not done
- Sounds are verified by bus probes only, NOT by ear. Needed listening pass: volume balance of till_collect vs coin, jar_deposit spam when holding a jar (cooldown .08), sword_swing on every combo step, tutor_show on every card, ledger_stamp every other row, hot/cold ding at season start. Tune `vol` in manifest.json.
- `jar_tap`, `hand_tap`, `ui_hover`, footsteps, `baron_arrive` etc. still unreferenced by events (hand_tap and jar_tap have files, no trigger).
- `cloud_hello` is referenced by sandbox:hired pick only (fine).
- Jars panel shot showed the HUD only (panel stays staged/collapsed in the shot); jars panel itself was not visually reviewed at 1280x720.
- Crew pet still has no face; no MCP modelling tools exist. Helpers/customers keep old faces.
- Hand-test on a real phone still pending (faces, sound loudness, ledger).

## NEXT
1. Listen/tune sfx volumes; trigger for jar_tap / hand_tap if wanted.
2. Real-phone test; adjust face/HUD if needed.
3. Optional Cloud pet face.
4. Rebuild zip (`bash tools/itch_zip.sh`) after any change and re-upload as lumen-ledger-web.zip.
