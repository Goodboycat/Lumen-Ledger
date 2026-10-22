// LUMEN LEDGER — FinLit Jars panel (Chat 7A). DOM only. Contract: §B UI → mountJars(root).
//
//   import { mountJars, rebalance } from './ui/jars.js';
//   const jars = mountJars(root, { bus, pct: { spend: 40, save: 30, invest: 20, protect: 10 } });
//   jars.setPct({ save: 50 })        // drag one, the other three rebalance proportionally so the total stays 100
//   jars.setBalances(economy.state.jars) // show actual Spark per jar (from eco:jar)
//   jars.pct → { spend, save, invest, protect } integers summing to 100
//   jars.lock('invest', true)         // 8B story may lock jars until their lesson unlocks
//
// Emits on bus:  'ui:jar' { pct: {...}, changed: 'save', source: 'drag'|'preset'|'api' }   (every change, debounced to the input event)
//                'ui:jar:apply' { pct }   when the player presses APPLY (the integrator calls economy.allocate from this)
//                'ui:jar:withdraw' { jar, amount }  BUGFIX B11: the ↩ button next to a jar balance → economy.withdraw (half the jar, min 1)
//                'ui:repay' { amount }              BUGFIX B01: the PAY BARON button → economy.repay (whole debt, capped by the pouch in Game.js)
// Listens:       'eco:jar' { jars } → setBalances · 'eco:season' report → setBalances(report.jars) · 'eco:loan' {debt} / 'eco:spark' → debt row
//
// Motion: slider fill is a CSS gradient var(--pct); jar icon liquid height 350 ms outExpo; slosh 450 ms outBack on change.

import { iconize, icon } from './icons.js';
import { bus as defaultBus } from '../src/core/EventBus.js';

export const JAR_ORDER = ['spend', 'save', 'invest', 'protect'];
export const JAR_INFO = {
  spend:   { name: 'Spend',   hint: 'needs & wants — stalls, upkeep' },
  save:    { name: 'Save',    hint: 'earns +5 % / season · pushes the Fog back at 150' },
  invest:  { name: 'Invest',  hint: '8 % ± 4 % / season · can dip' },
  protect: { name: 'Protect', hint: 'insurance — absorbs shocks' },
};
export const JAR_PRESETS = {
  balanced: { spend: 40, save: 30, invest: 20, protect: 10 },
  saver:    { spend: 25, save: 50, invest: 10, protect: 15 },
  grower:   { spend: 30, save: 20, invest: 40, protect: 10 },
};

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

/**
 * PURE: given current integer percentages and one changed key/value, return a new object that sums to 100.
 * The other (unlocked) jars shrink/grow proportionally to their current share; integer remainder goes to the
 * largest of them. Locked jars keep their value. If everything else is locked the change is clamped.
 */
export function rebalance(pct, key, value, locked = {}) {
  const out = { ...pct };
  const others = JAR_ORDER.filter((k) => k !== key && !locked[k]);
  const lockedSum = JAR_ORDER.filter((k) => k !== key && locked[k]).reduce((a, k) => a + (out[k] || 0), 0);
  const max = 100 - lockedSum;
  value = clamp(Math.round(+value || 0), 0, max);
  if (!others.length) { out[key] = max; return out; }
  out[key] = value;
  const rest = max - value;
  const curSum = others.reduce((a, k) => a + (out[k] || 0), 0);
  let acc = 0;
  for (const k of others) {
    const share = curSum > 0 ? (out[k] || 0) / curSum : 1 / others.length;
    out[k] = Math.floor(rest * share); acc += out[k];
  }
  let rem = rest - acc;
  // give the remainder 1-by-1 to the biggest others (deterministic)
  const byBig = [...others].sort((a, b) => (out[b] - out[a]) || JAR_ORDER.indexOf(a) - JAR_ORDER.indexOf(b));
  for (let i = 0; rem > 0; i = (i + 1) % byBig.length) { out[byBig[i]]++; rem--; }
  return out;
}
export const sumPct = (p) => JAR_ORDER.reduce((a, k) => a + (p[k] || 0), 0);

export function mountJars(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const st = { pct: { ...(opts.pct || JAR_PRESETS.balanced) }, balances: { spend: 0, save: 0, invest: 0, protect: 0 }, locked: {}, dirty: false, debt: +opts.debt || 0, spark: +opts.spark || 0 };
  if (sumPct(st.pct) !== 100) st.pct = rebalance(st.pct, 'spend', st.pct.spend);

  const panel = el('aside', 'll-jars'); panel.id = 'll-jars';
  const head = el('div', 'll-jars-head');
  const title = el('span', null, '🫙 FinLit Jars');
  const total = el('span', 'll-jars-total', '100 %'); const caret = el('span', 'll-caret', '▾');
  head.append(title, total, caret);
  panel.append(head);
  head.addEventListener('click', () => { panel.classList.toggle('collapsed'); caret.innerHTML = iconize(panel.classList.contains('collapsed') ? '▸' : '▾'); });

  const rows = {};
  for (const k of JAR_ORDER) {
    const row = el('div', 'll-jar ' + k);
    const icon = el('div', 'll-jar-icon'); const liquid = el('i'); icon.append(liquid);
    const name = el('div', 'll-jar-name', `<span>${JAR_INFO[k].name}</span><small class="ll-jar-bal">0 ✦</small>`);
    const input = el('input'); input.type = 'range'; input.min = 0; input.max = 100; input.step = 1; input.value = st.pct[k]; input.setAttribute('aria-label', JAR_INFO[k].name + ' percent');
    const pctEl = el('div', 'll-jar-pct', `<span>${st.pct[k]}%</span>`);
    row.append(icon, name, input, pctEl);
    if (k !== 'spend') { // B11: withdraw half of a jar back into the pouch (Spend IS the pouch, nothing to withdraw)
      const wd = el('button', 'll-jar-wd'); wd.innerHTML = iconize('↩'); wd.type = 'button'; wd.title = 'Take half of this jar back into your pouch'; wd.setAttribute('aria-label', 'Withdraw half of ' + JAR_INFO[k].name);
      wd.addEventListener('click', (e) => { e.stopPropagation(); api.withdraw(k); });
      row.append(wd); row.classList.add('has-wd');
    }
    row.title = JAR_INFO[k].hint;
    panel.append(row);
    rows[k] = { row, icon, liquid, input, pctEl: pctEl.firstChild, bal: name.querySelector('.ll-jar-bal') };
    input.addEventListener('input', () => { api.setPct({ [k]: +input.value }, 'drag'); });
    input.addEventListener('change', () => { bus.emit('ui:jar', { pct: { ...st.pct }, changed: k, source: 'release' }); });
    input.addEventListener('pointerdown', () => hint.textContent = JAR_INFO[k].hint);
  }
  const foot = el('div', 'll-jars-foot');
  const presetBtn = el('button', 'll-btn alt', 'Preset ⟳'); let presetI = 0;
  const applyBtn = el('button', 'll-btn', 'APPLY'); applyBtn.disabled = true;
  foot.append(presetBtn, applyBtn);
  const hint = el('div', 'll-jars-hint', 'drag a jar — the others rebalance');
  // B01: the debt row — the ONLY player-facing way to pay down Baron Gilt's principal (interest compounds every season)
  const debtRow = el('div', 'll-jars-debt');
  const debtLab = el('span', 'll-jars-debt-lab', '🎩 Debt'); const debtVal = el('b', 'll-jars-debt-val', '0 ✦'); debtLab.append(debtVal);
  const repayBtn = el('button', 'll-btn repay', 'PAY BARON'); repayBtn.type = 'button'; repayBtn.disabled = true; repayBtn.title = 'Pay the Baron from your pouch — stops the interest and lets the Fog lift';
  debtRow.append(debtLab, repayBtn);
  panel.append(foot, debtRow, hint);
  repayBtn.addEventListener('click', () => api.repay());
  root.appendChild(panel);

  presetBtn.addEventListener('click', () => { const keys = Object.keys(JAR_PRESETS); presetI = (presetI + 1) % keys.length; api.setPreset(keys[presetI]); hint.textContent = 'preset: ' + keys[presetI]; });
  applyBtn.addEventListener('click', () => api.apply());

  const retrigger = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  const render = (changed) => {
    for (const k of JAR_ORDER) {
      const r = rows[k], v = st.pct[k];
      if (+r.input.value !== v) r.input.value = v;
      r.input.style.setProperty('--pct', v + '%');
      r.pctEl.textContent = v + '%';
      r.liquid.style.height = (12 + v * 0.86) + '%';
      // BUGFIX P02: Spend IS the pouch (sales land there, APPLY moves only save/invest/protect) → show pouch + any spend-jar Spark, not a dead 0
      r.bal.innerHTML = iconize(Math.round(k === 'spend' ? (st.balances.spend || 0) + st.spark : (st.balances[k] || 0)) + ' ✦');
      r.row.classList.toggle('locked', !!st.locked[k]);
      if (changed === k || changed === '*') retrigger(r.icon, 'pop');
    }
    const s = sumPct(st.pct); total.textContent = s + ' %'; total.classList.toggle('bad', s !== 100);
    // BUGFIX P01: APPLY was disabled until a slider moved, so keeping the shown split could never fill the jars. Now: enabled whenever
    // the pouch has Spark and the split sends something to Save/Invest/Protect (or the sliders changed).
    // BUGFIX P09: with an EMPTY pouch APPLY would move 0 Spark (chime, no effect) → disabled, hint says why; a dirty split still arms it once Spark arrives.
    const toJars = (st.pct.save + st.pct.invest + st.pct.protect) > 0;
    applyBtn.disabled = !(st.spark > 0 && (st.dirty || toJars));
    applyBtn.title = st.spark > 0 ? 'move the pouch into the jars by this split' : 'your pouch is empty — sell Glimmers first';
    debtVal.innerHTML = iconize(Math.round(st.debt) + ' ✦');
    debtRow.classList.toggle('clear', st.debt <= 0);
    repayBtn.disabled = !(st.debt > 0 && st.spark > 0);
    repayBtn.innerHTML = iconize(st.debt <= 0 ? 'DEBT FREE' : 'PAY ' + Math.min(Math.round(st.debt), Math.floor(st.spark)) + ' ✦');
  };

  const api = {
    el: panel, state: st,
    get pct() { return { ...st.pct }; },
    setPct(partial, source = 'api') {
      let changed = null;
      for (const [k, v] of Object.entries(partial || {})) { if (!JAR_ORDER.includes(k) || st.locked[k]) continue; st.pct = rebalance(st.pct, k, v, st.locked); changed = k; }
      if (!changed) return api;
      st.dirty = true; render(changed);
      bus.emit('ui:jar', { pct: { ...st.pct }, changed, source });
      return api;
    },
    setPreset(name) { const p = JAR_PRESETS[name]; if (!p) return api; st.pct = { ...p }; st.dirty = true; render('*'); bus.emit('ui:jar', { pct: { ...st.pct }, changed: '*', source: 'preset', preset: name }); return api; },
    setBalances(jars) { if (!jars) return api; for (const k of JAR_ORDER) if (jars[k] != null) st.balances[k] = Math.round(jars[k]); render(null); return api; },
    lock(k, on = true) { if (JAR_ORDER.includes(k)) { st.locked[k] = !!on; render(null); } return api; },
    /** B11: ask the integrator to move half of a jar (min 1 ✦) back into the pouch. */
    withdraw(k, amount) { if (!JAR_ORDER.includes(k) || k === 'spend') return api; const bal = st.balances[k] || 0; const a = Math.max(1, Math.round(amount != null ? amount : bal / 2)); if (bal <= 0) { hint.textContent = JAR_INFO[k].name + ' jar is empty'; return api; } bus.emit('ui:jar:withdraw', { jar: k, amount: Math.min(a, bal) }); retrigger(rows[k].icon, 'pop'); return api; },
    /** B01: ask the integrator to repay the Baron (amount defaults to everything the pouch can cover). */
    repay(amount) { if (!(st.debt > 0)) { hint.textContent = 'no debt — the Baron has nothing on you'; return api; } const a = Math.min(Math.round(amount != null ? amount : st.debt), Math.floor(st.spark)); if (!(a > 0)) { hint.textContent = 'your pouch is empty — sell Glimmers or ↩ withdraw from a jar'; return api; } bus.emit('ui:repay', { amount: a }); retrigger(debtRow, 'pop'); return api; },
    /** B01: show debt + pouch so the PAY button knows what it can pay. */
    setDebt(debt, spark) { if (debt != null) st.debt = Math.max(0, +debt || 0); if (spark != null) st.spark = Math.max(0, +spark || 0); render(null); return api; },
    apply() { st.dirty = false; render(null); bus.emit('ui:jar:apply', { pct: { ...st.pct } }); retrigger(panel, 'll-apply'); return api; },
    setCollapsed(on) { panel.classList.toggle('collapsed', !!on); caret.innerHTML = iconize(on ? '▸' : '▾'); return api; },
    destroy() { offs.forEach((f) => f()); panel.remove(); },
  };
  const offs = [
    bus.on('eco:jar', (p) => { if (p && p.jars) api.setBalances(p.jars); }),
    bus.on('eco:season', (r) => { if (r && r.jars) api.setBalances(r.jars); if (r && r.debt != null) api.setDebt(r.debt, r.spark); }),
    bus.on('eco:loan', (p) => { if (p && p.debt != null) api.setDebt(p.debt, null); }),
    bus.on('eco:spark', (p) => { if (p && p.spark != null) api.setDebt(null, p.spark); }),
  ];
  render('*');
  return api;
}
