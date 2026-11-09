# HANDOFF S76 (2026-11-09) - partial: 7 of 12 player reports fixed, rest NOT started

**Setup**: clone into /home/user, mv to /home/user/webapp, `bash LUMEN/game/tools/github.sh <TOKEN>`. Browser rig: `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium` + apt libs (see S75). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. New shared rig `tools/rig76.mjs` (launch / startStory / shot). Probes: `probe_s76_title.mjs`, `probe_s76_boss.mjs <season>`, `probe_s76_root.mjs`.

## DONE (all pushed; 17 node test files pass, check --enemies OK, economy sim unchanged: sensible wins @10 x10 / @11 x10)
1. **Main-menu ghost UI**: `ui/title.css` end: while `body.ll-title-open`, every `#game-root` child except title/canvas/debug/credits/pause is `visibility:hidden`, tutor card/hand/joy `display:none`. Verified by DOM probe after `lg.toTitle()` (only the PLAY icon visible).
2. **Shield "absorbed"**: it was FALSE on cast (the 'ABSORBED!' pop fired when the shield was only armed). Removed the pop + event-name pop in `anim/heroAbilities.js`, and removed the `🛡 ... absorbed` answer pill in `Game.js`. Real absorbs still clear the storm + the Protect bark.
3. **Cloud hand on Save jar**: `jar:withdraw` card now `maxShows:1`, never offered for Invest (locked, nothing to take back), and the hand points at the arrow of the jar Pip stands at (`tutor.js st.ptJar`), not always the first jar with a balance (Save). Test-guard: a `//` comment mid-line broke tutor.js once, fixed.
4. **S10 debt paid -> no ending**: root cause = `isWin()` only ran inside `endSeason()` BEFORE the Baron's pier visit. New `Economy.tryWin()` called in `baronPier.done()` right after `closePier()` (emits `eco:win` before `pier:done`, so Game goes to 'ending' = victory cinematic + dialogue). Also new balance `winFogMax: 0.99` (BALANCE_TUNED) so debt 0 after S10 wins even if fog > 0. Test added in `tests/pier.test.mjs`.
5. **S8/9/10 boss + collectors**: Collectors took landing index 0 = Baron's own point (stacked) or far shores off camera. `enemies.js spawnWave` now spawns them as an arc entourage 1-2.4 u beside the Baron (`_spawnOne(..., ent)`); they walk home to his shore point (copy, not the cached object). Probed S8 (3 enemies) and S10 (5) in the browser: all within ~3 u of each other.
6. Version string `S76`.

## NOT DONE (next chat, in this order)
A. **Glimmers never visit some shops** (customers.js: look at `_pickStall`/stall kind -> WANT map, `unserved`, stalls behind other stalls / no flowfield path / queue slots; write a browser probe that builds all 12 stall types and counts visits per type over 2 seasons).
B. **Purple chips -> Cloud speaks symbolically**: the "purple boxes" are HUD `.ll-chips .ll-chip` (`#3b2a6b`, `ui/hud.js` handler `hud:chip` line ~192; emitters: customers.js `_owlWant` 'Nobody sells X', stormWarning, nightMarket, story `hud:new`). Wanted: shown as the Cloud (drawn `cloudbaby`) saying an ICON-ONLY message (e.g. glimmer face + shop icon, storm mark + jar), each new one stacks BELOW the previous, each fades to transparent over 5 s (CSS opacity transition, remove at 5 s).
C. **Cloud blue tutor box slightly transparent**: `ui/tutor.css` `.ll-tutor-bub` background alpha ~0.85 (text stays opaque).
D. **Cloud as a buyable crew member** (shop Crew tab): add `helper_cloud` to `economyData.js` UPGRADES (see helper_tallyOwl rows) + a model (`assets/creatures/helpers.js`, reuse `cloudBaby` art/geo) + a job in `systems/crewJobs.js`: walk to dropped coins (`sb.coins`), carry (coin above head), hand to Pip, coin disappears when delivered (`sb.collectCoin`). Needs the icon via procedural -> side-by-side screenshot -> sliced PNG (`tools/icons_shot.mjs`), ui/build.js crew card, tutor.json card.
E. Beta-test sweep (every feature) and a final mobile-landscape (844x390, 568x320) screenshot review + analysis; not done this chat. Last visual check: S8 boss screenshot `tools/shots/s76_boss_s8.png` (HUD readable, boss + collectors visible).
F. S74/S75 leftovers: Baron banner over centre, shop tray scroll hint, tiny tap targets at 568x320.

## Notes
- Credentials: the GitHub token was given in chat; it is in ~/.git-credentials only, never committed.
- No new icons / MCP model / rig used this chat (all fixes were logic + CSS).
