# HANDOFF 12 — Audio loader + bus→SFX map + Ludo.ai prompt list (IN PROGRESS — resume file)

Owned: `src/core/Audio.js` · `audio/manifest.json` · `docs/audio_prompts.md` · `demo_audio.html` · check.mjs `--audio` section (additive) ·
one wiring line in `index.html` (+ `src/core/index.js` barrel line).
Start point: 11B master. `index.html` already emits **`bus 'input:first' {touch}`** once on the first gesture and resumes
`window.lumenAudioCtx` — Audio.js creates/resumes its context there (never at module load — iOS).

## Plan = Missing list (tick as they land; each item = one wip.sh commit)
- [ ] P1.0 `src/core/Audio.js` skeleton: `createAudio({bus, settings})` → `{ load(manifest), play(id,{vol,pitch}), music(id), stop(), setVolume(sfx, music), unlock(), state, destroy }`.
      No Node globals; `AudioContext` missing (Node / check.mjs) → fully inert but API-complete (`state.silent = true`).
- [ ] P1.1 loader: manifest `{ sfx: {id: {file, vol, loop, synth}}, music: {...} }`; `fetch` + `decodeAudioData`; a 404 / decode error → id marked
      `missing` and `play()` is silent (logs once per id). Files live in `audio/sfx/*.ogg|mp3`, `audio/music/*`.
- [ ] P1.2 **procedural fallback** (so the jam build is never silent): tiny synth per id from `manifest.synth` (`{type:'blip'|'coin'|'thud'|'whoosh'|'chime'|'buzz', f, dur}`)
      built with OscillatorNode + GainNode envelopes; used when the file is missing. Music fallback: 4-chord pad loop from `synth.chords`.
- [ ] P1.3 bus → SFX map for the 15 core events (`eco:sale` coin · `eco:spark` tick · `eco:denied` buzz · `build:*` / `ui:build` hammer · `eco:season` chime ·
      `eco:loan` · `eco:scam` sting · `eco:scamResult` · `eco:upgrade` · `eco:win` fanfare · `eco:lose` · `story:line` blip · `ui:choice` · `ui:ledger:open` · `ui:title:open`
      music swap · `game:start` music · `sandbox:ability` whoosh · `ui:touch`/button click) with per-event cooldown (no machine-gun on 10 Hz ticks).
- [ ] P1.4 `audio/manifest.json` with every id (+ synth fallback params) · `src/core/index.js` export · `index.html` wiring (settings sfx/music from `ui.pause.settings`, `ui:settings`).
- [ ] P1.5 `check.mjs --audio`: imports Audio.js in Node (inert), loads the manifest (every mapped event id exists), fires the 15 events through a bus → `audio.state.played` counts,
      cooldown asserted, missing-file path asserted, destroy() → no listeners.
- [ ] P2 `docs/audio_prompts.md`: ~40 SFX + 6 music prompts for Ludo.ai (id · length · loop · mood · prompt), file names = manifest.
- [ ] P3 pitch variance per play (`pitchVar` in manifest, ±6 %) · ducking music to 35 % under `ui:dialogue:open` / `ui:ledger:open`, back on close (200 ms ramps).
- [ ] demo_audio.html: one button per id (plays file or synth, logs id + source), music buttons, volume sliders; `window.game`, stats.
- [ ] close: HANDOFF final · README row · commit.

## Done
(nothing yet)

## Measured
(filled at close)

## Notes for the integrator
(filled at close)
