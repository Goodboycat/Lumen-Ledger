# HANDOFF 45Z — Plan phase 45 "Ship v3" (2026-11-03, docs only, no code)

## Gate
MASTER_PLAN_V6 §3: 45Z is gated on 44D's funnel (hands ≥ 80 %, reach S2 ≥ 40 %) + full `check.mjs` ALL OK. `FUNNEL_BASELINE.md` "44D": reach S2 **100 %**, hands **86.3 %**; `check.mjs` ALL OK; itch zip 9.7 MB builds. **Gate passed → phase 45 open.** Islands = NO (HANDOFF_44D) — phase 45 ships one island.

## Why
Everything the jam needs exists in pieces: `game/docs/ITCH_PAGE.md` (page copy, 2 `[bracket]` placeholders), `SUBMISSION_CHECKLIST.md` (10 quality gates, last dry-run S39), `tools/itch_zip.sh` (green), 3 hero shots (44_*). What is missing is the **assembly**: the 6 shot list, the checklist walked against S47 (not S39), the real-browser playtest nobody has run since S38, and a final version/Bible. Phase 45 adds **no system, no ability, no panel** — it is polish + ship. Deadline: **2026-11-15**, submission-day runbook in SUBMISSION_CHECKLIST §F (≈ 45 min).

## Phase table (the contract 45A–45C implement)
| ID | Deliverable (one line) | Owned files | Needs |
|---|---|---|---|
| 45A | **Itch page + 6 screenshots**: `tools/hero_shots.mjs --ship` takes the 6-shot list of ITCH_PAGE §5 at 1280×720 (title · market with price bubbles · raid threat arrow · jars/Protect · ledger · Baron at the pier) → `LUMEN_extras/game/docs/screenshots/45_ship/`; ITCH_PAGE.md `[bracket]` names filled, §5 shot list → file names, S47 features (readable prices, HOT/COLD, double raid) added to "Good to know"; cover image 630×500 cropped from shot 2 with `sharp`/canvas (no new art). | tools/hero_shots.mjs (--ship script), docs/ITCH_PAGE.md, screenshots/45_ship/*.png + cover.png | 44D |
| 45B | **Playtest + quality gates**: one real-browser run S1→S3 via `tools/play.mjs --script funnel` (≤ 6 shots, no video) → first REAL (non-synthetic) funnel row in FUNNEL_BASELINE "## 45B browser"; walk SUBMISSION_CHECKLIST §D 10 gates against S47 (`qa_mobile.mjs` 3 viewports, smoke ERRORS none, draw calls ≤ 180, no-scroll at 1280×720, back button, audio unlock, save/continue); each ❌ → fix only if ≤ 5 lines in a file this phase may touch, else `PLAY_BUGS.md` row; checklist §G replaced by "§G S47 dry run". | tools/play.mjs (funnel script if missing), docs/SUBMISSION_CHECKLIST.md, docs/FUNNEL_BASELINE.md, docs/PLAY_BUGS.md, ≤ 5-line fixes in ui/*.css ui/title.js index.html | 45A |
| 45C | **Close + release**: `GAME_VERSION`/`UI_VERSION = 'S48'`; title footer shows `S48 · jam build`; `bash tools/itch_zip.sh` → final zip + sha256 in HANDOFF; `Game_Bible S48.md` (table 45Z–45C, §2 ship rules below, measured); README "## Ship v3 (45, S48)" paragraph; README_pipeline rows 45Z–45C + Next = `(jam submitted 2026-11-__)`; trailer 13B + APK 14 **standby decision** (default skip; only if ≥ 15 credits remain in the chat after the zip); optional `?telemetry=<url>` endpoint decision (default off). | src/Game.js + ui/index.js (version lines), LUMEN/README.md, LUMEN_extras/Game_Bible S48.md, README_pipeline.md, HANDOFF_45C.md | 45B |

## Rules that bite (Bible §2 candidates for S48 — "ship rules")
1. The itch build is `index.html` at zip root with every fetch relative (`./data/…`, `./audio/…`); nothing absolute, nothing from a CDN.
2. The title footer always shows the version string; a bug report without a version is not a bug report.
3. Mobile is a first-class target: 3 viewports of `qa_mobile.mjs` green before every upload (0 overflow, 0 scroll, 44 px taps).
4. A ship phase adds no system. Any "while we're here" idea → `SUGGESTIONS.md`, not code.
5. The upload is re-checked in the itch preview page (not only locally) before the submission form is sent.

## Notes for the integrator
- `tools/hero_shot_44.mjs` is the template for `--ship`: it boots `index.html` headless (Playwright, `tools/setup_browser.sh` once), forces a season, frames a target, saves a PNG. Reuse its `boot()` and `frame()`; add a scene list, don't write a second harness.
- Shot list (ITCH_PAGE §5) at S47: 1 title (S48 footer) · 2 market S3 with ≥ 1 price bubble + HOT glyph (`44_hot_sign.png` style) · 3 Collector carrying coins + red RAID chip + edge arrow (force `enemies.spawnWave(6,{raiders:2})`) · 4 Pip at a jar with the Protect tag (`sb.interact()` near jar) · 5 the ledger after a season (`eco.endSeason()` → `story:review`) · 6 the Baron at the pier (`'pier'` state, `pier:tick` ≥ 10 s left).
- `play.mjs --script funnel` was promised by 40B and never written (P2 open since S44). If it costs > 10 credits, run `index.html` headless for 2 game-seasons with `window.lumenTelemetry.export()` and feed that JSON to `funnel.mjs` instead — the deliverable is a real-browser row, not the script.
- `SUBMISSION_CHECKLIST.md §E` (APK) stays as-is; mark it "standby — 45C decides".
- Credits: 44A–44D each had ≤ 2 chats. Phase 45 is 3 IDs ≈ 3 chats. Do not open 13B/14 prompts unless 45C explicitly decides to.
- Browser cost: 45A ≈ 6 shots, 45B ≈ 6 shots + qa_mobile; 45C takes none. No video, no GIF.
