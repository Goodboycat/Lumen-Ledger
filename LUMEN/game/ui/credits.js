// LUMEN LEDGER — Credits after THE END (S71). DOM only, no Three.
//
//   import { mountCredits } from './ui/credits.js';
//   const cr = mountCredits(root, { bus, lessons: storyData.lessons });
//   cr.show({ stars, seasons })  ·  cr.hide()  ·  cr.isOpen  ·  cr.destroy()
//
// Opens by itself on `game:won` {season, stars} (Game.finishRun: ledger THE END ▸ -> game:won -> title). The title is already coming back
// underneath; this card sits above it (z 60) until the player taps BACK TO TITLE (Enter / Space / Esc / tap anywhere on the button).
// Shows: trophy + "You lit the Lighthouse", the star total, the ten lessons the player learnt (one drawn rosette each), a thank-you line.
// Emits: ui:credits:open / ui:credits:close.   Swallows Enter / Space / Esc while open so the title behind never starts a game.
import { bus as defaultBus } from '../src/core/EventBus.js';
import { icon, iconize } from './icons.js';

const FALLBACK = [['budgeting', 'Budgeting'], ['needsVsWants', 'Needs vs Wants'], ['emergencyFund', 'Emergency Fund'], ['goodVsBadInterest', 'Good vs Bad Interest'], ['scams', 'Too-Good Deals'],
  ['compoundGrowth', 'Compound Growth'], ['insurance', 'Insurance'], ['diversification', 'Diversification'], ['delayedGratification', 'Delayed Gratification'], ['planningForAGoal', 'Planning for a Goal']];

export function mountCredits(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const el = (tag, cls, html) => { const n = document.createElement(tag); if (cls) n.className = cls; if (html != null) n.innerHTML = html; return n; };
  const list = (() => { const L = opts.lessons; if (!L || typeof L !== 'object') return FALLBACK.map(([id, title], i) => ({ id, title, season: i + 1 }));
    return Object.values(L).filter((x) => x && x.title).sort((a, b) => (a.season || 0) - (b.season || 0)).map((x) => ({ id: x.id, title: x.title, season: x.season })); })();

  const wrap = el('div', 'll-credits'); wrap.setAttribute('role', 'dialog'); wrap.setAttribute('aria-label', 'Credits');
  const bg = el('div', 'll-credits-bg');
  const confetti = el('div', 'll-credits-confetti'); for (let i = 0; i < 9; i++) { const c = el('span', 'll-credits-c', icon('confetti')); c.style.setProperty('--x', (6 + i * 11) + '%'); c.style.setProperty('--d', (i * 0.55) + 's'); c.style.setProperty('--s', (22 + (i % 3) * 8) + 'px'); confetti.append(c); }
  const card = el('div', 'll-credits-card');
  const colL = el('div', 'll-credits-l'), colR = el('div', 'll-credits-r');
  const trophy = el('div', 'll-credits-trophy', icon('trophy'));
  const title = el('h2', 'll-credits-title', 'THE END');
  const sub = el('p', 'll-credits-sub', 'You lit the Lighthouse!');
  const stat = el('div', 'll-credits-stat');
  colL.append(trophy, title, sub, stat);
  const head = el('h3', 'll-credits-head', 'What you learnt');
  const grid = el('ul', 'll-credits-lessons');
  list.forEach((L, i) => { const li = el('li', 'll-credits-les', `<span class="n">${icon('rosette')}<b>${i + 1}</b></span><span class="t"></span>`); li.querySelector('.t').textContent = L.title; li.style.setProperty('--i', i); grid.append(li); });
  const thanks = el('p', 'll-credits-thanks', iconize('Thank you for playing ✦ Lumen Ledger · made for the Zoud GameLab jam, “Make FinLit Fun”'));
  const btn = el('button', 'll-btn ll-credits-back', iconize('▸ BACK TO TITLE')); btn.type = 'button';
  colR.append(head, grid, thanks, btn);
  card.append(colL, colR); wrap.append(bg, confetti, card); root.appendChild(wrap);

  const st = { open: false, shown: 0 };
  const api = {
    el: wrap, state: st, lessons: list,
    get isOpen() { return st.open; },
    show(p = {}) {
      const stars = Math.max(0, p.stars | 0), seasons = Math.max(1, p.seasons | 0 || list.length), max = seasons * 3;
      stat.innerHTML = `<span class="ll-credits-stars">${icon('star')}<b>${stars}</b><i>/ ${max}</i></span><span class="ll-credits-statlab">stars earned in ${seasons} seasons</span>`;
      st.open = true; st.shown++; wrap.classList.remove('closing'); wrap.classList.add('open'); bus.emit('ui:credits:open', { stars, seasons }); return api;
    },
    hide() { if (!st.open) return api; st.open = false; wrap.classList.remove('open'); wrap.classList.add('closing'); setTimeout(() => wrap.classList.remove('closing'), 220); bus.emit('ui:credits:close', {}); return api; },
    destroy() { offs.forEach((f) => f && f()); window.removeEventListener('keydown', onKey, true); wrap.remove(); },
  };
  btn.addEventListener('click', () => api.hide());
  btn.addEventListener('pointerdown', (e) => e.stopPropagation && e.stopPropagation());
  const onKey = (e) => { if (!st.open) return; if (e.key === 'Enter' || e.key === ' ' || e.key === 'Escape') { e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.(); api.hide(); } };
  window.addEventListener('keydown', onKey, true);   // capture: runs before the title's own Enter handler
  const offs = [bus.on('game:won', (p) => api.show({ stars: p?.stars, seasons: p?.season })), bus.on('game:start', () => { if (st.open) api.hide(); })];
  return api;
}
export default mountCredits;
