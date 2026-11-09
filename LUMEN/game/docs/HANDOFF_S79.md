# HANDOFF S79 (2026-11-09) - F1/F2/F3 verified + fixed, Cloud brightened, Cloud fetch rules verified. Beta pass E, A2, B2, final screenshots and ITCH devlog remain.

Setup: clone straight into /home/user (NOT /tmp, a 493 MB tmpfs: a /tmp clone fails at checkout) -> `mv` to /home/user/webapp -> `bash LUMEN/game/tools/github.sh <TOKEN>`.
Browser: `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium`, then apt libs (Debian 13: `libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libxcomposite1 libxdamage1 libxrandr2 libgbm1 libxkbcommon0 libpango-1.0-0 libcairo2 libasound2t64 libnss3 libcups2t64 libxfixes3`).
Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Run checks FROM `LUMEN/game`: `node tools/check.mjs --combat --crew --curiosity`.
Headless swiftshader runs at ~2 fps, so game time is slow: teleport or force states in probes instead of waiting.

## DONE (all pushed)
- **F1 banner** (`ui/wave.css`): verified at 844x390 and 568x320. The hazard stripes (`::before/::after`, `left/right:-100vw`) crossed the Spark pill, debt chip and PAY. Now `left:0; right:0`, so the stripes stay inside the banner. The banner sits at top 66 px (<=420 px tall) and 78 px (<=340 px tall), below the tallest HUD pill (the Spark pill is 67-71 px tall at 568x320 because PAY wraps). Banner `max-width` 70 vw / 66 vw.
- **F2 shop tray** (`ui/build.css`): at 568x320 the tray reached 22 px into the Spark pill (it hid PAY). New `@media (max-height:340px) and (min-height:301px)` block with compact cards (grid max-height 70 px, small icons, no footprint tag). Tray top is now 75-78 px and the Spark pill bottom is 74 px. With a card selected (`.has-detail`) the detail bar now REPLACES tabs, grid and foot on phones (they are restored by the X): 568x320 tray top 137, 844x390 tray top 153. Before, the 844x390 detail state was 362 px tall with its top at y=-38 (cut off).
- **F2 chevron**: `.more` appears only when the grid overflows. The Jars tab is empty (0 cards, no chevron). Every other tab overflows, so the chevron shows there. Correct.
- **F3 touch targets**: tabs are 40 px tall at both sizes. Detail-bar buttons and the +/- price buttons are >=40 px on phones.
- **Cloud look** (`assets/creatures/helpers.js`): `bake()` merges everything into ONE shared vertex-colour toon material, so a per-mesh emissive does nothing. The Cloud now gets a cloned `toonVertexMat()` with `emissive 0x8A8A8A` after the bake (`if (type==='cloud')`). Puffs are 0xFFFFFF and the face is ~1.6x bigger (eye r .098, pupil .062, gap .145, plus a flat smile crescent and bigger pink cheeks). Crop `tools/shots/s79_cloud_e_crop.png` (3x) shows a white puff with a visible smiling face.
- **Cloud faces the camera** (`systems/crewJobs.js` follow state): `faceTo(p.x + (hp.x-p.x)*0.3, p.z+3)`. Before, it faced Pip, so its face was sideways to the iso camera.
- **Cloud fetch rules** (`tools/probe_s79_cloud.mjs`, real browser):
  - A coin ~13 u from the Cloud is ignored (range 10 u OK).
  - A coin at 8 u is fetched and paid (+5).
  - A coin within 0.8 u of Pip is ignored, so Pip takes it himself.
  - Baron wave: the Cloud used to fly to coins next to the Baron (distance to him went to 0.1 u). New `nearEnemy()`: coins within 3 u of a live Collector/Baron (`enemies.active`, states chase/seek/raid/carry) are skipped until the enemy walks off or dies. Verified after the fix.
- `check.mjs` ALL OK, `--crew` 8/8, `--combat` OK.
- **Docs rule**: `LUMEN_extras/game/docs/START_HERE.md` now has "RULE ITCH": at the very end, when everything is solved, write `LUMEN/game/docs/ITCH_DEVLOG.md`.
- New tools: `tools/verify_s79_f.mjs W H` (banner/tray/chevron overlap report + shots), `tools/probe_s79_tray.mjs W H`, `tools/shot_s79_cloud.mjs W H tag`, `tools/probe_s79_cloud.mjs`.

## NOT DONE
- **MCP model/rig/animation for the Cloud**: no MCP modelling tools were available this chat. The Cloud is still procedural (now bright). If MCP appears next chat, try it. Otherwise leave it as is.
- **S77-A2 fruit** (investigated, NOT fixed). `economyData.js`: fruit `fair 6, base 1.6`, a normal demand curve. With only 4 stalls (fruit, bread, tea, flower) fruit sells fine (21 picks, 19 paid). In the full 12-stall market (`node tools/probe_s77_fast.mjs 10 6`) fruit got 13 picks but only 2 reached `_react` (1 paid, 1 refused); the other 11 never resolved. Tea has the same problem (3 picks, 2 resolved). Other kinds resolve about 60-100 % of picks. The 'refused' counts on bread, tool and sparkExchange (7-8) suggest the Critic/haggler price check (`price <= fair*1.1`) also needs a look. Hypotheses to test first:
  1. A probe artefact: the 1500-step cap per wave leaves customers still queued when the probe stops. Check by running longer, or by counting `C.active` at the end.
  2. Fruit and tea are the cheapest stalls, so the customers' `wallet` cap (`paid > g.wallet`) or `sold===0` may apply.
  3. `pickStall` re-picks (`_set(c,'pickStall')` after `stuck>2.5` s) inflate the pick counts: each re-pick increments `pick` without a `_react`. That is the likeliest cause, so log `stuckCount` per stall.
- **S77-E**: beta pass over every feature, then FINAL screenshots at 844x390 and 568x320 (title, play, shop tray, Crew tab with the Cloud card, ledger, boss banner), analysed for beginner-friendliness. Only these were looked at this chat: banner and tray (844 and 568), and the Cloud close-up. Observed and NOT yet fixed: at 568x320 the tutor bubble ("Drag the stick to move Pip.") wraps to 2 lines and sits close to the BUILD button and the Cloud icon. The debug stats overlay (fps/tris) appears only with `debug=1`, so it is not a player issue.
- **S77-B2** chip icon review. **Slash chain** slash1 -> slash2 -> spin in real time on a phone. **Cloud sfx** ids (`cloud_hello`, `crew_payoff`) when the audio files land.
- **ITCH_DEVLOG.md**: not written (RULE ITCH says to write it last, when everything is solved).
