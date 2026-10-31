// LUMEN LEDGER — Progressive HUD reveal (S41 / 15A). DOM only, no Three.
//
//   import { mountReveal } from './ui/reveal.js';
//   const rv = mountReveal(ui, { bus });     // ui = mountUI() result (needs ui.hud / ui.jars / ui.touch / ui.toast)
//   rv.stage · rv.staged (bool) · rv.reveal(key, {quiet}) · rv.revealAll({quiet}) · rv.hideAll() · rv.destroy()
//
// Why: playtest — a first-time player who SKIPS the tutorial faces 5 unexplained widgets at once (jars panel, Debt-Fog bar,
//   reputation stars, ⏩ speed, 6 FinLit power chips). Now:
//   • Jars start COLLAPSED on every new game (one header row; the tutorial's jar step expands them).
//   • Tutorial takers: everything is shown the moment the guide opens (the guide points at each widget).
//   • Skippers (Skip pressed before the jar step, or ?notutorial on a first run): the widgets appear ONE AT A TIME, each with a
//     one-line toast, on the moment it first matters — or after a fallback delay so nothing stays hidden for long:
//       jars   → first sale (cust:paid)               fallback 20 s
//       fog    → first fog rise (eco:fog delta>0)     fallback 35 s (or any eco:loan)
//       rep    → 3rd sale                              fallback 50 s
//       speed  → 60 s of play (waiting for customers)  (or an eco:season report)
//       powers → first ⚔ attack / 75 s                 (touch strip only; desktop keys always work)
//   • Resumed saves / players who already finished the tutorial once (localStorage) see everything at once, no toasts.
//   • game:title resets. Hidden = CSS class `ll-staged` (display:none) on the real elements; reveal pops them (`ll-reveal-in`).

import { bus as defaultBus } from '../src/core/EventBus.js';

export const REVEAL_ORDER = ['jars', 'fog', 'rep', 'speed', 'powers'];
export const REVEAL_FALLBACK_S = { jars: 20, fog: 35, rep: 50, speed: 60, powers: 75 };
const TOAST = {
  jars:   { text: '🫙 Money jars unlocked — tap the jar header to split your Spark into Spend · Save · Invest · Protect.', icon: '🫙' },
  fog:    { text: '🌫 Debt Fog bar — debt and bad deals make it grow. At 100 % the island is lost; paying the Baron lifts it.', icon: '🌫' },
  rep:    { text: '★ Reputation — happy Glimmers raise it, fair prices keep it. More stars = more customers.', icon: '★' },
  speed:  { text: '⏩ Waiting for customers? Tap ⏩ (or T) to speed up time: 1× → 2× → 3×.', icon: '⏩' },
  powers: { text: '✨ FinLit powers unlocked — the chips above the buttons: Magnet · Shield · Grow · Flash · Haggle · Sweep.', icon: '✨' },
};

export function mountReveal(ui, opts = {}) {
  const bus = opts.bus || ui?.bus || defaultBus;
  const storageKey = opts.storageKey || 'lumen.tutorialDone';
  const tutDone = () => { try { return typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1'; } catch { return false; } };
  const hasDoc = typeof document !== 'undefined' && !!document.querySelector;

  // the real elements (looked up lazily — touch mounts after hud, tutorial after touch)
  const nodes = () => {
    const hud = ui?.hud?.el, q = (root, sel) => (root && root.querySelector ? root.querySelector(sel) : null);
    return {
      jars: ui?.jars?.el || null,
      fog: q(hud, '.ll-fog'),
      rep: q(hud, '.ll-rep'),
      speed: q(hud, '.ll-speed'),
      powers: ui?.touch?.strip || null,
    };
  };
  const st = { staged: false, shown: new Set(REVEAL_ORDER), t: 0, sales: 0, timer: 0, offs: [] };
  const pop = (n) => { if (!n || !n.classList) return; n.classList.remove('ll-staged'); n.classList.remove('ll-reveal-in'); void (n.offsetWidth ?? 0); n.classList.add('ll-reveal-in'); setTimeout(() => n.classList && n.classList.remove('ll-reveal-in'), 700); };

  const api = {
    get staged() { return st.staged; },
    get stage() { return REVEAL_ORDER.filter((k) => !st.shown.has(k)); },
    get shown() { return [...st.shown]; },
    /** Hide every staged widget (new game for a possible skipper). Jars collapse too. */
    hideAll() {
      const n = nodes(); st.staged = true; st.shown.clear(); st.t = 0; st.sales = 0;
      for (const k of REVEAL_ORDER) n[k]?.classList?.add('ll-staged');
      ui?.jars?.setCollapsed?.(true);
      return api;
    },
    /** Show one widget (with its one-line toast unless quiet). */
    reveal(k, { quiet } = {}) {
      if (!REVEAL_ORDER.includes(k) || st.shown.has(k)) return api;
      st.shown.add(k); pop(nodes()[k]);
      if (!quiet && st.staged && ui?.toast?.push && TOAST[k]) ui.toast.push({ ...TOAST[k], kind: 'info', id: 'reveal', duration: 6500 });
      if (st.shown.size >= REVEAL_ORDER.length) st.staged = false;
      bus.emit('ui:reveal', { key: k, quiet: !!quiet, left: api.stage });
      return api;
    },
    revealAll({ quiet = true } = {}) { for (const k of REVEAL_ORDER) api.reveal(k, { quiet }); st.staged = false; return api; },
    /** Clock (seconds of unpaused play) → fallback reveals. Called from ui.update when staged. */
    update(dt) {
      if (!st.staged) return;
      st.t += Math.min(0.1, Math.max(0, +dt || 0));
      for (const k of REVEAL_ORDER) if (!st.shown.has(k) && st.t >= REVEAL_FALLBACK_S[k]) { api.reveal(k); break; }   // one per frame → staggered
    },
    destroy() { st.offs.forEach((f) => f()); st.offs.length = 0; },
  };

  const on = (n, f) => st.offs.push(bus.on(n, f));
  // --- new game: collapse jars; hide the widgets only when the guide might be skipped (first run, no save)
  on('game:start', () => {
    ui?.jars?.setCollapsed?.(true);
    const firstRun = !tutDone();
    if (firstRun && hasDoc) api.hideAll(); else { st.staged = false; st.shown = new Set(REVEAL_ORDER); for (const k of REVEAL_ORDER) nodes()[k]?.classList?.remove('ll-staged'); }
  });
  on('game:resumed', () => api.revealAll({ quiet: true }));
  on('game:title', () => { api.revealAll({ quiet: true }); ui?.jars?.setCollapsed?.(false); });
  // --- tutorial takers see everything (the hand points at jars / fog / season). Skip before the jar step → staged mode stays.
  on('ui:tutorial:open', () => { st.wasStaged = st.staged; api.revealAll({ quiet: true }); });
  on('ui:tutorial:step', (p) => { if (p && p.id === 'jars') ui?.jars?.setCollapsed?.(false); });
  on('ui:tutorial:close', (p) => {
    const why = p && p.why, step = p && p.step;
    const early = ['welcome', 'joystick', 'attack', 'interact', 'build', 'deploy'].includes(step);
    if (why === 'skip' && early && st.wasStaged) api.hideAll();          // skipper → progressive reveal from scratch
    else if (why === 'done' || why === 'skip') { st.staged = false; }   // took the guide → stays revealed
    if (why !== 'title') ui?.jars?.setCollapsed?.(true);                 // jars back to one row after the guide
    st.wasStaged = false;
  });
  // --- triggers
  on('cust:paid', () => { if (!st.staged) return; st.sales++; api.reveal('jars'); if (st.sales >= 3) api.reveal('rep'); });
  on('eco:fog', (p) => { if (st.staged && p && p.delta > 0.0005) api.reveal('fog'); });
  on('eco:loan', () => { if (st.staged) api.reveal('fog'); });
  on('eco:season', () => { if (st.staged) { api.reveal('jars'); api.reveal('fog'); api.reveal('speed'); } });
  on('ui:touch', (p) => { if (st.staged && p && (p.action === 'attack' || p.action === 'ability')) api.reveal('powers'); });
  on('hero:attack', () => { if (st.staged) api.reveal('powers'); });
  return api;
}

export default mountReveal;
