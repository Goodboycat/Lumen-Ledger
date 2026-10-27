# LUMEN LEDGER — Game Bible, version **S39** (2026-10-27)

S39 is a **docs / balance-verification / submission-prep pass**. No gameplay code changed except the version strings.

## 1. What S39 did
| Task | Result |
|---|---|
| Balance sweep re-run (`node tests/economy.sim.mjs --sweep`, 20 seeds, 150 Spark / 260 debt, S37 three-wave pacing) | *sensible* wins at S10 **20/20** (fog cleared S7×4 · S8×10 · S9×6); *borrow-everything* loses S3 (5) / S5 (15); *hoarder* loses S8 (5) / S9 (7) / S12 (1), open past S12 (7). Written into `docs/GDD.md` (Balance targets). GDD §Start already said 150 / 260. |
| Headless gates `check.mjs --build --firstplayer --game --economy` | **ALL OK**. S36 drag/move gate OK; S1→S3 + win → endless → lose → title walk OK (3133 frames); first-player S1 +158–169 / −74. |
| Submission checklist dry run vs. `tools/itch_zip.sh` | Zip = **9.6 MB, 305 files, 12 MB unzipped**, `index.html` at root, no tools/tests/docs/demo. Checklist A1/D9 updated, new §G lists what is still open. |
| Stale size numbers | README "≈ 0.54 MB" → 9.6 MB; `docs/ITCH_PAGE.md` size note updated (music OGGs ≈ 6 MB, three.js 1.3 MB, icon sheet 0.6 MB). |
| Play-test notes → `LUMEN_extras/game/docs/PLAY_BUGS.md` | **P84** (P2, OPEN): on touch, the left half of the screen is always the joystick, so props there cannot be dragged. **P85** (P3, OPEN, design note): a passive beginner's debt still grows 260 → 431 by S3; consider a Pip repay nudge at S2. |
| Version | `GAME_VERSION` (`src/Game.js`) and `UI_VERSION` (`ui/index.js`) → `'S39'`. Title footer shows S39. |

## 2. Verify
```bash
cd LUMEN/game && node tools/check.mjs --game --build --firstplayer --economy   # ALL OK at S39
node tests/economy.sim.mjs --sweep
bash tools/itch_zip.sh                                                       # → lumen-ledger-web.zip
```

## 3. Report for the next chat
- **Open bugs:** P84 (touch drag vs joystick: fix first, it's small, in `src/core/Input.js` pointerdown: let a touch on a placed prop claim the drag before the joystick takes it), P85 (optional nudge), P23 (deferred).
- **Still not tested by hand:** a real touch device (drag + P84 fix), the S6–S10 boss fight, endless mode for longer than the headless walk. These need a person or a browser session; the headless suite covers only the short scripted walk.
- **Submission (due 2026-11-15, aim for 11-13):** A3 2-min trailer (not recorded), C6 cover 630×500, C7 6 screenshots, GDD §11 / BUDGET names, PDFs, D1 full `check.mjs` suite re-run, D10 phone play-through after upload.
- **Optional:** re-encode the 7 music OGGs at ~64 kbps to bring the zip from 9.6 MB to about 5 MB (faster phone load).
- **Pipeline:** `bash LUMEN/game/tools/github.sh <TOKEN>` first. Bump **both** `GAME_VERSION` and `UI_VERSION` every version.
