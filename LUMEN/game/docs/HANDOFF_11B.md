# HANDOFF 11B — Mobile QA + final itch.io build folder (CLOSED 2026-10-19)

Owned: bug fixes only (minimal, any file) · `docs/QA_MOBILE.md` · `tools/qa_mobile.mjs` (new, Playwright, 3 viewports, touch emulation).
Start point: 11A master (133–135 dc in play, ERRORS none). Two chats: the first was axed with P1.0/P1.1 on disk but uncommitted
(recovered from the user's tar and pushed as the first WIP of the second chat — Rule 0 works).

## Done
- **P1.0** `tools/qa_mobile.mjs` — 360×800 portrait touch · 800×360 landscape touch · 1280×720 desktop; loads `index.html?autoplay&debug[&touch=1]`,
  drains the S1 opening dialogue, audits overflow / panel overlap (play + build tray open) / tap targets < 44 px / document scroll /
  page errors / `game.stats`; shots in `tools/shots/qa_<vp>_{0_title,1_play,2_build}.png`; exit 1 on any FAIL.
- **P1.1** fixes (smallest change each): jars panel folds to its header under an open dialogue (`body.ll-dlg-open` from `dialogue.js`,
  `jars.css` ≤ 900 px; portrait lifted 250 px above the pad) · title layer `display:none` 340 ms after `hide()` (`title.css/.js`) ·
  44 px tap targets on `body.is-touch` only (`base.css`) · `#debug-stats` bottom-left + safe-area (`index.html`).
- **P1.2** `docs/QA_MOBILE.md` — table (viewport · overflow · overlap · taps · scroll · dc · meshes · dpr), the four bugs + fixes, itch.io
  embed notes; play shots copied to `../screenshots/11B_mobile/`. **Result 3/3 OK**: 0 overflow · 0 overlap · 0 scroll · 0 taps < 44 px on
  touch · errors none · 110 / 135 / 133 dc.
- **P2.1 iOS**: `100dvh` fallback on html/body/#game-root, `-webkit-touch-callout: none`, `touch-action: manipulation` (no 300 ms delay,
  no double-tap zoom), `overscroll-behavior: none`, `gesturestart` preventDefault (pinch). **Audio unlock stub**: the first
  `pointerdown`/`touchend`/`keydown` (capture, once) emits **`bus 'input:first' {touch}`** and resumes `window.lumenAudioCtx` if 12 parked one.
- **P2.2 Android / WebView**: back button = Esc — a sentinel `history.pushState` entry; `popstate` re-arms it and dispatches a synthetic
  `Escape` keydown so 7A's tray (close / cancel placing) and 7C's pause menu react exactly as on desktop; on the title screen back
  leaves normally; `?nohistory` disables it (Flutter can own the back stack). Path audit: zero absolute `/src` `/ui` `/vendor` `/data`
  references — everything relative, so `file://`-free WebView `assets/` and itch.io CDN sub-folders both work.
- **P3**: CSS-only loading screen `#boot-loading` (gold coin flip, `prefers-reduced-motion` aware) removed two rAFs after `game.start()`
  or on boot error; inline SVG Spark-coin favicon (no request); itch.io 1280×720 embed check — `scrollWidth/Height` = viewport, no bars.

## Missing
- None of the prompt's P1–P3 items. Real-device checks (actual iOS Safari, thermal fps) are manual and outside the sandbox.

## Measured
- Draw calls in play (swiftshader, headless): 360×800 **110** · 800×360 **135** · 1280×720 **133** (11A target ≤ 150 ✅). Meshes 187. fps 20 is
  the software GL of the container, not the game (11A: 60 on GPU).
- `node tools/check.mjs` with every flag: **ALL OK** (no new sections — 11B is CSS/HTML; the harness is the browser-side test).

## Suspected
- `touch-action: manipulation` on `html, body` is inherited by the jar sliders, which set `touch-action: none` themselves (7A) — verified
  in the harness that dragging still works (jar rects unchanged), but a real iOS device should confirm slider drag vs. page gesture.

## Notes for the integrator
- **12 audio**: create the `AudioContext` inside `bus.on('input:first', …)` (or earlier and park it on `window.lumenAudioCtx`; the stub
  resumes it in the gesture). Never create it at module load on iOS.
- **13A jam package**: upload `LUMEN/game/` as the zip root (`index.html` at top level); itch.io settings 1280×720, "Mobile friendly",
  fullscreen button. `docs/QA_MOBILE.md` has the embed notes.
- **14 Flutter**: load `index.html` from the asset bundle via a local HTTP server (relative paths only, no `file://` — ES modules need http),
  pass `?nohistory` if Flutter handles back, hand the save slot across with `?import=LUMEN1:…` / `window.lumenSave.export()` (10D).
- Re-run the harness any time: `bash tools/setup_browser.sh` (once) → `NODE_PATH=tools/node_modules node tools/qa_mobile.mjs`.
