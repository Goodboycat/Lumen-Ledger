# HANDOFF 13B — Trailer shot list + demo mode — IN PROGRESS

Owned: `src/systems/demoMode.js` · `docs/TRAILER.md` · one wiring block in `index.html` (`?demo=1`) · `check.mjs --demo` (additive section).
Needs: 10C `createLumenGame` state machine (`lg.start/lg.sb`), `GameCamera` (`game.followTarget`, `camera.zoom`), 10B `sb.keys / sb.ability / sb.build.load`, 13A `ITCH_PAGE.md §5` shot list (the 6 shots = the 6 camera moves).

## Plan (= Missing list until ticked)
- [ ] P1.0 `demoMode.js` skeleton — `createDemoMode(lg, { game, bus, ui, seconds:60 })` → `{ start, stop, update, shot, shots, state, destroy }`; inert in Node
- [ ] P1.1 pre-built market: `sb.build.load` 8 stalls (L1–L3) + Spark 400 + 2 helpers hired + 12 customers warm-up (seed fixed), hero at plaza
- [ ] P1.2 camera rig: `game.followTarget` override + `camera.zoom` + `camera.offset` tween; `Sequence` of 6 shots with ms + easing table (orbit‑free: dolly/zoom/pan only, the GameCamera has no yaw)
- [ ] P1.3 scripted actions per shot: hero walk path via `game.input.move` override, build ghost + confirm, jars apply, ability Q/W/G, `eco.endSeason` at shot 6 → ledger; dialogue auto‑advance
- [ ] P1.4 key **H** toggles HUD (`body.ll-demo-nohud` hides `#ll-hud`, jars, build tray, touch pad, debug stats); `?demo=1` wiring in index.html (skip title, `window.demo`)
- [ ] P1.5 `check.mjs --demo`: headless 60 s run → 6 shots entered in order, actions fired (build placed, ability played, season ended), HUD toggle, destroy clean
- [ ] P2 `docs/TRAILER.md` — 2:00 shot list: timestamp · demo segment · caption (on‑screen text) · VO/none · music cue (12 manifest ids) · capture settings (1280×720 60 fps, OBS, `?demo=1&nohud`)
- [ ] P3 letterbox bars (`body.ll-demo-cine` 2.39:1 CSS) + slow‑mo beat (`game.sequences.timeScale` 0.35 for 600 ms on coin arrival)
- [ ] Close: check ALL OK → this file → README row → Next → 14 → commit + push

## Done
(none yet)

## Missing
(see Plan)

## Measured
(tbd — expect same 110–135 dc as index.html; demo adds 0 meshes)

## Notes for the integrator
- Recording: `index.html?demo=1` runs 60 s unattended then loops; press H to hide the HUD for B‑roll, Esc stops the demo and hands control back.
