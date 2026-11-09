# HANDOFF S69 (2026-11-09) - the 4 red gates are green

**Setup**: `bash LUMEN/game/tools/github.sh <TOKEN>`; browser rig: `cd LUMEN/game/tools && npm i playwright@1.47.0 && npx playwright install chromium` + apt libs (Debian 13 names: `libatk1.0-0t64 libatk-bridge2.0-0t64 libatspi2.0-0t64 libasound2t64 libcups2t64 libgbm1 libnss3 libxkbcommon0 libpango-1.0-0 libcairo2 libxcomposite1 libxdamage1 libxrandr2 libxfixes3`); server `cd LUMEN/game && setsid -f python3 -m http.server 3000 --bind 0.0.0.0`. Clone straight into /home/user/webapp.

## Verdict on the 4 red gates: ALL were STALE TESTS, not game bugs
| Gate | Root cause | Fix (test side only) |
|---|---|---|
| `--customers` "paid 8/20", "did not pick a stall" | S44B (`wantOf`/`_want`): a customer whose top want nobody sells leaves `noStall` (sad) BY DESIGN. The S3 wave mix (impulse/tourist/spender) wants toy/lantern/pottery/cloth, the rig only has fruit/bread/tea; a `spender` wants cloth/toy. Probe: 18 of 72 spawns leave noStall, 0 leave for any other reason. | wave test uses the S1 mix, edge-case uses a `saver` |
| `--firstplayer` "seed 3: S3 sold only 12 units" | same S44B behaviour (S3 mix) | S3 floor 8 (S1/S2 stay 15) + NEW guard `paid + noStall >= 85 % of spawned` (the real "nobody buys" detector; measured 94-100 %) |
| `--enemies` "wave spawned behind the deal dialogue" | S1 wave mark is day 0.55, Baron deal day 0.70 (seasons.json, 41C). Jumping day01 to 0.71 fires the wave BEFORE the offer exists. Probe confirms the real scheduler never spawns a wave while `pendingOffer` is open. | test opens a deal with `offerScam()`, moves day01 past 0.55, asserts the wave waits, refuse -> lands; re-arms `sb.sched.marks/fired` per season (4 spots) |
| `--enemies` (behind P62, never reached before) "clear left meshes" | pooled hidden `cust_collector` SHOPPER shares `userData.type 'collector'` with the enemy | ignore hidden `cust_*` |
| `--jars1` "empty-land tap no longer opens the tray" | S64-A `tapGrace()` swallows any land tap < 0.7 s after a modal closed - the gate's drain() had just closed the S1 dialogue. Intentional. | gate asserts the swallow, then clears `lg.modalClosedAt` and asserts the tray opens |
| `--jars1` T1.5 (behind the above) | S66-A: Spend is the pouch, never a tray card | expected tray list drops `spend` |

Full run of EVERY `args.includes` flag (48 flags) = `ALL OK`; `node --test tests/*.test.mjs` 14 files, 0 fail.

## Real game fixes (found by the screenshot pass at 844x390 + 568x320)
- **Build tray opened on an EMPTY "Jars" tab on a new game** (Jars tab is first, but no jar is buildable until the first till sweep) while the tutor said "Tap a stall, then Deploy". `ui/build.js`: `api.ensureFilledTab()` called from `open()` -> first tab with cards (crew counts). Shots `tools/shots/s69_tray_*`.
- **568x320 tray covered the Spark pill / PAY button**: `ui/build.css` S69 media rule (301-340 px tall, touch) -> grid 96 px.
- Rig `tools/shot_s69.mjs W H` (title / dialogue / play / tray shots, console errors = [] at both sizes).

## Screenshot review (beginner, phone landscape)
844x390 and 568x320: HUD (Spark / debt / PAY, season pill, pause, Focus, power chip, sword) legible, no overlaps, joystick demo + Cloud hand clear, stall cards show icon + price + "yours". Debug text (fps/tris) only appears with `?debug` - rig now runs without it.
Still unseen: 1280x720 desktop tray + chips, title at 568x320 (shot exists: `s69_title_568x320.png`, not reviewed).

## Icons
No new in-game art needed this chat (no new UI glyphs). Pipeline if needed: `node tools/icons_shot.mjs <names>` -> side-by-side sheet -> `tools/icons_png.mjs` slices PNGs.

## TODO / next
- Gameplay question worth a human look: a passive 3-stall player in S3 sells only 11-22 units and 18-24 customers leave `noStall`. By design ("build what they ask for"), but is the want bubble + Owl line enough for a beginner to learn it? (Funnel: `tools/funnel.mjs`, baseline docs/FUNNEL_BASELINE.md.)
- Focus still not persisted in saves (additive field in save.js snapshot if wanted).
- S66-F leftovers: 1280x720 chips/title/PAY shots.
- Credits screen after THE END (S70), then Wishes + Neighbours, Regions, cinematic polish.
- No MCP model/rig/animation work was needed (no 3D asset changes this chat).
