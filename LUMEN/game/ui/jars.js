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
// Listens:       'eco:jar' { jars } → setBalances · 'eco:season' report → setBalances(report.jars)
//
// Motion: slider fill is a CSS gradient var(--pct); jar icon liquid height 350 ms outExpo; slosh 450 ms outBack on change.

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

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
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
  const st = { pct: { ...(opts.pct || JAR_PRESETS.balanced) }, balances: { spend: 0, save: 0, invest: 0, protect: 0 }, locked: {}, dirty: false };
  if (sumPct(st.pct) !== 100) st.pct = rebalance(st.pct, 'spend', st.pct.spend);

  const panel = el('aside', 'll-jars'); panel.id = 'll-jars';
  const head = el('div', 'll-jars-head');
  const title = el('span', null, '🫙 FinLit Jars');
  const total = el('span', 'll-jars-total', '100 %'); const caret = el('span', 'll-caret', '▾');
  head.append(title, total, caret);
  panel.append(head);
  head.addEventListener('click', () => { panel.classList.toggle('collapsed'); caret.textContent = panel.classList.contains('collapsed') ? '▸' : '▾'; });

  const rows = {};
  for (const k of JAR_ORDER) {
    const row = el('div', 'll-jar ' + k);
    const icon = el('div', 'll-jar-icon'); const liquid = el('i'); icon.append(liquid);
    const name = el('div', 'll-jar-name', `<span>${JAR_INFO[k].name}</span><small class="ll-jar-bal">0 ✦</small>`);
    const input = el('input'); input.type = 'range'; input.min = 0; input.max = 100; input.step = 1; input.value = st.pct[k]; input.setAttribute('aria-label', JAR_INFO[k].name + ' percent');
    const pctEl = el('div', 'll-jar-pct', `<span>${st.pct[k]}%</span>`);
    row.append(icon, name, input, pctEl);
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
  panel.append(foot, hint);
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
      r.bal.textContent = (st.balances[k] || 0) + ' ✦';
      r.row.classList.toggle('locked', !!st.locked[k]);
      if (changed === k || changed === '*') retrigger(r.icon, 'pop');
    }
    const s = sumPct(st.pct); total.textContent = s + ' %'; total.classList.toggle('bad', s !== 100);
    applyBtn.disabled = !st.dirty;
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
    apply() { st.dirty = false; render(null); bus.emit('ui:jar:apply', { pct: { ...st.pct } }); retrigger(panel, 'll-apply'); return api; },
    setCollapsed(on) { panel.classList.toggle('collapsed', !!on); caret.textContent = on ? '▸' : '▾'; return api; },
    destroy() { offs.forEach((f) => f()); panel.remove(); },
  };
  const offs = [
    bus.on('eco:jar', (p) => { if (p && p.jars) api.setBalances(p.jars); }),
    bus.on('eco:season', (r) => { if (r && r.jars) api.setBalances(r.jars); }),
  ];
  render('*');
  return api;
}
