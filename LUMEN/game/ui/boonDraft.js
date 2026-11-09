// S67 — Boon Draft modal + the owned-badge row. DOM only. Opens after a season Ledger (never on win / lose): 3 cards, ONE choice, no skip.
//   const bd = mountBoonDraft(root, { bus });
//   bd.show({ cards:[boonDef x3], families, season }, (id) => …)   // tap a card = select, PICK = confirm (keys 1-3 / Enter work too)
//   bd.setOwned(rows)  // rows = boons.ownedRow(eco) → small drawn badges under the Season pill; tap a badge = a 3 s info pop
//   bd.isOpen · bd.hide() · bd.destroy()
// Emits: ui:boon:open {ids, season} · ui:boon:select {id} · ui:boon:pick {id}
import { bus as defaultBus } from '../src/core/EventBus.js';
import { icon } from './icons.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const esc = (t) => String(t ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));

export function mountBoonDraft(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const wrap = el('section', 'll-boons'); wrap.id = 'll-boons'; wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Pick a boon');
  const backdrop = el('div', 'll-boons-backdrop');
  const sheet = el('article', 'll-boons-sheet');
  const head = el('header', 'll-boons-head');
  const title = el('h2', 'll-boons-title', icon('boon') + '<span>Pick a Boon</span>');
  const sub = el('p', 'll-boons-sub', 'One choice. Every boon has a price.');
  head.append(title, sub);
  const list = el('div', 'll-boons-cards');
  const foot = el('footer', 'll-boons-foot');
  const btn = el('button', 'll-btn ll-boons-pick', 'PICK ONE'); btn.type = 'button'; btn.disabled = true;
  foot.append(btn);
  sheet.append(head, list, foot); wrap.append(backdrop, sheet); root.appendChild(wrap);

  // owned badges (always mounted; hidden while empty / off-play)
  const row = el('nav', 'll-boon-row'); row.id = 'll-boon-row'; row.hidden = true; row.dataset.guide = 'hud:boons';   /* S68: tap the badge row -> guide card */ row.setAttribute('aria-label', 'Your boons');
  const pop = el('div', 'll-boon-pop'); pop.hidden = true;
  root.append(row, pop);

  const st = { open: false, cards: [], sel: null, cb: null, season: 1, popT: 0, owned: [] };
  const cardEls = new Map();

  function select(id) {
    if (!st.open) return; st.sel = id;
    for (const [cid, c] of cardEls) { c.classList.toggle('sel', cid === id); c.setAttribute('aria-pressed', cid === id ? 'true' : 'false'); }
    btn.disabled = false; btn.innerHTML = 'TAKE ' + esc((st.cards.find((c) => c.id === id) || {}).name || 'IT').toUpperCase() + ' ' + icon('chevR');
    bus.emit('ui:boon:select', { id });
  }
  function build(cards, fam) {
    list.innerHTML = ''; cardEls.clear();
    cards.forEach((b, i) => {
      const f = (fam && fam[b.family]) || {};
      const c = el('button', 'll-boon-card'); c.type = 'button'; c.dataset.id = b.id; c.dataset.family = b.family; c.style.setProperty('--fam', f.color || '#ccc'); c.setAttribute('aria-pressed', 'false');
      const top = el('span', 'll-boon-top'); top.innerHTML = `<span class="ll-boon-ico">${icon(f.icon || 'boon')}</span><span class="ll-boon-name">${esc(b.name)}</span><span class="ll-boon-fam">${esc(f.name || '')}</span>`;
      const up = el('span', 'll-boon-up'); up.innerHTML = `${icon('upgrade')}<span>${esc(b.up)}</span>`;
      const dn = el('span', 'll-boon-down'); dn.innerHTML = `${icon('warn')}<span>${esc(b.down)}</span>`;
      const ls = el('span', 'll-boon-lesson'); ls.textContent = b.lesson;
      const key = el('span', 'll-boon-key', String(i + 1));
      c.append(top, up, dn, ls, key);
      c.addEventListener('click', (e) => { e.stopPropagation && e.stopPropagation(); select(b.id); });
      list.appendChild(c); cardEls.set(b.id, c);
    });
    wrap.dataset.n = String(cards.length);
  }
  const api = {
    el: wrap, state: st, row,
    get isOpen() { return st.open; },
    show({ cards, families, season } = {}, cb) {
      if (!cards || !cards.length) return false;
      st.cards = cards.slice(0, 3); st.cb = cb || null; st.sel = null; st.season = season || 1; st.open = true;
      build(st.cards, families); btn.disabled = true; btn.textContent = 'PICK ONE';
      sub.textContent = `Season ${st.season} is next. One choice. Every boon has a price.`;
      wrap.classList.remove('closing'); wrap.classList.add('open'); hidePop();
      bus.emit('ui:boon:open', { ids: st.cards.map((c) => c.id), season: st.season });
      return true;
    },
    pick(id = st.sel) {
      if (!st.open || !id || !st.cards.some((c) => c.id === id)) return false;
      st.open = false; wrap.classList.remove('open'); wrap.classList.add('closing'); setTimeout(() => wrap.classList.remove('closing'), 220);
      bus.emit('ui:boon:pick', { id }); const cb = st.cb; st.cb = null; if (cb) cb(id);
      return true;
    },
    hide() { st.open = false; wrap.classList.remove('open', 'closing'); return api; },
    setOwned(rows) {
      st.owned = rows || []; row.innerHTML = '';
      for (const r of st.owned) {
        const b = el('button', 'll-boon-badge'); b.type = 'button'; b.dataset.id = r.id; b.style.setProperty('--fam', r.color || '#ccc'); b.setAttribute('aria-label', r.name + ': ' + r.up + '; ' + r.down);
        b.innerHTML = icon(r.icon || 'boon') + (r.left != null ? `<i>${r.left}</i>` : '');
        b.addEventListener('click', (e) => { e.stopPropagation && e.stopPropagation(); showPop(r); });
        row.appendChild(b);
      }
      row.hidden = !st.owned.length || !st.visible;
    },
    /** the badge row follows play state: shown only while a run is on screen */
    setVisible(v) { st.visible = !!v; row.hidden = !st.owned.length || !st.visible; if (!st.visible) hidePop(); },
    destroy() { document.removeEventListener('keydown', onKey, true); clearTimeout(st.popT); wrap.remove(); row.remove(); pop.remove(); },
  };
  st.visible = false;
  function showPop(r) { clearTimeout(st.popT); pop.innerHTML = `<b>${esc(r.name)}</b><span class="u">${icon('upgrade')}${esc(r.up)}</span><span class="d">${icon('warn')}${esc(r.down)}</span>${r.left != null ? `<em>${r.left} season${r.left === 1 ? '' : 's'} left</em>` : ''}`; pop.hidden = false; st.popT = setTimeout(hidePop, 3500); }
  function hidePop() { clearTimeout(st.popT); pop.hidden = true; }
  pop.addEventListener('click', hidePop);
  btn.addEventListener('click', (e) => { e.stopPropagation && e.stopPropagation(); api.pick(); });
  const onKey = (e) => {
    if (!st.open || e.repeat) return;
    if (e.key >= '1' && e.key <= '3') { const c = st.cards[+e.key - 1]; if (c) { e.preventDefault(); e.stopPropagation(); select(c.id); } }
    else if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); e.stopPropagation(); if (st.sel) api.pick(); }
  };
  document.addEventListener('keydown', onKey, true);
  return api;
}
export default mountBoonDraft;
