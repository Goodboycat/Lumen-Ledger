# Chat 12 — Audio loader + Ludo.ai prompt list
Needs: 10C master
Owned (only these files): game/src/core/Audio.js, game/audio/manifest.json, game/docs/audio_prompts.md
Read (API_CONTRACTS): bus event names from all HANDOFFs
Export: `Audio.load(manifest)`, `Audio.play(id,{vol,pitch})`, `Audio.music(id)`, bus→SFX map, graceful silence when a file is missing

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Audio.js (WebAudio, unlock on first tap, missing files = silent) + manifest with ids. Bus map for 15 core events.
### P2 — should ship (≈ 25 credits)
- docs/audio_prompts.md: ~40 SFX + 6 music prompts for Ludo.ai, each with id, length, loop?, and mood.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Pitch variance per play, ducking music under dialogue.

## Demo page `game/demo_audio.html`
Buttons play each id (silent if file missing, logs the id).
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_audio.html --shots --close`.

## Handoff `docs/HANDOFF_12.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
