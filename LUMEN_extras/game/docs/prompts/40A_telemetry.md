# Chat 40A — Funnel telemetry: measure before touching anything
Needs: 10C createLumenGame (bus events game:start · eco:season · ui:start) · 10D save      Blocked-by: none (first v6 ID)
Owned (only these files): src/systems/telemetry.js (new), src/Game.js (`installTelemetry(lg)` ≤ 15 lines, called from createLumenGame), tests/telemetry.test.mjs (new), index.html (`?telemetry=<url>` flag, 2 lines), check.mjs (additive `--telemetry`)
Read (max 6 credits): START_HERE.md → MASTER_PLAN_V6.md §0–§1, §5 → this → Game.js lines 485–600 (createLumenGame, installStart) + 910–955 (installSeasonLoop) only
Export (API_CONTRACTS "Telemetry (40A)", ≤ 6 lines):
  `createTelemetry({ bus, storage, now:()=>ms, endpoint?:string, enabled?:bool }) → T` · `T.session` = { id, startedAt, steps:{play, firstStall, firstSale, firstCoinInHand, s2, s3}, quit:{state, season, day01, reason}, seasonsPlayed, sparkHandled, sparkTotal }
  `T.mark(step, data?)` (idempotent per session) · `T.flush()` → writes ring buffer `lumen.telemetry` (max 50 sessions) · `T.export()` → JSON string · `T.destroy()` → 0 listeners
  bus in: `ui:start` → play · `build:placed` (first `stall_*`) → firstStall · `eco:sale` → firstSale · `eco:spark {reason:'tip:*'|'till:*'}` → firstCoinInHand + sparkHandled · `eco:season` → s2/s3 · `ui:title`/`eco:lose`/`pagehide` → quit
  bus out: `telemetry:mark {step, t}` (HUD debug only)

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 20 credits)
- `telemetry.js`: pure, no DOM/Three. `createTelemetry` subscribes to the bus events above; every `mark` stores `t = now() − startedAt` once. `quit` is written by `end(reason)` (called on `ui:title`, `eco:lose`, and by Game.js on `pagehide`/`visibilitychange hidden`). `flush()` appends the session to a ring buffer in `storage` (same injected-storage pattern as save.js: `{getItem,setItem}`), trims to 50.
- `sparkTotal` += every positive `eco:spark` delta; `sparkHandled` += deltas whose reason starts with `tip:` or `till:` (42A will emit `till:`). This is the "% of Spark through Pip's hands" metric of PLAN §5 — it must exist before 42A so the baseline is honest.
- `tests/telemetry.test.mjs` (node:test, mock bus with on/emit/off): play→firstStall→firstSale order and times · mark is idempotent · s2/s3 set from `eco:season {season}` · quit captured with state/season/day01 · ring buffer trims at 50 · destroy → 0 listeners.
- `Game.js installTelemetry(lg)`: create with `storage = globalThis.localStorage || memory`, `now = performance.now`; call `T.end('pagehide')` from a `pagehide` listener (guard `typeof window`); expose `lg.telemetry`; `window.lumenTelemetry = { export }` in index.html alongside `lumenSave`.
- `check.mjs --telemetry` (below).
### P2 — should ship (≈ 10 credits)
- Optional POST: if `endpoint` is set (`?telemetry=https://…` on index.html, default OFF, never hard-coded), `flush()` also `navigator.sendBeacon(endpoint, json)` (try/catch, fire-and-forget). Nothing personal is sent: no IP, no UA beyond `touch:bool`, `w×h`.
- `T.summary()` → `{reachedS2:bool, reachedS3:bool, tFirstStall, tFirstSale, tFirstCoin, modalSeconds}` where `modalSeconds` accumulates while `ui.isModal()` is true in the first 90 s (Game.js passes `isModal` in; sample at 10 Hz from the existing `eco:tick`).
### P3 — nice to have (≈ 5 credits)
- `?debug` stats line shows the current session's marks (Game.js already renders debug stats; one extra string).

## Demo page: none — pure logic, `tests/telemetry.test.mjs` + check.mjs.

## check.mjs section `--telemetry` (additive; name it `40A TELEMETRY`)
- headless `createLumenGame` run (reuse the `--game` harness, seasonSeconds 20) with telemetry installed → after S1→S3 the session has play, firstStall (starter stalls count only if placed by the player — assert it is set by a scripted `ui:build` + place, not by STARTER_STALLS), firstSale, s2, s3.
- `sparkTotal > 0`, `sparkHandled ≥ 0`, `sparkHandled ≤ sparkTotal`; print the ratio (expected ≈ 0.05 on S44 — that is the baseline, not a failure).
- `end('title')` → quit.state 'playing'|'review', `export()` parses, ring buffer length 1; `destroy()` → listener count unchanged from before install.
- run ≤ 2 s.

## Budgets: 0 meshes, 0 draw calls. ≤ 1 KB per session in storage.
## Content rules that bite here: telemetry is opt-in to network (endpoint off by default) and anonymous; it must never block or delay `ui:start` (no await before PLAY).
## Handoff `docs/HANDOFF_40A.md`: Done / Missing / Measured (the S44 sparkHandled ratio + tFirstStall from the headless run) / Suspected / Notes for the integrator (40B reads `export()` shape; 42A must emit `eco:spark reason 'till:*'`).
