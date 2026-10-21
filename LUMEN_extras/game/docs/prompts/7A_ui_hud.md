# Chat 7A — UI: HUD + Build menu + Jars (DOM/CSS only)
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) (no Three needed)
Owned (only these files): game/ui/hud.js, hud.css, build.js, build.css, jars.js, jars.css, game/demo_ui_hud.html
Read (API_CONTRACTS): §A EventBus, ui/base.css · export §B UI (mountHUD, mountBuildMenu, mountJars)
Export: exactly §B UI functions

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- HUD ribbon (Spark count-up tween, Season chip, Fog % purple bar). 4 jar sliders summing to 100 % (drag one, others rebalance) emitting ui:jar.
### P2 — should ship (≈ 25 credits)
- Build menu grid of cards (emoji/SVG placeholder icon, name, cost, locked), emits ui:build. Listens to eco:*, build:*.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Bounce-in keyframes, safe-area insets, portrait layout.

## Demo page `game/demo_ui_hud.html`
Fake bus events every 2 s animate everything; no Three.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_ui_hud.html --shots --close`.

## Handoff `docs/HANDOFF_7A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
