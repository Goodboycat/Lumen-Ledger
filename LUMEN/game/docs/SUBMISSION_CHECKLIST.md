# Lumen Ledger — Jam submission checklist (Chat 13A)
*Every requirement from the Zoud GameLab jam page (`LUMEN/screenshots/reference/jam_page_*.png`) and the itch.io upload form, mapped to the file that satisfies it, who owns it, and how it is verified. Tick the box when the artefact exists AND the check passes. Submit target **Thu 2026‑11‑13**; hard deadline **Sat 2026‑11‑15**.*

Legend: ✅ exists today · 🔜 owned by a later chat · ☐ manual step on submission day.

## A. The four jam deliverables (required for funding consideration)
| # | Jam requirement | Artefact | Owner | Verify | Status |
|---|---|---|---|---|---|
| A1 | **Your Game** — playable, on itch.io | `lumen-ledger-web.zip` from `docs/ITCH_PAGE.md §6` → itch upload, "played in browser" | 13A recipe · ☐ upload day | recipe dry‑run OK (S39: 9.6 MB, `index.html` at root, 305 files) · `node tools/check.mjs` full flags ALL OK · incognito phone test after upload | ✅ recipe / ☐ upload |
| A2 | **Concept Doc / Initial Game Design Document** | `docs/GDD.md` (pitch, pillars, core loop, FinLit mapping table, systems, controls, art, narrative, scope, accessibility) — export to PDF for the form | 8B ✅ · 13A fills §11 credits ☐ | PDF opens, 12 sections, team names filled | ✅ doc / ☐ PDF |
| A3 | **2‑Minute Video** — footage of *actual gameplay in the submitted game* | `docs/TRAILER.md` shot list + `?demo=1` demo mode (`src/systems/demoMode.js`) → recorded MP4 1280×720 ≤ 2:00 → YouTube (unlisted) + itch trailer field | 13B 🔜 · ☐ record | video is real captured gameplay (no mock‑ups), ≤ 120 s, audio unlock tap visible or trimmed, theme card in first 5 s | 🔜 |
| A4 | **Game Budget** | `docs/BUDGET.md` (jam build actual + funded v1.0, roles, tools, audio, testing, marketing, tiers) — export to PDF/XLSX | 13A ✅ | totals reconcile (A ≈ $7.4k · B ≈ $705k), bracketed names filled | ✅ doc / ☐ PDF |

## B. Theme & content rules
| # | Requirement | Where it is satisfied | Verify | Status |
|---|---|---|---|---|
| B1 | Theme **"Make FinLit Fun"** visible | title screen tagline + footer (`ui/title.js` l.46/54), `<title>` in `index.html`, lesson card every season, theme statement `docs/ITCH_PAGE.md §3` | open `index.html` — tagline under logo | ✅ |
| B2 | Financial‑literacy concepts taught, not just themed | 10 lessons (budgeting → planning for a goal) each tied to a mechanic: `docs/GDD.md §4`, `data/story.json → lessons`, `src/systems/economy.js BALANCE.lessons` | `node tools/check.mjs --story` (every lessonId has lines) | ✅ |
| B3 | Family‑friendly / 16+ safe, UAE partner | no gambling, loot boxes, magic, undead (`LUMEN_extras/game/docs/GAME_BIBLE.md §2`) | `check.mjs --story` banned‑word regex passes | ✅ |
| B4 | No external assets with unclear licence | all 3D procedural, one MIT library (`vendor/three.module.js`), audio in‑engine synth or self‑generated | `grep -r "http" src ui` finds no CDN/asset URLs | ✅ |

## C. itch.io page fields (from `docs/ITCH_PAGE.md §1`)
| # | Field | Value / file | Status |
|---|---|---|---|
| C1 | Title · tagline · classification · kind (HTML) · release status (Prototype) · pricing (free) | `docs/ITCH_PAGE.md §1` table | ✅ copy |
| C2 | Upload with "This file will be played in the browser" | A1 zip | ☐ |
| C3 | Embed: 1280 × 720 · mobile friendly · fullscreen button · click‑to‑launch (audio unlock) · scrollbars off | `docs/ITCH_PAGE.md §1`; 1280×720 no‑scroll verified in the browser ✅ | ✅ setting / ☐ apply |
| C4 | Description body (pitch, how to play, controls, lessons, good‑to‑know, credits) | `docs/ITCH_PAGE.md §2` paste block | ✅ |
| C5 | Genre · tags (≤ 10) · inputs · accessibility · session length · language | `docs/ITCH_PAGE.md §1` | ✅ |
| C6 | Cover image 630 × 500 | shot 1 re‑framed + logo, `LUMEN/screenshots/13A_itch/cover.png` | ☐ (shot list ready) |
| C7 | 6 screenshots 1280 × 720 | `docs/ITCH_PAGE.md §5` shot list → `LUMEN/screenshots/13A_itch/01…06.png` | ☐ (shot list ready) |
| C8 | Trailer link | A3 | 🔜 |
| C9 | Submit to the jam (itch "Submit to jam" button on the Zoud GameLab jam page, answer the theme question with `ITCH_PAGE.md §3`) | — | ☐ |
| C10 | Source link | https://github.com/Goodboycat/Lumen-Ledger | ✅ |

## D. Quality gates before upload
| # | Gate | Command / file | Status |
|---|---|---|---|
| D1 | Headless suite | `node tools/check.mjs` → ALL OK | ✅ 45B (2026‑11‑04, S47) |
| D2 | Full game walk headless | included in D1 (`--game`: S1 → S3 → win → endless → lose → title) | ✅ 45B |
| D3 | Browser smoke, 0 console errors | Playwright `index.html?mute&debug` 1280×720, title → PLAY → dialogue drained → play: `pageerror` + console.error = **0** | ✅ 45B (S47) |
| D4 | Mobile check, 3 viewports (360×800 · 800×360 · 1280×720) | `qa_mobile.mjs` 3/3 green after the bark-transform + joystick-knob CSS fix | ✅ 45B |
| D5 | Perf budget | ≤ 180 draw calls in play (45B prompt budget; `docs/PERF.md` measured 110–135 at S39) — **167** measured in S1 play, 95 k tris, SwiftShader | ✅ 45B (167 ≤ 180; over the old 150 note → PLAY_BUGS 45B-3) |
| D6 | Save round‑trip | `check.mjs --save` + browser: `lg.save.write()` at S1 day 0.42 / 77 coins → reload → CONTINUE visible → resumed S1 day01 0.42, coins 77, verb chain at step 0 | ✅ headless / ✅ manual 45B |
| D7 | Relative paths only (itch CDN sub‑path, WebView) | `grep -rn "src=\"/\|href=\"/\|fetch('/" index.html ui src` → **0** | ✅ 45B |
| D8 | Audio unlock on first gesture; `?mute` works | `window.lumenAudioCtx` absent on the title, created after the first Enter (index.html queues title music until `input:first`); `?mute` boots with 0 errors | ✅ 45B |
| D9 | Zip sanity after build | `bash tools/itch_zip.sh` → 9.7 MB, 336 files; root = `index.html favicon.png icon.png icon-192.png src/ ui/ data/ audio/ vendor/` — no `tools/ tests/ docs/ demo_*` | ✅ 45B (S47) |
| D10 | Fresh‑profile play‑through on a phone from the live itch URL (one season, title → ledger) | ☐ submission day | ☐ |
| D11 | 1280×720 no‑scroll (itch iframe) | `scrollWidth/Height` = 1280/720 = viewport in title and play | ✅ 45B |
| D12 | Android back = Esc | `history.pushState` sentinel + `popstate` (index.html:139): `page.goBack()` → URL unchanged, `game.paused = true` | ✅ 45B |
| D13 | Title footer shows the version | footer text `jam build · S47` visible on the title (`ui/title.js` `opts.version`) | ✅ 45B |

## E. Android APK (bonus deliverable, Chat 14)
| # | Item | Artefact | Status |
|---|---|---|---|
| E1 | Flutter WebView wrapper loading `game/` from assets, `mediaPlaybackRequiresUserGesture` handled, back button = Esc (11B) | 14 🔜 | 🔜 |
| E2 | Save import via `?import=LUMEN1:<base64>` (10D) | `src/systems/save.js exportText/importText` ✅ | ✅ hook |
| E3 | APK attached to the itch page as a second upload (Android) | ☐ | 🔜 |

## F. Submission‑day runbook (≈ 45 min)
1. `git pull`, run D1 (ALL OK), build the zip (`ITCH_PAGE.md §6`), check D9.
2. Fill the GDD §11 and BUDGET bracketed names; export `GDD.pdf`, `BUDGET.pdf` (print‑to‑PDF from any Markdown viewer).
3. Capture the 6 screenshots + cover (`ITCH_PAGE.md §5`), drop into `LUMEN/screenshots/13A_itch/`.
4. itch: create project → paste §1 fields → upload zip (browser) + APK (Android) → embed 1280×720 → description §2 → screenshots, cover, trailer link → **Save & view** → D10 on a phone.
5. Jam page → **Submit your project** → theme answer = `ITCH_PAGE.md §3` → attach/link GDD, video, budget as the form asks.
6. Commit `LUMEN/README.md` row "SUBMITTED <date> <itch URL>"; push.

## F-dry. S48 runbook rehearsal (2026-11-04, chat 45C) — "done" = done in the sandbox, "would do" = user step on submission day
1. ✅ **done** — `git pull` (origin/main = sandbox), D1 `node tools/check.mjs` → ALL OK after the S48 bump; `bash tools/itch_zip.sh` → `/tmp/LumenLedger_itch.zip` 9.7 MB · 336 files · sha256 `f07679fa14035e58b4377551230cf4c93f94ecc00c17adff85a096eb97f90080`; D9 re-verified (1× `index.html` at root, `data/seasons.json` + `data/story.json` + `audio/manifest.json` present, 0 absolute `src="/`/`href="/` refs). **Rebuild the zip on the day** (`bash tools/itch_zip.sh` — any commit after S48 changes the sha).
2. ☐ **would do** — GDD §11 / BUDGET bracketed names + print-to-PDF: user step (needs real names + a Markdown viewer). Not done by a chat.
3. ✅ **done** (45A) — 6 shots + cover are in `LUMEN_extras/game/docs/screenshots/45_ship/` (`1_title … 6_pier.png`, `cover.png` 630×500); the old `LUMEN/screenshots/13A_itch/` path in step 3 is superseded.
4. ☐ **would do** — itch: create project → paste `ITCH_PAGE.md §1` (viewport 1280×720, fullscreen ON, mobile friendly ON, Embed in page) → upload the zip (browser; **no APK** — 14 skipped, see HANDOFF_45C) → description §2 → 6 screenshots + cover (no trailer — 13B skipped) → **Save & view** → **ship rule 5**: open the itch *preview* page, title shows `S48 · jam build`, PLAY → first dialogue → place a stall → reload → CONTINUE → then D10 on a phone (touch pad, no scroll).
5. ☐ **would do** — Jam page → Submit your project → theme answer = `ITCH_PAGE.md §3` → attach GDD / budget as the form asks (video: "none" — HTML5 build + page are the deliverables).
6. ☐ **would do** — commit `LUMEN/README.md` top "**Play:**" line with the itch URL + "SUBMITTED <date>"; `bash tools/wip.sh "SUBMITTED"`.

## G. S47 dry run (2026-11-04, chat 45B) — replaces the S39 dry run
- Measured in a real headless Chromium (Playwright 1.47, SwiftShader GL, 1280×720, `?mute`). Harness: `tools/play.mjs --script funnel` + two one-off probes (gates, save round-trip). 0 page errors, 0 console errors across title → PLAY → dialogue → play → back → reload → CONTINUE.
- D1–D9, D11–D13 ✅ (table above). D10 ☐ needs the live itch URL + a phone.
- A1 ✅ zip builds: 9.7 MB, 336 files, `index.html` at root (was 9.6 MB / 305 files at S39; +31 files = phase 43–44 data/ui). A2/A4 docs exist, PDFs ☐. A3 video 🔜.
- Draw calls in play: **167** (S39 note said 110–135; phase 43–44 added price bubbles, sign tints, wants icons). Within the 45B budget of 180; the old 150 line is stale → `PLAY_BUGS.md 45B-3`.
- Funnel (FUNNEL_BASELINE "## 45B browser"): PLAY ✅, firstSale 55.5 s, firstCoinInHand 95.3 s (`tip:walk`), S2/S3 not reached in 238 s because SwiftShader runs at fps ≈ 1 (maxDt clamp = 1/10 speed) and the verb chain freezes the season clock up to 125 s. Findings → `PLAY_BUGS.md 45B-1 / 45B-2`.
- Still open before 2026-11-15: A3 trailer, GDD §11 names, D10 phone play-through, re-run `tools/play.mjs --script funnel` on a real GPU for a comparable S2/S3 row.
