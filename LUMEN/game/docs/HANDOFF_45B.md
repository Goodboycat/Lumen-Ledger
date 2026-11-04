# HANDOFF 45B — Real-browser playtest + 10 quality gates (2026-11-04, in progress)

## Done
- [x] qa_mobile 3/3 (prev chat): bark keyframes no longer override the inline transform (barks were parked at 0,0 off-screen); joystick knob hidden with its base. 2 CSS lines in ui/*.css.

## Missing (plan — tick as they land)
- [ ] P1 `tools/play.mjs --script funnel` — Playwright boots `index.html?mute` 1280×720, PLAY, speed ×3 via `window.game.setSpeed(3)` (lg = window.game), keyboard replay (WASD, B+1 at ~30 s, E deposit, E pier), run to S3, `window.lumenTelemetry.export()` → `tools/shots/funnel_browser_45B.json`.
- [ ] P1 `node tools/funnel.mjs tools/shots/funnel_browser_45B.json --md` → FUNNEL_BASELINE "## 45B browser" next to 44D synthetic.
- [ ] P1 Gates §D 1–10 vs S47, each ✅/❌ + how measured; "§G S47 dry run (2026-11-04)" replaces §G S39.
- [ ] P2 ≤ 5-line fixes in owned files; everything else → PLAY_BUGS.md `45B-n` rows.
- [ ] P2 evidence shots only where a gate fails → `screenshots/45B_gates/` (≤ 6).

## Measured
(pending)

## Suspected
(pending)

## Notes for 45C
(pending)
