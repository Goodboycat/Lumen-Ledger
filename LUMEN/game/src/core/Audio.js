// Chat 12 — Audio: WebAudio loader + procedural fallback + bus→SFX map. No build step, no deps.
//   import { createAudio } from './src/core/Audio.js'
//   const audio = createAudio({ bus: game.bus, settings: ui.pause.settings });   // inert until the first gesture (bus 'input:first' from index.html)
//   await audio.load('./audio/manifest.json');       // or a manifest object; missing/404 files → synth fallback (never throws)
//   audio.play('coin', { vol: 0.8, pitch: 1.1 });   audio.music('island_day');   audio.setVolume({ sfx: 0.8, music: 0.6 });
// Rules: AudioContext is created/resumed ONLY inside audio.unlock() (first user gesture — iOS). In Node (check.mjs) there is no
// AudioContext → every call is a no-op that still records to audio.state (played counts), so the bus map is testable headless.
// Manifest shape (audio/manifest.json):
//   { "sfx": { "coin": { "file": "sfx/coin.ogg", "vol": 0.9, "pitchVar": 0.06, "synth": { "type": "coin", "f": 1320, "dur": 0.18 } }, … },
//     "music": { "island_day": { "file": "music/island_day.ogg", "vol": 0.6, "loop": true, "synth": { "chords": [[0,4,7],[5,9,12],[7,11,14],[0,4,7]], "bpm": 72 } } },
//     "events": { "eco:sale": { "sfx": "coin", "cooldown": 0.08 }, … } }

const AC = typeof window !== 'undefined' ? (window.AudioContext || window.webkitAudioContext) : undefined;

export const DEFAULT_VOLUMES = { sfx: 0.8, music: 0.6 };

export function createAudio(opts = {}) {
  const bus = opts.bus;
  const state = {
    unlocked: false, silent: !AC, ctx: null, manifest: null, buffers: new Map(), missing: new Set(),
    volumes: { sfx: +(opts.settings?.sfx ?? DEFAULT_VOLUMES.sfx), music: +(opts.settings?.music ?? DEFAULT_VOLUMES.music) },
    played: {}, lastPlay: {}, currentMusic: null, musicNode: null, ducked: false, log: [],
  };
  const offs = [];
  let sfxGain = null, musicGain = null, musicDuck = null;

  const now = () => (state.ctx ? state.ctx.currentTime : (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000));
  const def = (kind, id) => state.manifest?.[kind]?.[id] || null;

  function ensureGraph() {
    if (!state.ctx || sfxGain) return;
    sfxGain = state.ctx.createGain(); musicGain = state.ctx.createGain(); musicDuck = state.ctx.createGain();
    sfxGain.gain.value = state.volumes.sfx; musicGain.gain.value = state.volumes.music; musicDuck.gain.value = 1;
    sfxGain.connect(state.ctx.destination); musicGain.connect(musicDuck); musicDuck.connect(state.ctx.destination);
  }

  const api = {
    state,
    /** create / resume the AudioContext — call ONLY from a user gesture (index.html emits bus 'input:first'). */
    unlock() {
      if (!AC) return false;
      if (!state.ctx) { try { state.ctx = window.lumenAudioCtx || new AC(); window.lumenAudioCtx = state.ctx; } catch { state.silent = true; return false; } }
      if (state.ctx.state === 'suspended') state.ctx.resume().catch(() => {});
      ensureGraph(); state.unlocked = true;
      if (state.pendingMusic) { const m = state.pendingMusic; state.pendingMusic = null; api.music(m); }
      return true;
    },
    /** load a manifest (object or URL). Decodes every file it can; failures are recorded in state.missing (synth fallback). Never throws. */
    async load(manifest) { state.manifest = typeof manifest === 'string' ? await fetchJson(manifest, state) : (manifest || {}); if (bus) wireBus(); return api; },
    play(id, o = {}) { return playSfx(id, o); },
    music(id) { return playMusic(id); },
    stopMusic(fade = 0.4) { return stopMusic(fade); },
    setVolume(v = {}) {
      if (Number.isFinite(+v.sfx)) state.volumes.sfx = clamp01(+v.sfx);
      if (Number.isFinite(+v.music)) state.volumes.music = clamp01(+v.music);
      if (sfxGain) ramp(sfxGain.gain, state.volumes.sfx, 0.08); if (musicGain) ramp(musicGain.gain, state.volumes.music, 0.08);
      return api;
    },
    duck(on) { state.ducked = !!on; if (musicDuck) ramp(musicDuck.gain, on ? 0.35 : 1, 0.2); return api; },
    destroy() { for (const off of offs) off(); offs.length = 0; stopMusic(0); if (state.ctx && state.ctx !== window.lumenAudioCtx) state.ctx.close?.(); },
  };

  // ---- filled in below (P1.1 loader · P1.2 synth · P1.3 bus map) ----
  function playSfx(id, o) { const d = def('sfx', id); state.played[id] = (state.played[id] || 0) + 1; state.lastPlay[id] = now(); if (!d) state.log.push(`unknown sfx ${id}`); return !!d; }
  function playMusic(id) { state.currentMusic = id; return !!def('music', id); }
  function stopMusic() { state.currentMusic = null; }
  function wireBus() {}

  return api;
}

async function fetchJson(url, state) {
  try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { state.log.push(`manifest ${url} failed: ${e.message || e}`); return {}; }
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function ramp(param, to, sec) { try { const t = param.context ? param.context.currentTime : 0; param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(to, t + sec); } catch { param.value = to; } }
