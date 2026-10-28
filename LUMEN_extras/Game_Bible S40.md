# LUMEN — Lumen Ledger · Game Bible S40 (2026-10-28)

Previous: `Game_Bible S39.md` (everything there still applies; this file only lists what S40 changed).
Version strings: `GAME_VERSION = 'S40'` (src/Game.js) · `UI_VERSION = 'S40'` (ui/index.js) → shown in the title-menu footer.

## S40 — low-fps protection removed (user request: 2-minute gameplay capture)

**Problem.** While screen-recording, fps drops. The S02 "every phone runs at 60 fps" ladder (PixelRatioGovernor in
`src/systems/perf.js`) then dropped the pixel ratio (1.5 → 0.85 → 0.7) and demoted the Quality preset
high → medium → low, overwriting the player's Settings choice. The low preset stuck (presets were never re-promoted), and
under the same load the browser could suspend the AudioContext → music + sfx fell silent.

**Changes.**
1. `src/Game.js`
   - `PixelRatioGovernor` is no longer imported/instantiated in `installPerf`; `updatePerf` no longer ticks it. `sb.perf.governor` stays
     `null` (the F3 debug line already falls back to `renderer.getPixelRatio()`).
   - The `perf:quality` listener (mirror demotion into Settings + toast "Graphics set to … to keep 60 fps") is deleted.
   - Result: **Quality is exactly what the player picks in ⏸ Settings** (default `medium`, persisted in `localStorage lumen.settings`)
     and is applied on boot via `applyQuality`. Nothing moves it automatically — medium/high stay locked.
   - `GAME_VERSION = 'S40'`.
2. `src/core/Audio.js` — **AudioContext resume watchdog** (`api.keepAlive`, `state.resumes`): every 1 s and on
   visibilitychange / focus / pointerdown / keydown / touchstart, if `ctx.state !== 'running'` → `ctx.resume()`. Music / ambience
   loops are plain Web Audio nodes so they continue. Headless-safe (no window → no timers).
3. `ui/pause.js` — Quality hint now reads "low = no shadows, sharper = more pixels · stays where you set it".
4. `ui/index.js` — `UI_VERSION = 'S40'`. `LUMEN/game/README.md` perf paragraph updated.

**Kept (not perf-protection, still useful):** BlobShadows (1 InstancedMesh), CreatureLOD (distance tiers), `maxDt = 1/10` clamp.
The `PixelRatioGovernor` class itself still lives in `src/systems/perf.js` only because `tools/check.mjs --perf` unit-tests it; it is
dead code at runtime. Safe to delete class + tests in a later pass if wanted.

**Verification.** `node tools/check.mjs --perf` → ALL OK ✅ (no browser run; credits saved per instruction).

## Capture tips
- `?mute` still silences audio for trailer capture; without it, music/sfx now keep playing under low fps.
- `?debug` / F3 shows fps · calls · dpr — dpr should stay constant for the whole recording.

## Next chat
- Optional: delete `PixelRatioGovernor` + its check.mjs cases (dead code).
- Optional: expose a "Lock 60 fps / performance mode" toggle only if a user explicitly asks — do NOT re-add auto-demotion.
