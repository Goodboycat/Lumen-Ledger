# Chat 11B — Mobile QA + final itch.io build folder
Needs: 11A master
Owned (only these files): bug fixes only; docs/QA_MOBILE.md
Read (API_CONTRACTS): —
Export: final itch.io build in LUMEN/game (index.html at root; the user zips it himself for itch.io) + Flutter WebView checklist

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Viewports 360×800 portrait, 800×360 landscape, 1280×720: touch controls, safe-area, no overflow. Fix.
### P2 — should ship (≈ 25 credits)
- iOS Safari quirks (audio unlock on tap, 100vh), Android Chrome back button, WebView (no file:// — relative paths only).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Loading screen, favicon, itch.io 1280×720 embed check.

## Demo page `game/index.html`
Screenshots at the 3 viewports in QA_MOBILE.md.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs index.html --shots --close`.

## Handoff `docs/HANDOFF_11B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
