# HANDOFF 13A — Jam package (itch page copy · Game Budget · README · submission checklist) — IN PROGRESS

Owned: `game/README.md` · `docs/ITCH_PAGE.md` · `docs/BUDGET.md` · `docs/SUBMISSION_CHECKLIST.md` (docs only — no code, no demo).
Needs: 11B master + `docs/GDD.md` (8B). Jam requirements (from `screenshots/reference/jam_page_2_submission_theme.png`):
**Your Game · Concept Doc / GDD · 2‑minute video of actual gameplay · Game Budget**. Theme: **"Make FinLit Fun"**. Submit by 2026‑11‑15.

## Plan (= Missing list until each line is ticked)
- [ ] P1.1 `docs/ITCH_PAGE.md` — title, tagline, 150‑word pitch, controls table, FinLit lessons list, tags/metadata, embed settings (1280×720), credits block
- [ ] P1.2 `docs/BUDGET.md` — Game Budget sheet: dev months, roles, tools, audio, QA, marketing; jam build (actual) vs funded v1.0 (12 months) columns
- [ ] P2.1 `game/README.md` — how to run (static server / itch zip), folder structure, test commands, credits, licence
- [ ] P2.2 `docs/SUBMISSION_CHECKLIST.md` — every itch.io / jam requirement → the file that satisfies it + who/when
- [ ] P3 Screenshot shot list (6 shots, camera positions + what must be visible) → section in ITCH_PAGE.md
- [ ] Close: `node tools/check.mjs` ALL OK → this file finalised → README "Done" row → "Next" → 13B → commit + push

## Done
(none yet)

## Missing
(see Plan)

## Measured
- Docs only: 0 draw calls, 0 tris. `check.mjs` unaffected.

## Notes for the integrator
- 13B (trailer) reads the shot list in ITCH_PAGE.md §Screenshots; 14 (APK) reads README "How to run" + SUBMISSION_CHECKLIST "APK" row.
