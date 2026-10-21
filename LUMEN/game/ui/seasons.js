// LUMEN LEDGER — Season info (mobile bugfix: "seasons go by without me knowing what they are and for what").
//
//   import { mountSeasonInfo } from './ui/seasons.js';
//   const si = mountSeasonInfo(root, { bus, lessons: storyData.lessons, seasons: storyData.seasons, seasonsToWin: 10, seasonSeconds: 150 });
//   si.open(season?) · si.close() · si.banner(season) · si.isOpen · si.destroy()
//
// What it adds
//   • a small lesson tag under the HUD season pill ("📘 Budgeting · tap ⓘ") — the pill itself becomes a button
//   • tap the pill → a Season card: what a Season is (one market day ≈ 2½ min, the day bar), THIS season's money lesson + tip,
//     time left, what happens at the end (Ledger + stars), how to win (survive 10 seasons with the Debt Fog at 0 %), and the
//     list of all 10 lessons with the current one highlighted. Pauses the game while open (ui:pause {by:'season'}).
//   • every new season (game:start, ui:continue after the Ledger) → a big banner slides in for 6 s: "Season 3 / 10 — Emergency Fund"
//     + the tip, with a "What's this?" button that opens the card.
// Listens: eco:tick {day01, season} · eco:season (report) · game:start · ui:continue · game:title · ui:tutorial:open/close
// Emits:   ui:pause {on, by:'season'} · ui:season:open / ui:season:close

import { iconize, icon } from './icons.js';
import { bus as defaultBus } from '../src/core/EventBus.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };
const esc = (s) => String(s ?? '').replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]));
export const LESSON_ORDER = ['budgeting', 'needsVsWants', 'emergencyFund', 'goodVsBadInterest', 'scams', 'compoundGrowth', 'insurance', 'diversification', 'delayedGratification', 'planningForAGoal'];
const LESSON_ICON = { budgeting: '🫙', needsVsWants: '🤔', emergencyFund: '☂️', goodVsBadInterest: '📈', scams: '🎩', compoundGrowth: '🌱', insurance: '🛡️', diversification: '🧺', delayedGratification: '⏳', planningForAGoal: '🗼' };

export function mountSeasonInfo(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const seasonsToWin = opts.seasonsToWin || 10;
  const lessons = opts.lessons || {};
  const seasonsData = Array.isArray(opts.seasons) ? opts.seasons : [];
  const st = { open: false, pending: null, season: 1, day01: 0, seasonSeconds: opts.seasonSeconds || 150, bannerT: 0, endless: false, playing: false };

  const lessonFor = (n) => {
    const sd = seasonsData.find((s) => s.season === n);
    const id = (sd && sd.lesson) || LESSON_ORDER[(n - 1) % LESSON_ORDER.length];
    const L = lessons[id] || {};
    return { id, title: L.title || id, text: L.lesson || '', tip: L.tip || '', chapter: (sd && sd.title) || '', icon: LESSON_ICON[id] || '📘' };
  };

  // ---------------------------------------------------------------- HUD tag + pill hook
  const tag = el('button', 'll-season-tag'); tag.type = 'button'; tag.setAttribute('aria-label', 'What is this season?');
  const hookPill = () => {
    const pill = root.querySelector('.ll-season'); if (!pill || pill.dataset.siHooked) return !!pill;
    pill.dataset.siHooked = '1'; pill.classList.add('is-tappable'); pill.setAttribute('role', 'button'); pill.title = 'What is this season?';
    pill.append(el('span', 'll-season-info', 'ⓘ'));
    pill.addEventListener('click', () => api.open());
    pill.parentNode.insertBefore(tag, pill.nextSibling);
    return true;
  };
  tag.addEventListener('click', () => api.open());

  // ---------------------------------------------------------------- banner
  const banner = el('section', 'll-season-banner'); banner.setAttribute('aria-live', 'polite');
  const bTop = el('div', 'll-sb-top'); const bTitle = el('div', 'll-sb-title'); const bTip = el('div', 'll-sb-tip');
  const bRow = el('div', 'll-sb-row'); const bMore = el('button', 'll-sb-more', 'What\'s a season? ⓘ'); const bOk = el('button', 'll-sb-ok', 'Got it');
  bMore.type = bOk.type = 'button'; bRow.append(bMore, bOk);
  banner.append(bTop, bTitle, bTip, bRow);
  bMore.addEventListener('click', () => { api.hideBanner(); api.open(); });
  bOk.addEventListener('click', () => api.hideBanner());

  // ---------------------------------------------------------------- card (modal)
  const back = el('div', 'll-season-back');
  const card = el('section', 'll-season-card'); card.setAttribute('role', 'dialog'); card.setAttribute('aria-modal', 'true');
  back.append(card);
  back.addEventListener('click', (e) => { if (e.target === back) api.close(); });
  root.append(banner, back);

  const fmt = (s) => { s = Math.max(0, Math.round(s)); const m = Math.floor(s / 60); return m ? `${m} min ${String(s % 60).padStart(2, '0')} s` : `${s} s`; };
  function renderCard() {
    const n = st.season, L = lessonFor(n), left = (1 - st.day01) * st.seasonSeconds;
    const list = LESSON_ORDER.map((id, i) => { const x = lessons[id] || {}; const cls = i + 1 < n ? 'done' : (i + 1 === n ? 'now' : ''); return `<li class="${cls}"><b>${i + 1}</b> ${LESSON_ICON[id] || ''} ${esc(x.title || id)}</li>`; }).join('');
    card.innerHTML = iconize(`
      <header class="ll-sc-head"><span class="ll-sc-big">${L.icon}</span><div><small>${st.endless || n > seasonsToWin ? `Endless · Season ${n}` : `Season ${n} of ${seasonsToWin}`}${L.chapter ? ' · ' + esc(L.chapter) : ''}</small><h2>${esc(L.title)}</h2></div><button class="ll-sc-x" type="button" aria-label="close">✕</button></header>
      <div class="ll-sc-body">
        <p class="ll-sc-lesson">${esc(L.text)}</p>
        ${L.tip ? `<p class="ll-sc-tip">💡 <b>Tip:</b> ${esc(L.tip)}</p>` : ''}
        <div class="ll-sc-time"><span>⏱ Time left this season</span><b>${fmt(left)}</b><i><em style="width:${(st.day01 * 100).toFixed(0)}%"></em></i></div>
        <h3>What is a Season?</h3>
        <ul class="ll-sc-what">
          <li>📅 One Season = one market day on the island (about ${Math.round(st.seasonSeconds / 30) / 2} min). The small blue bar in the Season pill fills up as the day goes by.</li>
          <li>💰 During the day: build stalls, sell to Glimmers, pick up tips, and split your Spark into the four jars.</li>
          <li>📒 When the bar is full the season ends: the <b>Ledger</b> shows income, interest earned / paid, upkeep, and gives you up to ★★★.</li>
          <li>🌫️ Every season Baron Gilt's debt grows by 20 % interest, Save pays you 5 %, Invest moves 8 ± 4 %. Events and too-good deals pop up.</li>
          <li>🗼 <b>To win:</b> get through ${seasonsToWin} seasons and push the Debt Fog bar down to 0 %. If the fog fills the island, you lose.</li>
          <li>📘 Each season teaches one money lesson (below). The tip tells you what to try this season.</li>
        </ul>
        <h3>The ${seasonsToWin} lessons</h3>
        <ol class="ll-sc-list">${list}</ol>
      </div>
      <footer class="ll-sc-foot"><button class="ll-sc-ok" type="button">Back to the island ▶</button></footer>`);
    card.querySelector('.ll-sc-x').addEventListener('click', () => api.close());
    card.querySelector('.ll-sc-ok').addEventListener('click', () => api.close());
  }
  function renderTag() {
    const L = lessonFor(st.season);
    tag.innerHTML = iconize(`${L.icon} ${esc(L.title)} <span>ⓘ</span>`);
  }

  const api = {
    el: card, banner, tag, state: st,
    get isOpen() { return st.open; },
    open(n) {
      if (n) st.season = n; hookPill(); renderCard();
      if (!st.open) { st.open = true; back.classList.add('on'); bus.emit('ui:pause', { on: true, by: 'season' }); bus.emit('ui:season:open', { season: st.season }); }
      return api;
    },
    close() { if (!st.open) return api; st.open = false; back.classList.remove('on'); bus.emit('ui:pause', { on: false, by: 'season' }); bus.emit('ui:season:close', {}); return api; },
    banner(n = st.season) {
      st.season = n; hookPill(); renderTag();
      const L = lessonFor(n);
      bTop.textContent = st.endless || n > seasonsToWin ? `Endless · Season ${n}` : `Season ${n} / ${seasonsToWin}${L.chapter ? ' · ' + L.chapter : ''}`;
      bTitle.innerHTML = iconize(`${L.icon} This season: <b>${esc(L.title)}</b>`);
      bTip.innerHTML = L.tip ? icon('bulb') + ' ' + esc(L.tip) : esc(L.text);
      banner.classList.remove('on'); void banner.offsetWidth; banner.classList.add('on');
      clearTimeout(st.bannerT); st.bannerT = setTimeout(() => api.hideBanner(), opts.bannerMs ?? 7000);
      return api;
    },
    /** Show the banner as soon as no modal (dialogue / ledger / tutorial) owns the screen. */
    requestBanner(n) { st.pending = n || st.season; api._flush(); return api; },
    _flush() { if (st.pending == null || !st.playing) return; if (typeof opts.isModal === 'function' && opts.isModal()) return; const n = st.pending; st.pending = null; setTimeout(() => api.banner(n), 250); },
    hideBanner() { clearTimeout(st.bannerT); banner.classList.remove('on'); return api; },
    setSeason(n) { if (n && n !== st.season) { st.season = n; renderTag(); } return api; },
    destroy() { offs.forEach((f) => f()); clearTimeout(st.bannerT); banner.remove(); back.remove(); tag.remove(); },
  };

  const offs = [
    bus.on('eco:tick', (p) => { if (!p) return; if (p.day01 != null) st.day01 = p.day01; if (p.season != null) api.setSeason(p.season); if (st.open) { const t = card.querySelector('.ll-sc-time b'), bar = card.querySelector('.ll-sc-time em'); if (t) t.textContent = fmt((1 - st.day01) * st.seasonSeconds); if (bar) bar.style.width = (st.day01 * 100).toFixed(0) + '%'; } }),
    bus.on('eco:season', (r) => { if (r && r.season != null) { st.season = r.season + 1; st.day01 = 0; renderTag(); } }),
    bus.on('game:start', (p) => { st.endless = p && p.mode === 'endless'; st.playing = true; st.season = 1; st.day01 = 0; if (p && p.seasonSeconds) st.seasonSeconds = p.seasonSeconds; hookPill(); renderTag(); tag.classList.add('on'); if (opts.autoBanner !== false) setTimeout(() => api.requestBanner(st.season), 120); }),
    bus.on('game:resumed', (p) => { if (p && p.season) { st.season = p.season; renderTag(); } }),
    bus.on('ui:continue', (p) => { if ((p?.outcome || 'season') === 'season' && opts.autoBanner !== false) setTimeout(() => api.requestBanner(st.season), 120); }),
    bus.on('ui:dialogue:close', () => setTimeout(() => api._flush(), 60)),
    bus.on('ui:ledger:close', () => setTimeout(() => api._flush(), 60)),
    bus.on('ui:tutorial:close', () => setTimeout(() => api._flush(), 60)),
    bus.on('game:endless', () => { st.endless = true; renderTag(); }),
    bus.on('game:title', () => { st.playing = false; api.hideBanner(); api.close(); tag.classList.remove('on'); }),
  ];
  hookPill(); renderTag();
  return api;
}

export default mountSeasonInfo;
