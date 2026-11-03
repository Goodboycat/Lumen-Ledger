# Chat 45B — Real-browser playtest + 10 quality gates
Needs: 45A      Blocked-by: 45A
Owned (only these files): tools/play.mjs (`--script funnel` if missing — or the headless-export fallback below), game/docs/SUBMISSION_CHECKLIST.md (§D ticks + new "§G S47 dry run"), game/docs/FUNNEL_BASELINE.md ("## 45B browser"), game/docs/PLAY_BUGS.md (rows), ≤ 5-line fixes in ui/*.css · ui/title.js · index.html only, HANDOFF_45B.md
Read (max 6 credits): START_HERE.md → HANDOFF_45Z.md → HANDOFF_45A.md "Notes for 45B" → this → SUBMISSION_CHECKLIST.md §D §G → FUNNEL_BASELINE.md "44D"
Export (API_CONTRACTS): none.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 22 credits)
- **Real-browser funnel row**: Playwright boots `index.html` (1280×720, `?mute`), presses PLAY, lets the game run S1→S3 on the real clock with speed ×3 (`window.game` speed flag or `sb.timeScale`) — the synthetic player's scripted inputs are replayed via `page.keyboard` (W/A/S/D walk, B+1 stall at ~30 s, E deposit, E at the pier). At S3 start: `window.lumenTelemetry.export()` → `tools/shots/funnel_browser_45B.json` → `node tools/funnel.mjs <json> --md` → FUNNEL_BASELINE "## 45B browser" table next to the 44D synthetic column. Any step the browser fails to reach = the first real finding; record it, don't fix it here.
- **Gates §D 1–10** against S47, each one line ✅/❌ + how measured: smoke ERRORS none (`tools/smoke.mjs`) · `qa_mobile.mjs` 3/3 · draw calls ≤ 180 in play (`?debug`) · 1280×720 no-scroll · itch zip index.html at root · relative paths audit (`grep -rn "src=\"/\|href=\"/\|fetch('/" index.html ui src` → 0) · save → reload → CONTINUE resumes · Android back = Esc · audio unlocks on first input · title footer version. Write "§G S47 dry run (date)" replacing §G S39.
### P2 — should ship (≈ 10 credits)
- Fix any ❌ that is ≤ 5 lines inside the owned files (CSS overflow, a missing `./`, footer text). Everything else → `PLAY_BUGS.md` row `45B-n` with repro + severity; the fix belongs to 45C or post-jam.
- ≤ 6 screenshots only where a gate fails (evidence), to `screenshots/45B_gates/`.
### P3 — nice to have
- `tools/play.mjs --script funnel` as a reusable script (if P1 used the inline harness) so 45C/post-jam can re-run with one command.

## Demo page: none.
## check.mjs section: none — but `node tools/check.mjs` must still be ALL OK after any P2 fix (run once at the end).
## Budgets: ≤ 12 browser screenshots total across P1+P2, 0 video. Browser run ≤ 3 game-seasons at ×3 = ~2.5 min wall clock.
## Fallback if Playwright keyboard replay is flaky (> 2 attempts): run headless `index.html` 2 seasons with `?autoplay` off and only the stall placed via `window.game.sb.keys` — a partial browser row (firstSale, S2 reached) is still the first real number; say so in the table caption.
## Content rules that bite here: Ship rule 3 (mobile 3/3 green before upload) · Ship rule 2 (footer version visible on the title) · Ship rule 4 (no system; a bug is a row, not a feature).
## Handoff `docs/HANDOFF_45B.md`: Done / Missing / Measured (browser funnel vs 44D synthetic; 10 gates table) / Suspected (why any browser step differs from synthetic) / Notes for 45C (which PLAY_BUGS rows block upload, which don't).
