// LUMEN LEDGER — Scam Journal sheet (T5, S58). DOM only, no Three, zero gameplay logic (data = src/systems/scamJournal.js).
//   const jr = mountJournal(root, { bus, journal: () => lg.sb?.journal });   jr.open() · jr.close() · jr.isOpen · jr.render() · jr.destroy()
// Opened by the pause menu's JOURNAL button (bus 'ui:journal:open'). 9 sticker slots (6 Too-Good Deals, 3 fair deals), a 2-column grid on phones.
// Filled sticker = drawn icon + name + ONE tell line + stamp (spotted / fell for it / took it / passed). Empty sticker = grey "?" (collecting hook).
// Touch-only: every target >= 44 px, the sheet scrolls, Esc / back tap / X close it. Never invents text: tells come from data (economyData SCAMS/FAIRS).
import { icon } from './icons.js';
const el = (tag, cls, txt) => { const e = document.createElement(tag); if (cls) e.className = cls; if (txt != null) e.textContent = txt; return e; };
const DEAL_ICON = { zeroInterestLoan: 'scroll', doubleSpark: 'sparkle', luckyLantern: 'lantern', foggyInsurance: 'umbrella', premiumStallKit: 'hammer', quickFlip: 'chart', coopCrate: 'crate', honestSwap: 'lantern', neighborGift: 'basket' };
const STAMP = { spotted: ['check', 'SPOTTED'], fell: ['cross', 'FELL FOR IT'], refused: ['check', 'SAID NO'], met: ['sticker', 'MET'], took: ['check', 'TOOK IT'], passed: ['sticker', 'PASSED'] };

export function mountJournal(root, opts = {}) {
  const bus = opts.bus; const getJ = () => (typeof opts.journal === 'function' ? opts.journal() : opts.journal) || null;
  const wrap = el('div', 'll-journal'); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Scam Journal');
  const back = el('div', 'll-journal-back'); const sheet = el('div', 'll-journal-sheet');
  const head = el('div', 'll-journal-head'); const ic = el('span', 'll-journal-ico'); ic.innerHTML = icon('journal');
  const title = el('h2', 'll-journal-title', 'JOURNAL'); const count = el('span', 'll-journal-count', '0 / 9');
  const x = el('button', 'll-journal-x', '\u2715'); x.type = 'button'; x.setAttribute('aria-label', 'Close journal');
  head.append(ic, title, count, x);
  const sub = el('p', 'll-journal-sub', 'Every deal a stranger offers. Look before you decide.');
  const grid = el('div', 'll-journal-grid'); sheet.append(head, sub, grid); wrap.append(back, sheet); (root || document.body).append(wrap);
  const st = { open: false };
  const api = {
    el: wrap, sheet, grid, close: null,
    get isOpen() { return st.open; },
    summary() { return getJ()?.summary?.() || { met: 0, total: 0, spotted: 0, fell: 0, fair: 0, stars: 0 }; },
    render() {
      const J = getJ(); grid.textContent = '';
      const slots = J?.slots?.() || [];
      for (const s of slots) {
        const e = s.entry; const card = el('div', 'll-sticker ' + (e ? 'met ' + e.r : 'empty') + (s.kind === 'fair' ? ' fair' : '')); card.dataset.id = s.id; card.dataset.kind = s.kind;
        const pic = el('span', 'll-sticker-pic'); pic.innerHTML = e ? icon(DEAL_ICON[s.id] || (s.kind === 'fair' ? 'gift' : 'mask')) : '<span class="ll-sticker-q">?</span>';
        const body = el('span', 'll-sticker-body');
        body.append(el('b', 'll-sticker-name', e ? s.title : 'Not met yet'));
        body.append(el('span', 'll-sticker-tell', e ? (s.kind === 'fair' ? 'Fair: ' : 'Tell: ') + s.tell : (s.kind === 'fair' ? 'A friendly stranger with a fair deal.' : 'A stranger with a too-good deal.')));
        card.append(pic, body);
        if (e) { const [ico, lab] = STAMP[e.r] || STAMP.met; const stamp = el('span', 'll-sticker-stamp'); stamp.innerHTML = icon(ico) + '<i>' + lab + '</i>'; card.append(stamp); }
        grid.append(card);
      }
      const sm = api.summary(); count.textContent = `${sm.met} / ${sm.total}`; wrap.dataset.spotted = sm.spotted; wrap.dataset.fell = sm.fell; return sm;
    },
    open() { if (st.open) return api; st.open = true; api.render(); wrap.classList.add('open'); grid.scrollTop = 0; bus?.emit('ui:journal:opened', api.summary()); return api; },
    close() { if (!st.open) return api; st.open = false; wrap.classList.remove('open'); bus?.emit('ui:journal:closed', {}); return api; },
    destroy() { offs.forEach((f) => f?.()); wrap.remove(); },
  };
  api.close = api.close.bind(api);
  x.addEventListener('click', () => api.close()); back.addEventListener('click', () => api.close());
  const offs = [];
  if (bus) offs.push(bus.on('ui:journal:open', () => api.open()), bus.on('ui:pause:close', () => api.close()), bus.on('ui:title:open', () => api.close()), bus.on('journal:update', () => { if (st.open) api.render(); }));
  return api;
}
export default mountJournal;
