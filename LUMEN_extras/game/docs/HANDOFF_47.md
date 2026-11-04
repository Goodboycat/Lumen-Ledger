# HANDOFF 47 — Phase 47 "Measure-fix" CLOSED (S50, 2026-11-04)

Phase 46 left `next.sh` with **no open ID** (every "Next" ID has a Done row). This chat picked the two cheapest open PLAY_BUGS rows
(no new system, ship rule 4) and closed them. One commit + push per task.

## Done
- **47A** `src/systems/telemetry.js`: `ui:dialogue:open` → `ui:dialogue:close` is summed into `modalSeconds` on the session clock,
  clamped to the first 90 s; `eco:tick` sampling is skipped while a box is open (no double count); `ui:title` closes an open window first.
  `tests/telemetry.test.mjs` 6 pass (new: 43 s under the opening box with 0 ticks → 43.0; second box 85→105 s → +5 clamped).
  PLAY_BUGS 45B-2 → FIXED.
- **47B** `LUMEN_extras/game/docs/PERF.md` "Targets": real-browser 167 draw calls @ S47 game zoom + **≤ 180** jam budget. PLAY_BUGS 45B-3 → CLOSED.
- **Close**: `GAME_VERSION`/`UI_VERSION` **S50** · `node tools/check.mjs` ALL OK · zip rebuilt.

## Measured
- `bash tools/itch_zip.sh` → `/tmp/LumenLedger_itch.zip` **9.7 MB · 334 files** · sha256 `8c42303f50b5394466814d5a9393cb121c30f345a4cbf373bb50569b058c53c0` · 1× `index.html` at root.
- No browser run (credits). Change is 10 lines in a pure recorder + docs; DOM untouched.

## Missing / not done
- PLAY_BUGS 45B-4 (SwiftShader 1/10 speed) and 45B-5 (hidden CONTINUE button) are harness notes — nothing to fix in the game.
- itch URL still unknown to the repo — user uploads the S50 zip, then `LUMEN/README.md` "Play:" line + `bash tools/wip.sh "SUBMITTED <date> <url>"`.
- Legacy `summary:false` jars slider DOM (~80 lines, HANDOFF_46D) still present; low value.

## Next (suggested, post-jam unless the user says otherwise)
- Telemetry endpoint (HANDOFF_45C "Standby") once there is somewhere to POST to.
- Optional one `node tools/qa_mobile.mjs` / `play.mjs --script funnel` run on S50 to refresh the browser funnel row with the corrected `modalSeconds`.
- Islands decision re-opens per HANDOFF_44D condition.
