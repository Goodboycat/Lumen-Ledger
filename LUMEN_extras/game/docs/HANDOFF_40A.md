# HANDOFF 40A — Funnel telemetry (MASTER_PLAN_V6 phase 40, 2026-11-02)
## Done (P1 + P2 + P3-lite)
- `src/systems/telemetry.js` — pure recorder (`createTelemetry`), steps play/firstStall/firstSale/firstCoinInHand/s2/s3, quit {state,season,day01,reason,t}, sparkTotal/sparkHandled (`tip:*`|`till:*`), modalSeconds (first 90 s sampled on `eco:tick` through `isModal`), ring buffer `lumen.telemetry` max 50, `export()/summary()/clear()/destroy()`, optional `sendBeacon(endpoint)` (P2, off by default), anonymous (touch:bool, w×h only).
- `tests/telemetry.test.mjs` 5 tests / node:test — order+times, idempotent mark, handled vs total, s2/s3, quit, ring trim 50, modal seconds, destroy → 0 listeners, disabled mode.
- `src/Game.js installTelemetry(lg)` (called from createLumenGame after installSave): storage = opts.storage || localStorage || memory, clock performance.now, pagehide / visibilitychange hidden → `end('pagehide')`, `lg.telemetry`, `opts.telemetryEndpoint`, `opts.telemetry:false`.
- `index.html`: `?telemetry=<url>` flag → `telemetryEndpoint`; `window.lumenTelemetry = {export, summary, clear}` next to `lumenSave`.
- `tools/check.mjs --telemetry` "40A TELEMETRY": unit tests + headless createLumenGame S1→S3 (20 s seasons) → asserts every step, starter stalls do NOT count as firstStall (a scripted `ui:build` does), sparkHandled ≤ sparkTotal, quit on ui:title has the pre-title state, export parses, session ≤ 1 KB (385 B), listeners after destroy ≤ before install, run ≤ 4 s (1.1 s). `--game --save` still ALL OK.
## Measured (S44 baseline, headless 20 s seasons, seed 3)
- **Spark through Pip's hands: 0 / 317 = 0.0 %** (no tip coin is walked over in the headless run; in play it is ≈ 5 %). PLAN §5 target ≥ 80 % after 42A.
- firstCoinInHand: never (headless) — real players: only via tips. 42A must make this ≤ 20 s.
- Times in the headless run are not human times (play 0 s, firstSale 0.13 s); 40B's scripted `play.mjs --script funnel` gives the baseline numbers for the doc.
## Missing
- P3 `?debug` stats line showing the current marks (one string in the debug readout) — trivial, do with 40B if wanted.
- `quit.day01` is rounded to 2 dp from the last `eco:tick` (≤ 100 ms stale) — fine for a histogram.
## Suspected
- `ui:start {mode:'continue'}` (resume) starts a new session with `resumed:true`; its `firstStall` may never fire if the player already had stalls — 40B should bucket resumed sessions separately.
## Notes for the integrator
- 40B reads `lumenTelemetry.export()` (JSON array of sessions, shape above / API_CONTRACTS "Telemetry (40A)").
- **42A must emit `eco:spark` with reason `till:<how>`** for coins collected from a till (`eco.earn(v, 'till:walk')`), otherwise the §5 metric stays at the tip-only value.
- Nothing awaits before PLAY; all handlers are synchronous.
