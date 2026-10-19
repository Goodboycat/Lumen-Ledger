# HANDOFF 11B — Mobile QA + final itch.io build folder (IN PROGRESS — resume file)

Owned: bug fixes only (any file, minimal) · `docs/QA_MOBILE.md` · `tools/qa_mobile.mjs` (new, Playwright, 3 viewports, touch emulation).
Start point (11A master): index.html 133–135 dc in play, ERRORS none; touch pad / safe-area CSS from 7C already present.

## Plan = Missing list (tick as they land; each item = one wip.sh commit)
- [ ] P1.0 `tools/qa_mobile.mjs`: 3 viewports (360×800 portrait touch · 800×360 landscape touch · 1280×720 desktop) → load title → PLAY → drain dialogue → shots + DOM audit (elements overflowing the viewport, touch pad vs build tray vs jars overlap, buttons < 44 px).
- [ ] P1.1 run it, read the audit, fix the overflow / overlap bugs in `ui/*.css` (smallest change).
- [ ] P1.2 re-run → `docs/QA_MOBILE.md` with the 3 screenshots + table (viewport · overflow · overlap · tap targets · dc).
- [ ] P2.1 iOS: `100dvh` fallback for `100vh`, audio unlock stub on first tap (12 audio will hook `game.bus 'input:first'`), `-webkit-touch-callout` off, no double-tap zoom.
- [ ] P2.2 Android back button / WebView: `history.pushState` guard → Esc → pause menu instead of leaving; all paths relative (grep for `/src`, `/ui`, `/vendor`); `?import=` already handled by 10D.
- [ ] P3 loading screen (CSS-only, hidden by `game.start()`), favicon (inline SVG data URI), itch.io embed check 1280×720 (no scroll bars, `overflow: hidden` on html/body).

## Done
(nothing yet)

## Measured
(see docs/QA_MOBILE.md once it exists)

## Notes for the integrator
(filled at close)
