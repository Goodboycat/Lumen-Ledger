// LUMEN LEDGER — HUD ribbon (Chat 7A). DOM only, no Three. Contract: docs/API_CONTRACTS.md §B UI → mountHUD(root).
//
//   import { mountHUD } from './ui/hud.js';
//   const hud = mountHUD(document.getElementById('game-root'), { bus: game.bus, stats: () => game.stats, seasonsToWin: 10 });
//   hud.update(dtSeconds)            // call each frame (count-up tween + fps readout); or let it self-drive via requestAnimationFrame (default)
//   hud.setSpark(n) / hud.setSeason(n, day01) / hud.setFog(0..1) / hud.setDebt(n) / hud.setReputation(0..1)
//   hud.sync(economy.state)         // one call to set everything from an Economy state object
//   hud.el, hud.destroy()
//
// Listens on bus: eco:spark {spark,delta} · eco:season report{season,fog01,debt,spark,jars} · eco:fog {fog01} · eco:loan {debt}
//                 eco:denied {cost} (shake) · cust:paid {paid} (+N float) · eco:tick? {day01} (optional, from the integrator)
// Emits nothing. Pure display.
//
// Motion table (CSS keyframes, see hud.css): ribbon bounce-in 500 ms outBack · spark pulse 320 ms outBack on gain ·
// shake 360 ms on denied/loss · "+N" float 900 ms outQuad · fog bar width 600 ms outExpo · spark count-up: exp damp k=9 (≈ 350 ms to settle).

import { iconize, icon } from './icons.js';
import { bus as defaultBus } from '../src/core/EventBus.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };
const clamp01 = (v) => Math.max(0, Math.min(1, v));

export function mountHUD(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const seasonsToWin = opts.seasonsToWin || 10;
  const statsFn = opts.stats || null;
  const selfDrive = opts.selfDrive !== false;

  // ---------------------------------------------------------------- DOM
  const hud = el('header', 'll-hud'); hud.id = 'll-hud';
  const spark = el('div', 'll-spark');
  spark.append(el('div', 'll-spark-coin', icon('glint')));
  const sparkCol = el('div', 'll-spark-col');
  const sparkVal = el('span', 'll-spark-val', '0');
  const sparkSub = el('span', 'll-spark-sub', 'SPARK');
  sparkCol.append(sparkVal, sparkSub);
  const debtChip = el('span', 'll-spark-debt', 'debt 0');
  // S05: quick PAY button inside the debt chip — repaying the Baron is the win path, and the jars panel (with PAY BARON) is collapsed
  //   on phones during dialogue. Emits the same 'ui:repay' {amount} the jars button does (Game.js caps it by the pouch).
  const payBtn = el('button', 'll-spark-pay', 'PAY'); payBtn.type = 'button'; payBtn.title = 'Pay the Baron from your pouch (stops the interest, lifts the Fog)'; payBtn.disabled = true;
  spark.append(sparkCol, debtChip, payBtn);
  payBtn.addEventListener('click', (e) => { e.stopPropagation && e.stopPropagation(); api.pay(); });

  const mid = el('div', 'll-mid');
  const season = el('div', 'll-season');
  const seasonTxt = el('span', null, 'Season 1 / 10');
  const day = el('span', 'll-day'); const dayFill = el('i'); day.append(dayFill);
  // S28: time speed ⏩ — the player often waits for customers with nothing to do. Cycles 1× → 2× → 3× → 1× (also key T).
  //   Emits 'ui:speed' {cycle:true}; Game.js owns game.timeScale and answers with 'game:speed' {speed} which relabels the button.
  const speedBtn = el('button', 'll-speed', '⏩'); speedBtn.type = 'button'; speedBtn.title = 'Time speed (T): 1× → 2× → 3×'; speedBtn.setAttribute('aria-label', 'Time speed');
  speedBtn.addEventListener('click', (e) => { e.stopPropagation && e.stopPropagation(); bus.emit('ui:speed', { cycle: true, source: 'hud' }); });
  season.append(seasonTxt, day, speedBtn);
  const fog = el('div', 'll-fog');
  const fogTrack = el('div', 'll-fog-track'); const fogFill = el('div', 'll-fog-fill'); fogTrack.append(fogFill);
  const fogPct = el('span', 'll-fog-pct', '35%');
  fog.append(el('span', 'll-fog-label', 'DEBT FOG'), fogTrack, fogPct);
  mid.append(season, fog);

  const right = el('div', 'll-right');
  const stats = el('div', 'll-stats', 'fps — · calls —');
  const rep = el('div', 'll-rep');
  const repStars = []; for (let i = 0; i < 5; i++) { const s = el('i', null, '★'); rep.append(s); repStars.push(s); }
  right.append(stats, rep);
  if (!statsFn) stats.style.display = 'none';

  hud.append(spark, mid, right);
  root.appendChild(hud);

  // ---------------------------------------------------------------- state
  const st = { spark: 0, shown: 0, season: 1, day01: 0, fog01: 0.35, debt: 0, rep: 0.5, fpsT: 0 };
  const refreshPay = () => { const can = st.debt > 0 && st.spark > 0; payBtn.disabled = !can; payBtn.textContent = can ? 'PAY ' + Math.min(st.debt, Math.floor(st.spark)) : 'PAY'; };

  const floatText = (txt, cls) => {
    const f = el('span', 'll-float ' + cls, txt); spark.appendChild(f);
    f.addEventListener('animationend', () => f.remove(), { once: true });
    setTimeout(() => f.remove(), 1200);
  };
  const retrigger = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  // ---------------------------------------------------------------- API
  const api = {
    el: hud, state: st,
    setSpark(n, { silent } = {}) {
      n = Math.round(+n || 0);
      const d = n - st.spark; st.spark = n;
      if (!silent && d !== 0) {
        spark.classList.toggle('is-up', d > 0); spark.classList.toggle('is-down', d < 0);
        retrigger(spark, d > 0 ? 'pulse' : 'shake');
        floatText((d > 0 ? '+' : '−') + Math.abs(d), d > 0 ? 'gain' : 'loss');
        clearTimeout(st.colorT); st.colorT = setTimeout(() => spark.classList.remove('is-up', 'is-down'), 700);
      }
      if (silent) { st.shown = n; sparkVal.textContent = String(n); }
      refreshPay();
      return api;
    },
    setDebt(n) { st.debt = Math.round(+n || 0); debtChip.textContent = 'debt ' + st.debt; spark.classList.toggle('has-debt', st.debt > 0); refreshPay(); return api; },
    /** S05: repay what the pouch can cover (amount defaults to min(debt, spark)). Emits 'ui:repay' {amount, source:'hud'}; returns the amount asked. */
    pay(amount) {
      const a = Math.min(Math.round(amount != null ? amount : st.debt), Math.floor(st.spark));
      if (!(st.debt > 0) || !(a > 0)) { retrigger(spark, 'shake'); return 0; }
      bus.emit('ui:repay', { amount: a, source: 'hud' }); retrigger(spark, 'pulse'); return a;
    },
    setSeason(n, day01) {
      if (n !== st.season) { st.season = n; retrigger(season, 'pop'); }
      seasonTxt.textContent = n > seasonsToWin ? `Endless · S${n}` : `Season ${n} / ${seasonsToWin}`;
      if (day01 != null) api.setDay(day01);
      return api;
    },
    setDay(day01) { st.day01 = clamp01(+day01 || 0); dayFill.style.width = (st.day01 * 100).toFixed(1) + '%'; return api; },
    setFog(f01, { flash } = {}) {
      const prev = st.fog01; st.fog01 = clamp01(+f01 || 0);
      fogFill.style.width = (st.fog01 * 100).toFixed(1) + '%';
      fogPct.textContent = Math.round(st.fog01 * 100) + '%';
      fog.classList.toggle('is-danger', st.fog01 >= 0.7);
      fog.classList.toggle('is-clear', st.fog01 <= 0.001);
      if (flash || st.fog01 > prev + 0.02) retrigger(fog, 'flash');
      return api;
    },
    setReputation(r01) { st.rep = clamp01(+r01 || 0); const on = Math.round(st.rep * 5); repStars.forEach((s, i) => s.classList.toggle('on', i < on)); rep.title = 'reputation ' + Math.round(st.rep * 100) + '%'; return api; },
    sync(state, { silent = true } = {}) {
      if (!state) return api;
      if (state.spark != null) api.setSpark(state.spark, { silent });
      if (state.season != null) api.setSeason(state.season, state.day01);
      if (state.fog01 != null) api.setFog(state.fog01);
      if (state.debt != null) api.setDebt(state.debt);
      if (state.reputation != null) api.setReputation(state.reputation);
      return api;
    },
    /** Count-up tween: exponential damp toward the target (frame-rate independent). */
    update(dt) {
      dt = Math.min(0.1, Math.max(0, +dt || 0));
      if (st.shown !== st.spark) {
        const k = 1 - Math.exp(-9 * dt);
        st.shown += (st.spark - st.shown) * k;
        if (Math.abs(st.spark - st.shown) < 0.6) st.shown = st.spark;
        sparkVal.textContent = String(Math.round(st.shown));
      }
      if (statsFn) { st.fpsT += dt; if (st.fpsT > 0.25) { st.fpsT = 0; const s = statsFn() || {}; stats.textContent = `fps ${Math.round(s.fps || 0)} · calls ${s.drawCalls || 0}`; } }
    },
    destroy() { offs.forEach((f) => f()); if (st.raf) cancelAnimationFrame(st.raf); hud.remove(); },
  };

  // ---------------------------------------------------------------- bus wiring
  const offs = [
    bus.on('eco:spark', (p) => { if (p && p.spark != null) api.setSpark(p.spark); }),
    bus.on('eco:season', (r) => { if (!r) return; api.setSeason((r.season || 0) + 1, 0); if (r.fog01 != null) api.setFog(r.fog01); if (r.debt != null) api.setDebt(r.debt); if (r.spark != null) api.setSpark(r.spark, { silent: true }); if (r.reputation != null) api.setReputation(r.reputation); }),
    bus.on('eco:fog', (p) => { if (p && p.fog01 != null) api.setFog(p.fog01); }),
    bus.on('eco:loan', (p) => { if (p && p.debt != null) api.setDebt(p.debt); }),
    bus.on('eco:denied', () => { retrigger(spark, 'shake'); }),
    bus.on('eco:tick', (p) => { if (p && p.day01 != null) api.setDay(p.day01); if (p && p.season != null && p.season !== st.season) api.setSeason(p.season); }),
    bus.on('eco:win', () => { api.setFog(0); seasonTxt.innerHTML = iconize('✦ Lighthouse lit!'); }),
    bus.on('eco:lose', () => { seasonTxt.textContent = 'Fogged out…'; }),
    bus.on('game:speed', (p) => { const s = (p && p.speed) || 1; speedBtn.innerHTML = iconize(s > 1 ? `⏩${s}×` : '⏩'); speedBtn.classList.toggle('on', s > 1); speedBtn.title = `Time speed ${s}× (T): 1× → 2× → 3×`; if (s > 1) retrigger(speedBtn, 'pop'); }),
  ];

  // self-drive (demo pages / integrator may call update(dt) themselves with selfDrive:false)
  if (selfDrive && typeof requestAnimationFrame === 'function') {
    let last = performance.now();
    const loop = (t) => { api.update((t - last) / 1000); last = t; st.raf = requestAnimationFrame(loop); };
    st.raf = requestAnimationFrame(loop);
  }
  api.setSpark(opts.spark ?? 0, { silent: true }); api.setSeason(opts.season ?? 1, 0); api.setFog(opts.fog01 ?? 0.35); api.setDebt(opts.debt ?? 0); api.setReputation(opts.reputation ?? 0.5);
  return api;
}
