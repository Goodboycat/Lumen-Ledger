// tools/vclock.js — deterministic virtual clock for frame-exact video capture (injected by tools/record_video.mjs via
// page.addInitScript, never shipped in the game). Until __vc.freeze() the page runs on real time. After freeze():
//   performance.now / Date.now / requestAnimationFrame / setTimeout / setInterval follow a virtual clock that only moves
//   when the harness calls __vc.step(ms) — so a 2-minute 60 fps video is exactly 7200 game frames no matter how slow
//   swiftshader renders. CSS / WAAPI animations are paused and scrubbed to virtual time every step.
// Audio: window.__vc.audioLog collects { t, kind, id, ... } (virtual ms) — tools/mix_audio.py renders the soundtrack offline.
(() => {
  const R = { now: performance.now.bind(performance), dnow: Date.now, raf: window.requestAnimationFrame.bind(window), caf: window.cancelAnimationFrame.bind(window),
    st: window.setTimeout.bind(window), ct: window.clearTimeout.bind(window), si: window.setInterval.bind(window), ci: window.clearInterval.bind(window) };
  const dateBase = R.dnow() - R.now();
  // seeded Math.random (mulberry32) → the same script gives the same game, so a fast dry run (render stubbed) predicts the real one
  const seed = +(new URLSearchParams(location.search).get('vcseed') || 12345);
  let a32 = seed >>> 0;
  Math.random = () => { a32 = (a32 + 0x6D2B79F5) >>> 0; let t = a32; t = Math.imul(t ^ (t >>> 15), t | 1); t ^= t + Math.imul(t ^ (t >>> 7), t | 61); return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
  const vc = { frozen: false, t: 0, frame: 0, audioLog: [], timers: new Map(), rafs: new Map(), nextId: 1e6, anims: new WeakMap() };
  window.__vc = vc;
  const now = () => (vc.frozen ? vc.t : R.now());
  performance.now = now;
  Date.now = () => Math.floor(dateBase + now());

  window.requestAnimationFrame = (cb) => { if (!vc.frozen) return R.raf(cb); const id = vc.nextId++; vc.rafs.set(id, cb); return id; };
  window.cancelAnimationFrame = (id) => { if (vc.rafs.delete(id)) return; R.caf(id); };
  const addTimer = (cb, ms, args, every) => { const id = vc.nextId++; vc.timers.set(id, { cb, args, due: vc.t + Math.max(0, +ms || 0), every: every ? Math.max(1, +ms || 0) : 0, seq: id }); return id; };
  window.setTimeout = (cb, ms, ...a) => (vc.frozen && typeof cb === 'function' ? addTimer(cb, ms, a, false) : R.st(cb, ms, ...a));
  window.setInterval = (cb, ms, ...a) => (vc.frozen && typeof cb === 'function' ? addTimer(cb, ms, a, true) : R.si(cb, ms, ...a));
  window.clearTimeout = (id) => { if (!vc.timers.delete(id)) R.ct(id); };
  window.clearInterval = (id) => { if (!vc.timers.delete(id)) R.ci(id); };

  vc.freeze = () => { if (!vc.frozen) { vc.t = R.now(); vc.frozen = true; } return vc.t; };
  const scrubAnimations = () => {
    if (!document.getAnimations) return;
    for (const a of document.getAnimations()) {
      let s = vc.anims.get(a);
      if (s === undefined) { s = vc.t - (a.currentTime || 0); vc.anims.set(a, s); try { a.pause(); } catch {} }
      try { if (a.playState !== 'paused') a.pause(); a.currentTime = Math.max(0, vc.t - s); } catch {}
    }
  };
  /** advance virtual time by ms: fire due timers (in order), then one rAF batch, then scrub CSS animations. */
  vc.step = (ms = 1000 / 60) => {
    const target = vc.t + ms;
    for (let guard = 0; guard < 5000; guard++) {
      let best = null;
      for (const [id, tm] of vc.timers) if (tm.due <= target && (!best || tm.due < best[1].due || (tm.due === best[1].due && tm.seq < best[1].seq))) best = [id, tm];
      if (!best) break;
      const [id, tm] = best; vc.t = Math.max(vc.t, tm.due);
      if (tm.every) { tm.due += tm.every; tm.seq = vc.nextId++; } else vc.timers.delete(id);
      try { tm.cb(...(tm.args || [])); } catch (e) { console.error(e); }
    }
    vc.t = target; vc.frame++;
    const batch = [...vc.rafs.values()]; vc.rafs.clear();
    for (const cb of batch) { try { cb(vc.t); } catch (e) { console.error(e); } }
    scrubAnimations();
    return vc.t;
  };

  // audio tap: wrap window.audio's public API as soon as index.html assigns it (logs every call with virtual time)
  let _audio;
  Object.defineProperty(window, 'audio', { configurable: true, get: () => _audio, set: (a) => {
    _audio = a;
    if (!a || a.__vcTapped) return; a.__vcTapped = true;
    const log = (e) => { const st = a.state; vc.audioLog.push({ t: +now().toFixed(1), vol: st ? { ...st.volumes } : null, ducked: !!st?.ducked, ...e }); };
    const play = a.play, music = a.music, stop = a.stopMusic, duck = a.duck, setVol = a.setVolume;
    a.play = (id, o = {}) => { log({ kind: 'sfx', id, v: o.vol ?? 1, p: o.pitch ?? 1 }); return play(id, o); };
    a.music = (id) => { if (id !== a.state.currentMusic || !a.state.musicNode) log({ kind: 'music', id }); return music(id); };
    a.stopMusic = (f = 0.4) => { log({ kind: 'stop', fade: f }); return stop(f); };
    a.duck = (on) => { log({ kind: 'duck', on: !!on }); return duck(on); };
    a.setVolume = (v = {}) => { const r = setVol(v); log({ kind: 'vol' }); return r; };
  } });
})();
