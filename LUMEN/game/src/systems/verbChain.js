// 41B (re-opened by user, minimal scope): diegetic verb chain — five verbs, no overlay, never blocks. 48F: no DOM here — hints go out as tutor:hint.
// installVerbChain(lg) → V · V.steps · V.step (index | -1 done) · V.skip() · V.update(dt) · V.destroy()
// bus: tut:step {id,index} · tut:done {seconds, skipped} · tut:skip · tutor:hint {id,key,text,pulse} (48F).   Season clock (sb.eco.tick) is frozen while V.step >= 0.
// State persisted in lg.story.state.verbStep (-1 = done) so resume restarts at the current step.
// Simplification vs. the original prompt: 'bonk' completes on any sword swing (combat:hit|combat:miss) and pays 3 coins — no crate prop.
export const VERB_STEPS = ['move', 'coin', 'bonk', 'stall', 'deposit'];
const HINTS = { move: 'Move Pip with WASD / tap', coin: 'Grab the coin ahead', bonk: 'Swing your sword: Space', stall: 'Press B, place a stall', deposit: 'Carry it to the Save jar by the cottage, press E', depositBuild: 'Build the Save jar: B → Jars' };   // 42B: jars are places
const KEYS = { move: 'WASD', coin: 'WASD', bonk: 'Space', stall: 'B', deposit: 'E' };   // 42B: E at the jar
const PULSE_S = 10, AUTO_S = 25;

export function installVerbChain(lg) {
  const { bus } = lg, offs = [];
  const on = (n, f) => offs.push(bus.on(n, f));
  const V = lg.verbs = { steps: VERB_STEPS, step: -1, t: 0, total: 0, flags: {}, autoBarks: 0 };
  const hints = Object.assign({}, HINTS, ...(lg.story?.data?.verbs || []).map((x) => ({ [x.id]: x.hint })));
  const hero = () => lg.sb?.hero?.root?.position;
  const ahead = (d) => { const r = lg.sb.hero.root, a = r.rotation?.y || 0, p = r.position; return { x: p.x + Math.sin(a) * d, z: p.z + Math.cos(a) * d }; };
  const persist = () => { if (lg.story?.state) lg.story.state.verbStep = V.step; };

  // 48F: the floating chip + Skip button are deleted (HANDOFF_48Z D2). Each step emits tutor:hint {id, key, text} and ui/tutor.js
  //   (data/tutor.json cards verb:<id>) shows it once per profile. Pulse at PULSE_S re-emits the hint (tutor drops it if already seen).
  function ui(text, key, pulse) { bus.emit('tutor:hint', { id: VERB_STEPS[V.step], key, text, pulse: !!pulse }); }
  function hideUI() {}

  // ---- steps -----------------------------------------------------------------------------------------------------
  const SETUP = {
    move: () => { const h = hero(); V.flags.from = h ? { x: h.x, z: h.z } : null; },
    coin: () => { const a = ahead(2); V.flags.coin = lg.sb.dropTip?.(a.x, a.z, 3); },
    bonk: () => { V.flags.swung = false; },
    stall: () => { V.flags.placed = false; },
    // 42B: light the lantern nearest the Save jar and bark the way; done = jars:deposit (any jar — the walk is the lesson).
    // T1-C: the tutorial IS the first lesson → Save is unlocked here (the first-till-sweep rule may not have fired yet). With no Save jar built (S51 deleted the
    //   pre-placed jars) the hint becomes "build it" and the step is also done by build:placed jar_save — no silent 25 s wait (T1.7).
    deposit: () => { V.flags.applied = false; const sb = lg.sb; try { sb?.jarUnlocks?.unlockNow?.('save', 'verb'); } catch { /* ok */ }
      const jar = sb?.jarsWorld?.get?.('save') || null;
      if (!jar) { V.flags.needJar = true; ui(hints.depositBuild || HINTS.depositBuild, 'B', false); return; }
      V.flags.needJar = false; const jp = jar.position;
      let best = null, bd = Infinity; for (const l of sb.world.lanterns || []) { const d = Math.hypot(l.position.x - jp.x, l.position.z - jp.z); if (d < bd) { bd = d; best = l; } }
      best?.userData?.setLit?.(true); V.flags.litLantern = best;
      bus.emit('story:bark', { speaker: 'owl', text: 'Carry it to the Save jar — by the cottage, the blue one.', anchor: { x: jp.x, y: 1.3, z: jp.z }, ttl: 3.6 }); },
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
  on('ui:jar:apply', () => { V.flags.applied = true; });   // legacy ?sliders=1 path still completes the step
  on('jars:deposit', () => { V.flags.applied = true; });   // 42B: the real path — Pip walked the Spark to a jar
  on('build:placed', (p) => { if (!p?.silent && p?.id === 'jar_save' && VERB_STEPS[V.step] === 'deposit' && V.flags.needJar) { V.flags.needJar = false; V.t = 0; V.flags.pulsed = false; ui('Now tap the jar and Pip puts 10 ✦ in', 'tap', false); } });   // T1-C: built → next hint (the deposit itself finishes the step)

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

  // 46A (PLAY_BUGS 45B-1): the S1 opening dialogue swallows B/1/E while the chain was already counting its 25 s auto-advance →
  //   the chain now starts only when no dialogue box is open (deferred until 'ui:dialogue:close'), and V.update does not count
  //   time while one is open. Headless tests have no ui → unaffected.
  const dialogueOpen = () => !!lg.ui?.dialogue?.isOpen;
  V.pending = null;                           // step index waiting for the dialogue to close (null = none)
  V.start = (i = 0) => { if (!lg.sb) return; if (dialogueOpen()) { V.pending = i; return; } V.pending = null; V.total = 0; V.autoBarks = 0; freezeEco(lg.sb); silenceOldGates(); enter(i); };
  on('ui:dialogue:close', () => { if (V.pending !== null && lg.sb) { const i = V.pending; V.pending = null; V.start(i); } });
  V.skip = () => { if (V.step < 0) return; bus.emit('tut:skip', { at: VERB_STEPS[V.step] }); finish(true); };
  V.update = (dt) => {
    if (V.step < 0 || !lg.sb || lg.cine?.active || dialogueOpen()) return;
    V.t += dt; V.total += dt; const id = VERB_STEPS[V.step];
    if (DONE[id]()) return enter(V.step + 1);
    if (V.t >= AUTO_S) { V.autoBarks++; /* 48A: silent auto-advance, toast deleted */ return enter(V.step + 1); }
    if (V.t >= PULSE_S && !V.flags.pulsed) { V.flags.pulsed = true; ui(hints[id], KEYS[id], true); }
  };
  // once bonk completes, pay the sword's first job: 3 coins
  on('tut:step', (p) => { if (p.id === 'stall' && lg.sb?.dropTip) { const a = ahead(1.2); for (let k = 0; k < 3; k++) lg.sb.dropTip(a.x + (k - 1) * 0.5, a.z, 1); } V.flags.pulsed = false; });

  on('game:start', () => { if (lg._resuming) return; const st = lg.story?.state; if (st && st.verbStep === -1 && lg.opts.verbsAlways !== true) return; if (eligible()) V.start(0); });
  on('game:resumed', () => { const s = lg.story?.state?.verbStep; if (typeof s === 'number' && s >= 0 && eligible()) V.start(s); });
  on('game:title', () => { V.pending = null; if (V.step >= 0) { V.step = -1; hideUI(); } });
  V.destroy = () => { hideUI(); for (const f of offs) try { f(); } catch (_) {} offs.length = 0; };
  lg._offs?.push(V.destroy);
  return V;
}
export default installVerbChain;
