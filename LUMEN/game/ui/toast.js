// LUMEN LEDGER — Toast queue (Chat 7B). DOM only, no Three. Contract: §B UI → mountToast(root).
//
//   import { mountToast } from './ui/toast.js';
//   const toast = mountToast(root, { bus, max: 3, duration: 2800, listen: true });
//   toast.push('Stall placed!', { kind: 'ok'|'info'|'warn'|'bad'|'gold', icon: '🔨', duration?, id? })  → toast handle { el, close() }
//   toast.push({ text, kind, icon, duration, id })   // same, object form. Same `id` within 1 s → coalesces ("×2").
//   toast.clear() · toast.count · toast.destroy()
//
// Listens (opts.listen !== false — the integrator may switch this off and push its own):
//   ui:toast {text,kind,icon,duration}  · story:toast {text,...} (8A tutorial toasts) · eco:event {event:{title,text}} · eco:scam offer {title}
//   build:placed {id} · build:upgraded {id,level} · build:denied {why} · eco:denied {cost} · eco:loan {kind,delta,debt} · eco:win · eco:lose
//   cust:angry {reason} (coalesced) · island:unlock {zone}
// Emits nothing.
//
// Motion: slide-in from top 320 ms outBack · progress bar = duration linear · exit 200 ms inQuad (shrink + fade) · stack re-layout via CSS transition 220 ms.

import { iconize, icon } from './icons.js';
import { bus as defaultBus } from '../src/core/EventBus.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };
const ICON = { ok: '✔', info: 'ℹ', warn: '⚠', bad: '✖', gold: '✦' };

export function mountToast(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  // S41/15B: ONE text channel — phones (≤640 px or touch) show a single toast at a time; desktop keeps opts.max (3).
  const phone = () => { try { return typeof window !== 'undefined' && window.matchMedia && (window.matchMedia('(max-width: 640px)').matches || (document.body && document.body.classList.contains('is-touch'))); } catch { return false; } };
  const maxOf = () => (opts.max === 1 || phone()) ? 1 : (opts.max || 3);
  const defDur = opts.duration || 5000;
  // mobile pass: toasts disappeared too fast → longer defaults + reading time: ≥ 1.4 s + 75 ms per character (a 100-char tip ≈ 9 s).
  // Touching / hovering a toast holds it; tap still dismisses.
  const readMs = (text) => 1400 + String(text).length * 75;

  const wrap = el('div', 'll-toasts'); wrap.id = 'll-toasts'; wrap.setAttribute('aria-live', 'polite');
  root.appendChild(wrap);
  const live = []; // { el, id, text, t, timer, count }
  // S41/15B: while a dialogue line is on screen, toasts are HELD (queued) — two text boxes at once was the #1 "what do I read?" moment.
  //   They are released one by one (350 ms apart) when the dialogue closes; same id/text coalesce inside the hold queue too.
  const held = []; let holding = false; let releaseT = 0;

  const remove = (t) => {
    const i = live.indexOf(t); if (i < 0) return; live.splice(i, 1); clearTimeout(t.timer);
    t.el.classList.add('out'); const kill = () => t.el.remove(); t.el.addEventListener('animationend', kill, { once: true }); setTimeout(kill, 260);
  };

  const api = {
    el: wrap,
    get count() { return live.length; },
    get items() { return live.map((t) => ({ id: t.id, text: t.text, count: t.count })); },
    push(text, o = {}) {
      if (text && typeof text === 'object') { o = text; text = o.text; }
      text = String(text ?? ''); if (!text) return null;
      const kind = o.kind || 'info'; const id = o.id || null;
      if (holding && !o.now) {
        const same = held.find((h) => (id && h.id === id) || h.text === text);
        if (same) { same.o = { ...o }; return same.handle; }
        const h = { id, text, o: { ...o }, handle: { el: null, close() { const i = held.indexOf(h); if (i >= 0) held.splice(i, 1); } } };
        held.push(h); if (held.length > 6) held.shift();
        return h.handle;
      }
      const want = o.duration ?? defDur;
      const duration = (want <= 0 || want < 200 || (opts.duration != null && opts.duration < 200)) ? want : Math.max(want, readMs(text));   // < 200 ms = tests / explicit
      // coalesce: same id (or same text) still visible → bump counter + restart timer
      const same = live.find((t) => (id && t.id === id) || t.text === text);
      if (same) { same.count++; same.badge.textContent = '×' + same.count; same.badge.style.display = ''; restart(same, duration); same.el.classList.remove('bump'); void same.el.offsetWidth; same.el.classList.add('bump'); return same.handle; }
      const node = el('div', 'll-toast ' + kind);
      const icon = el('span', 'll-toast-icon', o.icon || ICON[kind] || ICON.info);
      const txt = el('span', 'll-toast-text', text);
      const badge = el('span', 'll-toast-badge', ''); badge.style.display = 'none';
      const bar = el('i', 'll-toast-bar'); bar.style.animationDuration = duration + 'ms';
      node.append(icon, txt, badge, bar);
      // BUGFIX P28: optional tappable action button (touch has no Esc) — o.action = { label, emit: 'bus:event' | fn }
      if (o.action && (o.action.emit || typeof o.action === 'function' || typeof o.action.fn === 'function')) {
        const a = o.action, btn = el('button', 'll-toast-act', a.label || 'Stop'); btn.type = 'button';
        btn.addEventListener('click', (ev) => { ev.stopPropagation(); if (typeof a === 'function') a(); else if (a.fn) a.fn(); else if (a.emit && bus) bus.emit(a.emit, a.payload || {}); remove(t); });
        node.insertBefore(btn, bar);
      }
      node.addEventListener('click', () => remove(t));
      const hold = () => { clearTimeout(t.timer); t.bar.style.animationPlayState = 'paused'; };
      const release = () => { if (live.includes(t)) { t.bar.style.animationPlayState = ''; restart(t, Math.max(2000, duration * 0.5)); } };
      node.addEventListener('pointerenter', hold); node.addEventListener('pointerleave', release);
      const t = { el: node, id, text, timer: 0, count: 1, badge, bar, handle: null };
      t.handle = { el: node, close: () => remove(t) };
      wrap.prepend(node); live.unshift(t);
      while (live.length > maxOf()) remove(live[live.length - 1]);
      restart(t, duration);
      return t.handle;
    },
    clear() { [...live].forEach(remove); held.length = 0; return api; },
    /** S41/15B: hold (queue) toasts while a dialogue owns the text channel; release() plays them back one by one. */
    hold(on = true) { holding = !!on; if (!holding) release(); return api; },
    get holding() { return holding; }, get heldCount() { return held.length; },
    destroy() { offs.forEach((f) => f()); clearTimeout(releaseT); api.clear(); wrap.remove(); },
  };
  function release() {
    clearTimeout(releaseT); if (holding || !held.length) return;
    const h = held.shift(); api.push({ ...h.o, text: h.text, id: h.id || undefined, now: true });
    if (held.length) releaseT = setTimeout(release, 350);
  }
  function restart(t, duration) {
    clearTimeout(t.timer); if (duration > 0) t.timer = setTimeout(() => remove(t), duration);
    t.bar.style.animation = 'none'; void t.bar.offsetWidth; t.bar.style.animation = ''; t.bar.style.animationDuration = duration + 'ms';
  }

  const offs = [];
  if (opts.listen !== false) {
    const on = (n, f) => offs.push(bus.on(n, f));
    on('ui:toast', (p) => p && api.push(p));
    on('story:toast', (p) => p && api.push({ kind: 'info', icon: '🦉', ...(typeof p === 'string' ? { text: p } : p), duration: Math.max(7000, (p && p.duration) || 0) }));   // tutorial tips: ≥ 7 s
    on('eco:event', (p) => {
      const e = (p && p.event) || p || {}; if (!(e.title || e.text)) return;
      // S15: say what really happened to the player's money (Protect absorbed / Save+Invest scattered) so the insurance lesson lands
      const fx = (p && p.effect) || {}; const tail = [];
      if (fx.absorbed > 0) tail.push(`🛡 Protect absorbed ${fx.absorbed} ✦`);
      if (fx.exposed > 0) tail.push(`💨 ${fx.exposed} ✦ scattered from Save & Invest`);
      else if (e.effect && e.effect.exposeJars && fx.absorbed > 0 && !fx.debt && fx.spark === 0) tail.push('Save & Invest untouched');
      api.push({ text: (e.title ? `${e.title}: ${e.text || ''}`.trim() : e.text) + (tail.length ? ' — ' + tail.join(' · ') : ''), kind: 'warn', icon: '📜', duration: 8000, id: 'event' });
    });
    on('eco:scam', (o) => o && api.push({ text: `Baron's deal: ${o.title || 'too good to be true'}…`, kind: 'bad', icon: '🎩', duration: 7000, id: 'scam' }));
    on('build:placed', (p) => p && api.push({ text: `${nice(p.id)} built`, kind: 'ok', icon: '🔨', id: 'placed' }));
    on('build:upgraded', (p) => p && api.push({ text: `${nice(p.id)} → level ${p.level}`, kind: 'gold', icon: '⬆', id: 'upgraded' }));
    on('build:denied', (p) => api.push({ text: 'Cannot build: ' + ((p && p.why) || 'blocked'), kind: 'bad', id: 'denied', duration: 3200 }));
    // BUGFIX: every refusal used to read "Not enough Spark" — also for 'owned', 'needs zone_west', 'jar save is empty', 'no debt to repay',
    // 'loan refused'. Only cost refusals say that now; the others show the economy's own reason (prefixes stripped).
    on('eco:denied', (p) => {
      const why = (p && (p.why || p.reason)) || '';
      const isCost = !why || why === 'cost' || why === 'cannot afford' || /^not enough/i.test(why) || /^(spend|build:|upgrade:)/.test(why);
      const text = isCost ? `Not enough Spark${p && p.cost ? ` (need ${p.cost})` : ''}` : (why === 'owned' ? 'Already owned' : String(why).replace(/^needs (zone_|helper_)/, 'needs ').replace(/^jar /, '').replace(/^\w/, (c) => c.toUpperCase()));
      api.push({ text, kind: 'bad', id: 'denied', duration: 3200 });
    });
    // S41/15F: debt clarity — the season report's interest line gets its own toast with a tappable PAY action (phones have no hotkey).
    // "Debt grew +40 ✦ (20% interest) → 240 ✦" tells WHY the number went up; PAY emits the same ui:repay the HUD button does.
    // Held while the season card / dialogue is open (15B), so it shows the moment the player is back in control.
    on('eco:season', (r) => {
      if (!r || !(r.interestPaid > 0) || !(r.debt > 0)) return;
      const base = r.debt - r.interestPaid, pct = base > 0 ? Math.round(r.interestPaid / base * 100) : 0;
      api.push({ text: `Debt grew +${r.interestPaid} ✦ (${pct}% interest) → ${r.debt} ✦. Pay it down early — interest compounds.`, kind: 'bad', icon: '🎩', id: 'interest', duration: 7000, action: { label: 'Pay', emit: 'ui:repay', payload: { source: 'hud' } } });
    }),
    // S41/15F: start-of-game — the inherited debt is explained once (new STORY game only, not on continue / endless)
    on('game:start', (p) => {
      if (!p || p.resumed || (p.mode && p.mode !== 'story') || !(p.debt > 0)) return;
      api.push({ text: `You inherited ${p.debt} ✦ of debt from the old Glowmarket — Baron Gilt adds ${Math.round((p.loanRate || 0.2) * 100)}% every season. PAY it down from your pouch (💸) before it grows.`, kind: 'warn', icon: '🎩', id: 'debt-intro', duration: 9000, action: { label: 'Pay', emit: 'ui:repay', payload: { source: 'hud' } } });
    }),
    on('eco:loan', (p) => p && api.push(p.kind === 'repay' ? { text: `Repaid ${p.delta} — debt ${p.debt}`, kind: 'ok', icon: '💸', id: 'loan' } : { text: `Loan +${p.delta} — the Baron smiles. Debt ${p.debt}`, kind: 'bad', icon: '🎩', id: 'loan' }));
    on('cust:angry', (p) => api.push({ text: 'A Glimmer left angry' + (p && (p.why || p.reason) ? ` (${p.why || p.reason})` : ''), kind: 'warn', icon: '😠', id: 'angry', duration: 3500 }));
    // S16/S20: Debt Collectors + Baron Gilt. The wave toast names the Baron's NEW power this season (BARON_POWERS text lives in enemies.js; the bus payload carries ids).
    on('enemy:wave', (p) => {
      if (!p) return;
      if (p.boss) { const n = (p.powers || []).length; api.push({ text: `Baron Gilt lands at the pier${p.count > 1 ? ` with ${p.count - 1} Collector${p.count > 2 ? 's' : ''}` : ''} — watch the red rings, step out before they land!`, kind: 'bad', icon: '🎩', id: 'wave', duration: 6500 }); if (n) api.push({ text: BARON_HINT[(p.powers || []).at(-1)] || '', kind: 'warn', icon: '⚠', id: 'wavehint', duration: 7000 }); }
      else api.push({ text: `Hit Collectors twice (⚔) or walk away — they are slower than you`, kind: 'warn', icon: '🌫', id: 'wave', duration: 5000 });   // S41/15D: the "N landed" line is the big wave banner (ui/wave.js) now
    });
    on('enemy:defeated', (p) => p && p.kind === 'baron' && api.push({ text: `Baron Gilt retreats! +${p.reward} ✦`, kind: 'gold', icon: '🎩', id: 'baron', duration: 4500 }));
    on('enemy:stomp', (p) => p && p.hit === false && api.push({ text: 'Dodged the stomp — he is dazed, hit him now!', kind: 'ok', icon: '⚔', id: 'stomp', duration: 2500 }));
    on('enemy:dashEnd', (p) => p && api.push({ text: `${p.hit ? 'The umbrella got you — but' : 'Dodged the dash —'} he is paralysed for ${p.stun} s. Hit him now!`, kind: 'ok', icon: '⚔', id: 'stomp', duration: 3000 }));
    on('island:unlock', (p) => api.push({ text: `New zone unlocked${p && p.zone ? ': ' + nice(p.zone) : ''}!`, kind: 'gold', icon: '🗺', duration: 5000 }));
    on('eco:win', () => api.push({ text: 'The Lighthouse is lit! ✦', kind: 'gold', duration: 5000 }));
    on('eco:lose', () => api.push({ text: 'The Debt Fog took the island…', kind: 'bad', duration: 5000 }));
    // BUGFIX P42: gameplay toasts (incl. the 6 s demolish-mode toast with its Stop button) no longer float over the Title screen
    on('ui:dialogue:open', () => api.hold(true));
    on('ui:dialogue:close', () => api.hold(false));
    on('game:title', () => api.clear());
    on('ui:title:open', () => api.clear());
  }
  return api;
}
const BARON_HINT = {
  cannon: 'Debt-Fog Cannon: a ring marks where you stand — step out before the fog ball lands (−1 ✦, slowing puddle).',
  puddle: 'Fog puddles linger longer now — Pip walks at 60 % inside them.',
  stomp: 'Big Stomp: when he crouches, a wide ring grows where you stood and he leaps there — get out, then hit him while he is dazed!',
  minigun: 'Fog Minigun: 2 s of pellets that follow you with a lag — keep moving sideways.',
  umbrella: 'Umbrella Dash: he aims, then charges along the line. Sidestep — he is paralysed for 4 s after. Hit him!',
};
const nice = (id) => String(id || '').replace(/^stall_/, '').replace(/_/g, ' ').replace(/([a-z])([A-Z])/g, '$1 $2').replace(/^\w/, (c) => c.toUpperCase());
