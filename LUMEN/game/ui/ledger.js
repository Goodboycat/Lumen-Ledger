// LUMEN LEDGER — Season Ledger Review screen (Chat 7B). DOM only, no Three. Contract: §B UI → mountLedger(root).
//
//   import { mountLedger } from './ui/ledger.js';
//   const ledger = mountLedger(root, { bus, lessons: LESSONS?, seasonsToWin: 10, autoOpen: true });
//   ledger.show(report, { lesson? })   // report = Economy LedgerReport (eco:season payload). Opens the modal, counts rows up, pops stars.
//   ledger.hide() · ledger.setLesson({ id, title, lesson, tip }) · ledger.isOpen · ledger.update(dt) (optional; self-drives by default) · ledger.destroy()
//
// Listens on bus:  eco:season report  → show(report)  (unless opts.autoOpen === false — the integrator may open it after the story line)
//                  story:lesson { id, title, lesson, tip }  → fills the lesson card (8B emits this at season end; otherwise LESSONS[lessonId] fallback)
//                  eco:win / eco:lose  → the next show() uses the win/lose header
// Emits:           'ui:continue' { season, stars, lessonId, outcome: 'season'|'win'|'lose' }  when the player presses CONTINUE
//                  'ui:ledger:open' / 'ui:ledger:close'
//
// Motion table (CSS keyframes in ledger.css + JS count-up):
//   backdrop fade 220 ms · sheet drop-in 420 ms outBack · rows reveal stagger 90 ms × i (each 260 ms outQuad) ·
//   number count-up 650 ms outCubic per row, started with the row · stars pop 380 ms outBack, 220 ms apart, after the rows ·
//   lesson card slide-up 320 ms outBack after stars · CONTINUE button bounce 300 ms outBack when everything is in · hide: shrink 180 ms inQuad.

import { iconize, icon } from './icons.js';
import { bus as defaultBus } from '../src/core/EventBus.js';

/** Fallback lesson cards keyed by Economy lessonId (8A owns the real text in data/story.json → story:lesson). */
export const LESSONS = {
  budgeting:            { title: 'Budgeting',             lesson: 'A budget is a plan for your Spark before you spend it. Every coin gets a jar.',                        tip: 'Fill the jars first, then spend what is left in Spend.' },
  needsVsWants:         { title: 'Needs vs Wants',        lesson: 'Needs keep the market running (upkeep, repairs). Wants are nice — but they wait their turn.',          tip: 'Ask: if I skip this, does anything break?' },
  emergencyFund:        { title: 'Emergency Fund',        lesson: 'Shocks happen. Spark set aside in Protect means a storm is a bill, not a loan.',                      tip: 'Keep ~3 seasons of upkeep in Protect.' },
  goodVsBadInterest:    { title: 'Good vs Bad Interest',  lesson: 'Save pays YOU 5 % a season. The Baron charges 20 % — and his interest compounds on itself.',          tip: 'Repay debt before buying anything shiny.' },
  scams:                { title: 'Too-Good Deals',        lesson: 'If a deal is secret, urgent and guaranteed, it is a scam. Real offers survive a night of thinking.',  tip: 'Spot the tells: hurry, secrecy, "guaranteed".' },
  compoundGrowth:       { title: 'Compound Growth',       lesson: 'Interest earns interest. Small amounts left alone become big amounts — time does the work.',          tip: 'Start saving early, even tiny amounts.' },
  insurance:            { title: 'Insurance',             lesson: 'The Protect jar absorbs shocks so one bad day does not undo a good season.',                           tip: 'Insurance feels wasted — until it is not.' },
  diversification:      { title: 'Diversification',       lesson: 'Spread Spark across stalls and jars. When one dips, the others carry you.',                           tip: 'Never one stall, never one jar.' },
  delayedGratification: { title: 'Delayed Gratification', lesson: 'Waiting a season for an upgrade you can afford beats borrowing for it today.',                        tip: 'Future-you is a customer too.' },
  planningForAGoal:     { title: 'Planning for a Goal',   lesson: 'Name the goal, price it, split it into seasons. The Lighthouse is just a plan with a deadline.',    tip: 'Goal ÷ seasons left = this season\'s target.' },
};

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };
const fmt = (n) => (n < 0 ? '−' : '') + Math.abs(Math.round(n)).toLocaleString('en-US');
const outCubic = (t) => 1 - Math.pow(1 - t, 3);

/** Row definitions: [key, label, sign]  sign +1 income-ish (green), −1 cost-ish (red), 0 neutral. */
export const LEDGER_ROWS = [
  ['income',         'Sales income',        +1],
  ['interestEarned', 'Save interest  +5 %', +1],
  ['investReturn',   'Invest return',       +1],
  ['expenses',       'Expenses & upkeep',   -1],
  ['interestPaid',   'Loan interest  20 %', -1],
];

export function mountLedger(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const lessons = opts.lessons || LESSONS;
  const seasonsToWin = opts.seasonsToWin || 10;
  const selfDrive = opts.selfDrive !== false;

  // ---------------------------------------------------------------- DOM
  const wrap = el('section', 'll-ledger'); wrap.id = 'll-ledger';
  const backdrop = el('div', 'll-ledger-backdrop');
  const sheet = el('article', 'll-ledger-sheet');
  const head = el('header', 'll-ledger-head');
  const title = el('h2', 'll-ledger-title', 'Season 1 Ledger');
  const sub = el('p', 'll-ledger-sub', 'the books are open');
  head.append(title, sub);
  const table = el('div', 'll-ledger-rows');
  const rows = {};
  for (const [key, label, sign] of LEDGER_ROWS) {
    const r = el('div', 'll-ledger-row ' + (sign > 0 ? 'plus' : sign < 0 ? 'minus' : 'zero')); r.dataset.key = key;
    const lab = el('span', 'll-ledger-label', label); const val = el('span', 'll-ledger-val', '0');
    r.append(lab, val); table.append(r); rows[key] = { row: r, val, sign, target: 0, shown: 0, t: -1 };
  }
  const net = el('div', 'll-ledger-row net'); const netLab = el('span', 'll-ledger-label', 'Net this season'); const netVal = el('span', 'll-ledger-val', '0');
  net.append(netLab, netVal); table.append(net); rows.net = { row: net, val: netVal, sign: 0, target: 0, shown: 0, t: -1 };
  const chips = el('div', 'll-ledger-chips');
  const chipFog = el('span', 'll-chip fog', 'Fog 35 %'); const chipDebt = el('span', 'll-chip debt', 'Debt 0'); const chipWorth = el('span', 'll-chip worth', 'Net worth 0');
  chips.append(chipFog, chipDebt, chipWorth);
  const stars = el('div', 'll-ledger-stars'); const starEls = [];
  for (let i = 0; i < 3; i++) { const s = el('i', null, '★'); stars.append(s); starEls.push(s); }
  const starTxt = el('p', 'll-ledger-startxt', '');
  const lesson = el('aside', 'll-lesson');
  const lessonTag = el('span', 'll-lesson-tag', 'FinLit lesson');
  const lessonTitle = el('h3', 'll-lesson-title', '');
  const lessonBody = el('p', 'll-lesson-body', '');
  const lessonTip = el('p', 'll-lesson-tip', '');
  lesson.append(lessonTag, lessonTitle, lessonBody, lessonTip);
  const foot = el('footer', 'll-ledger-foot');
  const btn = el('button', 'll-btn ll-ledger-continue', 'CONTINUE ▸');
  foot.append(btn);
  sheet.append(head, table, chips, stars, starTxt, lesson, foot);
  wrap.append(backdrop, sheet);
  root.appendChild(wrap);

  // ---------------------------------------------------------------- state
  const st = { open: false, report: null, lesson: null, outcome: 'season', t: 0, phase: 'idle', timers: [], raf: 0, pendingLesson: null };
  const retrigger = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };
  const later = (ms, fn) => { const id = setTimeout(fn, ms); st.timers.push(id); return id; };
  const clearTimers = () => { st.timers.forEach(clearTimeout); st.timers = []; };

  // timeline (ms): rows 0 + 90·i (5 rows + net) · stars at ROWS_END + 220·i · lesson after stars · button after lesson
  const ROW_STAGGER = 90, ROW_COUNT_MS = 650, STAR_GAP = 220;
  const rowsEnd = () => ROW_STAGGER * LEDGER_ROWS.length + ROW_COUNT_MS;

  const fillLesson = (L) => {
    st.lesson = L || null;
    lessonTitle.textContent = L ? L.title : '—';
    lessonBody.textContent = L ? L.lesson : '';
    lessonTip.textContent = L && L.tip ? 'Tip: ' + L.tip : '';
    lesson.classList.toggle('empty', !L);
  };

  const api = {
    el: wrap, state: st, rows,
    get isOpen() { return st.open; },
    /** Open the modal with an Economy LedgerReport. opts.lesson overrides the lesson card. */
    show(report, o = {}) {
      report = report || {}; st.report = report; clearTimers();
      const season = report.season ?? 1; const starsN = Math.max(0, Math.min(3, report.stars | 0));
      st.outcome = o.outcome || st.outcome || 'season';
      wrap.classList.remove('closing', 'win', 'lose'); wrap.classList.add('open'); st.open = true;
      if (st.outcome !== 'season') wrap.classList.add(st.outcome);
      title.innerHTML = iconize(st.outcome === 'win' ? '✦ The Lighthouse is lit!' : st.outcome === 'lose' ? 'Fogged out…' : `Season ${season} Ledger`);
      sub.textContent = st.outcome === 'win' ? `Debt Fog pushed off the island in ${season} seasons` : st.outcome === 'lose'
        ? (report.reason === 'debt' ? 'the Baron owns the market' : 'the Debt Fog covered the Lighthouse') : season >= seasonsToWin ? ((report.debt || 0) > 0 ? 'the Lighthouse waits — pay the Baron off to light it' : (report.fog01 || 0) > 0 ? 'the Lighthouse waits — push the last Fog away' : 'last season before the Lighthouse')   // BUGFIX: S10+ without a win said "last season" forever
        : season === seasonsToWin - 1 ? 'last season before the Lighthouse' : `${seasonsToWin - season} season${seasonsToWin - season === 1 ? '' : 's'} to the Lighthouse`;
      // rows
      let netSum = 0;
      LEDGER_ROWS.forEach(([key], i) => {
        const r = rows[key]; const v = +report[key] || 0; r.target = v * (r.sign < 0 ? -1 : 1); r.shown = 0; r.t = -1; r.val.textContent = '0';
        r.row.classList.remove('in', 'hidden-zero'); r.row.style.setProperty('--i', i); netSum += r.target;
        later(ROW_STAGGER * i, () => { r.row.classList.add('in'); r.t = 0; });
      });
      rows.net.target = netSum; rows.net.shown = 0; rows.net.t = -1; rows.net.val.textContent = '0'; rows.net.row.classList.remove('in', 'pos', 'neg');
      rows.net.row.classList.add(netSum >= 0 ? 'pos' : 'neg');
      later(ROW_STAGGER * LEDGER_ROWS.length, () => { rows.net.row.classList.add('in'); rows.net.t = 0; });
      // chips
      chipFog.textContent = `Fog ${Math.round((report.fog01 ?? 0) * 100)} %` + (report.fogDelta ? ` (${report.fogDelta > 0 ? '+' : '−'}${Math.round(Math.abs(report.fogDelta) * 100)})` : '');
      chipFog.classList.toggle('bad', (report.fogDelta || 0) > 0); chipFog.classList.toggle('good', (report.fogDelta || 0) < 0);
      chipDebt.textContent = `Debt ${fmt(report.debt || 0)}`; chipDebt.classList.toggle('bad', (report.debt || 0) > 0);
      chipWorth.textContent = `Net worth ${fmt(report.netWorth ?? ((report.spark || 0) + Object.values(report.jars || {}).reduce((a, b) => a + b, 0) - (report.debt || 0)))}`;
      chips.classList.remove('in'); later(rowsEnd() - 200, () => chips.classList.add('in'));
      // stars
      starEls.forEach((s) => s.classList.remove('on', 'pop'));
      for (let i = 0; i < 3; i++) later(rowsEnd() + STAR_GAP * i, () => { if (i < starsN) { starEls[i].classList.add('on'); retrigger(starEls[i], 'pop'); } else starEls[i].classList.add('pop'); });
      starTxt.textContent = ['No stars — the Fog is winning. Save first, spend second.', 'One star. Steady. Try to earn more than you spend.', 'Two stars! Solid season — keep the debt down.', 'Three stars! A perfect ledger ✦'][starsN];
      starTxt.classList.remove('in'); later(rowsEnd() + STAR_GAP * 3, () => starTxt.classList.add('in'));
      // lesson card
      const L = o.lesson || st.pendingLesson || lessons[report.lessonId] || null; st.pendingLesson = null; fillLesson(L);
      lesson.classList.remove('in'); later(rowsEnd() + STAR_GAP * 3 + 120, () => lesson.classList.add('in'));
      // button
      btn.classList.remove('in'); btn.disabled = true; later(rowsEnd() + STAR_GAP * 3 + 420, () => { btn.classList.add('in'); btn.disabled = false; });
      btn.innerHTML = iconize(st.outcome === 'win' ? 'ENDLESS MODE ▸' : st.outcome === 'lose' ? 'TRY AGAIN ▸' : 'CONTINUE ▸');
      bus.emit('ui:ledger:open', { season, stars: starsN });
      return api;
    },
    /** Skip all pending animation — everything to its final state (tap on the sheet does this). */
    skip() {
      if (!st.open) return api; clearTimers();
      for (const k of Object.keys(rows)) { const r = rows[k]; r.row.classList.add('in'); r.t = ROW_COUNT_MS; r.shown = r.target; r.val.textContent = fmt(r.target); }
      chips.classList.add('in'); const n = Math.max(0, Math.min(3, (st.report && st.report.stars) | 0));
      starEls.forEach((s, i) => { s.classList.toggle('on', i < n); s.classList.add('pop'); }); starTxt.classList.add('in'); lesson.classList.add('in'); btn.classList.add('in'); btn.disabled = false;
      return api;
    },
    hide() {
      if (!st.open) return api; st.open = false; clearTimers();
      wrap.classList.remove('open'); wrap.classList.add('closing'); later(200, () => wrap.classList.remove('closing', 'win', 'lose'));
      bus.emit('ui:ledger:close', {}); st.outcome = 'season';
      return api;
    },
    /** Player pressed CONTINUE (or integrator calls it). Emits ui:continue, then hides. */
    continue() {
      if (!st.open) return api; const r = st.report || {};
      bus.emit('ui:continue', { season: r.season ?? 1, stars: r.stars | 0, lessonId: r.lessonId, outcome: st.outcome });
      return api.hide();
    },
    setLesson(L) { if (st.open) fillLesson(L); else st.pendingLesson = L; return api; },
    /** Count-up tween for the rows (650 ms outCubic each, started by the stagger timers). */
    update(dt) {
      dt = Math.min(0.1, Math.max(0, +dt || 0)) * 1000;
      for (const k of Object.keys(rows)) {
        const r = rows[k]; if (r.t < 0 || r.t >= ROW_COUNT_MS) continue;
        r.t = Math.min(ROW_COUNT_MS, r.t + dt); const e = outCubic(r.t / ROW_COUNT_MS);
        r.shown = r.target * e; r.val.textContent = fmt(r.shown);
        if (r.t >= ROW_COUNT_MS) { r.val.textContent = fmt(r.target); retrigger(r.val, 'pop'); }
      }
    },
    destroy() { clearTimers(); offs.forEach((f) => f()); if (st.raf) cancelAnimationFrame(st.raf); window.removeEventListener('keydown', onKey); wrap.remove(); },
  };

  btn.addEventListener('click', () => { if (!btn.disabled) api.continue(); });
  sheet.addEventListener('click', (e) => { if (e.target !== btn && btn.disabled) api.skip(); });
  const onKey = (e) => { if (!st.open) return; if (e.key === 'Enter' || e.key === ' ') { e.preventDefault && e.preventDefault(); btn.disabled ? api.skip() : api.continue(); } };
  window.addEventListener('keydown', onKey);

  // ---------------------------------------------------------------- bus wiring
  const offs = [
    bus.on('eco:season', (r) => { if (opts.autoOpen !== false && r) api.show(r); }),
    bus.on('story:lesson', (L) => { if (L && L.title) api.setLesson(L); }),
    bus.on('eco:win', () => { st.outcome = 'win'; if (st.open) api.show(st.report, { outcome: 'win' }); }),
    bus.on('eco:lose', (p) => { st.outcome = 'lose'; if (st.open) api.show({ ...(st.report || {}), reason: p && p.reason }, { outcome: 'lose' }); }),
  ];
  if (selfDrive && typeof requestAnimationFrame === 'function') {
    let last = performance.now();
    const loop = (t) => { api.update((t - last) / 1000); last = t; st.raf = requestAnimationFrame(loop); };
    st.raf = requestAnimationFrame(loop);
  }
  return api;
}
