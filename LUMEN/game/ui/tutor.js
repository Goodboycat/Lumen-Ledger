// LUMEN LEDGER — 48F curiosity tutorial (HANDOFF_48Z decision D2). DOM only, no Three. Blue glass card, one at a time, once per profile.
//
//   import { mountTutor } from './ui/tutor.js';
//   const tutor = mountTutor(root, { bus, data: tutorJson, seen: [] });
//   tutor.show(id) · tutor.dismiss() · tutor.seen (array of card ids shown, persist it) · tutor.update(dt) · tutor.destroy()
//   tutor.bind({ touched: () => boolean })   // Game.js: true once the player built / deposited / opened the tray (onCuriosityLull timer)
//
// Reactive, not scripted: a card appears AFTER the player did something (any bus event named in data/tutor.json cards[].on),
// names the next step in ≤ 60 chars and dies on pointerdown / keydown (capture, never preventDefault) or after `ttl` seconds.
//   • each card id shows ONCE per profile (`seen`, persisted by save.js tutorSeen)        • only ONE card on screen
//   • a new trigger while a card is up is DROPPED, not queued                            • never pauses, dims, blocks or stacks
//   • `onCuriosityLull`: `lull` seconds of play with touched() === false → one card, then never again
// Bus out: tutor:shown {id} · tutor:dismissed {id, ms, why}.
import { bus as defaultBus } from '../src/core/EventBus.js';
import { icon } from './icons.js';

export const TUTOR_DEFAULTS = { ttl: 8, lull: 25 };

const matches = (match, p) => {
  if (!match) return true; if (!p || typeof p !== 'object') return false;
  for (const k of Object.keys(match)) {
    const want = match[k], got = p[k];
    if (typeof want === 'string' && want.endsWith('*')) { if (!String(got ?? '').startsWith(want.slice(0, -1))) return false; }
    else if (got !== want) return false;
  }
  return true;
};

export function mountTutor(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const data = opts.data || { cards: [] };
  const cfg = { ttl: +data.ttl || TUTOR_DEFAULTS.ttl, lull: +data.lull || TUTOR_DEFAULTS.lull };
  const cards = new Map(); for (const c of data.cards || []) if (c && c.id) cards.set(c.id, c);
  const seen = Array.isArray(opts.seen) ? opts.seen.filter((id) => typeof id === 'string') : [];
  const hasDoc = typeof document !== 'undefined' && !!document.createElement;
  const now = () => (typeof performance !== 'undefined' && performance.now ? performance.now() : Date.now());

  // ---- DOM (≤ 1 card subtree: wrap > [ico, txt] + hand)
  let wrap = null, ico = null, txt = null, hand = null;
  if (hasDoc) {
    wrap = document.createElement('div'); wrap.className = 'll-tutor'; wrap.setAttribute('aria-live', 'polite');
    ico = document.createElement('span'); ico.className = 'll-tutor-ico';
    txt = document.createElement('span'); txt.className = 'll-tutor-txt';
    hand = document.createElement('div'); hand.className = 'll-tutor-hand'; hand.innerHTML = icon('point');
    wrap.append(ico, txt); (root || document.body).append(wrap, hand);
  }

  const st = { cur: null, t: 0, at: 0, lull: 0, lullDone: seen.includes('onCuriosityLull'), active: true, deps: null, offs: [], raf: 0 };

  const pointAt = (sel) => {
    if (!hand) return; hand.classList.remove('show'); if (st.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(st.raf); st.raf = 0;
    if (!sel || typeof sel !== 'string') return;
    const host = root || document;
    const tick = () => {
      if (!st.cur) return;
      const el = host.querySelector ? host.querySelector(sel) : null; const b = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
      if (!b || (!b.width && !b.height)) { hand.classList.remove('show'); }
      else { const hb = (root && root.getBoundingClientRect) ? root.getBoundingClientRect() : { left: 0, top: 0 }; hand.classList.add('show'); hand.style.left = `${Math.round(b.left + b.width / 2 - hb.left)}px`; hand.style.top = `${Math.round(b.bottom - hb.top + 2)}px`; }
      if (typeof requestAnimationFrame === 'function') st.raf = requestAnimationFrame(tick);
    };
    tick();
  };

  const api = {
    seen,
    get current() { return st.cur ? st.cur.id : null; },
    get visible() { return !!st.cur; },
    bind(d) { st.deps = d || null; return api; },
    /** Show card `id` once. Returns true when it was shown (false: unknown, already seen, or another card is up → dropped). */
    show(id) {
      const c = cards.get(id); if (!c || !st.active) return false;
      if (st.cur || seen.includes(id)) return false;
      seen.push(id); st.cur = c; st.t = 0; st.at = now();
      if (wrap) { ico.innerHTML = c.icon ? icon(c.icon) : ''; txt.textContent = String(c.text || '').slice(0, 60); wrap.classList.add('show'); pointAt(c.point); }
      bus.emit('tutor:shown', { id });
      return true;
    },
    dismiss(why = 'tap') {
      const c = st.cur; if (!c) return api;
      st.cur = null; const ms = Math.round(now() - st.at);
      if (wrap) { wrap.classList.remove('show'); pointAt(null); }
      bus.emit('tutor:dismissed', { id: c.id, ms, why });
      return api;
    },
    /** Clock: unpaused play seconds (ui.update). ttl + curiosity lull. */
    update(dt) {
      dt = Math.min(0.1, Math.max(0, +dt || 0));
      if (st.cur) { st.t += dt; if (st.t >= cfg.ttl) api.dismiss('ttl'); return; }
      if (st.lullDone || !st.active) return;
      const touched = st.deps && typeof st.deps.touched === 'function' ? !!st.deps.touched() : true;
      if (touched) { st.lullDone = true; return; }           // the player found it on their own → the lull card is never needed
      st.lull += dt; if (st.lull >= cfg.lull) { st.lullDone = true; api.show('onCuriosityLull'); }
    },
    destroy() { api.dismiss('destroy'); st.offs.forEach((f) => { try { f(); } catch (_) {} }); st.offs.length = 0; offDom(); wrap?.remove?.(); hand?.remove?.(); },
  };

  // ---- triggers: one bus listener per distinct event name
  const byEvent = new Map();
  for (const c of cards.values()) { if (!c.on) continue; if (!byEvent.has(c.on)) byEvent.set(c.on, []); byEvent.get(c.on).push(c); }
  for (const [ev, list] of byEvent) st.offs.push(bus.on(ev, (p) => { if (p && p.silent) return; for (const c of list) if (matches(c.match, p)) { api.show(c.id); return; } }));
  // the card's own trigger may be the thing the player tapped — dismiss on the NEXT gesture only (same tick ignored via st.at)
  const gesture = (e) => { if (!st.cur) return; if (now() - st.at < 120) return; if (e && e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; api.dismiss(e && e.type === 'keydown' ? 'key' : 'tap'); };
  let offDom = () => {};
  if (typeof window !== 'undefined' && window.addEventListener) {
    window.addEventListener('pointerdown', gesture, true); window.addEventListener('keydown', gesture, true);
    offDom = () => { window.removeEventListener('pointerdown', gesture, true); window.removeEventListener('keydown', gesture, true); };
  }
  st.offs.push(bus.on('game:title', () => { api.dismiss('title'); st.active = false; }));
  st.offs.push(bus.on('game:start', () => { st.active = true; st.lull = 0; }));
  st.offs.push(bus.on('game:resumed', () => { st.active = true; st.lull = 0; }));
  for (const n of ['ui:ledger:open', 'ui:dialogue:open', 'ui:seasons:open', 'ui:title:open', 'eco:win', 'eco:lose']) st.offs.push(bus.on(n, () => api.dismiss('modal')));
  return api;
}

export default mountTutor;
