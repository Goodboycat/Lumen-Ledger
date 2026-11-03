# Chat 45C — Close phase 45: S48, final zip, Bible, submit
Needs: 45A 45B      Blocked-by: 45B
Owned (only these files): src/Game.js + ui/index.js (`GAME_VERSION`/`UI_VERSION = 'S48'` lines only), ui/title.js (footer text "S48 · jam build", ≤ 2 lines), LUMEN/README.md ("## Ship v3 (45, S48)" paragraph + top "Play" link), LUMEN_extras/Game_Bible S48.md (copy S47's structure), LUMEN_extras/README_pipeline.md (rows 45Z–45C + Next), game/docs/SUBMISSION_CHECKLIST.md (§F runbook ticked with the date), HANDOFF_45C.md
Read (max 5 credits): START_HERE.md → HANDOFF_45Z.md → HANDOFF_45A/45B.md "Notes for 45C" → this → Game_Bible S47.md (structure only)
Export (API_CONTRACTS): none.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 15 credits)
- Fix nothing new. If HANDOFF_45B lists a PLAY_BUGS row that **blocks upload** (crash, black screen, scroll at 1280×720), fix it only if ≤ 10 lines in one file and the owner is in this phase (ui/*, index.html); otherwise ship with the bug named in the itch "Good to know".
- Versions `'S48'` + title footer "S48 · jam build" → `node tools/check.mjs` ALL OK → `bash tools/itch_zip.sh` → record size, file count, `sha256sum /tmp/LumenLedger_itch.zip` in the HANDOFF. Verify once more: `unzip -l | grep -c "^.*index.html$"` = 1 at root, `data/seasons.json` + `data/story.json` + `audio/manifest.json` present.
- `Game_Bible S48.md`: table 45Z–45C, "What the player gets" (one paragraph = the itch pitch), §2 **ship rules 1–5** from HANDOFF_45Z, Measured (browser funnel 45B vs synthetic 44D vs 40B baseline — the v6 "re-measure vs 40A baseline" line), Gates.
### P2 — should ship (≈ 8 credits)
- README paragraph + README_pipeline rows 45Z 45A 45B 45C; Next → `(jam build S48 ready 2026-11-__; submit per SUBMISSION_CHECKLIST §F; post-jam: islands decision re-opens — see HANDOFF_44D)`.
- **Standby decision** written in HANDOFF_45C: trailer 13B and APK 14 — default **SKIP** for the jam (HTML5 + page are the deliverables). Only un-freeze if ≥ 15 credits remain in THIS chat after the zip AND the user asked by name. Telemetry endpoint: default OFF (`?telemetry=` stays opt-in); note the free-endpoint option for a post-jam chat.
### P3 — nice to have
- SUBMISSION_CHECKLIST §F runbook rehearsed as a dry run: every step ticked with "would do / done" — the user performs the actual itch upload (the chat has no itch login).

## Demo page: none.
## check.mjs section: none — `node tools/check.mjs` ALL OK is the gate (run after the version bump, before the zip).
## Budgets: 0 browser screenshots. 0 new systems. The whole chat should close in ≤ 35 credits.
## Content rules that bite here: Ship rule 2 (footer version) · Ship rule 1 (relative paths in the zip) · Ship rule 5 (itch preview check is a user step — write it into §F, do not claim it done).
## Handoff `docs/HANDOFF_45C.md`: Done / Missing / Measured (zip size + sha256, check output line, funnel 3-column) / Standby decision (13B, 14, telemetry) / Notes for post-jam (islands re-open condition from HANDOFF_44D; PLAY_BUGS rows left; SUGGESTIONS.md top 3).
