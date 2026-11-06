// T2b — the answer pill: every power press gets ≤ 8 words, in ≤ 1 frame, never a modal. DOM only (0 meshes), pointer-events none.
//   const pa = mountPowerAnswer(root, { bus, stars?: () => ({ have }) });   pa.text · pa.visible · pa.say(text, name?, kind?) · pa.update(dt) · pa.destroy()
// Listens: ability:answer {name,text,kind} (Game.js: numbers + "no target → do this") · sandbox:denied {name,why,secondsLeft,reason} (cooldown / busy / blocked)
//          · ability:locked {name,stars,have} (live ★ count). One line at a time, a new one replaces the old; fades after ttl s.
import { icon } from './icons.js';
import { SHORT, deniedLine, lockedLine, words } from '../src/systems/powerAnswers.js';

const ICON = { coinMagnetDash: 'dash', bubbleShield: 'shield', growthStomp: 'upgrade', ledgerFlash: 'bulb', haggleShout: 'megaphone', fogSweep: 'broom' };
export const ANSWER_DEFAULTS = { ttl: 2.6, maxWords: 8 };

export function mountPowerAnswer(root, opts = {}) {
  const bus = opts.bus; if (!bus) throw new Error('mountPowerAnswer: opts.bus required');
  const cfg = { ...ANSWER_DEFAULTS, ...opts };
  const wrap = document.createElement('div'); wrap.className = 'll-pans'; wrap.id = 'll-power-answer'; wrap.setAttribute('aria-live', 'polite'); wrap.setAttribute('role', 'status');
  const ico = document.createElement('span'); ico.className = 'll-pans-ico'; const txt = document.createElement('span'); txt.className = 'll-pans-txt';
  wrap.append(ico, txt); root.appendChild(wrap);
  const st = { text: '', name: '', kind: '', t: 0, on: false, n: 0 };
  const api = {
    el: wrap,
    get text() { return st.text; }, get visible() { return st.on; }, get kind() { return st.kind; }, get count() { return st.n; },
    /** Show one line (clipped to maxWords). */
    say(text, name = '', kind = 'ok') {
      let w = String(text || '').trim().split(/\s+/).filter(Boolean); if (!w.length) return api;
      if (w.length > cfg.maxWords) w = w.slice(0, cfg.maxWords);
      st.text = w.join(' '); st.name = name; st.kind = kind; st.t = 0; st.on = true; st.n++;
      txt.textContent = st.text; ico.innerHTML = ICON[name] ? icon(ICON[name]) : '';
      wrap.dataset.kind = kind; wrap.dataset.power = name || '';
      wrap.classList.remove('show'); void wrap.offsetWidth; wrap.classList.add('show');
      return api;
    },
    hide() { st.on = false; wrap.classList.remove('show'); return api; },
    update(dt) { if (!st.on) return; st.t += Math.min(0.1, Math.max(0, +dt || 0)); if (st.t >= cfg.ttl) api.hide(); },
    destroy() { for (const f of offs) try { f(); } catch (_) {} offs.length = 0; wrap.remove(); },
  };
  const offs = [
    bus.on('ability:answer', (p) => { if (p && p.text) api.say(p.text, p.name, p.kind || 'ok'); }),
    bus.on('sandbox:denied', (p) => { if (!p || !p.name) return; api.say(deniedLine(p.why, p), p.name, p.why || 'denied'); }),
    bus.on('ability:locked', (p) => { if (!p || !p.name) return; api.say(lockedLine({ stars: p.stars, have: p.have }), p.name, 'locked'); }),
    bus.on('ui:title:open', () => api.hide()), bus.on('game:title', () => api.hide()),
  ];
  return api;
}
export { SHORT, words };
export default mountPowerAnswer;
