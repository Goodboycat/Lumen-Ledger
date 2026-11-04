// LUMEN LEDGER — Speed-up nudge (S42 / 16B). DOM only, no Three.
//
//   import { mountNudge } from './ui/nudge.js';
//   const nd = mountNudge(root, { bus, idleS: 7 });
//   nd.bind({ bored: () => boolean });          // Game.js: true when there is nothing to do (no enemies chasing, no Glimmers, speed 1×)
//   nd.update(dt) (from ui.update, only when no modal owns the screen) · nd.show() · nd.hide() · nd.visible · nd.destroy()
//
// Why: playtest — between waves the island is empty for 20–40 s and players sit and wait. Nobody finds the ⏩ button on their own.
//   When the game has been "boring" for `idleS` seconds (bound predicate true the whole time) a cartoon hand 👆 bobs beside the HUD's
//   ⏩ speed button with a "Touch here!" bubble. Tapping the bubble = tapping the button (ui:speed cycle). It hides the moment
//   the predicate turns false (customers arrive, a wave lands), when speed changes (game:speed > 1), under modals (ui:*:open),
//   on season end, and on game:title. It re-arms after `cooldownS` so it does not nag: at most once per `cooldownS` and never more
//   than `maxShows` times per game (people learn after two).
//
// Events listened: game:speed · game:start · game:title · eco:season · ui:speed · ui:tutorial:open · ui:ledger:open · ui:pause
// Events emitted : ui:nudge { on: true|false, why }

import { bus as defaultBus } from '../src/core/EventBus.js';

export const NUDGE_DEFAULTS = { idleS: 7, cooldownS: 45, maxShows: 3 };

export function mountNudge(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const cfg = { ...NUDGE_DEFAULTS, ...opts };
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const el = (tag, cls, txt) => { const n = document.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

  let deps = null;
  const st = { t: 0, cool: 0, shows: 0, visible: false, armed: true, offs: [], raf: 0 };

  // ---- DOM
  let wrap = null, bubble = null, hand = null;
  if (hasDoc) {
    wrap = el('div', 'll-nudge'); wrap.setAttribute('aria-hidden', 'true');
    hand = el('div', 'll-nudge-hand', '👆');
    bubble = el('button', 'll-nudge-bubble'); bubble.type = 'button';
    bubble.innerHTML = '<b>Touch here!</b><small>Nothing happening? Speed up time ⏩</small>';
    bubble.addEventListener('click', (e) => { e.stopPropagation?.(); bus.emit('ui:speed', { cycle: true, source: 'nudge' }); api.hide('tap'); });
    wrap.append(hand, bubble);
    (root || document.body).appendChild(wrap);
  }

  const target = () => { const r = root || document; return r.querySelector ? r.querySelector('.ll-hud .ll-speed') : null; };
  const place = () => {
    if (!wrap || !st.visible) return;
    const btn = target(); if (!btn || !btn.getBoundingClientRect) return;
    const b = btn.getBoundingClientRect(), host = (root && root.getBoundingClientRect) ? root.getBoundingClientRect() : { left: 0, top: 0 };
    if (!b.width && !b.height) { wrap.classList.remove('show'); return; }       // button hidden (staged / modal) → nothing to point at
    wrap.classList.add('show');
    // hand sits just under the button, bubble under the hand; clamp so it never leaves the viewport on narrow phones
    const vw = (typeof window !== 'undefined' && window.innerWidth) || 800;
    const x = Math.max(70, Math.min(vw - 110, b.left + b.width / 2 - host.left));
    wrap.style.left = `${Math.round(x)}px`; wrap.style.top = `${Math.round(b.bottom - host.top + 4)}px`;
    if (typeof requestAnimationFrame === 'function') st.raf = requestAnimationFrame(place);
  };

  const api = {
    get visible() { return st.visible; },
    get idle() { return st.t; },
    get shows() { return st.shows; },
    bind(d) { deps = d || null; return api; },
    show() {
      if (st.visible) return api;
      st.visible = true; st.shows++; st.cool = cfg.cooldownS;
      if (wrap) { wrap.classList.remove('show'); place(); }
      bus.emit('ui:nudge', { on: true, why: 'bored', shows: st.shows });
      return api;
    },
    hide(why = 'hide') {
      st.t = 0;
      if (!st.visible) return api;
      st.visible = false;
      if (wrap) wrap.classList.remove('show');
      if (st.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(st.raf); st.raf = 0;
      bus.emit('ui:nudge', { on: false, why });
      return api;
    },
    /** Reset for a new game (counts, cooldown). */
    reset() { api.hide('reset'); st.shows = 0; st.cool = 0; st.t = 0; st.armed = true; return api; },
    /** Clock: seconds of unpaused play. */
    update(dt) {
      dt = Math.min(0.1, Math.max(0, +dt || 0));
      if (st.cool > 0 && !st.visible) st.cool -= dt;
      const bored = !!(st.armed && deps && typeof deps.bored === 'function' && deps.bored());
      if (!bored) { if (st.visible) api.hide('busy'); else st.t = 0; return; }
      if (st.visible) return;
      if (st.cool > 0 || st.shows >= cfg.maxShows) return;
      st.t += dt;
      if (st.t >= cfg.idleS) api.show();
    },
    destroy() { api.hide('destroy'); st.offs.forEach((f) => f()); st.offs.length = 0; wrap?.remove?.(); },
  };

  const on = (n, f) => st.offs.push(bus.on(n, f));
  on('game:speed', (p) => { if (p && p.speed > 1) api.hide('speed'); });
  on('ui:speed', () => api.hide('speed'));
  on('game:start', () => api.reset());
  on('game:title', () => { api.reset(); st.armed = false; });
  on('game:resumed', () => { st.armed = true; });
  on('eco:season', () => api.hide('season'));
  on('eco:win', () => api.hide('win')); on('eco:lose', () => api.hide('lose'));
  for (const n of ['ui:ledger:open', 'ui:dialogue:open', 'ui:seasons:open', 'ui:title:open']) on(n, () => api.hide('modal'));
  on('ui:pause', (p) => { if (p && p.on) api.hide('pause'); });
  on('ui:touch', (p) => { if (p && p.action === 'ability') api.hide('busy'); });
  on('game:start', () => { st.armed = true; });

  return api;
}

export default mountNudge;
