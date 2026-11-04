# LUMEN — Lumen Ledger · Game Bible S48 (2026-11-04)

Previous: `Game_Bible S47.md` (everything there still applies; this file only lists what S48 changed — phase 45 "Ship v3", chats 45Z–45C). S48 is the **jam build**: no system was added, only the itch page, the real-browser measurement and the release zip.
Version strings: `GAME_VERSION = 'S48'` (src/Game.js) · `UI_VERSION = 'S48'` (ui/index.js) → title-menu footer `S48 · jam build` (index.html passes `${GAME_VERSION} · jam build` as `opts.version`).

## S48 — Ship v3: itch page, real-browser funnel, release zip (phase 45)

| ID | Change | Files |
|---|---|---|
| 45Z | Plan: gate check (44D funnel: reach S2 100 %, Spark-through-hands 86.3 % ≥ 80 % → **UNGATED**) + phase table 45A–45C + "Rules that bite" = the 5 ship rules below. Docs only. | `LUMEN_extras/game/docs/HANDOFF_45Z.md`, `game/docs/prompts/45A–45C` |
| 45A | Itch page + 6 ship screenshots: `tools/hero_shots.mjs --ship` boots the real `index.html` headless (1280×720, `?mute&notutorial&nocine&season=600`), forces each scene via `window.game`/`sb()` only; shots `1_title … 6_*` in `LUMEN_extras/game/docs/screenshots/45_ship/`; `ITCH_PAGE.md` filled (team Goodboycat, Three.js r160 vendored, form fields, "Good to know", devlog seed). Fix: `?debug=0` was truthy → harness passes no `debug` key. | `tools/hero_shots.mjs`, `game/docs/ITCH_PAGE.md`, `screenshots/45_ship/*` |
| 45B | Real-browser playtest + 13 gates: `tools/play.mjs --script funnel` (Playwright headless Chromium) → `funnel_browser_45B.json` → FUNNEL_BASELINE "## 45B browser"; SUBMISSION_CHECKLIST §D D1–D13 ticked against S47; `PLAY_BUGS.md` rows 45B-1…5 (no S1). qa_mobile 3/3 (2 CSS lines: bark keyframes / joystick knob). | `tools/play.mjs`, `tools/shots/funnel_browser_45B.json`, `game/docs/FUNNEL_BASELINE.md`, `SUBMISSION_CHECKLIST.md`, `PLAY_BUGS.md`, `ui/*.css` |
| 45C | Close + release: versions `S48`, footer `S48 · jam build`; `node tools/check.mjs` ALL OK; `bash tools/itch_zip.sh` → `/tmp/LumenLedger_itch.zip` **9.7 MB · 336 files · sha256 `f07679fa…f90080`** (index.html at root, `data/seasons.json` + `data/story.json` + `audio/manifest.json` present, 0 absolute refs); this Bible; README "## Ship v3"; README_pipeline rows 45Z–45C; standby decision (trailer 13B / APK 14 / telemetry endpoint → SKIP for the jam). | `src/Game.js`, `ui/index.js`, `index.html`, `LUMEN/README.md`, this file, `README_pipeline.md`, `HANDOFF_45C.md` |

### What the player gets (= the itch pitch)
A cosy 3D island market you run as Pip, a lighthouse keeper's kid with a ledger: place stalls with **B**, set prices **in the world** (E on the hanging sign — it turns green → white → amber → red with how fair you are), watch Glimmers react with ♥ / ✓ / ✗ bubbles and little stall icons for what they wanted, pick up tips with your own hands, and bonk the Collectors that raid your till before they carry the coins off. Each season brings one HOT and one COLD demand (the Owl tells you once), a jar to protect, and a ledger page at the end that shows where every Spark went — because the whole point is that **money you touched is money you understood**. Keyboard + mouse or touch, one island, ~10–15 minutes to Season 3, saves in the browser, runs offline from the zip.

### Bible §2 lines added — ship rules (from HANDOFF_45Z "Rules that bite")
1. The itch build is `index.html` at zip root with every fetch relative (`./data/…`, `./audio/…`); nothing absolute, nothing from a CDN.
2. The title footer always shows the version string; a bug report without a version is not a bug report.
3. Mobile is a first-class target: 3 viewports of `qa_mobile.mjs` green before every upload (0 overflow, 0 scroll, 44 px taps).
4. A ship phase adds no system. Any "while we're here" idea → `SUGGESTIONS.md`, not code.
5. The upload is re-checked in the itch preview page (not only locally) before the submission form is sent — a **user** step (the chat has no itch login); see SUBMISSION_CHECKLIST §F.

### Measured (v6 "re-measure vs 40B baseline" line)
| step | 40B baseline S44 (synthetic n=20) | 44D synthetic (n=20, game-time) | **45B browser** (n=1, wall clock, SwiftShader fps≈1) |
|---|---|---|---|
| firstStall | 30.03 s (scripted) | 30.03 s (scripted) | **not reached** — `B`+`1` landed while the S1 opening dialogue was open (PLAY_BUGS 45B-1, S2) |
| firstSale | 7.42 s | 7.10 s | **55.53 s** (dialogue drains ~43 s in a real browser) |
| firstCoinInHand | never (no tip/till earn before 42A) | 150.20 s (script collects at season end) | **95.27 s** (`tip:walk` — the 42A tip loop works live) |
| reach S2 / S3 | 100 % / 100 % @ 150.5 / 300.8 s | 100 % / 100 % @ 150.2 / 300.3 s | **not reached in 238 s** — verb chain freezes the season clock + `maxDt = 0.1` at fps≈1 ≈ 1/10 speed (45B-4/5, harness artefacts, not player-facing) |
| Spark through Pip's hands | 0.0 % | 86.3 % | 100 % (3/3 verb-chain coins; not comparable) |
| modalSeconds 0–90 s | 0.1 s (headless) | 0.0 s | ≈ 43 s of opening dialogue (telemetry does not count dialogue yet — 45B-2) |

Reading: the synthetic funnel still passes every v6 gate (reach S2 100 % ≥ 60 %, hands 86.3 % ≥ 80 %). The single real-browser run is a **measurement of the harness as much as of the game**: the one player-facing finding is 45B-1 (the opening dialogue should either auto-advance or the verb chain should start on `dialogue:closed`) — post-jam unless a chat owning `verbChain.js` has ≤ 3 lines to spare. Real retention numbers need itch telemetry (`?telemetry=<url>` stays opt-in / OFF).

### Islands decision
Unchanged from S47: **NO** through the 2026-11-15 jam. Re-open condition (HANDOFF_44D): reach S3 ≥ 40 % on real players AND ≥ 10 chats of credit.

### Gates
`node tools/check.mjs` → ALL OK (after the S48 bump) · `bash tools/itch_zip.sh` → 9.7 MB / 336 files / 1 × `index.html` at root · D1–D13 ticked in SUBMISSION_CHECKLIST §D (45B, S47; D13 footer text re-checked for S48 by grep of `index.html` `version:` line) · qa_mobile 3/3.
