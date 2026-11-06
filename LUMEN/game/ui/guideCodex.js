// LUMEN LEDGER — T2 guide codex (FUN_PASS §7.A entry point 3). DOM only, no Three, zero gameplay logic.
//
//   import { mountGuideCodex } from './guideCodex.js';
//   const codex = mountGuideCodex(root, { bus, tutor });      // tutor = ui/tutor.js api (reads tutor.list() = same data/tutor.json + counts)
//   codex.open() · codex.close() · codex.isOpen · codex.render() · codex.summary() → { met, total } · codex.destroy()
//
// Opened by the pause menu's GUIDE button (bus 'ui:guide:open'). Lives above the pause sheet: the game is already paused, so nothing runs.
// Rows are ≥ 44 px (touch), met cards show icon + text, unmet cards are grey with a "?" and the hint of WHERE the thing lives (the group).
// Header counts "12 / 34 met". Card text is never invented here — it is data/tutor.json's.
import { icon } from './icons.js';

const GROUPS = [['jars', 'JARS'], ['market', 'MARKET'], ['money', 'MONEY'], ['threats', 'THREATS'], ['people', 'PEOPLE'], ['crew', 'CREW'], ['powers', 'POWERS'], ['verbs', 'FIRST STEPS'], ['build', 'BUILD'], ['world', 'WORLD'], ['other', 'OTHER']];

const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };

export function mountGuideCodex(root, opts = {}) {
  const bus = opts.bus; const tutor = opts.tutor || null;
  const wrap = el('div', 'll-codex'); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Guide');
  const back = el('div', 'll-codex-back');
  const sheet = el('div', 'll-codex-sheet');
  const head = el('div', 'll-codex-head');
  const title = el('h2', 'll-codex-title', 'GUIDE'); const count = el('span', 'll-codex-count', '0 / 0 met');
  const x = el('button', 'll-codex-x', '✕'); x.type = 'button'; x.setAttribute('aria-label', 'Close guide');
  head.append(title, count, x);
  const hint = el('p', 'll-codex-sub', 'Everything you have met. Grey = not found yet.');
  const list = el('div', 'll-codex-list');
  sheet.append(head, hint, list); wrap.append(back, sheet); (root || document.body).append(wrap);

  const st = { open: false };
  const api = {
    el: wrap, sheet, list, count, close: null,
    get isOpen() { return st.open; },
    summary() { const rows = tutor?.list ? tutor.list() : []; let met = 0; for (const r of rows) if (r.met) met++; return { met, total: rows.length }; },
    /** Rebuild the rows from the tutor's current counts (cheap: ≤ 60 rows, only while open). */
    render() {
      const rows = tutor?.list ? tutor.list() : []; const by = new Map();
      for (const r of rows) { const g = by.get(r.group) || by.set(r.group, []).get(r.group); g.push(r); }
      list.textContent = '';
      const order = [...GROUPS.map((g) => g[0]), ...[...by.keys()].filter((k) => !GROUPS.some((g) => g[0] === k))];
      for (const key of order) {
        const rs = by.get(key); if (!rs || !rs.length) continue;
        const name = (GROUPS.find((g) => g[0] === key) || [key, key.toUpperCase()])[1];
        const metN = rs.filter((r) => r.met).length;
        const h = el('div', 'll-codex-group'); h.append(el('span', null, name), el('span', 'll-codex-gn', `${metN} / ${rs.length}`)); list.append(h);
        for (const r of rs) {
          const row = el('div', 'll-codex-row' + (r.met ? ' met' : ' unmet')); row.dataset.id = r.id;
          const ic = el('span', 'll-codex-ico'); ic.innerHTML = r.met && r.icon ? icon(r.icon) : '<span class="ll-codex-q">?</span>';
          const tx = el('span', 'll-codex-txt', r.met ? r.text : 'Not found yet — keep exploring.');
          row.append(ic, tx);
          if (r.met && r.count > 1) row.append(el('span', 'll-codex-n', '×' + r.count));
          list.append(row);
        }
      }
      const s = api.summary(); count.textContent = `${s.met} / ${s.total} met`;
      return s;
    },
    open() { if (st.open) return api; st.open = true; api.render(); wrap.classList.add('open'); list.scrollTop = 0; if (bus) bus.emit('ui:guide:opened', api.summary()); return api; },
    close() { if (!st.open) return api; st.open = false; wrap.classList.remove('open'); if (bus) bus.emit('ui:guide:closed', {}); return api; },
    destroy() { offs.forEach((f) => f()); wrap.remove(); },
  };
  api.close = api.close.bind(api);
  x.addEventListener('click', () => api.close()); back.addEventListener('click', () => api.close());
  const offs = [];
  if (bus) offs.push(bus.on('ui:guide:open', () => api.open()), bus.on('ui:pause:close', () => api.close()), bus.on('ui:title:open', () => api.close()));
  return api;
}
export default mountGuideCodex;
