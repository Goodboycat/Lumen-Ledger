# Chat 13B — Trailer shot list + demo mode
Needs: 11B master
Owned (only these files): game/src/systems/demoMode.js, docs/TRAILER.md
Read (API_CONTRACTS): Game.js state machine, GameCamera
Export: `?demo=1` autoplay camera path + scripted actions for recording

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- demoMode: 6 scripted camera moves (Sequence-driven) over a pre-built market with customers; hides HUD on key H.
### P2 — should ship (≈ 25 credits)
- TRAILER.md: 2-minute shot list with timestamps, captions, which demo segment, music cue.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Cinematic letterbox + slow-mo beats.

## Demo page `game/index.html?demo=1`
Runs 60 s unattended.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs index.html?demo=1 --shots --close`.

## Handoff `docs/HANDOFF_13B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
