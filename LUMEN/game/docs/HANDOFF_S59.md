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
| S59-G | The cloud hand must point at every part of the tab containers (tabs, cards, Deploy, toggle) correctly. | PARTIAL: toggle + Jars tab verified within 2 px (card point `^` prefix = hand above the tab). NOT yet checked: tray cards, Deploy button, stall tab |
| S59-H | Tell the player to add the other jars; if ignored, tell again at the next season (`remind`). | DONE (src/systems/jarRemind.js, card `jar:add`, tests/jarRemind.test.mjs; 20 s after unlock, again 3 s after next-season CONTINUE, waits while dialogue/chain) |
| S59-I | `stormmark` icon wired to the storm warning marker (not only the tutor card). | DONE (hud:chip {icon, alert} from novelties/stormWarning.js; ui/hud.css chip rules scoped to .ll-chips because ledger.css has a global white .ll-chip) |
| S59-J | Phone-landscape check of later cards (jar, till, stall upgrade, Collector, stranger). | PARTIAL: jar reminder, storm chip, Cloud dialogue checked. todo: till, stall upgrade, Collector, stranger |
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
