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

// The 15 core events (+ a few UI ones) → SFX ids in audio/manifest.json. The manifest "events" block can override any entry.
// `pick(payload)` returns a variant rule for payload-dependent sounds. Cooldowns stop 10 Hz ticks from machine-gunning.
export const DEFAULT_EVENTS = {
  'eco:sale':          { sfx: 'coin',        cooldown: 0.08 },
  'eco:spark':         { sfx: 'spark_tick',  cooldown: 0.25, vol: 0.5 },
  'eco:denied':        { sfx: 'deny',        cooldown: 0.3 },
  'build:denied':      { sfx: 'deny',        cooldown: 0.3 },
  'sandbox:denied':    { sfx: 'deny',        cooldown: 0.3 },
  'ui:build':          { sfx: 'click',       cooldown: 0.1, vol: 0.5, pick: (p) => p?.action === 'denied' ? { sfx: 'deny' } : p?.action === 'select' ? { sfx: 'click' } : { sfx: null } },
  'build:enter':       { sfx: 'pick_up',     cooldown: 0.2 },
  'build:placed':      { sfx: 'hammer',      cooldown: 0.12 },
  'build:removed':     { sfx: 'crumble',     cooldown: 0.2 },
  'build:upgraded':    { sfx: 'level_up',    cooldown: 0.3 },
  'ui:build:open':     { sfx: 'tray_open',   cooldown: 0.2 },
  'ui:build:close':    { sfx: 'tray_close',  cooldown: 0.2 },
  'eco:season':        { sfx: 'season_bell', cooldown: 1 },
  'eco:loan':          { sfx: 'loan_stamp',  cooldown: 0.3 },
  'eco:jar':           { sfx: 'jar_fill',    cooldown: 0.15 },
  'ui:jar:apply':      { sfx: 'jar_apply',   cooldown: 0.3 },
  'eco:scam':          { sfx: 'scam_sting',  cooldown: 1 },
  'eco:scamResult':    { sfx: 'scam_refuse', cooldown: 1, pick: (p) => p?.accepted ? { sfx: 'scam_fell' } : null },
  'eco:upgrade':       { sfx: 'level_up',    cooldown: 0.3 },
  'eco:win':           { sfx: 'fanfare',     cooldown: 2, music: 'victory' },
  'eco:lose':          { sfx: 'lose_sting',  cooldown: 2, music: 'fog_lose' },
  'story:line':        { sfx: 'dlg_blip',    cooldown: 0.12, vol: 0.6 },
  'story:toast':       { sfx: 'toast',       cooldown: 0.4, vol: 0.6 },
  'ui:choice':         { sfx: 'click',       cooldown: 0.1 },
  'ui:continue':       { sfx: 'click',       cooldown: 0.1 },
  'ui:ledger:open':    { sfx: 'ledger_open', cooldown: 0.5, duck: true },
  'ui:ledger:close':   { duck: false },
  'ui:dialogue:open':  { duck: true },
  'ui:dialogue:close': { duck: false },
  'ui:pause:open':     { sfx: 'tray_open',   cooldown: 0.2, duck: true },
  'ui:pause:close':    { sfx: 'tray_close',  cooldown: 0.2, duck: false },
  'ui:title:open':     { music: 'title' },
  'game:start':        { sfx: 'start',       cooldown: 1, music: 'island_day' },
  'game:endless':      { music: 'island_endless' },
  'sandbox:ability':   { sfx: 'ability',     cooldown: 0.2, pick: (p) => ({ sfx: ABILITY_SFX[p?.name] || 'ability' }) },
  'sandbox:hired':     { sfx: 'hire',        cooldown: 0.5 },
  'sandbox:tip':       { sfx: 'coin',        cooldown: 0.1, vol: 0.5, pitch: 1.3 },
  'cust:state':        { sfx: 'cust_happy',  cooldown: 0.25, vol: 0.5, pick: (p) => p?.state !== 'react' ? { sfx: null } : p?.reaction === 'happy' ? { sfx: 'cust_happy' } : { sfx: 'cust_grumble' } },
  'ui:touch':          { sfx: 'click',       cooldown: 0.08, vol: 0.4 },
};
const ABILITY_SFX = { coinMagnetDash: 'magnet', bubbleShield: 'shield', growthStomp: 'stomp', ledgerFlash: 'flash', haggleShout: 'shout', fogSweep: 'sweep' };

export function createAudio(opts = {}) {
  const bus = opts.bus;
  const state = {
    unlocked: false, silent: !AC, ctx: null, manifest: null, buffers: new Map(), missing: new Set(),
    volumes: { sfx: +(opts.settings?.sfx ?? DEFAULT_VOLUMES.sfx), music: +(opts.settings?.music ?? DEFAULT_VOLUMES.music) },
    played: {}, lastPlay: {}, currentMusic: null, musicNode: null, ducked: false, log: [],
  };
  const offs = [];
  let sfxGain = null, musicGain = null, musicDuck = null;

  // seconds clock for cooldowns: AudioContext time when live, wall clock when inert; `api._now` can override it (check.mjs drives cooldowns deterministically)
  const now = () => (api._now ? api._now() : state.ctx ? state.ctx.currentTime : (typeof performance !== 'undefined' ? performance.now() / 1000 : Date.now() / 1000));
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
    destroy() { for (const off of offs) off(); offs.length = 0; stopMusic(0); if (state.ctx && typeof window !== 'undefined' && state.ctx !== window.lumenAudioCtx) state.ctx.close?.(); },
    _now: null,
  };

  // ---- P1.1 loader: decode a file on first use (lazy — the jam build has few/no files, synth covers the rest) ----
  const base = () => (state.manifest?.base ?? './audio/');
  // manifest.fetchFiles === false → never fetch (no 404 console noise while the Ludo.ai files do not exist yet); synth only.
  const fetchOK = () => state.manifest?.fetchFiles !== false;
  async function buffer(kind, id) {
    const d = def(kind, id); if (!d || !d.file || !state.ctx || state.missing.has(id) || !fetchOK()) return null;
    if (state.buffers.has(id)) return state.buffers.get(id);
    const p = (async () => {
      try { const r = await fetch(base() + d.file); if (!r.ok) throw new Error('HTTP ' + r.status); return await state.ctx.decodeAudioData(await r.arrayBuffer()); }
      catch (e) { state.missing.add(id); state.buffers.delete(id); if (!state.log.includes(`missing ${id}`)) state.log.push(`missing ${id}`); return null; }
    })();
    state.buffers.set(id, p); const b = await p; if (b) state.buffers.set(id, b); return b;
  }
  /** preload every manifest file (optional; play() loads lazily anyway). Resolves when all attempts finished. */
  api.preload = async () => { if (!state.ctx) return api; const ids = []; for (const k of ['sfx', 'music']) for (const id of Object.keys(state.manifest?.[k] || {})) ids.push(buffer(k, id)); await Promise.all(ids); return api; };

  // ---- play ----
  function playSfx(id, o) {
    const d = def('sfx', id); state.played[id] = (state.played[id] || 0) + 1; state.lastPlay[id] = now();
    if (!d) { if (!state.log.includes(`unknown sfx ${id}`)) state.log.push(`unknown sfx ${id}`); return false; }
    if (!state.ctx || !state.unlocked || state.volumes.sfx <= 0) return true;                     // inert (Node / before gesture / muted) but counted
    const vol = clamp01((o.vol ?? 1) * (d.vol ?? 1));
    const pv = d.pitchVar ?? 0; const pitch = (o.pitch ?? 1) * (pv ? 1 + (Math.random() * 2 - 1) * pv : 1);
    const b = state.buffers.get(id);
    if (b && !(b instanceof Promise)) { const s = state.ctx.createBufferSource(); s.buffer = b; s.playbackRate.value = pitch; const g = state.ctx.createGain(); g.gain.value = vol; s.connect(g); g.connect(sfxGain); s.start(); return true; }
    if (d.file && !state.missing.has(id) && !b && fetchOK()) buffer('sfx', id);                   // kick off decode for next time; synth now
    if (d.synth) synthSfx(state.ctx, sfxGain, d.synth, vol, pitch);
    return true;
  }
  function playMusic(id) {
    if (id === state.currentMusic && state.musicNode) return true;
    const d = def('music', id); if (!d) { state.currentMusic = null; return false; }
    state.currentMusic = id; if (!state.ctx || !state.unlocked) { state.pendingMusic = id; return true; }
    stopMusic(0.5);
    const start = (node) => { state.musicNode = node; };
    buffer('music', id).then((b) => {
      if (state.currentMusic !== id) return;
      if (b) { const s = state.ctx.createBufferSource(); s.buffer = b; s.loop = d.loop !== false; const g = state.ctx.createGain(); g.gain.value = d.vol ?? 1; s.connect(g); g.connect(musicGain); s.start(); start({ stop: () => { try { s.stop(); } catch {} }, gain: g }); }
      else if (d.synth) start(synthMusic(state.ctx, musicGain, d.synth, d.vol ?? 0.5));
    });
    return true;
  }
  function stopMusic(fade = 0.4) {
    const n = state.musicNode; state.musicNode = null; state.currentMusic = state.currentMusic && fade === 0 ? null : state.currentMusic;
    if (!n) return; if (fade > 0 && n.gain) { ramp(n.gain.gain, 0, fade); setTimeout(() => n.stop(), fade * 1000 + 50); } else n.stop();
  }
  // ---- P1.3 bus → SFX map. Manifest "events": { "<bus event>": { sfx | music | duck | fn, cooldown, vol, when: "<payload key>" } } merged over DEFAULT_EVENTS ----
  function wireBus() {
    for (const off of offs) off(); offs.length = 0;
    const events = { ...DEFAULT_EVENTS, ...(state.manifest?.events || {}) };
    offs.push(bus.on('input:first', () => api.unlock()));
    offs.push(bus.on('ui:settings', (p) => { if (p?.key === 'sfx' || p?.key === 'music') api.setVolume({ [p.key]: p.value }); }));
    for (const [ev, rule] of Object.entries(events)) {
      if (!rule) continue;
      offs.push(bus.on(ev, (payload) => {
        const r = typeof rule.pick === 'function' ? rule.pick(payload) || rule : rule;        // per-payload variant (e.g. win vs lose ledger)
        if (r.duck !== undefined) api.duck(!!r.duck);
        if (r.music !== undefined) { if (r.music) api.music(r.music); else api.stopMusic(); }
        if (!r.sfx) return;
        const cd = r.cooldown ?? 0.05, last = state.lastFire[ev] ?? -1e9, t = now();
        if (t - last < cd) { state.throttled = (state.throttled || 0) + 1; return; }
        state.lastFire[ev] = t; state.fired[ev] = (state.fired[ev] || 0) + 1;
        api.play(r.sfx, { vol: r.vol, pitch: r.pitch });
      }));
    }
    state.wired = Object.keys(events).length;
  }
  state.lastFire = {}; state.fired = {};

  return api;
}

async function fetchJson(url, state) {
  try { const r = await fetch(url); if (!r.ok) throw new Error(r.status); return await r.json(); }
  catch (e) { state.log.push(`manifest ${url} failed: ${e.message || e}`); return {}; }
}
// ---- P1.2 procedural fallback — tiny oscillator sketches so the build is never silent when a Ludo.ai file is missing ----
// synth: { type: 'coin'|'blip'|'thud'|'whoosh'|'chime'|'buzz'|'fanfare'|'sad'|'pop'|'tick', f (Hz), dur (s) }
export function synthSfx(ctx, out, s, vol = 1, pitch = 1) {
  const t0 = ctx.currentTime, f = (s.f || 440) * pitch, dur = s.dur || 0.2;
  const osc = (type, freq, t, d, v, slideTo) => {
    const o = ctx.createOscillator(), g = ctx.createGain(); o.type = type; o.frequency.setValueAtTime(freq, t);
    if (slideTo) o.frequency.exponentialRampToValueAtTime(Math.max(20, slideTo), t + d);
    g.gain.setValueAtTime(0.0001, t); g.gain.exponentialRampToValueAtTime(Math.max(0.0002, v * vol), t + 0.008); g.gain.exponentialRampToValueAtTime(0.0001, t + d);
    o.connect(g); g.connect(out); o.start(t); o.stop(t + d + 0.02);
  };
  const noise = (t, d, v, hp = 800) => {
    const n = ctx.sampleRate * d, b = ctx.createBuffer(1, Math.max(1, n | 0), ctx.sampleRate), ch = b.getChannelData(0);
    for (let i = 0; i < ch.length; i++) ch[i] = (Math.random() * 2 - 1) * (1 - i / ch.length);
    const src = ctx.createBufferSource(); src.buffer = b; const fl = ctx.createBiquadFilter(); fl.type = 'highpass'; fl.frequency.value = hp;
    const g = ctx.createGain(); g.gain.setValueAtTime(v * vol, t); g.gain.exponentialRampToValueAtTime(0.0001, t + d); src.connect(fl); fl.connect(g); g.connect(out); src.start(t); src.stop(t + d + 0.02);
  };
  switch (s.type) {
    case 'coin':    osc('square', f, t0, dur * 0.45, 0.25); osc('square', f * 1.5, t0 + dur * 0.3, dur * 0.7, 0.25); break;
    case 'blip':    osc('sine', f, t0, dur, 0.3, f * 1.25); break;
    case 'tick':    osc('triangle', f, t0, Math.min(dur, 0.06), 0.2); break;
    case 'pop':     osc('sine', f, t0, dur, 0.35, f * 0.5); break;
    case 'thud':    osc('sine', f, t0, dur, 0.6, f * 0.4); noise(t0, dur * 0.5, 0.15, 200); break;
    case 'whoosh':  noise(t0, dur, 0.3, 400); break;
    case 'chime':   [1, 1.5, 2].forEach((m, i) => osc('sine', f * m, t0 + i * 0.07, dur, 0.22)); break;
    case 'buzz':    osc('sawtooth', f, t0, dur, 0.18, f * 0.9); break;
    case 'fanfare': [1, 1.25, 1.5, 2].forEach((m, i) => osc('square', f * m, t0 + i * 0.11, dur * 0.6, 0.18)); break;
    case 'sad':     [1, 0.84, 0.75].forEach((m, i) => osc('triangle', f * m, t0 + i * 0.18, dur * 0.8, 0.25)); break;
    default:        osc('sine', f, t0, dur, 0.3); break;
  }
}
// music fallback: slow pad loop over `chords` (semitone offsets from `root` Hz), `bpm` beats per chord. Returns { stop(), gain }.
export function synthMusic(ctx, out, s, vol = 0.5) {
  const root = s.root || 220, chords = s.chords || [[0, 4, 7], [5, 9, 12], [7, 11, 14], [0, 4, 7]], beat = 60 / (s.bpm || 72) * 4;
  const gain = ctx.createGain(); gain.gain.value = 0; gain.connect(out); ramp(gain.gain, vol, 1.2);
  const lp = ctx.createBiquadFilter(); lp.type = 'lowpass'; lp.frequency.value = 900; lp.connect(gain);
  const voices = [0, 1, 2].map(() => { const o = ctx.createOscillator(), g = ctx.createGain(); o.type = 'triangle'; g.gain.value = 0.25; o.connect(g); g.connect(lp); o.start(); return { o, g }; });
  let i = 0, alive = true;
  const step = () => { if (!alive) return; const c = chords[i % chords.length]; const t = ctx.currentTime; voices.forEach((v, k) => v.o.frequency.setTargetAtTime(root * Math.pow(2, (c[k] ?? c[0]) / 12), t, 0.25)); i++; timer = setTimeout(step, beat * 1000); };
  let timer = null; step();
  return { gain: { gain: gain.gain }, stop: () => { alive = false; clearTimeout(timer); voices.forEach((v) => { try { v.o.stop(); } catch {} }); try { gain.disconnect(); } catch {} } };
}
const clamp01 = (x) => Math.min(1, Math.max(0, x));
function ramp(param, to, sec) { try { const t = param.context ? param.context.currentTime : 0; param.cancelScheduledValues(t); param.setValueAtTime(param.value, t); param.linearRampToValueAtTime(to, t + sec); } catch { param.value = to; } }
