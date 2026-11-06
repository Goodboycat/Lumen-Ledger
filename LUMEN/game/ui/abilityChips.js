// 41D — six ability chips in key order (Q W E R F G). Locked = dimmed + "★3" cost; unlock = pop; locked press = shake.
// mountAbilityChips(root, { bus, abilities?: Set }) → { el, sync(set, starsTotal), destroy() }
// Listens: ability:unlock {id,stars} · ability:locked {name} · sandbox:ability:start {name,cooldown} · game:state (hide off-play)
// T2b: press fires on RELEASE < 350 ms; hold ≥ 350 ms → bus ui:power:ask {name} (guide card, no ability); locked chips stay pressable (aria-disabled) so they answer;
//      ability:fx {name,frac} drains a thin bar (Shield / Stomp).
// DOM only, 0 meshes. Owned by 41D.
import { bus as defaultBus } from '../src/core/EventBus.js';
import { ABILITY_ORDER, starsFor } from '../src/systems/unlocks.js';

const KEYS = { coinMagnetDash: 'Q', bubbleShield: 'W', growthStomp: 'E', ledgerFlash: 'R', haggleShout: 'F', fogSweep: 'G' };
const HOLD_MS = 350;
const SHORT = { coinMagnetDash: 'Dash', bubbleShield: 'Shield', growthStomp: 'Stomp', ledgerFlash: 'Flash', haggleShout: 'Haggle', fogSweep: 'Sweep' };

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function retrigger(n, cls) { n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls); }

export function mountAbilityChips(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const wrap = el('nav', 'll-abil'); wrap.id = 'll-ability-chips'; wrap.setAttribute('aria-label', 'Abilities');
  const chips = {}; const holds = [];
  for (const id of ABILITY_ORDER) {
    const c = el('button', 'll-abil-chip'); c.type = 'button'; c.dataset.id = id;
    c.append(el('b', 'll-abil-key', KEYS[id]), el('span', 'll-abil-name', SHORT[id]));
    const cost = starsFor(id); if (cost) c.append(el('small', 'll-abil-cost', '★' + cost));
    c.title = SHORT[id] + ' [' + KEYS[id] + ']' + (cost ? ' — earn ' + cost + ' ★ in ledgers' : '');
    const fx = el('i', 'll-abil-fx'); c.append(fx); c._fx = fx;   // T2b: thin bar that drains while Shield (30 s) / Stomp (12 s) is active
    // T2b: HOLD ≥ 350 ms = ask the guide (ui:power:ask, the press is NOT fired); a release before that = the normal press (ui:ability).
    // Locked chips are NOT `disabled` any more: a press answers "Locked. Earn ★ …" instead of nothing.
    let hold = 0, held = false;
    c.addEventListener('pointerdown', (e) => { e.stopPropagation && e.stopPropagation(); held = false; if (hold) clearTimeout(hold); c.classList.add('down');
      hold = setTimeout(() => { hold = 0; held = true; c.classList.remove('down'); bus.emit('ui:power:ask', { name: id }); }, HOLD_MS); });
    const rel = (e, cancel) => { e && e.stopPropagation && e.stopPropagation(); c.classList.remove('down'); if (!hold) return; clearTimeout(hold); hold = 0; if (!cancel) bus.emit('ui:ability', { name: id }); };
    c.addEventListener('pointerup', (e) => rel(e, false)); c.addEventListener('pointercancel', (e) => rel(e, true)); c.addEventListener('pointerleave', (e) => rel(e, true));
    c.addEventListener('keydown', (e) => { if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) { e.preventDefault && e.preventDefault(); bus.emit('ui:ability', { name: id }); } });   // keyboard focus → press
    c.addEventListener('contextmenu', (e) => e.preventDefault && e.preventDefault());
    chips[id] = c; wrap.append(c); holds.push(() => { if (hold) clearTimeout(hold); hold = 0; });
  }
  root.append(wrap);

  const api = {
    el: wrap, chips,
    sync(set, starsTotal) {
      for (const id of ABILITY_ORDER) { const on = !set || set.has(id); chips[id].classList.toggle('locked', !on); chips[id].setAttribute('aria-disabled', on ? 'false' : 'true'); }
      if (starsTotal != null) wrap.dataset.stars = String(starsTotal);
    },
    unlock(id) { const c = chips[id]; if (!c) return; c.classList.remove('locked'); c.setAttribute('aria-disabled', 'false'); retrigger(c, 'pop'); },
    shake(id) { const c = chips[id]; if (c) retrigger(c, 'shake'); },
    cooldown(id, s) { const c = chips[id]; if (!c) return; c.style.setProperty('--cd', (s || 5) + 's'); retrigger(c, 'cooling'); },
    /** T2b: drain bar (frac 1 → 0) for the timed powers. */
    fx(id, frac) { const c = chips[id]; if (!c) return; const f = Math.max(0, Math.min(1, +frac || 0)); c._fx.style.setProperty('--fx', String(f)); c.classList.toggle('fx', f > 0); },
    destroy() { for (const h of holds) h(); for (const off of offs) try { off(); } catch (_) {} wrap.remove(); },
  };
  const offs = [
    bus.on('ability:unlock', (e) => e?.id && api.unlock(e.id)),
    bus.on('ability:locked', (e) => e?.name && api.shake(e.name)),
    bus.on('sandbox:ability:start', (e) => e?.name && api.cooldown(e.name, e.cooldown)),
    bus.on('sandbox:denied', (e) => e?.name && api.shake(e.name)),
    bus.on('ability:fx', (e) => e?.name && api.fx(e.name, e.frac)),
    bus.on('ui:abilities', (e) => api.sync(e?.abilities, e?.starsTotal)),
  ];
  if (opts.abilities) api.sync(opts.abilities, opts.starsTotal);
  return api;
}

export default mountAbilityChips;
