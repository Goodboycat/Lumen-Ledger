// LUMEN LEDGER — Build menu (Chat 7A). DOM only, no Three. Contract: §B UI → mountBuildMenu(root).
//
//   import { mountBuildMenu } from './ui/build.js';
//   const menu = mountBuildMenu(root, { bus, catalog: PROP_CATALOG, spark: () => eco.state.spark, categories: ['stall','decor','nature'] });
//   menu.open() / close() / toggle() / select(id) / setSpark(n) / setLocked(id, bool) / setUnlocked(['stall_fruit', ...])
//   menu.setCounts({ stall_fruit: 2 })   // badge = how many are placed (fed from build:placed/removed automatically)
//
// Emits on bus:  'ui:build' { id, cost, action: 'select' }           → integrator calls build.enter(id)
//                'ui:build' { action: 'cancel' }                      → build.exit()
//                'ui:build' { action: 'rotate' | 'confirm' | 'demolish' | 'upgrade' | 'sell' (id) }   (placing banner / foot buttons)
//                'ui:build:open' / 'ui:build:close'
// Listens:       eco:spark {spark} → affordability tint · build:enter → placing banner · build:exit/placed/removed → leave placing / counts
//                build:denied {why} → shake the card · build:ghost {ok} → confirm button green/red · ui:unlock {ids} → unlock cards
//
// Catalog entry shape used: { name, cost, category, footprint:[w,d], stallType? }. Items with cost 0 and category 'landmark' are hidden
// unless opts.showAll. Icons are emoji placeholders (ICONS map; 10A may swap for SVG via opts.icon(id, entry)).
//
// Motion: tray-in 380 ms outBack · card stagger 22 ms × index, 320 ms outBack · denied shake 360 ms · placing banner 300 ms outBack.

import { iconize, icon } from './icons.js';
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
export const CATEGORY_LABELS = { stall: 'Stalls', decor: 'Decor', nature: 'Nature', landmark: 'Landmarks', crew: 'Crew & Land' };
// BUGFIX B24: helpers + zone unlocks were debug-key only (H/Z). The 'crew' tab lists what the integrator offers via api.offers()
// → [{ id, name, icon, cost, text, kind:'helper'|'zone', owned, blocker }] and a tap emits ui:build { action:'buy', id }.
export const OFFER_ICONS = { helper_tallyOwl: '🦉', helper_packMole: '🧺', helper_sparkBee: '⚡', helper_guardTortoise: '🛡', helper_scoutFox: '👀', helper_gardenerSnail: '🌱', zone_west: '🗺', zone_east: '⚓', zone_far: '🗼' };

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };

export function mountBuildMenu(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const catalog = opts.catalog || {};
  const sparkFn = typeof opts.spark === 'function' ? opts.spark : null;
  const iconFn = opts.icon || ((id) => ICONS[id] || '▪️');
  const cats = [...(opts.categories || ['stall', 'decor', 'nature'])]; if (opts.crewTab !== false && !cats.includes('crew')) cats.push('crew');
  const st = { open: false, placing: null, selected: null, placedById: new Map(), spark: sparkFn ? sparkFn() : (opts.spark ?? 0), cat: cats[0], locked: new Set(opts.locked || []), counts: {}, demolish: false };

  const wrap = el('section', 'll-build'); wrap.id = 'll-build';
  const toggle = el('button', 'll-build-toggle', '🔨 BUILD <span class="ll-key">B</span>');
  const placing = el('div', 'll-build-placing');
  const placingTxt = el('span', null, 'Placing…');
  const rotBtn = el('button', 'll-btn', '⟳ R'); const okBtn = el('button', 'll-btn ok', '✓ place'); const noBtn = el('button', 'll-btn no', '✕ cancel');
  placing.append(placingTxt, rotBtn, okBtn, noBtn);
  // S09: demolish pill — shown INSTEAD of the 🔨 BUILD toggle while demolish mode is armed with the tray closed (the state P13 keeps).
  //   Touch players have no Esc: the ✕ Done button ends demolish mode in both layers (api.cancel → ui:build {action:'cancel'}).
  const demolishPill = el('div', 'll-build-demolishing');
  const demolishTxt = el('span', null, '💥 Demolish mode · tap a building');
  const demolishDone = el('button', 'll-btn no', '✕ Done');
  demolishPill.append(demolishTxt, demolishDone);
  const syncDemolishPill = () => wrap.classList.toggle('demolishing', !!(st.demolish && !st.open && !st.placing));
  const tray = el('div', 'll-build-tray');
  const tabs = el('nav', 'll-build-tabs');
  const sparkEl = el('span', 'll-build-spark', '✦ 0');
  const grid = el('div', 'll-build-grid');
  const foot = el('div', 'll-build-foot');
  const footTxt = el('span', null, 'pick a card → B / tap to place · R rotate');
  const demolishBtn = el('button', 'll-btn warn', '💥 demolish');
  demolishPill.dataset.role = 'demolish-pill';
  const upgradeBtn = el('button', 'll-btn', '⬆ upgrade');
  foot.append(footTxt, upgradeBtn, demolishBtn);
  // BUGFIX (mobile): tapping a card used to DEPLOY it at once (ghost + placing banner), so there was no way to pick a stall type to
  // UPGRADE. Now a tap only SELECTS the card and opens this detail bar: 🚀 Deploy (place a new one) · ⬆ Upgrade (your placed one).
  const detail = el('div', 'll-build-detail');
  const detIcon = el('span', 'll-det-icon'); const detInfo = el('span', 'll-det-info');
  const deployBtn = el('button', 'll-btn deploy', '🚀 Deploy'); const upBtn = el('button', 'll-btn up', '⬆ Upgrade'); const detClose = el('button', 'll-btn close', '✕');
  const sellBtn = el('button', 'll-btn sell', '💰 Sell');   // P12: sell one placed prop of this type from the tray (50 % refund) — no island tap needed
  deployBtn.type = upBtn.type = detClose.type = sellBtn.type = 'button';
  const priceBox = el('span', 'll-det-price'); const priceDown = el('button', 'll-btn pm', '−'); const priceVal = el('span', 'll-det-price-val', '0 ✦'); const priceUp = el('button', 'll-btn pm', '+');
  priceDown.type = priceUp.type = 'button'; priceDown.title = 'lower the price (more buyers, less per sale)'; priceUp.title = 'raise the price (fewer buyers, more per sale)';
  priceBox.append(el('small', null, 'price'), priceDown, priceVal, priceUp); priceBox.style.display = 'none';
  detail.append(detIcon, detInfo, priceBox, deployBtn, upBtn, sellBtn, detClose);
  tray.append(tabs, grid, detail, foot);
  wrap.append(placing, demolishPill, tray, toggle);
  root.appendChild(wrap);

  // tabs
  const tabEls = {};
  for (const c of cats) { const b = el('button', 'll-build-tab', CATEGORY_LABELS[c] || c); b.addEventListener('click', () => { st.cat = c; renderGrid(); }); tabs.append(b); tabEls[c] = b; }
  tabs.append(sparkEl);

  const items = () => Object.entries(catalog).filter(([id, e]) => e && e.category === st.cat && (opts.showAll || !(e.category === 'landmark' && !e.cost)) && !(opts.hide && opts.hide.includes(id)));
  const cards = new Map();
  const retrigger = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  const affordable = (cost) => (cost || 0) <= st.spark;
  // BUGFIX B09: one authoritative price — the integrator sets api.costOf = (id) => BuildSystem.cost(id) (economy balance for stalls);
  // the catalogue cost is only a fallback for standalone demos. Cards, Deploy, placing banner and affordability all read this.
  const ALIAS = { stall_bakery: 'stall_bread', stall_loaf: 'stall_bread' };   // P10: friendly ids → card ids (mirrors PROP_ALIASES in systems/build.js)
  const costOf = (id) => { const e = catalog[id] || {}; if (typeof api.costOf === 'function') { const c = api.costOf(id); if (Number.isFinite(c)) return c; } return e.cost || 0; };
  // BUGFIX B02/B06: badges come from the LIVE placed collection when the integrator provides placedInfo (starter + restored stalls count,
  // nothing survives a new run); the event-fed counter is only the standalone fallback.
  const countOf = (id) => (typeof api.placedInfo === 'function' ? api.placedInfo(id).length : (st.counts[id] || 0));
  // S29: one stall per type — a placed stall type is OWNED: its card shows a level badge (L1–L3) instead of a count and Deploy turns into
  //   "✓ Deployed · L2" (disabled) so the player reaches for ⬆ Upgrade. Decor / nature keep their counts and stay unlimited.
  const isStallId = (id) => (catalog[id] || {}).category === 'stall';
  const ownedLevel = (id) => { if (!isStallId(id)) return 0; const l = placedOf(id); return l.length ? Math.max(...l.map((e) => e.level || 1)) : 0; };
  const LEVEL_NAMES = { 1: 'L1', 2: 'L2', 3: 'L3 ★' };

  // B24: 'crew' tab = offers (helpers + zones) from the integrator; a card buys, no placement
  function renderOffers() {
    const list = typeof api.offers === 'function' ? (api.offers() || []) : [];
    if (!list.length) { grid.append(el('div', 'll-build-empty', 'nobody to hire yet')); return; }
    list.forEach((o, i) => {
      const card = el('button', 'll-card offer'); card.style.setProperty('--i', i); card.dataset.id = o.id; card.type = 'button';
      card.append(el('span', 'll-card-icon', o.icon || OFFER_ICONS[o.id] || '▪️'), el('span', 'll-card-name', o.name || o.id),
        el('span', 'll-card-cost' + (o.owned ? ' free' : ''), o.owned ? '✓ yours' : `${o.cost} ✦`), el('span', 'll-card-count', '0'));
      card.title = `${o.name || o.id} · ${o.cost} Spark${o.upkeep ? ` · ${o.upkeep} ✦/season` : ''}\n${o.text || ''}`;
      card.classList.toggle('owned', !!o.owned); card.classList.toggle('locked', !!o.blocker && o.blocker !== 'cost'); card.classList.toggle('poor', o.blocker === 'cost');
      card.addEventListener('click', () => {
        if (typeof api.offers === 'function') { const live = (api.offers() || []).find((x) => x.id === o.id); if (live) Object.assign(o, live); }   // re-check at tap time (Spark may have moved)
        if (o.owned) { footTxt.innerHTML = iconize(`${o.name}: already yours`); return; }
        if (o.blocker && o.blocker !== 'cost') { retrigger(card, 'denied'); footTxt.innerHTML = iconize(`${o.name}: ${o.blocker}`); return; }
        if (o.blocker === 'cost') { retrigger(card, 'denied'); footTxt.innerHTML = iconize(`need ${o.cost} ✦ (have ${st.spark})`); return; }
        footTxt.innerHTML = iconize(`${o.icon || OFFER_ICONS[o.id] || ''} ${o.text || o.name}`); st.demolish = false; demolishBtn.classList.remove('on'); bus.emit('ui:build', { id: o.id, cost: o.cost, action: 'buy', kind: o.kind });   // BUGFIX P30: buying an offer leaves demolish mode
      });
      card._offer = o; grid.append(card); cards.set(o.id, card);
    });
  }
  function renderGrid() {
    for (const c of cats) tabEls[c].classList.toggle('on', c === st.cat);
    grid.innerHTML = ''; cards.clear();
    wrap.classList.toggle('crew', st.cat === 'crew');
    if (st.cat === 'crew') { renderOffers(); refreshCards(); return; }
    items().forEach(([id, e], i) => {
      const cost = costOf(id);
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
    sparkEl.innerHTML = iconize(`✦ ${st.spark}`);
    if (st.cat === 'crew') { for (const [, card] of cards) { const o = card._offer; if (o && !o.owned && (!o.blocker || o.blocker === 'cost')) { o.blocker = o.cost > st.spark ? 'cost' : null; card.classList.toggle('poor', o.blocker === 'cost'); } } refreshDetail(); return; }   // offers re-render on eco:upgrade / sandbox:hired
    for (const [id, card] of cards) {
      const locked = st.locked.has(id); const cost = costOf(id);
      card.classList.toggle('poor', !locked && !affordable(cost));
      const cEl = card.querySelector && card.querySelector('.ll-card-cost'); if (cEl) cEl.innerHTML = iconize(cost ? `${cost} ✦` : 'free');
      card.classList.toggle('locked', locked);
      card.classList.toggle('selected', st.selected === id);
      const n = countOf(id); const lvl = ownedLevel(id);
      card.classList.toggle('owned', lvl > 0); card.classList.toggle('maxed', lvl >= 3);
      card.classList.toggle('has-count', n > 0); card.lastChild.textContent = lvl > 0 ? LEVEL_NAMES[lvl] || 'L' + lvl : n;
      if (lvl > 0 && cEl) cEl.innerHTML = iconize(lvl >= 3 ? '★ max' : '✓ yours');
      card.classList.toggle('poor', !locked && lvl === 0 && !affordable(cost));   // an owned stall is never "too expensive" — it is already bought
    }
    refreshDetail();
  }
  // placed entries per id (fed by build:placed / upgraded / removed) → the Upgrade button knows levels without touching BuildSystem
  const placedOf = (id) => (typeof api.placedInfo === 'function' ? api.placedInfo(id) : [...(st.placedById.get(id)?.values() || [])]);
  function upgradeInfo(id) {
    const list = placedOf(id); if (!list.length) return { can: false, why: 'none placed yet' };
    const low = list.filter((e) => (e.level || 1) < 3); if (!low.length) return { can: false, why: 'all at max level' };
    const lvl = Math.min(...low.map((e) => e.level || 1)); const cost = typeof api.upgradeCost === 'function' ? api.upgradeCost(lvl + 1) : null;
    return { can: true, lvl, to: lvl + 1, cost, poor: cost != null && cost > st.spark };
  }
  function refreshDetail() {
    const id = st.selected, e = id && catalog[id];
    wrap.classList.toggle('has-detail', !!e); if (!e) return;
    const cost = costOf(id), n = countOf(id), lvl = ownedLevel(id);
    detIcon.innerHTML = iconize(iconFn(id, e));
    const isStall = e.category === 'stall';
    detInfo.innerHTML = iconize(`<b>${e.name || id}</b><small>${lvl ? `✓ yours · ${LEVEL_NAMES[lvl] || 'L' + lvl}` : (cost ? cost + ' ✦' : 'free')} · ${(e.footprint || [1, 1]).join('×')}${n && !isStall ? ` · ${n} placed` : ''}</small>`);
    const poor = !affordable(cost);
    // S29: an owned stall type cannot be deployed twice — the button says so and hands over to ⬆ Upgrade
    deployBtn.disabled = lvl > 0 || poor; deployBtn.classList.toggle('poor', poor && !lvl); deployBtn.classList.toggle('owned', lvl > 0);
    deployBtn.innerHTML = iconize(lvl > 0 ? `✓ Deployed · ${LEVEL_NAMES[lvl] || 'L' + lvl}` : poor ? `🚀 need ${cost} ✦` : '🚀 Deploy');
    deployBtn.title = lvl > 0 ? `you already run a ${e.name || id} (one stall per type) — upgrade it instead` : 'place a new one on the island';
    // BUGFIX P24: the refund is 50 % of the ACTUAL entry cost (base + upgrades) of the stall that would be sold (lowest level first, like Game.js)
    const sellTarget = n ? placedOf(id).slice().sort((a, b) => (a.level || 1) - (b.level || 1))[0] : null; const sellCost = sellTarget && sellTarget.cost != null ? sellTarget.cost : cost;
    // S07: pre-spawned clutter (cost 0 + salvage) sells for its flat salvage bonus → label says "Salvage"
    const isSalvage = !!(sellTarget && sellTarget.salvage && !(sellTarget.cost > 0));
    const refund = isSalvage ? Math.round(sellTarget.salvage) : Math.round(sellCost * 0.5 + 1e-9);
    sellBtn.style.display = n ? '' : 'none'; sellBtn.innerHTML = iconize(`${isSalvage ? '🧹 Salvage' : '💰 Sell'}${n > 1 ? ' 1' : ''} · +${refund} ✦`); sellBtn.title = isSalvage ? `clear this ${e.name || id} off the island for a ${refund} ✦ salvage bonus (frees its tiles)` : `sell your ${n > 1 ? 'lowest-level ' : ''}${e.name || id} for half its cost (upgrades refunded too)`;
    upBtn.style.display = isStall ? '' : 'none'; priceBox.style.display = isStall && n && typeof api.priceOf === 'function' ? '' : 'none';
    if (isStall && n && typeof api.priceOf === 'function') {   // B24: price control for a placed stall type (CustomerSystem.setPrice via ui:price)
      const pr = api.priceOf(id) || {}; const p = pr.price ?? 0, f = pr.fair ?? p; const tag = p > f * 1.25 ? ' · greedy?' : p < f * 0.75 ? ' · cheap' : ' · fair';
      priceVal.innerHTML = iconize(`${p} ✦${tag}`); priceVal.classList.toggle('hot', p > f * 1.25); priceDown.disabled = p <= 1;
    }
    if (isStall) {
      const u = upgradeInfo(id);
      upBtn.disabled = !u.can || u.poor; upBtn.classList.toggle('poor', !!u.poor);
      upBtn.innerHTML = iconize(u.can ? `⬆ Upgrade L${u.lvl}→${u.to}${u.cost != null ? ` · ${u.cost} ✦` : ''}` : `⬆ ${u.why}`);
    }
  }

  const api = {
    el: wrap, state: st, cards,
    get isOpen() { return st.open; },
    open() { if (st.open) return api; st.open = true; wrap.classList.remove('closing'); wrap.classList.add('open'); renderGrid(); if (st.demolish) footTxt.textContent = 'demolish: tap a building (50 % refund)'; syncDemolishPill(); bus.emit('ui:build:open', {}); return api; },
    // BUGFIX P13: close() keeps st.demolish (the player closes the tray to tap a stall on the island) — the 💥 button stays `.on` and
    // the integrator keeps lg.demolishMode; Esc / a card pick / 💥 again / cancel() end it in both layers.
    close() {
      if (!st.open) return api; st.open = false; wrap.classList.remove('open'); wrap.classList.add('closing');
      setTimeout(() => wrap.classList.remove('closing'), 220); st.selected = null; refreshCards(); syncDemolishPill(); bus.emit('ui:build:close', {}); return api;
    },
    toggle() { return st.open ? api.close() : api.open(); },
    select(id) {
      if (!catalog[id] && ALIAS[id]) id = ALIAS[id];   // P10
      const e = catalog[id]; if (!e) return api;
      const card = cards.get(id);
      if (st.locked.has(id)) { if (card) retrigger(card, 'denied'); footTxt.textContent = 'locked — finish the lesson first'; return api; }
      if (st.selected === id && opts.tapAgainDeploys) return api.deploy(id);
      st.selected = id; st.demolish = false; demolishBtn.classList.remove('on'); refreshCards();
      const lvl = ownedLevel(id);
      footTxt.innerHTML = iconize(e.category === 'stall' ? (lvl >= 3 ? `${e.name}: ★ max level — your best stall` : lvl ? `${e.name}: already yours (L${lvl}) → ⬆ upgrade it` : `${e.name}: 🚀 deploy it (one per type) or ⬆ upgrade later`) : `${e.name}: 🚀 deploy to place it`);
      bus.emit('ui:build', { id, cost: costOf(id), action: 'pick', footprint: e.footprint });
      return api;
    },
    /** Deploy = enter place mode for `id` (the old one-tap behaviour). Emits ui:build {action:'select'} → integrator calls build.enter(id). */
    deploy(id = st.selected) {
      if (!catalog[id] && ALIAS[id]) id = ALIAS[id];   // P10
      const e = catalog[id]; if (!e) return api;
      const card = cards.get(id);
      if (st.locked.has(id)) { if (card) retrigger(card, 'denied'); footTxt.textContent = 'locked — finish the lesson first'; return api; }
      const cost = costOf(id);
      // S29: one stall per type — a second Deploy is refused in the tray (BuildSystem.enter refuses it too, belt and braces)
      const lvl = ownedLevel(id);
      if (lvl > 0) { if (card) retrigger(card, 'denied'); st.selected = id; refreshCards(); footTxt.innerHTML = iconize(`${e.name}: already yours (L${lvl}) — one stall per type, ⬆ upgrade it instead`); bus.emit('ui:build', { id, cost, action: 'denied', why: 'duplicate', level: lvl }); return api; }
      if (!affordable(cost)) { if (card) retrigger(card, 'denied'); footTxt.innerHTML = iconize(`need ${cost} ✦ (have ${st.spark})`); bus.emit('ui:build', { id, cost, action: 'denied', why: 'cannot afford' }); return api; }
      st.selected = id; st.demolish = false; demolishBtn.classList.remove('on'); refreshCards();
      footTxt.innerHTML = iconize((document.body?.classList?.contains('is-touch') ? `${e.name}: tap / drag on the ground (or walk Pip) to move it · ✓ place` : `${e.name}: click the ground to place · R rotate · Esc cancel`));
      bus.emit('ui:build', { id, cost, action: 'select', footprint: e.footprint });
      return api;
    },
    /** Upgrade your placed `id` stall (integrator picks which: the lowest level, nearest Pip). Emits ui:build {action:'upgrade', id}. */
    upgradeSelected(id = st.selected) { if (!id) return api; bus.emit('ui:build', { action: 'upgrade', id }); return api; },
    /** P12: sell one placed prop of type `id` (integrator picks the lowest-level one, nearest Pip on ties; refund 50 %). */
    sellSelected(id = st.selected) { if (!id || !countOf(id)) return api; bus.emit('ui:build', { action: 'sell', id }); return api; },
    deselect() { st.selected = null; refreshCards(); footTxt.textContent = 'pick a card'; return api; },
    upgradeCost: opts.upgradeCost || null,   // (level) => cost   · set by the integrator (Game.js)
    offers: opts.offers || null,             // () => [{ id, name, icon, cost, upkeep, text, kind, owned, blocker }] · B24 crew tab (helpers + zones)
    priceOf: opts.priceOf || null,           // (id) => { price, fair } · B24 price control in the stall detail bar
    /** Nudge the selected stall type's price by ±1 (emits ui:price { id, delta }). */
    nudgePrice(delta, id = st.selected) { if (!id) return api; bus.emit('ui:price', { id, delta }); return api; },
    placedInfo: opts.placedInfo || null,     // (id) => [{ level }] · set by the integrator so silently-loaded starter stalls count too
    costOf: opts.costOf || null,             // (id) => Spark · set by the integrator (BuildSystem.cost) — BUGFIX B09
    /** BUGFIX B02: forget everything about the previous run (badges, tracked entries, selection, placing). */
    reset() { st.counts = {}; st.placedById.clear(); st.selected = null; st.demolish = false; demolishBtn.classList.remove('on'); api.setPlacing(null); refreshCards(); syncDemolishPill(); return api; },
    refresh() { refreshCards(); return api; },
    cancel() { st.selected = null; st.demolish = false; demolishBtn.classList.remove('on'); api.setPlacing(null); refreshCards(); syncDemolishPill(); bus.emit('ui:build', { action: 'cancel' }); return api; },
    /** S09: true while the floating demolish pill is shown (demolish armed, tray closed). */
    get demolishPillVisible() { return wrap.classList.contains('demolishing'); },
    setPlacing(id) {
      const was = st.placing; st.placing = id; wrap.classList.toggle('placing', !!id);
      // BUGFIX P40: while placing, the open tray is only hidden by CSS — so it popped back up over the island the moment the stall was
      // placed. When placing ends the tray now closes for real (build.mode is already idle, so the ui:build:close → build.exit() is a no-op).
      if (!id && was && st.open) { wrap.classList.remove('has-detail'); api.close(); }
      if (id) { const e = catalog[id] || {}; placingTxt.innerHTML = iconize(`${iconFn(id, e)} ${e.name || id} · ${costOf(id)} ✦`); }
      return api;
    },
    setGhostOk(ok) { okBtn.classList.toggle('ok', !!ok); okBtn.classList.toggle('no', !ok); okBtn.innerHTML = iconize(ok ? '✓ place' : '✕ blocked'); return api; },
    setSpark(n) { st.spark = Math.round(+n || 0); refreshCards(); return api; },
    setLocked(id, on = true) { on ? st.locked.add(id) : st.locked.delete(id); refreshCards(); return api; },
    setUnlocked(ids) { for (const id of ids || []) st.locked.delete(id); refreshCards(); return api; },
    lockAllExcept(ids) { st.locked = new Set(Object.keys(catalog).filter((k) => !ids.includes(k))); refreshCards(); return api; },
    setCounts(map) { Object.assign(st.counts, map || {}); refreshCards(); return api; },
    setCategory(c) { if (cats.includes(c)) { st.cat = c; if (st.selected && (!catalog[st.selected] || (catalog[st.selected].category || 'prop') !== c)) st.selected = null; renderGrid(); } return api; },   // BUGFIX P29: a card from another tab no longer leaves its detail bar open
    destroy() { offs.forEach((f) => f()); window.removeEventListener('keydown', onKey); wrap.remove(); },
  };

  toggle.addEventListener('click', () => api.toggle());
  deployBtn.addEventListener('click', () => api.deploy());
  upBtn.addEventListener('click', () => api.upgradeSelected());
  sellBtn.addEventListener('click', () => api.sellSelected());
  priceDown.addEventListener('click', () => api.nudgePrice(-1)); priceUp.addEventListener('click', () => api.nudgePrice(+1));
  detClose.addEventListener('click', () => api.deselect());
  rotBtn.addEventListener('click', () => bus.emit('ui:build', { action: 'rotate' }));
  okBtn.addEventListener('click', () => bus.emit('ui:build', { action: 'confirm' }));
  noBtn.addEventListener('click', () => api.cancel());
  demolishDone.addEventListener('click', () => { api.cancel(); bus.emit('ui:demolish:stop', { source: 'pill' }); });   // S09
  demolishBtn.addEventListener('click', () => { st.demolish = !st.demolish; st.selected = null; demolishBtn.classList.toggle('on', st.demolish); refreshCards(); footTxt.textContent = st.demolish ? 'demolish: tap a building (50 % refund)' : 'pick a card'; bus.emit('ui:build', { action: st.demolish ? 'demolish' : 'cancel' }); });
  upgradeBtn.addEventListener('click', () => bus.emit('ui:build', { action: 'upgrade' }));
  const onKey = (e) => {
    if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
    const k = e.key.toLowerCase();
    if (k === 'b' && !e.repeat && !st.placing && !opts.noHotkey) api.toggle();
    if (k === 'r' && !e.repeat && st.placing) bus.emit('ui:build', { action: 'rotate' });   // BUGFIX B21: the advertised R rotate
    if (e.key === 'Escape' && !opts.noEsc) { if (st.placing || st.demolish) api.cancel(); else if (st.open) api.close(); }   // P13: Esc leaves demolish mode even with the tray closed · S11: ui/index.js owns Esc (noEsc) in the real game
  };
  window.addEventListener('keydown', onKey);

  const offs = [
    bus.on('eco:spark', (p) => { if (p && p.spark != null) api.setSpark(p.spark); }),
    bus.on('eco:season', (r) => { if (r && r.spark != null) api.setSpark(r.spark); }),
    bus.on('build:enter', (p) => { api.setPlacing(p && p.id); }),
    bus.on('build:exit', () => { api.setPlacing(null); }),
    bus.on('build:ghost', (p) => { api.setGhostOk(p && p.ok); }),
    // BUGFIX B13: placing UI follows the BuildSystem — only build:exit leaves placing (it used to drop the banner here while the
    // world ghost stayed armed, so Esc no longer cancelled and a later click could still spend Spark)
    bus.on('build:placed', (p) => { if (p && p.id) { st.counts[p.id] = (st.counts[p.id] || 0) + 1; track(p, true); } refreshCards(); }),
    bus.on('build:removed', (p) => { if (p && p.id) { st.counts[p.id] = Math.max(0, (st.counts[p.id] || 0) - 1); track(p, false); } refreshCards(); }),
    bus.on('build:upgraded', (p) => { if (p && p.id) track(p, true); if (p && p.level) footTxt.innerHTML = iconize(`⬆ upgraded to L${p.level}!`); refreshCards(); }),
    bus.on('build:denied', (p) => { const id = (p && p.id) || st.selected || st.placing; const c = id && cards.get(id); if (c) retrigger(c, 'denied'); footTxt.innerHTML = iconize(p && p.why2 === 'duplicate' ? `one stall per type — your ${(catalog[id] || {}).name || id} is L${p.level || 1}: ⬆ upgrade it` : 'denied: ' + ((p && p.why) || '?')); }),
    bus.on('ui:unlock', (p) => { if (p && p.ids) api.setUnlocked(p.ids); }),
    bus.on('build:loaded', () => refreshCards()),
    bus.on('cust:price', () => refreshDetail()),                                   // B24: price changed (ui:price → Game.js → cust.setPrice)
    bus.on('eco:upgrade', () => { if (st.cat === 'crew') renderGrid(); }),         // B24: helper hired / zone bought → offer cards update
    bus.on('sandbox:hired', () => { if (st.cat === 'crew') renderGrid(); }),
  ];
  function track(p, on) {
    const ent = p.entry || p; const k = ent.uid ?? `${p.cx},${p.cz}`;
    let m = st.placedById.get(p.id); if (!m) st.placedById.set(p.id, (m = new Map()));
    if (on) m.set(k, { level: ent.level || p.level || 1 }); else m.delete(k);
  }
  renderGrid();
  return api;
}
