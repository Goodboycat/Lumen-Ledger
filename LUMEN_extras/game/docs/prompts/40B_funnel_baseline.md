# Chat 40B — Funnel report tool + S44 baseline numbers
Needs: 40A (export shape)      Blocked-by: 40A
Owned (only these files): tools/funnel.mjs (new), tools/play.mjs (additive script `funnel` — create the file if 28A's play.mjs does not exist yet; Playwright, ≤ 6 screenshots), docs/FUNNEL_BASELINE.md (new)
Read (max 6 credits): START_HERE.md → MASTER_PLAN_V6.md §5 → this → HANDOFF_40A Notes → tools/qa_mobile.mjs (Playwright boot pattern, 40 lines) only
Export (API_CONTRACTS "Funnel (40B)", ≤ 4 lines):
  `node tools/funnel.mjs <sessions.json|-> [--md]` → table: n sessions · % play→firstStall→firstSale→S2→S3 · median t for each · quit histogram by season × day01 decile · mean sparkHandled/sparkTotal · mean modalSeconds(0–90 s)
  `node tools/play.mjs --script funnel [--runs N] [--headless-eco]` → drives index.html N times (scripted inputs: PLAY, WASD walk, B + place stall, wait to S3 or 240 s), dumps `window.lumenTelemetry.export()` of each run to `tools/shots/funnel_<date>.json`

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 15 credits)
- `funnel.mjs`: pure Node, reads the 40A ring-buffer JSON (array of sessions), prints the table above as text and, with `--md`, as a Markdown table. Handles missing steps (never reached = not counted, listed as "n/a"). Unit-check inline: run it on a 3-session fixture written into `tests/fixtures/funnel.json` (allowed as part of this ID).
- Cheap baseline WITHOUT a browser first: extend the `check.mjs --telemetry` harness idea — a tiny script block in `funnel.mjs --synthetic 20` runs 20 headless `createLumenGame` sessions with a scripted "average player" (place 1 stall at t 30 s, end at S3) and reports. This gives tFirstSale / sparkHandled numbers at 0 credits.
- `docs/FUNNEL_BASELINE.md`: the S44 numbers (synthetic headless + whatever real browser runs P2 affords) in the PLAN §5 table layout, dated, with the exact commands used. **This file is what 45 compares against — be precise about what was measured and how.**
### P2 — should ship (≈ 15 credits)
- `play.mjs --script funnel --runs 3` in the sandbox browser (software WebGL is fine for timing; skip if WebGL refuses: note it, keep synthetic). Record modalSeconds(0–90 s) and tFirstStall from real UI timing (tutorial overlay + dialogue), which the headless run cannot see.
### P3 — nice to have (≈ 5 credits)
- `funnel.mjs --compare a.json b.json` → delta columns (used by 45).

## Demo page: none.

## check.mjs section: none new — `funnel.mjs --synthetic 3` is invoked by `--telemetry` as a smoke (exit 0, prints a table). Keep `--telemetry` ≤ 3 s.

## Budgets: 0. Screenshots ≤ 6 total for the whole ID.
## Content rules that bite here: numbers in FUNNEL_BASELINE.md are measurements, never estimates; if something could not be measured write "not measured (why)".
## Handoff `docs/HANDOFF_40B.md`: Done / Missing / Measured (paste the baseline table) / Suspected (e.g. "modalSeconds ≈ 50 s is dialogue 9 lines + tutorial 11 steps") / Notes for the integrator (41A–41D each re-run `funnel.mjs --synthetic 20` and paste the delta in their HANDOFF).
