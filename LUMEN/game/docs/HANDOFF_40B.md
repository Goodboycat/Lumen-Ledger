# HANDOFF 40B — Funnel report tool + S44 baseline (MASTER_PLAN_V6 phase 40, 2026-11-02)
## Done (P1 + P3; P2 not done)
- `tools/funnel.mjs` — pure Node. `node tools/funnel.mjs <sessions.json|-> [--md]` → PLAN §5 table (n, % reaching play→firstStall→firstSale→firstCoinInHand→s2→s3, median t each, quit histogram season × day01 decile × reason, mean sparkHandled/sparkTotal, mean modalSeconds 0–90 s). Missing steps = "n/a". `resumed:true` sessions bucketed out (counted, excluded).
- `--synthetic N [--season S] [--out f.json] [--quiet]` — N headless `createLumenGame` "average player" sessions on a **game-time clock** (`opts.telemetryNow` hook in `Game.js installTelemetry`, 1 line): PLAY → dialogue auto-advanced → one stall at 30 s (first unowned type, first free cell) → ledgers skipped → S3 → title. 20 runs × 150 s seasons = 17 s wall.
- `--compare a.json b.json [--md]` (P3) — delta columns for 41A–41D / 45.
- `tests/fixtures/funnel.json` (3 sessions, 20 s seasons) · `tools/shots/funnel_synthetic_2026-11-02.json` (the 20-session baseline).
- `check.mjs --telemetry` now also runs `funnel.mjs --synthetic 3 --season 20` + the fixture `--md` (exit 0, table regex) — section total ≈ 5 s (was ≤ 4 s budget; the extra is the 3 synthetic runs, accepted).
- `docs/FUNNEL_BASELINE.md` — the S44 table, dated, exact commands, honest about script-vs-human values.
## Measured (synthetic headless, n=20, 150 s seasons, seeds 1–20)
| step | reached | % | median t (s) |
|---|---|---|---|
| play | 20 | 100 % | 0.00 |
| firstStall | 20 | 100 % | 30.03 |
| firstSale | 20 | 100 % | 7.42 |
| firstCoinInHand | 0 | 0 % | n/a |
| s2 | 20 | 100 % | 150.50 |
| s3 | 20 | 100 % | 300.83 |
Spark through Pip's hands **0.0 %** (0 / 367 mean) · modalSeconds 0.1 s (headless, not human) · quit S3 d0.0 title 20/20.
## Missing
- **P2** `tools/play.mjs --script funnel` (Playwright, real UI timing for modalSeconds / tFirstStall): no browser installed in this sandbox and the chat budget was spent on resuming 40B from an axed chat. Do it in 45 (or any chat that runs `tools/setup_browser.sh` anyway) — ≤ 6 screenshots, 3 runs, dump `window.lumenTelemetry.export()` to `tools/shots/funnel_<date>.json`.
- "Abilities used in S1–S2" has no telemetry mark — 41D adds `T.mark('firstAbility')` (or an `ability:*` bus listener in telemetry.js) and a `STEPS` entry; funnel.mjs picks it up automatically if added to `STEPS` in both files.
- 40A's P3 `?debug` marks line — still open, trivial.
## Suspected
- `modalSeconds ≈ 50 s` in PLAN §5 is still an estimate (dialogue 9 lines + tutorial 11 steps); only P2 or itch data confirms it.
- `firstSale 7.4 s` comes from the 3 starter stalls — if 41B/42A drop starter stalls the median jumps to ≈ firstStall + wave time.
## Notes for the integrator
- 41A–41D: after your change run `node tools/funnel.mjs --synthetic 20 --quiet --out tools/shots/funnel_<ID>.json` then `node tools/funnel.mjs --compare tools/shots/funnel_synthetic_2026-11-02.json tools/shots/funnel_<ID>.json --md` and paste it in your HANDOFF. 41C expects s2 median → ≈ 70.5 s.
- The synthetic player tops spark to 400 at 30 s if short; if 42A changes how spark is earned, that line (`eco.state.spark = Math.max(..., 400)`) may hide an affordability problem — check `firstStall` stays 100 %.
