// LUMEN LEDGER — Build menu (Chat 7A). DOM only, no Three. Contract: §B UI → mountBuildMenu(root).
//
//   import { mountBuildMenu } from './ui/build.js';
//   const menu = mountBuildMenu(root, { bus, catalog: PROP_CATALOG, spark: () => eco.state.spark, categories: ['stall','decor','nature'] });
//   menu.open() / close() / toggle() / select(id) / setSpark(n) / setLocked(id, bool) / setUnlocked(['stall_fruit', ...])
//   menu.setCounts({ stall_fruit: 2 })   // badge = how many are placed (fed from build:placed/removed automatically)
//
// Emits on bus:  'ui:build' { id, cost, action: 'select' }           → integrator calls build.enter(id)
//                'ui:build' { action: 'cancel' }                      → build.exit()
//                'ui:build' { action: 'rotate' | 'confirm' | 'demolish' | 'upgrade' }   (placing banner / foot buttons)
//                'ui:build:open' / 'ui:build:close'
// Listens:       eco:spark {spark} → affordability tint · build:enter → placing banner · build:exit/placed/removed → leave placing / counts
//                build:denied {why} → shake the card · build:ghost {ok} → confirm button green/red · ui:unlock {ids} → unlock cards
//
// Catalog entry shape used: { name, cost, category, footprint:[w,d], stallType? }. Items with cost 0 and category 'landmark' are hidden
// unless opts.showAll. Icons are emoji placeholders (ICONS map; 10A may swap for SVG via opts.icon(id, entry)).
//
// Motion: tray-in 380 ms outBack · card stagger 22 ms × index, 320 ms outBack · denied shake 360 ms · placing banner 300 ms outBack.

import { bus as defaultBus } from '../src/core/EventBus.js';

export const ICONS = {
  stall_fruit: '🍎', stall_bread: '🥖', stall_lantern: '🏮', stall_fish: '🐟', stall_flower: '🌷', stall_tool: '🔨', stall_cloth: '🧵', stall_pottery: '🏺',
  stall_toy: '🧸', stall_tea: '🍵', stall_book: '📚', stall_sparkExchange: '✦',
  tree_round: '🌳', tree_cone: '🌲', tree_double: '🌳', tree_palm: '🌴', tree_blossom: '🌸', tree_tall: '🌲', tree_bush: '🌳', tree_lantern: '🎐',
  rock_small: '🪨', rock_medium: '🪨', rock_large: '⛰️', rock_flat: '🪨', rock_spire: '🗻', rock_cluster: '🪨', rock_crystal: '💎', rock_arch: '🌉', rock_mossy: '🪨', rock_cliff: '🧱',
  bush_round: '🌿', bush_berry: '🫐', bush_hedge: '🌿', bush_flower: '💐', bush_fern: '🌿', bush_tallgrass: '🌾',
  lighthouse: '🗼', cottage: '🏠', pier: '⚓', bridge: '🌉', fog_tower: '🏯', cliff_wall: '🧱', waterfall: '💧',
  jar_spend: '🫙', jar_save: '🫙', jar_invest: '🫙', jar_protect: '🫙', fence_post: '🪵', fence_rail: '🪵', fence_gate: '🚪', crate: '📦', barrel: '🛢️',
  lantern_post: '🏮', lantern_hanging: '🏮', sign_arrow: '➡️', sign_board: '🪧', sign_hanging: '🪧', bench: '🪑', path_dirt: '🟫', path_stone: '⬜', banner_string: '🎏', flower_pot: '🪴', water_trough: '🛁',
};
export const CATEGORY_LABELS = { stall: 'Stalls', decor: 'Decor', nature: 'Nature', landmark: 'Landmarks' };

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export function mountBuildMenu(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const catalog = opts.catalog || {};
  const sparkFn = typeof opts.spark === 'function' ? opts.spark : null;
  const iconFn = opts.icon || ((id) => ICONS[id] || '▪️');
  const cats = opts.categories || ['stall', 'decor', 'nature'];
  const st = { open: false, placing: null, selected: null, spark: sparkFn ? sparkFn() : (opts.spark ?? 0), cat: cats[0], locked: new Set(opts.locked || []), counts: {}, demolish: false };

  const wrap = el('section', 'll-build'); wrap.id = 'll-build';
  const toggle = el('button', 'll-build-toggle', '🔨 BUILD <span class="ll-key">B</span>');
  const placing = el('div', 'll-build-placing');
  const placingTxt = el('span', null, 'Placing…');
  const rotBtn = el('button', 'll-btn', '⟳ R'); const okBtn = el('button', 'll-btn ok', '✓ place'); const noBtn = el('button', 'll-btn no', '✕ cancel');
  placing.append(placingTxt, rotBtn, okBtn, noBtn);
  const tray = el('div', 'll-build-tray');
  const tabs = el('nav', 'll-build-tabs');
  const sparkEl = el('span', 'll-build-spark', '✦ 0');
  const grid = el('div', 'll-build-grid');
  const foot = el('div', 'll-build-foot');
  const footTxt = el('span', null, 'pick a card → B / tap to place · R rotate');
  const demolishBtn = el('button', 'll-btn warn', '💥 demolish');
  const upgradeBtn = el('button', 'll-btn', '⬆ upgrade');
  foot.append(footTxt, upgradeBtn, demolishBtn);
  tray.append(tabs, grid, foot);
  wrap.append(placing, tray, toggle);
  root.appendChild(wrap);

  // tabs
  const tabEls = {};
  for (const c of cats) { const b = el('button', 'll-build-tab', CATEGORY_LABELS[c] || c); b.addEventListener('click', () => { st.cat = c; renderGrid(); }); tabs.append(b); tabEls[c] = b; }
  tabs.append(sparkEl);

  const items = () => Object.entries(catalog).filter(([id, e]) => e && e.category === st.cat && (opts.showAll || !(e.category === 'landmark' && !e.cost)) && !(opts.hide && opts.hide.includes(id)));
  const cards = new Map();
  const retrigger = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  const affordable = (cost) => (cost || 0) <= st.spark;

  function renderGrid() {
    for (const c of cats) tabEls[c].classList.toggle('on', c === st.cat);
    grid.innerHTML = ''; cards.clear();
    items().forEach(([id, e], i) => {
      const cost = e.cost || 0;
      const card = el('button', 'll-card'); card.style.setProperty('--i', i); card.dataset.id = id;
      card.append(el('span', 'll-card-fp', (e.footprint || [1, 1]).join('×')), el('span', 'll-card-icon', iconFn(id, e)), el('span', 'll-card-name', e.name || id),
        el('span', 'll-card-cost' + (cost ? '' : ' free'), cost ? `${cost} ✦` : 'free'), el('span', 'll-card-count', '0'));
      card.title = `${e.name || id} · ${cost} Spark · ${(e.footprint || [1, 1]).join('×')} cells`;
      card.addEventListener('click', () => api.select(id));
      grid.append(card); cards.set(id, card);
    });
    refreshCards();
  }
  function refreshCards() {
    sparkEl.textContent = `✦ ${st.spark}`;
    for (const [id, card] of cards) {
      const e = catalog[id]; const locked = st.locked.has(id);
      card.classList.toggle('poor', !locked && !affordable(e.cost));
      card.classList.toggle('locked', locked);
      card.classList.toggle('selected', st.selected === id);
      const n = st.counts[id] || 0; card.classList.toggle('has-count', n > 0); card.lastChild.textContent = n;
    }
  }

  const api = {
    el: wrap, state: st, cards,
    get isOpen() { return st.open; },
    open() { if (st.open) return api; st.open = true; wrap.classList.remove('closing'); wrap.classList.add('open'); renderGrid(); bus.emit('ui:build:open', {}); return api; },
    close() {
      if (!st.open) return api; st.open = false; wrap.classList.remove('open'); wrap.classList.add('closing');
      setTimeout(() => wrap.classList.remove('closing'), 220); st.selected = null; refreshCards(); bus.emit('ui:build:close', {}); return api;
    },
    toggle() { return st.open ? api.close() : api.open(); },
    select(id) {
      const e = catalog[id]; if (!e) return api;
      const card = cards.get(id);
      if (st.locked.has(id)) { if (card) retrigger(card, 'denied'); footTxt.textContent = 'locked — finish the lesson first'; return api; }
      if (!affordable(e.cost)) { if (card) retrigger(card, 'denied'); footTxt.textContent = `need ${e.cost} ✦ (have ${st.spark})`; bus.emit('ui:build', { id, cost: e.cost || 0, action: 'denied', why: 'cannot afford' }); return api; }
      st.selected = id; st.demolish = false; demolishBtn.classList.remove('on'); refreshCards();
      footTxt.textContent = `${e.name}: tap the ground to place · R rotate · Esc cancel`;
      bus.emit('ui:build', { id, cost: e.cost || 0, action: 'select', footprint: e.footprint });
      return api;
    },
    cancel() { st.selected = null; st.demolish = false; demolishBtn.classList.remove('on'); api.setPlacing(null); refreshCards(); bus.emit('ui:build', { action: 'cancel' }); return api; },
    setPlacing(id) {
      st.placing = id; wrap.classList.toggle('placing', !!id);
      if (id) { const e = catalog[id] || {}; placingTxt.textContent = `${iconFn(id, e)} ${e.name || id} · ${e.cost || 0} ✦`; }
      return api;
    },
    setGhostOk(ok) { okBtn.classList.toggle('ok', !!ok); okBtn.classList.toggle('no', !ok); okBtn.textContent = ok ? '✓ place' : '✕ blocked'; return api; },
    setSpark(n) { st.spark = Math.round(+n || 0); refreshCards(); return api; },
    setLocked(id, on = true) { on ? st.locked.add(id) : st.locked.delete(id); refreshCards(); return api; },
    setUnlocked(ids) { for (const id of ids || []) st.locked.delete(id); refreshCards(); return api; },
    lockAllExcept(ids) { st.locked = new Set(Object.keys(catalog).filter((k) => !ids.includes(k))); refreshCards(); return api; },
    setCounts(map) { Object.assign(st.counts, map || {}); refreshCards(); return api; },
    setCategory(c) { if (cats.includes(c)) { st.cat = c; renderGrid(); } return api; },
    destroy() { offs.forEach((f) => f()); window.removeEventListener('keydown', onKey); wrap.remove(); },
  };

  toggle.addEventListener('click', () => api.toggle());
  rotBtn.addEventListener('click', () => bus.emit('ui:build', { action: 'rotate' }));
  okBtn.addEventListener('click', () => bus.emit('ui:build', { action: 'confirm' }));
  noBtn.addEventListener('click', () => api.cancel());
  demolishBtn.addEventListener('click', () => { st.demolish = !st.demolish; st.selected = null; demolishBtn.classList.toggle('on', st.demolish); refreshCards(); footTxt.textContent = st.demolish ? 'demolish: tap a building (50 % refund)' : 'pick a card'; bus.emit('ui:build', { action: st.demolish ? 'demolish' : 'cancel' }); });
  upgradeBtn.addEventListener('click', () => bus.emit('ui:build', { action: 'upgrade' }));
  const onKey = (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'b' && !e.repeat && !st.placing && !opts.noHotkey) api.toggle();
    if (e.key === 'Escape') { if (st.placing) api.cancel(); else if (st.open) api.close(); }
  };
  window.addEventListener('keydown', onKey);

  const offs = [
    bus.on('eco:spark', (p) => { if (p && p.spark != null) api.setSpark(p.spark); }),
    bus.on('eco:season', (r) => { if (r && r.spark != null) api.setSpark(r.spark); }),
    bus.on('build:enter', (p) => { api.setPlacing(p && p.id); }),
    bus.on('build:exit', () => { api.setPlacing(null); }),
    bus.on('build:ghost', (p) => { api.setGhostOk(p && p.ok); }),
    bus.on('build:placed', (p) => { if (p && p.id) { st.counts[p.id] = (st.counts[p.id] || 0) + 1; } api.setPlacing(null); st.selected = null; refreshCards(); }),
    bus.on('build:removed', (p) => { if (p && p.id) st.counts[p.id] = Math.max(0, (st.counts[p.id] || 0) - 1); refreshCards(); }),
    bus.on('build:denied', (p) => { const id = (p && p.id) || st.selected || st.placing; const c = id && cards.get(id); if (c) retrigger(c, 'denied'); footTxt.textContent = 'denied: ' + ((p && p.why) || '?'); }),
    bus.on('ui:unlock', (p) => { if (p && p.ids) api.setUnlocked(p.ids); }),
  ];
  renderGrid();
  return api;
}
