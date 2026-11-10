# HANDOFF S82 (2026-11-10) - Pip has a face (12 expressions), real Cloud sfx, devlog + zip refreshed

Setup (same as S81): clone https://github.com/Goodboycat/Lumen-Ledger straight into /home/user, `mv` to /home/user/webapp (move the template webapp aside first), `bash LUMEN/game/tools/github.sh <TOKEN>`. Browser libs: see HANDOFF_S79 (`sudo apt-get install` list), then `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium`. Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Run checks + shot tools FROM LUMEN/game. NEVER `pkill -f chromium` (it killed the shell once) and never chain `( ... ) &` with a following cd (the cd gets backgrounded too).

## DONE (all pushed)
1. **Pip's face.** The old eyes/mouth sat at z 0.36 = INSIDE the skull (front plane z 0.52), so Pip had no visible face at all. New `src/assets/heroFace.js` (rig: 2 eyes with glint + shut ^ arcs, 2 brows, mouth ribbon or open ellipse with teeth/tongue, tongue poke, blush, sweat drop; all flat unlit no-outline meshes, polygonOffset, ~25 meshes, no per-frame allocation) and `src/anim/heroFace.js` (driver). `hero.js` now exposes `parts.face` (rig), `parts.eyes` (= face group), `parts.mouth`.
2. **Expressions** (`EXPRESSIONS` in heroFace.js): neutral, happy, cheer, angry, dash, focus, strain, ouch, sad, worried, surprised, proud, dizzy. Params glide with damp (k 20; 40 for ouch). Random blink 2.2-5.4 s.
   - **angry** (teeth, slanted brows) = hero.state 'attack' (+0.45 s tail) - and move poses growthStomp / fogSweep.
   - **focus** (squint, tongue poke) = build placing (`build:enter` .. `build:exit`, 25 s safety), moves hammer/build/ledgerFlash; a placed/upgraded stall flashes focus then chains into cheer.
   - **ouch** (eyes squeezed, open mouth, sweat drop, priority 9) = `enemy:heroHit` 0.8 s, `storm:hit` 0.6 s.
   - **worried** = an enemy within 6 u in chase/seek/raid (polled every 0.25 s via opts.threat in Game.js), `storm:warn`, `enemy:baronWarn`, forced loan.
   - happy = jars:deposit / till:collect / eco:sale; surprised = enemy:wave, jars:spill; proud = enemy:blocked, build:removed; cheer = enemy:defeated, eco:win, celebrate/haggleShout; sad = build:denied, sandbox:denied, eco:lose; strain = pickUp/carry; dizzy = stunned (eyes circle).
   - Priority: timed event (ouch 9) > build hold 4 > attack/move 3 > threat 2 > neutral. API: `hero.face.set(name, dur=1, prio=5, snap=false)`, `.clear()`, `.name`, `.destroy()` (released with the run via sb._offs).
3. **Real sfx**: `audio/sfx/crew_payoff.ogg` and `cloud_hello.ogg` (converted from the user's Lumenledgersfx.zip with ffmpeg, mono vorbis q4) and `audio/manifest.json` points at them. `check.mjs --audio` OK. The same zip has ~45 more real Ludo.ai files (jar, deal, stranger, storm, season stingers, boss loops...) that are NOT wired: see NEXT.
4. **Tools**: `tools/face_shot.mjs [exprs]` (420x420 close-up, free camera), `tools/face_play_shot.mjs W H zoom [exprs]` (real play camera, 90x90 clip on Pip -> `tools/shots/s82_fp_<expr>_WxH.png`), `tools/probe_s82_face.mjs W H` (real attack -> angry, build placing -> focus, bus hit -> ouch; prints STATE lines).
5. GAME_VERSION `S82`. Gates `check.mjs --combat --crew --curiosity --audio` ALL OK. Shots re-taken at 844x390, 568x320, 1280x720 (`tools/shots/s80_final_*`, faces in `s82_fp_sheet*.png`). ITCH_DEVLOG.md updated (Pip face bullet, real sfx note, version S82).

## Seen / not done
- At 568x320 and 844x390 the face is small (Pip ~35 px tall) but brows + mouth read: angry vs ouch vs worried are distinguishable, happy/focus are subtle. If playtesters miss it, raise brow thickness (heroFace.js box 0.23 x 0.08) or add a tiny camera push on ouch.
- Faces were verified by forced states and real attack/build/hit probes; not hand-tested on a real phone. Hit-stop pauses the face (it ticks with hero.update).
- Helpers/crew/customers still use the older CreatureAnimator faces.
- No MCP modelling tools again; Cloud pet stays procedural (step 2 of the S81 list not done).
- 568x320 Cloud tutor card near BUILD: no real overlap (S81 note unchanged).
- Remaining ~45 real Ludo.ai sfx from the user pack are unmapped (e.g. Jar-Unlocked, Stranger-Arrives, Storm-Warning, Season-End stingers, Debt-Free fanfare, Boss-Fight-Loop/Endless .wav). Map them by id in manifest.json + check --audio.

## NEXT (in order)
1. Wire more real sfx from Lumenledgersfx.zip (ask the user to re-upload; /home/user/uploaded_files is per chat) -> ogg via ffmpeg -> manifest -> `check.mjs --audio`.
2. Hand-test faces on a phone; tune size/contrast if needed. Optional: faces for the Cloud crew pet.
3. Re-shoot, re-zip (`bash tools/itch_zip.sh`, upload as lumen-ledger-web.zip), update ITCH_DEVLOG.md if players notice.
