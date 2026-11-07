# HANDOFF S59 — cloud tutor, persistent cards, cloud hand, drawn SKIP (+ S59 user report 2026-11-07, IDs S59-A … S59-J)

## IDs (new this chat; anyone continuing: grep the ID in code comments, `S59-x`)
| ID | Ask (user, verbatim intent) | Status |
|---|---|---|
| S59-A | Tutorial must not show while the cinematic runs; it appears only AFTER the dialogue closes. | in progress |
| S59-B | While a dialogue is open the Build tray + Jars panel close at once and stay shut until the dialogue is over. | in progress |
| S59-C | Cloud hand: black outline was cut off, looked soulless -> redraw + animate; remove the pink circles from the HAND only (the cute cloud keeps its blush). | hand redrawn + baked (cloudhand, cloudhand2); animation in progress |
| S59-D | Tutorial text used glyph emojis (✦ ★) -> drawn icons (`iconizeText`). | in progress |
| S59-E | Tutor blue card needs the same black border + hard shadow as the other UIs. | in progress |
| S59-F | After the Pip/Owl opening the Cloud says hello and that it will help (dialogue speaker `cloud`, drawn `face_cloud`). | in progress |
| S59-G | The cloud hand must point at every part of the tab containers (tabs, cards, Deploy, toggle) correctly. | in progress |
| S59-H | Tell the player to add the other jars; if ignored, tell again at the next season (`remind`). | in progress |
| S59-I | `stormmark` icon wired to the storm warning marker (not only the tutor card). | in progress |
| S59-J | Phone-landscape check of later cards (jar, till, stall upgrade, Collector, stranger). | todo |
Also from the previous chat (all closed unless marked): story gate green (`premiumStallKit` <=110, `foggyInsurance` rule = flat accept/refuse OR look/walk tree) · GAME_VERSION S59 + README row + zip (RULE Z).

## Previous chat (kept)
DONE: icons cloudbaby/cloudhand/stormmark/skip (ui/icons.js, PNGs sliced from a side-by-side screenshot) · ID1 tutor cards persistent (ui/tutor.js: moving/tap/keys never close; `follow` events, standing-still 8 s clock for info cards, caps 30/60 s, ✓ chip, verb cards wait for cinematic/dialogue) · ID2 cloud hand (64 px, flips down near bottom edge, `point` arrays + `world:*` via Game.js locate(), nudge hand = cloudhand 60 px) · ID3 cinematic SKIP uses drawn `skip` icon.
Tests: tests/tutor.test.mjs + curiosity.test.mjs (9/9 each). Rigs: tools/play_s59.mjs, play_s59b.mjs, tools/probe_s59.mjs (event timeline), 844x390.
