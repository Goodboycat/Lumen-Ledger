// 41D — six ability chips in key order (Q W E R F G). Locked = dimmed + "★3" cost; unlock = pop; locked press = shake.
// mountAbilityChips(root, { bus, abilities?: Set }) → { el, sync(set, starsTotal), destroy() }
// Listens: ability:unlock {id,stars} · ability:locked {name} · sandbox:ability:start {name,cooldown} · game:state (hide off-play)
// DOM only, 0 meshes. Owned by 41D.
import { bus as defaultBus } from '../src/core/EventBus.js';
import { ABILITY_ORDER, starsFor } from '../src/systems/unlocks.js';

const KEYS = { coinMagnetDash: 'Q', bubbleShield: 'W', growthStomp: 'E', ledgerFlash: 'R', haggleShout: 'F', fogSweep: 'G' };
const SHORT = { coinMagnetDash: 'Dash', bubbleShield: 'Shield', growthStomp: 'Stomp', ledgerFlash: 'Flash', haggleShout: 'Haggle', fogSweep: 'Sweep' };

function el(tag, cls, text) { const n = document.createElement(tag); if (cls) n.className = cls; if (text != null) n.textContent = text; return n; }
function retrigger(n, cls) { n.classList.remove(cls); void n.offsetWidth; n.classList.add(cls); }

export function mountAbilityChips(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const wrap = el('nav', 'll-abil'); wrap.id = 'll-ability-chips'; wrap.setAttribute('aria-label', 'Abilities');
  const chips = {};
  for (const id of ABILITY_ORDER) {
    const c = el('button', 'll-abil-chip'); c.type = 'button'; c.dataset.id = id;
    c.append(el('b', 'll-abil-key', KEYS[id]), el('span', 'll-abil-name', SHORT[id]));
    const cost = starsFor(id); if (cost) c.append(el('small', 'll-abil-cost', '★' + cost));
    c.title = SHORT[id] + ' [' + KEYS[id] + ']' + (cost ? ' — earn ' + cost + ' ★ in ledgers' : '');
    c.addEventListener('click', (e) => { e.stopPropagation && e.stopPropagation(); bus.emit('ui:ability', { name: id }); });
    chips[id] = c; wrap.append(c);
  }
  root.append(wrap);

  const api = {
    el: wrap, chips,
    sync(set, starsTotal) {
      for (const id of ABILITY_ORDER) { const on = !set || set.has(id); chips[id].classList.toggle('locked', !on); chips[id].disabled = !on; }
      if (starsTotal != null) wrap.dataset.stars = String(starsTotal);
    },
    unlock(id) { const c = chips[id]; if (!c) return; c.classList.remove('locked'); c.disabled = false; retrigger(c, 'pop'); },
    shake(id) { const c = chips[id]; if (c) retrigger(c, 'shake'); },
    cooldown(id, s) { const c = chips[id]; if (!c) return; c.style.setProperty('--cd', (s || 5) + 's'); retrigger(c, 'cooling'); },
    destroy() { for (const off of offs) try { off(); } catch (_) {} wrap.remove(); },
  };
  const offs = [
    bus.on('ability:unlock', (e) => e?.id && api.unlock(e.id)),
    bus.on('ability:locked', (e) => e?.name && api.shake(e.name)),
    bus.on('sandbox:ability:start', (e) => e?.name && api.cooldown(e.name, e.cooldown)),
    bus.on('sandbox:denied', (e) => e?.name && api.shake(e.name)),
    bus.on('ui:abilities', (e) => api.sync(e?.abilities, e?.starsTotal)),
  ];
  if (opts.abilities) api.sync(opts.abilities, opts.starsTotal);
  return api;
}

export default mountAbilityChips;
