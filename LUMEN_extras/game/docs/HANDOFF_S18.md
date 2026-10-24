# HANDOFF S18 — Cinematics (title orbit · arrival walk-in · victory lighthouse) — DONE 2026-10-24

## What landed (all pushed to origin/main)
- `src/vfx/cinematics.js` — `CinematicDirector` (`play('title'|'arrival'|'victory', {sb, story, onDone})`, `skip()`, `stop(silent)`,
  `update(dtReal)`, `active`, `stats`, `dispose()`), `CINE` tunables. Letterbox + ⏭ SKIP DOM layer (tap bars / Esc / Enter / Space = skip).
  `reduceMotion` → every shot is a 0.6 s cut (arrival teleports Pip to the plaza; title orbit is a static wide shot).
- Hooks (previous chat): `GameCamera.setCine(rig, blend)` · `HeroController.inputOverride = {move:{x,y}}` · `StorySystem.hold(on)` / `.held`.
- `src/Game.js` `installCinematics(lg)`: title **showcase** sandbox (`lg.showcaseSb`, same seed/balance as a fresh PLAY) orbits behind the
  title (`body.ll-title-3d`); a fresh story PLAY **reuses** it (`lg.stats.showcaseReused`, no second build) and plays `arrival` before
  `game:start`; `eco:win` plays `victory` (`sb._cineLamp` → the shot lights the lamp, ending lines held until `cine:end`); CONTINUE /
  ENDLESS / `ui:restart` tear the showcase down and play nothing. `opts.cinematics` (default: on in browser, off headless),
  `opts.showcase` (check.mjs). `lg.destroy` disposes the director. `sb.update` gets `dtReal`; wind sways on the paused title.
- `ui/tutorial.js`: first-play guide defers `game:start` → `firstOpen()` until `cine:end` when an arrival/victory shot is active.
- `ui/cinematics.css` linked from `index.html`; `?nocine` (cinematics off), `?cinelog` (console trace of cine:* + game:start).
- `tools/check.mjs --cinematics` gate (5 steps) ALL OK. `--game --sandbox` green. `--save` fails 9/12 stalls — **pre-existing** (since d4788c7).
- Browser smoke (PlaywrightConsoleCapture, software WebGL): `?seed=3&autoplay&cinelog` → `cine:begin arrival` → `game:start` → `cine:end`,
  0 JS errors. Title page alone: 0 errors.

## Measured
- Arrival: pier → plaza (≈ 1.2 m end distance) in 2.9 s headless at stick 0.55 (`CINE.arrivalWalk`); hard cap 9 s. Victory 7.0 s (2.2 fly + 3.2 hold + 1.6 return).
- Showcase sandbox = 269 meshes (same as a run); teardown → 0 meshes.

## Not done / next
- Audio stings on `cine:begin` / `cine:lamp` (Audio.js DEFAULT_EVENTS map — 12's file; a line each).
- Title: a subtle "press PLAY" idle hint after one orbit lap; the orbit centre could follow the lighthouse on later laps.
- Victory: confetti burst from pack1 at `cine:lamp`; fogRecede already runs from the eco:win handler.
- Real-GPU visual pass (the sandbox only has SwiftShader): check letterbox height on 360×800 and that `.ll-title-card` blur is readable
  over the orbit. No screenshot loops — one `tools/smoke.mjs --shots` run at most.
- `--save` 9/12 stalls (pre-existing, 10D owner).

## Suspected
- On very slow devices the arrival hard cap (9 s) ends the shot before Pip reaches the plaza; he keeps his position (no snap). Fine.
- `ui:start` with `mode:'continue'` that falls back to `lg.start('story')` (no save) does NOT play the arrival (`_freshPlay=false`). Intentional.
