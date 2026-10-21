# HANDOFF 13A — Jam package (itch page copy · Game Budget · README · submission checklist) ✅ CLOSED

Owned: `game/README.md` · `docs/ITCH_PAGE.md` · `docs/BUDGET.md` · `docs/SUBMISSION_CHECKLIST.md` (docs only — no code, no demo).
Jam requirements (from `screenshots/reference/jam_page_2_submission_theme.png`): **Your Game · Concept Doc / GDD · 2‑minute video of actual gameplay · Game Budget**. Theme "Make FinLit Fun". Submit by 2026‑11‑15 (target 11‑13).

## Done
- **P1.1 `docs/ITCH_PAGE.md`** (130 lines): §1 itch form‑field table (title, 120‑char tagline, HTML kind, embed 1280×720 + mobile + fullscreen + click‑to‑launch, 10 tags, inputs, accessibility, session length, links) · §2 paste‑ready page body — ~190‑word pitch, "How to play" in 4 steps, controls table (keyboard + touch), 6 abilities ↔ FinLit, 10‑lesson table, Good‑to‑know (save / audio unlock / a11y / phone / content), credits · §3 theme statement for the jam form · §4 devlog seed · **§5 (P3) 6‑shot screenshot list** with camera zoom, URL flags, must‑be‑visible and itch captions (also the storyboard anchor for 13B) · **§6 itch zip recipe** — `zip` + 20‑line Python re‑root so `index.html` sits at the zip root, excludes tools/tests/docs/demos. **Dry‑run OK: 536 KB, 72 files, root = index.html src ui vendor data audio.**
- **P1.2 `docs/BUDGET.md`** (123 lines): §0 summary (A jam build ≈ **$7.4k** imputed · B funded v1.0 ≈ **$705k**) · §1 scope A vs B · §2 schedules (jam weeks actual; 3 funded milestones M1–M3) · §3 people (A 110 h imputed; B 4.5 FTE + 6 contract roles = $517k) · §4 tools & services ($36.7k incl. legal, WCAG audit, devices, backend) · §5 audio · §6 QA + learning‑outcome study · §7 marketing & release ($62.5k) · totals reconciled line by line (629.1k × 1.12 = 704.6k) · 3 funding tiers ($260k v0.9 classroom pilot / $705k v1.0 / $830k + live‑ops) · assumptions & risks.
- **P2.1 `game/README.md`** (rewritten, 60 lines): play it (static server, itch, APK) + URL flags (`?autoplay ?endless ?season ?debug ?mute ?nohistory`) · controls · folder map of every dir with one‑line purpose · test commands (check.mjs full flags, sim sweep, smoke, qa_mobile) · numbers (110–135 dc, 25 min, 0.54 MB) · credits & licence.
- **P2.2 `docs/SUBMISSION_CHECKLIST.md`** (70 lines): A four jam deliverables → artefact / owner / verify / status · B theme & content rules (B4 verified: zero `http://` in src/ui) · C ten itch fields · D ten quality gates (D7 verified: zero absolute `/src /ui /vendor` refs) · E APK rows for 14 · F 45‑minute submission‑day runbook.

## Missing
- `docs/GDD.md §11` credits still has `[name(s)]` placeholders and `docs/ITCH_PAGE.md` / `BUDGET.md` have `[team name]` / `[name]` — **GDD.md is not 13A‑owned**; the user fills real names on submission day (runbook F2). One `sed` replaces all three.
- Screenshots `LUMEN/screenshots/13A_itch/01…06.png` + `cover.png` are **not captured** (needs the browser; shot list is complete). 13B's recording session is the natural moment: run the shot list while the trailer is being captured.
- PDF exports of GDD / BUDGET: manual, submission day.

## Measured
- Docs only: 0 draw calls, 0 tris. `node tools/check.mjs` (default) ALL OK after every file; full flag suite unchanged from 12.
- Zip recipe: 536 KB zipped (vendor/three.module.js 1.3 MB unzipped is ~70 % of the payload).

## Notes for the integrator
- **13B** — use `ITCH_PAGE.md §5` as the storyboard spine (6 shots = 6 demo‑mode camera moves); the itch "trailer" field expects a YouTube/Vimeo link, and the jam insists on *actual gameplay* footage — demo mode must drive the real game, not a staged scene.
- **14** — README "Play it → Android" row and CHECKLIST §E are the contract: load `game/` from Flutter assets, back button = Esc (11B sentinel), `?import=` for saves, attach the APK as a second itch upload.
- Submission day: follow CHECKLIST §F top to bottom; nothing else in this package needs a decision.
