// 41B (re-opened by user, minimal scope): diegetic verb chain — five verbs, one floating hint, no overlay, never blocks.
// installVerbChain(lg) → V · V.steps · V.step (index | -1 done) · V.skip() · V.update(dt) · V.destroy()
// bus: tut:step {id,index} · tut:done {seconds, skipped} · tut:skip.   Season clock (sb.eco.tick) is frozen while V.step >= 0.
// State persisted in lg.story.state.verbStep (-1 = done) so resume restarts at the current step.
// Simplification vs. the original prompt: 'bonk' completes on any sword swing (combat:hit|combat:miss) and pays 3 coins — no crate prop.
export const VERB_STEPS = ['move', 'coin', 'bonk', 'stall', 'deposit'];
const HINTS = { move: 'Move Pip with WASD / tap', coin: 'Grab the coin ahead', bonk: 'Swing your sword: Space', stall: 'Press B, place a stall', deposit: 'Open jars, APPLY to Save' };
const KEYS = { move: 'WASD', coin: 'WASD', bonk: 'Space', stall: 'B', deposit: 'J' };
const PULSE_S = 10, AUTO_S = 25;

export function installVerbChain(lg) {
  const { bus } = lg, offs = [];
  const on = (n, f) => offs.push(bus.on(n, f));
  const V = lg.verbs = { steps: VERB_STEPS, step: -1, t: 0, total: 0, flags: {}, autoBarks: 0, el: null };
  const hints = Object.assign({}, HINTS, ...(lg.story?.data?.verbs || []).map((x) => ({ [x.id]: x.hint })));
  const hero = () => lg.sb?.hero?.root?.position;
  const ahead = (d) => { const r = lg.sb.hero.root, a = r.rotation?.y || 0, p = r.position; return { x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d }; };
  const persist = () => { if (lg.story?.state) lg.story.state.verbStep = V.step; };

  // ---- tiny DOM chip (absent headless) ---------------------------------------------------------------------------
  const doc = typeof document !== 'undefined' ? document : null;
  function ui(text, key, pulse) {
    if (!doc) return;
    if (!V.el) {
      V.el = doc.createElement('div'); V.el.id = 'verb-hint';
      V.el.style.cssText = 'position:fixed;left:50%;bottom:22%;transform:translateX(-50%);z-index:40;display:flex;gap:8px;align-items:center;padding:8px 14px;border-radius:14px;background:rgba(20,24,40,.82);color:#ffe9b0;font:600 15px system-ui,sans-serif;pointer-events:none;max-width:90vw;transition:transform .2s';
      V.skipEl = doc.createElement('button'); V.skipEl.id = 'verb-skip'; V.skipEl.textContent = 'Skip';
      V.skipEl.style.cssText = 'position:fixed;right:12px;bottom:12px;z-index:41;min-width:44px;min-height:44px;padding:0 14px;border-radius:12px;border:0;background:rgba(20,24,40,.82);color:#fff;font:600 14px system-ui,sans-serif;cursor:pointer';
      V.skipEl.onclick = () => V.skip();
      doc.body.appendChild(V.el); doc.body.appendChild(V.skipEl);
    }
    V.el.innerHTML = `<span style="border:1px solid #ffe9b0;border-radius:6px;padding:1px 6px;font-size:${pulse ? 17 : 12}px">${key}</span><span>${text}</span>`;
    V.el.style.transform = `translateX(-50%) scale(${pulse ? 1.12 : 1})`;
  }
  function hideUI() { V.el?.remove(); V.skipEl?.remove(); V.el = V.skipEl = null; }

  // ---- steps -----------------------------------------------------------------------------------------------------
  const SETUP = {
    move: () => { const h = hero(); V.flags.from = h ? { x: h.x, z: h.z } : null; },
    coin: () => { const a = ahead(2); V.flags.coin = lg.sb.dropTip?.(a.x, a.z, 3); },
    bonk: () => { V.flags.swung = false; },
    stall: () => { V.flags.placed = false; },
    deposit: () => { V.flags.applied = false; },
  };
  const DONE = {
    move: () => { const h = hero(), f = V.flags.from; if (h && !f) { V.flags.from = { x: h.x, z: h.z }; return false; } return !!h && Math.hypot(h.x - f.x, h.z - f.z) >= 3; },
    coin: () => !V.flags.coin || !lg.sb.coins?.includes(V.flags.coin),
    bonk: () => V.flags.swung,
    stall: () => V.flags.placed,
    deposit: () => V.flags.applied,
  };
  on('combat:hit', () => { V.flags.swung = true; }); on('combat:miss', () => { V.flags.swung = true; });
  on('build:placed', (p) => { if (!p?.silent && String(p?.id).startsWith('stall_')) V.flags.placed = true; });
  on('ui:jar:apply', () => { V.flags.applied = true; });

  function enter(i) {
    V.step = i; V.t = 0; persist();
    if (i < 0 || i >= VERB_STEPS.length) return finish(false);
    const id = VERB_STEPS[i]; SETUP[id]?.(); ui(hints[id], KEYS[id], false);
    bus.emit('tut:step', { id, index: i });
  }
  function finish(skipped) {
    V.step = -1; persist(); hideUI();
    bus.emit('tut:done', { seconds: Math.round(V.total * 10) / 10, skipped: !!skipped });
  }
  function freezeEco(sb) {                     // season clock does not run until tut:done
    if (!sb?.eco || sb.eco._verbWrapped) return; const orig = sb.eco.tick.bind(sb.eco);
    sb.eco.tick = (dt) => (V.step >= 0 ? undefined : orig(dt)); sb.eco._verbWrapped = true;
  }
  function silenceOldGates() { for (const n of ['tut:move', 'tut:build', 'tut:jars']) lg.tut?.fired?.add(n); }
  const eligible = () => (lg.opts.verbs === true || (lg.opts.verbs !== false && typeof document !== 'undefined' && !lg.opts.headless && !globalThis.__llDomShim)) && lg.opts.tutorial !== false && lg.mode === 'story' && (lg.sb?.eco?.state?.season ?? 1) === 1;

  V.start = (i = 0) => { if (!lg.sb) return; V.total = 0; V.autoBarks = 0; freezeEco(lg.sb); silenceOldGates(); enter(i); };
  V.skip = () => { if (V.step < 0) return; bus.emit('tut:skip', { at: VERB_STEPS[V.step] }); finish(true); };
  V.update = (dt) => {
    if (V.step < 0 || !lg.sb || lg.cine?.active) return;
    V.t += dt; V.total += dt; const id = VERB_STEPS[V.step];
    if (DONE[id]()) return enter(V.step + 1);
    if (V.t >= AUTO_S) { V.autoBarks++; bus.emit('story:toast', { id: 'verb-later-' + id, text: 'Later, then.', icon: '🦉', kind: 'info' }); return enter(V.step + 1); }
    if (V.t >= PULSE_S && !V.flags.pulsed) { V.flags.pulsed = true; ui(hints[id], KEYS[id], true); }
  };
  // once bonk completes, pay the sword's first job: 3 coins
  on('tut:step', (p) => { if (p.id === 'stall' && lg.sb?.dropTip) { const a = ahead(1.2); for (let k = 0; k < 3; k++) lg.sb.dropTip(a.x + (k - 1) * 0.5, a.z, 1); } V.flags.pulsed = false; });

  on('game:start', () => { if (lg._resuming) return; const st = lg.story?.state; if (st && st.verbStep === -1 && lg.opts.verbsAlways !== true) return; if (eligible()) V.start(0); });
  on('game:resumed', () => { const s = lg.story?.state?.verbStep; if (typeof s === 'number' && s >= 0 && eligible()) V.start(s); });
  on('game:title', () => { if (V.step >= 0) { V.step = -1; hideUI(); } });
  V.destroy = () => { hideUI(); for (const f of offs) try { f(); } catch (_) {} offs.length = 0; };
  lg._offs?.push(V.destroy);
  return V;
}
export default installVerbChain;
