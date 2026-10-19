# Lumen Ledger — Jam submission checklist (Chat 13A)
*Every requirement from the Zoud GameLab jam page (`LUMEN/screenshots/reference/jam_page_*.png`) and the itch.io upload form, mapped to the file that satisfies it, who owns it, and how it is verified. Tick the box when the artefact exists AND the check passes. Submit target **Thu 2026‑11‑13**; hard deadline **Sat 2026‑11‑15**.*

Legend: ✅ exists today · 🔜 owned by a later chat · ☐ manual step on submission day.

## A. The four jam deliverables (required for funding consideration)
| # | Jam requirement | Artefact | Owner | Verify | Status |
|---|---|---|---|---|---|
| A1 | **Your Game** — playable, on itch.io | `lumen-ledger-web.zip` from `docs/ITCH_PAGE.md §6` → itch upload, "played in browser" | 13A recipe · ☐ upload day | recipe dry‑run OK (536 KB, `index.html` at root, 72 files) · `node tools/check.mjs` full flags ALL OK · incognito phone test after upload | ✅ recipe / ☐ upload |
| A2 | **Concept Doc / Initial Game Design Document** | `docs/GDD.md` (pitch, pillars, core loop, FinLit mapping table, systems, controls, art, narrative, scope, accessibility) — export to PDF for the form | 8B ✅ · 13A fills §11 credits ☐ | PDF opens, 12 sections, team names filled | ✅ doc / ☐ PDF |
| A3 | **2‑Minute Video** — footage of *actual gameplay in the submitted game* | `docs/TRAILER.md` shot list + `?demo=1` demo mode (`src/systems/demoMode.js`) → recorded MP4 1280×720 ≤ 2:00 → YouTube (unlisted) + itch trailer field | 13B 🔜 · ☐ record | video is real captured gameplay (no mock‑ups), ≤ 120 s, audio unlock tap visible or trimmed, theme card in first 5 s | 🔜 |
| A4 | **Game Budget** | `docs/BUDGET.md` (jam build actual + funded v1.0, roles, tools, audio, QA, marketing, tiers) — export to PDF/XLSX | 13A ✅ | totals reconcile (A ≈ $7.4k · B ≈ $705k), bracketed names filled | ✅ doc / ☐ PDF |

## B. Theme & content rules
| # | Requirement | Where it is satisfied | Verify | Status |
|---|---|---|---|---|
| B1 | Theme **"Make FinLit Fun"** visible | title screen tagline + footer (`ui/title.js` l.46/54), `<title>` in `index.html`, lesson card every season, theme statement `docs/ITCH_PAGE.md §3` | open `index.html` — tagline under logo | ✅ |
| B2 | Financial‑literacy concepts taught, not just themed | 10 lessons (budgeting → planning for a goal) each tied to a mechanic: `docs/GDD.md §4`, `data/story.json → lessons`, `src/systems/economy.js BALANCE.lessons` | `node tools/check.mjs --story` (every lessonId has lines) | ✅ |
| B3 | Family‑friendly / 16+ safe, UAE partner | no gambling, loot boxes, magic, undead (`docs/GAME_BIBLE.md §2`) | `check.mjs --story` banned‑word regex passes | ✅ |
| B4 | No external assets with unclear licence | all 3D procedural, one MIT library (`vendor/three.module.js`), audio in‑engine synth or self‑generated | `grep -r "http" src ui` finds no CDN/asset URLs | ✅ |

## C. itch.io page fields (from `docs/ITCH_PAGE.md §1`)
| # | Field | Value / file | Status |
|---|---|---|---|
| C1 | Title · tagline · classification · kind (HTML) · release status (Prototype) · pricing (free) | `docs/ITCH_PAGE.md §1` table | ✅ copy |
| C2 | Upload with "This file will be played in the browser" | A1 zip | ☐ |
| C3 | Embed: 1280 × 720 · mobile friendly · fullscreen button · click‑to‑launch (audio unlock) · scrollbars off | `docs/ITCH_PAGE.md §1`; `tools/qa_mobile.mjs` 1280×720 no‑scroll check ✅ | ✅ setting / ☐ apply |
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
| D1 | Headless suite | `node tools/check.mjs --props --creatures --hero --abilities --economy --build --customers --ui --story --vfx --world --sandbox --game --save --audio` → ALL OK | ✅ (2026‑10‑19) |
| D2 | Full game walk headless | included in D1 (`--game`: S1 → S3 → win → endless → lose → title, 3070 frames) | ✅ |
| D3 | Browser smoke, 0 console errors | `bash tools/setup_browser.sh && node tools/smoke.mjs index.html --close` → ERRORS none | ✅ (12: 121–133 dc) |
| D4 | Mobile QA 3 viewports | `node tools/qa_mobile.mjs` → 3/3 OK, 0 overflow/overlap/scroll, taps ≥ 44 px | ✅ (11B) |
| D5 | Perf budget | ≤ 150 draw calls in play (`docs/PERF.md`: 110–135) | ✅ |
| D6 | Save round‑trip | `check.mjs --save` + manual: play a season, reload, CONTINUE | ✅ headless / ☐ manual |
| D7 | Relative paths only (itch CDN sub‑path, WebView) | 11B audit; `grep -rn '"/src\|"/ui\|"/vendor' index.html ui src` → none | ✅ |
| D8 | Audio unlock on first gesture; `?mute` works | 12 · click‑to‑launch on itch | ✅ |
| D9 | Zip sanity after build | `unzip -l lumen-ledger-web.zip \| head` shows `index.html`, `src/`, `ui/`, `vendor/`, `data/`, `audio/` — no `tools/ tests/ docs/ demo_*` | ✅ dry‑run |
| D10 | Fresh‑profile play‑through on a phone from the live itch URL (one season, title → ledger) | ☐ submission day | ☐ |

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
