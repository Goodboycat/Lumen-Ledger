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
// Bus out: tutor:shown {id, mode} · tutor:dismissed {id, ms, why}.
//
// T2 (FUN_PASS §7.A) — the same card, three more doors. Everything below is additive; the 48F event cards behave exactly as before.
//   • APPROACH  bus 'curious' {hint, why:'approach'|'linger'} / 'curious:ping' (src/systems/curiosity.js) → offer(id): shown while counts[id] < maxShows
//               (card field `target` ⇒ default 3, else 1), never twice within `repeatGap` s, queued (max 2, by `priority`) while another card is up.
//   • TAP       bus 'curious' {why:'tap'|'hold'} or a pointerdown on any [data-guide="<id>"] element → ask(id): ALWAYS shows (replaces the current card,
//               ignores counts + cooldown). A tap that also performs a game action (payload act:true) shows the card only until maxShows, then acts silently.
//   • CODEX     list() → [{id, icon, text, group, count, met}] for ui/guideCodex.js (pause → GUIDE).
//   • `doneOn` / `doneMatch` on a card = the bus event that proves the player learned it → retire(id) (never offered again; ask() still answers).
//   • `counts` {id: n} is what persists (save.js tutorCounts); `seen` stays the list of ids with n ≥ 1 (old saves: every seen id counts once).
//   • Cards born from the world (mode 'curious') ignore key presses (WASD would kill them) and the first 1.5 s of pointer gestures (the joystick).
//   • bind({ touched, blocked, project }) — blocked() true = no card at all (dialogue / modal / deal); project({x,y,z}) → {x,y,behind} puts the hand on a world thing.
import { bus as defaultBus } from '../src/core/EventBus.js';
import { icon } from './icons.js';

export const TUTOR_DEFAULTS = { ttl: 8, lull: 25, repeatGap: 12, queueMax: 2, gap: 0.35, guard: 1.5 };

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
  const cfg = { ttl: +data.ttl || TUTOR_DEFAULTS.ttl, lull: +data.lull || TUTOR_DEFAULTS.lull, repeatGap: data.repeatGap != null ? +data.repeatGap : TUTOR_DEFAULTS.repeatGap, queueMax: TUTOR_DEFAULTS.queueMax, gap: TUTOR_DEFAULTS.gap, guard: TUTOR_DEFAULTS.guard };
  const cards = new Map(); for (const c of data.cards || []) if (c && c.id) cards.set(c.id, c);
  const seen = Array.isArray(opts.seen) ? opts.seen.filter((id) => typeof id === 'string') : [];
  const counts = {};                                                           // T2: id → times shown (retired = 99). `seen` (ids with n ≥ 1) is kept in sync for old saves / tests.
  const RETIRED = 99, maxOf = (c) => Math.max(1, (c.maxShows | 0) || (c.target ? 3 : 1)), retired = (c) => (counts[c.id] || 0) >= maxOf(c);
  const putCounts = (m) => { if (!m || typeof m !== 'object' || Array.isArray(m)) return; for (const [id, n] of Object.entries(m)) { const v = Math.floor(+n); if (typeof id === 'string' && Number.isFinite(v) && v > 0) { counts[id] = Math.max(counts[id] || 0, Math.min(v, RETIRED)); if (!seen.includes(id)) seen.push(id); } } };
  for (const id of seen) counts[id] = Math.max(counts[id] || 0, 1);
  putCounts(opts.counts);
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

  const st = { cur: null, mode: 'event', world: null, queue: [], gap: 0, clock: 0, last: {}, t: 0, at: 0, lull: 0, lullDone: seen.includes('onCuriosityLull'), active: true, deps: null, offs: [], raf: 0 };

  const pointAt = (sel, world) => {
    if (!hand) return; hand.classList.remove('show'); if (st.raf && typeof cancelAnimationFrame === 'function') cancelAnimationFrame(st.raf); st.raf = 0;
    const hasWorld = !!world && st.deps && typeof st.deps.project === 'function';
    if (!(sel && typeof sel === 'string') && !hasWorld) return;
    const host = root || document;
    const tick = () => {
      if (!st.cur) return;
      const hb = (root && root.getBoundingClientRect) ? root.getBoundingClientRect() : { left: 0, top: 0 };
      if (hasWorld) {                                                               // T2: the hand sits under the thing the player asked about (a far Collector, a jar)
        let q = null; try { q = st.deps.project({ x: world.x, y: 1.3, z: world.z }); } catch (_) { q = null; }
        if (!q || q.behind || !Number.isFinite(q.x) || !Number.isFinite(q.y)) hand.classList.remove('show');
        else { hand.classList.add('show'); hand.style.left = `${Math.round(q.x)}px`; hand.style.top = `${Math.round(q.y + 8)}px`; }
      } else {
        const el = host.querySelector ? host.querySelector(sel) : null; const b = el && el.getBoundingClientRect ? el.getBoundingClientRect() : null;
        if (!b || (!b.width && !b.height)) { hand.classList.remove('show'); }
        else { hand.classList.add('show'); hand.style.left = `${Math.round(b.left + b.width / 2 - hb.left)}px`; hand.style.top = `${Math.round(b.bottom - hb.top + 2)}px`; }
      }
      if (typeof requestAnimationFrame === 'function') st.raf = requestAnimationFrame(tick);
    };
    tick();
  };

  const blockedNow = () => { try { return !!(st.deps && typeof st.deps.blocked === 'function' && st.deps.blocked()); } catch (_) { return false; } };
  /** Put card `c` on screen (counts it). mode 'event' (48F) | 'curious' (approach/linger/ping) | 'ask' (tap / HUD tap). */
  function display(c, mode, world) {
    counts[c.id] = Math.min(RETIRED - 1, (counts[c.id] || 0) + 1); if (!seen.includes(c.id)) seen.push(c.id);
    st.cur = c; st.mode = mode; st.world = world || null; st.t = 0; st.at = now(); st.last[c.id] = st.clock;
    if (wrap) { ico.innerHTML = c.icon ? icon(c.icon) : ''; txt.textContent = String(c.text || '').slice(0, 60); wrap.classList.add('show'); pointAt(c.point, world); }
    bus.emit('tutor:shown', { id: c.id, mode });
  }
  const queued = (id) => st.queue.some((q) => q.c.id === id);
  function enqueue(c, world) {
    if (queued(c.id)) return false;
    st.queue.push({ c, world: world || null }); st.queue.sort((a, b) => (b.c.priority | 0) - (a.c.priority | 0));
    while (st.queue.length > cfg.queueMax) st.queue.pop();
    return true;
  }
  function retire(id) {
    const c = cards.get(id); if (!c) return false;
    counts[id] = RETIRED;                                                    // learned by doing: never offered again, but NOT 'seen' (nothing was shown)
    const qi = st.queue.findIndex((q) => q.c.id === id); if (qi >= 0) st.queue.splice(qi, 1);
    if (st.cur && st.cur.id === id && st.mode !== 'ask') api.dismiss('done');
    return true;
  }

  const api = {
    seen, counts,
    get current() { return st.cur ? st.cur.id : null; },
    get visible() { return !!st.cur; },
    bind(d) { st.deps = d || null; return api; },
    /** Show card `id` while it has shows left (48F: once). Returns true when it was shown (false: unknown, retired, or another card is up → dropped). */
    show(id) {
      const c = cards.get(id); if (!c || !st.active) return false;
      if (st.cur || retired(c)) return false;
      display(c, 'event'); return true;
    },
    /** T2 approach / linger / ping: like show(), but repeats (≤ maxShows, ≥ repeatGap s apart) and QUEUES behind the card on screen. */
    offer(id, world) {
      const c = cards.get(id); if (!c || !st.active || retired(c) || blockedNow()) return false;
      if (st.last[id] != null && st.clock - st.last[id] < cfg.repeatGap) return false;
      if (st.cur) { if (st.cur.id === id) return false; return enqueue(c, world); }
      display(c, 'curious', world); return true;
    },
    /** T2 tap-to-ask: always answers (replaces the card on screen), no count limit, no cooldown. */
    ask(id, world) {
      const c = cards.get(id); if (!c || !st.active || blockedNow()) return false;
      if (st.cur && st.cur.id === id) { st.t = 0; st.at = now(); return true; }   // asked again: keep it up, restart the clock
      if (st.cur) { const o = st.cur; st.cur = null; bus.emit('tutor:dismissed', { id: o.id, ms: Math.round(now() - st.at), why: 'replaced' }); }
      display(c, 'ask', world); return true;
    },
    retire,
    /** Restore persisted progress (save slot / CONTINUE): counts {id:n} and/or the old seen list (each id = 1). Never lowers a count. */
    merge(o = {}) { if (Array.isArray(o.seen)) for (const id of o.seen) if (typeof id === 'string') { counts[id] = Math.max(counts[id] || 0, 1); if (!seen.includes(id)) seen.push(id); } putCounts(o.counts); return api; },
    /** Debug / reset: forget every card (counts, seen, queue, cool-downs). */
    clear() { for (const k of Object.keys(counts)) delete counts[k]; seen.length = 0; st.queue.length = 0; st.last = {}; st.lullDone = false; st.lull = 0; return api; },
    has(id) { return cards.has(id); },
    cardIds() { return [...cards.keys()]; },
    card(id) { return cards.get(id) || null; },
    /** T2 codex: every card, in data order. met = shown at least once (or retired by doing the thing). */
    list() { return [...cards.values()].filter((c) => c.on !== null || c.target || c.group).map((c) => ({ id: c.id, icon: c.icon || '', text: String(c.text || ''), group: c.group || 'other', count: Math.min(counts[c.id] || 0, 98), met: (counts[c.id] || 0) > 0 })); },
    get queued() { return st.queue.map((q) => q.c.id); },
    dismiss(why = 'tap') {
      const c = st.cur; if (!c) return api;
      st.cur = null; const ms = Math.round(now() - st.at); st.gap = cfg.gap;
      if (wrap) { wrap.classList.remove('show'); pointAt(null); }
      bus.emit('tutor:dismissed', { id: c.id, ms, why });
      if (why === 'title' || why === 'destroy') st.queue.length = 0;
      return api;
    },
    /** Clock: unpaused play seconds (ui.update). ttl + curiosity lull. */
    update(dt) {
      dt = Math.min(0.1, Math.max(0, +dt || 0)); st.clock += dt;
      if (st.cur) { st.t += dt; if (st.t >= cfg.ttl) api.dismiss('ttl'); return; }
      if (st.queue.length && st.active) {                                   // T2.3: two triggers close together → both shown in order, none dropped
        st.gap -= dt; if (st.gap > 0) return;
        if (blockedNow()) return;
        const n = st.queue.shift(); if (n && !retired(n.c)) { display(n.c, 'curious', n.world); return; }
      }
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
  // T2: the world asks (curiosity.js) · the player asks (tap on a thing) · the player did it (doneOn retires the card)
  st.offs.push(bus.on('curious', (p) => {
    if (!p || !p.hint || !cards.has(p.hint)) return; const w = Number.isFinite(p.x) && Number.isFinite(p.z) ? { x: p.x, z: p.z } : null;
    if (p.why === 'tap' || p.why === 'hold') { const c = cards.get(p.hint); if (p.act && p.why === 'tap' && retired(c)) return; api.ask(p.hint, w); }   // a tap that also acts: card only until maxShows
    else api.offer(p.hint, w);
  }));
  st.offs.push(bus.on('curious:ping', (p) => { if (p && p.hint && cards.has(p.hint)) api.offer(p.hint, Number.isFinite(p.x) ? { x: p.x, z: p.z } : null); }));
  const byDone = new Map();
  for (const c of cards.values()) { if (!c.doneOn) continue; if (!byDone.has(c.doneOn)) byDone.set(c.doneOn, []); byDone.get(c.doneOn).push(c); }
  for (const [ev, list] of byDone) st.offs.push(bus.on(ev, (p) => { for (const c of list) if (matches(c.doneMatch, p)) retire(c.id); }));
  // the card's own trigger may be the thing the player tapped — dismiss on the NEXT gesture only (same tick ignored via st.at)
  const guideOf = (e) => { let n = e && e.target; for (let i = 0; n && i < 8; i++, n = n.parentNode) { const g = n.dataset && n.dataset.guide; if (g) return g; if (n.getAttribute && n.getAttribute('data-guide')) return n.getAttribute('data-guide'); } return null; };
  const gesture = (e) => {
    if (e && e.type === 'pointerdown') { const g = guideOf(e); if (g && cards.has(g)) { api.ask(g); return; } }   // tap any [data-guide] HUD thing → its card (T2.6); the tap itself still works
    if (!st.cur) return;
    const guard = st.mode === 'curious' ? cfg.guard * 1000 : 120;                                   // a world card must survive the joystick / WASD that was already going
    if (now() - st.at < guard) return; if (e && e.type === 'keydown' && st.mode === 'curious') return;
    if (e && e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return; api.dismiss(e && e.type === 'keydown' ? 'key' : 'tap');
  };
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
