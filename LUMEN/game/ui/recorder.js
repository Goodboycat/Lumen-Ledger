// LUMEN — invisible gameplay recorder (QA / trailer). No UI, no DOM nodes, no cost when off.
//   ?rec                 → starts recording as soon as the game boots
//   Ctrl+Shift+F9        → toggle start / pause (resume keeps the same session)
//   window.lumenRec.start() / .pause() / .resume() / .stop() → Promise<{ video: Blob|null, log: object }>
//   window.lumenRec.save(name?)   → stops and downloads <name>.webm + <name>.json (browser), returns the same object
//   window.lumenRec.dump()        → Promise<{ videoB64, log }>  (headless harness writes them to disk; no download dialog)
// What is recorded:
//   • the WebGL canvas via canvas.captureStream + MediaRecorder (webm/vp8 or vp9) — world only, DOM overlays are not in the canvas
//   • a timeline JSON: every bus event (name + small payload summary), periodic state samples (season, spark, debt, fog, state, fps)
//     and key/pointer input — enough to replay what happened and to file bugs with timestamps.
// Pausing stops both the video and the log (MediaRecorder.pause) so a menu/tutorial skip does not bloat the file.

const MAX_EVENTS = 20000;
const SKIP = new Set(['eco:tick']);            // per-frame noise; covered by samples

function summarize(p) {
  if (p == null || typeof p !== 'object') return p;
  const o = {};
  let n = 0;
  for (const k of Object.keys(p)) {
    if (n++ > 8) break;
    const v = p[k];
    if (v == null || typeof v === 'number' || typeof v === 'boolean') o[k] = v;
    else if (typeof v === 'string') o[k] = v.length > 80 ? v.slice(0, 80) + '…' : v;
    else if (v.isVector3) o[k] = [+v.x.toFixed(2), +v.z.toFixed(2)];
  }
  return o;
}

export function installRecorder({ game, bus, lg, canvas, autostart = false, fps = 12 } = {}) {
  const rec = { state: 'idle', events: [], samples: [], chunks: [], startedAt: 0, activeMs: 0, _resumedAt: 0, mime: '', errors: [] };
  let mr = null, sampleT = 0, origEmit = null;
  const now = () => performance.now();
  const t = () => Math.round(rec.activeMs + (rec.state === 'recording' ? now() - rec._resumedAt : 0));
  const push = (e) => { if (rec.state !== 'recording' || rec.events.length >= MAX_EVENTS) return; e.t = t(); rec.events.push(e); };

  // bus tap (wrapped once; wrapper is a no-op unless recording)
  if (bus && !bus.__recTapped) {
    origEmit = bus.emit.bind(bus);
    bus.emit = (name, payload) => { if (rec.state === 'recording' && !SKIP.has(name)) { try { push({ k: 'ev', n: name, p: summarize(payload) }); } catch (_) { /* never break the game */ } } return origEmit(name, payload); };
    bus.__recTapped = true;
  }
  const onKey = (e) => { if (e.ctrlKey && e.shiftKey && e.code === 'F9') { e.preventDefault(); rec.state === 'recording' ? rec.pause() : (rec.state === 'paused' ? rec.resume() : rec.start()); return; } if (!e.repeat) push({ k: e.type === 'keydown' ? 'kd' : 'ku', c: e.code }); };
  const onPtr = (e) => push({ k: 'pd', x: Math.round(e.clientX), y: Math.round(e.clientY), tg: (e.target?.id || e.target?.className || e.target?.tagName || '').toString().slice(0, 40) });
  window.addEventListener('keydown', onKey, true); window.addEventListener('keyup', onKey, true); window.addEventListener('pointerdown', onPtr, true);

  // state sampler (1 Hz, game loop system so it follows real frames)
  const sampler = { update: (_dt, g, dtReal) => {
    if (rec.state !== 'recording') return; sampleT += dtReal || 0; if (sampleT < 1) return; sampleT = 0;
    const e = lg?.sb?.eco?.state;
    rec.samples.push({ t: t(), st: lg?.state, fps: g.stats.fps, paused: !!g.paused, ...(e ? { S: e.season, d: +(e.day01 || 0).toFixed(2), spark: Math.round(e.spark), debt: Math.round(e.debt || 0), fog: +(e.fog01 || 0).toFixed(2), jars: e.jars ? { ...e.jars } : null } : {}) });
  } };
  game?.add?.(sampler);

  function makeMR() {
    if (!canvas?.captureStream || typeof MediaRecorder === 'undefined') { rec.errors.push('MediaRecorder/captureStream unavailable → log only'); return null; }
    const types = ['video/webm;codecs=vp9', 'video/webm;codecs=vp8', 'video/webm'];
    rec.mime = types.find((m) => MediaRecorder.isTypeSupported?.(m)) || '';
    try {
      const m = new MediaRecorder(canvas.captureStream(fps), rec.mime ? { mimeType: rec.mime, videoBitsPerSecond: 1_500_000 } : undefined);
      m.ondataavailable = (ev) => { if (ev.data && ev.data.size) rec.chunks.push(ev.data); };
      m.onerror = (ev) => rec.errors.push(String(ev.error || ev));
      return m;
    } catch (err) { rec.errors.push('MediaRecorder: ' + err); return null; }
  }

  rec.start = () => {
    if (rec.state === 'recording') return rec;
    if (rec.state === 'paused') return rec.resume();
    rec.events = []; rec.samples = []; rec.chunks = []; rec.activeMs = 0; rec.startedAt = Date.now();
    mr = makeMR(); try { mr?.start(1000); } catch (err) { rec.errors.push('start: ' + err); mr = null; }
    rec._resumedAt = now(); rec.state = 'recording'; push({ k: 'rec', a: 'start', ua: navigator.userAgent.slice(0, 60) });
    return rec;
  };
  rec.pause = () => { if (rec.state !== 'recording') return rec; push({ k: 'rec', a: 'pause' }); rec.activeMs += now() - rec._resumedAt; rec.state = 'paused'; try { mr?.state === 'recording' && mr.pause(); } catch (_) {} return rec; };
  rec.resume = () => { if (rec.state !== 'paused') return rec; rec._resumedAt = now(); rec.state = 'recording'; try { mr?.state === 'paused' && mr.resume(); } catch (_) {} push({ k: 'rec', a: 'resume' }); return rec; };
  rec.stop = () => new Promise((resolve) => {
    if (rec.state === 'recording') rec.pause();
    const finish = () => { rec.state = 'idle'; const video = rec.chunks.length ? new Blob(rec.chunks, { type: rec.mime || 'video/webm' }) : null; resolve({ video, log: rec.log() }); };
    if (mr && mr.state !== 'inactive') { mr.onstop = finish; try { mr.stop(); } catch (_) { finish(); } } else finish();
    mr = null;
  });
  rec.log = () => ({ version: 1, startedAt: new Date(rec.startedAt).toISOString(), activeMs: Math.round(rec.activeMs), mime: rec.mime, errors: rec.errors, events: rec.events, samples: rec.samples,
    counts: rec.events.reduce((m, e) => { const key = e.k === 'ev' ? e.n : e.k; m[key] = (m[key] || 0) + 1; return m; }, {}) });
  rec.save = async (name = 'lumen_rec_' + new Date().toISOString().slice(0, 19).replace(/[:T]/g, '-')) => {
    const out = await rec.stop();
    const dl = (blob, fn) => { const a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = fn; a.style.display = 'none'; document.body.append(a); a.click(); setTimeout(() => { URL.revokeObjectURL(a.href); a.remove(); }, 1000); };
    if (out.video) dl(out.video, name + '.webm');
    dl(new Blob([JSON.stringify(out.log)], { type: 'application/json' }), name + '.json');
    return out;
  };
  rec.dump = async () => {
    const out = await rec.stop();
    let videoB64 = null;
    if (out.video) { const buf = new Uint8Array(await out.video.arrayBuffer()); let s = ''; for (let i = 0; i < buf.length; i += 0x8000) s += String.fromCharCode.apply(null, buf.subarray(i, i + 0x8000)); videoB64 = btoa(s); }
    return { videoB64, log: out.log };
  };
  rec.destroy = () => { window.removeEventListener('keydown', onKey, true); window.removeEventListener('keyup', onKey, true); window.removeEventListener('pointerdown', onPtr, true); game?.remove?.(sampler); if (origEmit && bus) { bus.emit = origEmit; bus.__recTapped = false; } };
  if (autostart) rec.start();
  return rec;
}

export default installRecorder;
