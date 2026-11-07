# HANDOFF S60 (user report 2026-11-07) — IDs for you and the next chats
Grep the ID in code comments (`S60-x`). Keep the game's drawn-icon art style (no font emoji in the game; emoji only in code comments).
| ID | Ask (user, verbatim intent) | Status |
|---|---|---|
| S60-A | The FIRST cloud hand (Move step) pointed at Pip to say "you can move with WASD". Better: on mobile the hand must POINT AT and DRAG a SIMULATED JOYSTICK (base ring + knob, drawn) so the player learns there IS a joystick. Desktop: hand points far ahead (~6 u, reads as "go there") + WASD keycaps. | in progress |
| S60-B | The cloud hand sometimes points at an INVISIBLE Stranger (a spot where the stranger no longer is / never was). Fix: moving targets are located LIVE every frame, never from the stale x,z snapshot; the hand hides and the card closes when the thing is gone / not visible. | in progress |
| S60-C | (from S59 open list) Owl opening bubble is 3 lines on a phone -> split into shorter bubbles. | pending |
| S60-D | Final beginner-friendly screenshot review, phone landscape (844x390) first, desktop second. | pending |
| S60-E | Real-device check of touch-hold + notch safe areas (human step, cannot be done in the sandbox). | open |
Rig restart: `cd LUMEN/game && setsid -f python3 -m http.server 3000`, then `node tools/play_s59e.mjs` / `play_s59f.mjs` (in play_s59f the opening dialogue opens ~10 s after PLAY: wait for ui.dialogue.isOpen before pressing Enter). Browser: `bash tools/setup_browser.sh` once.

# HANDOFF S59 — cloud tutor, persistent cards, cloud hand, drawn SKIP (+ S59 user report 2026-11-07, IDs S59-A … S59-J)

## IDs (new this chat; anyone continuing: grep the ID in code comments, `S59-x`)
| ID | Ask (user, verbatim intent) | Status |
|---|---|---|
| S59-A | Tutorial must not show while the cinematic runs; it appears only AFTER the dialogue closes. | in progress |
| S59-B | While a dialogue is open the Build tray + Jars panel close at once and stay shut until the dialogue is over. | in progress |
| S59-C | Cloud hand: black outline was cut off, looked soulless -> redraw + animate; remove the pink circles from the HAND only (the cute cloud keeps its blush). | hand redrawn + baked (cloudhand, cloudhand2); animation in progress |
| S59-D | Tutorial text used glyph emojis (✦ ★) -> drawn icons (`iconizeText`). | in progress |
| S59-E | Tutor blue card needs the same black border + hard shadow as the other UIs. | in progress |
| S59-F | After the Pip/Owl opening the Cloud says hello and that it will help (dialogue speaker `cloud`, drawn `face_cloud`). | DONE (opening = 3 lines; story.test + tools/checks/barks.mjs x3 updated 2->3; browser-verified on 844x390) |
| S59-G | The cloud hand must point at every part of the tab containers (tabs, cards, Deploy, toggle) correctly. | DONE (S59 closing chat, tools/play_s59e.mjs): toggle, Jars tab, Stalls tab, tray card, Deploy, placing OK all within 2 px dx on 844x390. FIX: verb:stall now targets `.ll-card:not(.owned)` and `.deploy:not(:disabled)` (it used to point at the disabled 'Deployed' button and cover Sell, because the 3 starter stalls are owned from the start) |
| S59-H | Tell the player to add the other jars; if ignored, tell again at the next season (`remind`). | DONE (src/systems/jarRemind.js, card `jar:add`, tests/jarRemind.test.mjs; 20 s after unlock, again 3 s after next-season CONTINUE, waits while dialogue/chain) |
| S59-I | `stormmark` icon wired to the storm warning marker (not only the tutor card). | DONE (hud:chip {icon, alert} from novelties/stormWarning.js; ui/hud.css chip rules scoped to .ll-chips because ledger.css has a global white .ll-chip) |
| S59-J | Phone-landscape check of later cards (jar, till, stall upgrade, Collector, stranger). | DONE (play_s59e.mjs, shots tools/shots/s59e_j1..j5): hand on-screen, no overlap with the card, on the right thing for stall, upgrade, till, Collector, stranger. Also: 'drag to move' joystick label moved above the Cloud avatar on phone landscape (ui/touch.css, white + dark outline) |
Also from the previous chat (all closed unless marked): story gate green (`premiumStallKit` <=110, `foggyInsurance` rule = flat accept/refuse OR look/walk tree) · GAME_VERSION S59 + README row + zip (RULE Z).

## Previous chat (kept)
DONE: icons cloudbaby/cloudhand/stormmark/skip (ui/icons.js, PNGs sliced from a side-by-side screenshot) · ID1 tutor cards persistent (ui/tutor.js: moving/tap/keys never close; `follow` events, standing-still 8 s clock for info cards, caps 30/60 s, ✓ chip, verb cards wait for cinematic/dialogue) · ID2 cloud hand (64 px, flips down near bottom edge, `point` arrays + `world:*` via Game.js locate(), nudge hand = cloudhand 60 px) · ID3 cinematic SKIP uses drawn `skip` icon.
Tests: tests/tutor.test.mjs + curiosity.test.mjs (9/9 each). Rigs: tools/play_s59.mjs, play_s59b.mjs, tools/probe_s59.mjs (event timeline), 844x390.

## Next chat (S59 closing notes)
- Rigs: tools/play_s59c.mjs (Cloud dialogue), tools/play_s59d.mjs (jar reminder hand, tray, storm chip). Server: `cd LUMEN/game && setsid -f python3 -m http.server 3000`. Browser: `bash tools/setup_browser.sh` once.
- SANDBOX GOTCHA: /tmp is a 493 MB tmpfs. Never mv/clone big trees through it; clone straight into /home/user.
- tools/wip.sh pushes even when a test fails (a failing test was pushed once and fixed in the next commit). Run the test before wip.sh.
- DOM shim: querySelector('[data-id=..]') matches _attrs, not dataset. Walk children and read dataset instead.
- node --test hangs if a mountTutor is not destroy()ed (hand rAF loop).
- Known: the debug overlay text bottom-left only shows with ?debug=1. The `drag to move` hint is faint behind the card (opacity .35), harmless.
- Open: S59-G remainder, S59-J remainder, GAME_VERSION still 'S57' in Game.js (bump to S59 + README row + zip, RULE Z), full `node tools/check.mjs` not re-run after the last CSS change.


## S59 closing chat (2026-11-07) — what changed
- GAME_VERSION = 'S59' (Game.js), README row 'Cloud tutor (S59)', web zip rebuilt (RULE Z).
- Full `node tools/check.mjs` = ALL OK after the last CSS change; all 14 tests/*.test.mjs pass (run them ONE FILE AT A TIME: `for f in tests/*.test.mjs; do node --test $f; done`. `node --test tests/` as a directory exits 1 in 100 ms — invocation quirk, not a test failure).
- Debug text (#debug-stats) is display:none without ?debug (verified computed style before and after PLAY).
- New rigs: tools/play_s59e.mjs (G/J remainder, debug text) and tools/play_s59f.mjs (title -> opening -> first play frame beginner shots s59f_*). In play_s59f the cinematic dialogue opens ~10 s after PLAY: wait for ui.dialogue.isOpen before pressing Enter.
- Beginner read of the final frames (844x390): title = one PLAY button; first frame = Spark pouch + debt + Season pill, one blue card 'Move Pip: WASD or tap the ground.' with the Cloud beside it, hand points ahead of Pip.
## Open for the next chat
- The Move-step hand sits on top of Pip's legs ('world:ahead' is only ~3 u from Pip): could point farther (6 u) so it reads as 'go there', not 'this is you'.
- The Owl opening text is 3 lines on phone; consider splitting it into two shorter bubbles (beginner reading load).
- Real-device phone check (touch hold, safe-area notch) is still a human step.
