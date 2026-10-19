# HANDOFF 12 — Audio loader + bus→SFX map + Ludo.ai prompt list ✅ CLOSED

Owned: `src/core/Audio.js` · `audio/manifest.json` · `docs/audio_prompts.md` · `demo_audio.html` · check.mjs `--audio` (additive) ·
one wiring block in `index.html` · `src/core/index.js` barrel line.

## Done
- **P1.0–1.2 `src/core/Audio.js`** `createAudio({bus, settings})` → `{ unlock, load(manifestUrlOrObj), preload, play(id,{vol,pitch}), music(id),
  stopMusic(fade), setVolume({sfx,music}), duck(on), state, destroy }`. Gain graph sfx / music → duck → destination. AudioContext is created
  **only** inside `unlock()` (bus `input:first` from index.html's 11B stub, re-uses `window.lumenAudioCtx`). In Node (no AudioContext) every
  call is inert but still counted in `state.played` → the whole map is testable headless. Lazy `fetch`+`decodeAudioData` per id; 404/decode
  error → `state.missing`, logged once, synth plays instead. **Procedural fallback**: `synthSfx` 11 sketch types (coin blip tick pop thud whoosh
  chime buzz fanfare sad default) from `manifest.synth {type,f,dur}`; `synthMusic` = 3-voice triangle pad over `chords` at `bpm` (looping).
  Music queued before unlock plays on unlock (`pendingMusic`). `fetchFiles:false` in the manifest skips fetching entirely (no 404 console noise
  while no .ogg exists yet).
- **P1.3 bus map** `DEFAULT_EVENTS` (39 bus events → 33 sfx ids, 6 music ids), per-event **cooldown** (10 Hz `eco:spark` → ≤ 4 plays/s),
  `pick(payload)` variants (scamResult accepted→`scam_fell`, ability name→magnet/shield/stomp/flash/shout/sweep, cust react happy/grumble,
  ui:build action), `music:` swaps (title / island_day / island_endless / victory / fog_lose), `duck:` flags (dialogue / ledger / pause open-close).
  Manifest `events` block overrides any entry. `ui:settings {key:sfx|music}` → volumes.
- **P1.4 `audio/manifest.json`** 33 sfx (file + vol + pitchVar + synth) · 6 music (file + loop + synth chords) · `index.html` creates the
  audio on `game.bus` with 7C `ui.pause.settings` volumes, loads the manifest, queues title music, `?mute`. `window.audio` for QA.
- **P1.5 `check.mjs --audio`**: manifest ↔ event-map id cross-check (all referenced sfx/music exist, every sfx has a synth) · 15 core events →
  15 counted plays · variants · cooldown 50 ticks/0.1 s → 1 play · music follows start/lose/title · duck on/off · ui:settings → volume ·
  unknown id → false + logged once · destroy → 0 listeners. `api._now` = injectable clock.
- **P2 `docs/audio_prompts.md`**: 33 SFX + 7 optional ambience + 6 music prompts (id · length · loop · mood · prompt, export spec OGG mono
  44.1 kHz −3 dBFS) + the trigger table (event → id → cooldown).
- **P3** pitch variance per play (`pitchVar` ±2–15 %) · ducking to 35 % under dialogue / ledger / pause, 200 ms ramps · 80 ms volume ramps.
- **demo_audio.html**: tap gate → `input:first`; button per sfx (green ring = real file decoded, plain = synth) and music id; 22 bus-event
  buttons with THROTTLED readout; sliders; duck; stop; keys 1–0 / M; stats line shows ctx state + current music.

## Missing
- No real audio files yet (by design — the jam build ships on the synth fallback). When Ludo.ai files land: drop into `audio/sfx/`,
  `audio/music/`, set `"fetchFiles": true`. Optional ambience ids (water_lap, seagull, wind_chime, fog_breath, footsteps) are not in the
  manifest/map — 13A or a later pass can add `cust:spawn`/hero-step hooks.
- `ledger` music id exists but is not mapped (ducking the island theme under the ledger reads better than a swap); map it in `events` if wanted.

## Measured
- demo_audio.html: 23 draw calls, 30 meshes (island only) · `index.html?autoplay` with audio wired: **121–133 dc**, ERRORS none.
- Audio nodes at rest: 3 GainNodes; per synth sfx 1–4 oscillators ≤ 1.4 s; synth music 3 oscillators + 1 filter + 1 gain, constant.
- check.mjs full suite incl. `--audio --game`: ALL OK.

## Suspected
- `synthMusic` uses `setTimeout` for chord steps → a background tab drifts (fine: the whole game loop also pauses). A real .ogg loop has no timer.

## Notes for the integrator (13A / 14)
- Nothing to wire: `index.html` already does it. Flutter WebView (14): the unlock is the first `pointerdown/touchend/keydown` — a WebView
  that autoplays without a gesture needs `mediaPlaybackRequiresUserGesture=false`, otherwise music simply starts at the first tap.
- Add a sound to a new event: one line in `DEFAULT_EVENTS` (or `manifest.events`) + an id in `manifest.sfx` with a `synth` sketch.
