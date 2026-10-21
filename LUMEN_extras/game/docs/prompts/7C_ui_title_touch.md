# Chat 7C — UI: Title, Pause, Settings, Touch controls
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game)
Owned (only these files): game/ui/title.*, pause.*, touch.*, game/demo_ui_title.html
Read (API_CONTRACTS): §A Input (press, onJoystick), EventBus · §B UI
Export: mountTitle(root), mountPause(root), mountTouch(root, input)

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Touch: virtual joystick (feeds input.move) + 3 buttons (attack/interact/build via input.press). Works in portrait. Test on a phone-sized viewport.
### P2 — should ship (≈ 25 credits)
- Title screen (logo, "Make FinLit Fun" tagline, Play / Continue / Endless), pause menu (ui:pause).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Settings: quality, outline thickness, SFX/music volume (emit ui:settings).

## Demo page `game/demo_ui_title.html`
Title → Play hides title and shows touch controls over Foundation scene.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_ui_title.html --shots --close`.

## Handoff `docs/HANDOFF_7C.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
