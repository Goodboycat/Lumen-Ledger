# Chat 48H — Close Phase 48: S51, README, itch URL, zip, Game Bible
Needs: 48A 48B 48C 48D 48E 48F 48G      Blocked-by: all of them (next.sh will not pick 48H before they have Done rows)
Owned (only these files): game/src/Game.js (ONLY `GAME_VERSION` line: `grep -n "GAME_VERSION = " game/src/Game.js`) · game/ui/*.js (`UI_VERSION` line only: `grep -rn "UI_VERSION = " game/ui`) · LUMEN/README.md (top "Play" line + ONE new "## Hush (48, S51)" section ≤ 8 lines, placed above "## Measure-fix") · LUMEN/game/README.md (controls table) · LUMEN/game/docs/ITCH_PAGE.md · LUMEN_extras/README_pipeline.md · LUMEN_extras/Game_Bible S51.md (NEW, ≤ 40 lines) · docs/HANDOFF_48H.md
Read (max 5 credits): HANDOFF_48Z "IDs" table → the 7 `HANDOFF_48A–G.md` "Done/Missing" lines only → this. Do NOT read game code.

## Build in THIS order. wip.sh after EVERY file.
### P1 — must ship (≈ 15 credits)
- Dead emitters sweep (only if 48A left them): `grep -n "'ui:toast'\|story:toast" game/src/Game.js game/src/core/Audio.js game/src/systems/story.js` → delete each `bus.emit(...)` statement **by line**, run `node tools/check.mjs --game --story --audio` after every 3 deletions; stop and record the line numbers in the handoff on the first red.
- Versions → `S51`; `node tools/check.mjs` (ALL) green; `bash tools/itch_zip.sh` → record size / file count / sha256 (`sha256sum /tmp/lumen-ledger-web.zip` or the path the script prints).
- LUMEN/README.md: "Play" line = `https://goodboycat.itch.io/lumen-ledger` (48Z already put it there — verify); new section "## Hush (48, S51, <date>)" listing what was **deleted** (toasts, hero bark, 2 touch buttons, pre-placed jars, verb chip/Skip, nudge text) and the one thing added (blue once-only tutor cards), zip sha, handoff link.
- README_pipeline: Done row `48Z–48H`, strike all 48x in "## Next".
### P2 — should ship (≈ 8 credits)
- ITCH_PAGE.md: controls paragraph = "move · attack · dash; tap the ground to build; walk up to things to use them" — remove ✋/🔨 mentions; add one line on jars being placed by the player.
- `LUMEN_extras/Game_Bible S51.md`: what changed for the player (≤ 40 lines, no code), the text-census table from HANDOFF_48Z with a "now" column.
### P3 — nice to have
- Real-browser smoke (`bash tools/setup_browser.sh && node tools/smoke.mjs` if present): 0 console errors, no element matching `[class*=toast]`, `#verb-hint` absent. Paste the 3 numbers in the handoff.

## Demo/check: `node tools/check.mjs` all flags. Handoff `docs/HANDOFF_48H.md` ≤ 15 lines. Then tell the user: upload the zip to itch (SUBMISSION_CHECKLIST §F).
