// LUMEN LEDGER — Scam Reveal card (T5.2, S58). DOM only. Shown ~4 s AFTER the dialogue closes, never modal, tap = skip (the choice itself is never skipped).
//   const rv = mountScamReveal(root, { bus, data: storyData.reveal, seed? });   rv.show(payload) · rv.hide() · rv.visible · rv.last · rv.update(dt) · rv.destroy()
// Listens: story:scamEnd {id, fair, accepted, looked, outcome, tell}  (stored)  ->  ui:dialogue:close / story:end (shown).
//   fell for a scam  : the mask DROPS (css) -> coin bag + big "-N" (or "debt +N") -> Owl: one kind line -> "The tell" in a highlighted strip
//   spotted (looked)  : a gold star pops: "Spotted!" + the tell as a one-liner (this is the +1 star the Journal counts)
//   fair taken        : green check + "+N" ;  walked away / said no without looking : nothing (no nag)
import { icon } from './icons.js';
const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const REVEAL = { ttl: 4.2, minShowMs: 600 };
const FALLBACK = { kind: ['Happens to everyone, Pip.'], spotted: ['Nicely spotted, Pip!'], fairTook: ['Checked first, paid fair.'], lostLabel: 'Lost', tellLabel: 'The tell' };

export function mountScamReveal(root, opts = {}) {
  const bus = opts.bus; if (!bus) throw new Error('mountScamReveal: opts.bus required');
  const D = { ...FALLBACK, ...(opts.data || {}) }; let n = 0;
  const card = el('section', 'll-reveal'); card.setAttribute('role', 'status'); card.setAttribute('aria-live', 'polite'); card.hidden = true;
  const pic = el('div', 'll-reveal-pic'), num = el('div', 'll-reveal-num'), owl = el('div', 'll-reveal-owl'), tell = el('div', 'll-reveal-tell');
  const top = el('div', 'll-reveal-top'); top.append(pic, num); card.append(top, owl, tell); root.appendChild(card);
  const st = { on: false, t: 0, pending: null, last: null, kind: null, shownAt: 0 };
  const pick = (a) => a[(n++) % a.length];
  const loss = (o) => { if (!o) return null; if (o.debtAdded > 0 && !(o.lostSpark > 0)) return { txt: '+' + o.debtAdded, lab: 'debt' }; if (o.lostSpark > 0) return { txt: '\u2212' + o.lostSpark, lab: D.lostLabel }; return null; };
  const api = {
    el: card, get visible() { return st.on; }, get last() { return st.last; }, get kind() { return st.kind; }, get pending() { return st.pending; },
    /** Render one reveal. p = story:scamEnd payload. Returns the kind shown ('fell' | 'spotted' | 'took' | null). */
    show(p) {
      if (!p) return null; let kind = null;
      if (!p.fair && p.accepted) kind = 'fell'; else if (!p.fair && !p.accepted && p.looked) kind = 'spotted'; else if (p.fair && p.accepted) kind = 'took';
      if (!kind) return null;
      card.className = 'll-reveal ' + kind; card.hidden = false; st.kind = kind; st.last = p; st.on = true; st.t = 0; st.shownAt = Date.now();
      if (kind === 'fell') {
        const L = loss(p.outcome); pic.innerHTML = '<span class="ll-reveal-mask">' + icon('mask') + '</span><span class="ll-reveal-bag">' + icon('coinbag') + '</span>';
        num.innerHTML = L ? '<b>' + L.txt + '</b><span>' + icon(L.lab === 'debt' ? 'fog' : 'spark') + '</span>' : '';
        owl.innerHTML = icon('owl') + '<span>' + pick(D.kind) + '</span>';
        tell.innerHTML = '<i>' + D.tellLabel + '</i> ' + (p.tell || '');
      } else if (kind === 'spotted') {
        pic.innerHTML = '<span class="ll-reveal-star">' + icon('star') + '</span>'; num.innerHTML = '<b>+1</b><span>' + icon('star') + '</span>';
        owl.innerHTML = icon('owl') + '<span>' + pick(D.spotted) + '</span>'; tell.innerHTML = '<i>' + D.tellLabel + '</i> ' + (p.tell || '');
      } else {
        const g = p.outcome?.net > 0 ? p.outcome.net : (p.outcome?.gained || 0);
        pic.innerHTML = '<span class="ll-reveal-star">' + icon('check') + '</span>'; num.innerHTML = g ? '<b>+' + g + '</b><span>' + icon('spark') + '</span>' : '';
        owl.innerHTML = icon('owl') + '<span>' + pick(D.fairTook) + '</span>'; tell.innerHTML = p.tell ? '<i>Fair</i> ' + p.tell : '';
      }
      tell.hidden = !tell.textContent.trim();
      card.classList.remove('go'); void card.offsetWidth; card.classList.add('go');
      bus.emit('ui:reveal:shown', { kind, id: p.id }); return kind;
    },
    hide() { if (!st.on) return api; st.on = false; card.hidden = true; card.classList.remove('go'); bus.emit('ui:reveal:hidden', {}); return api; },
    update(dt) { if (st.on) { st.t += Math.min(0.1, Math.max(0, +dt || 0)); if (st.t >= (opts.ttl ?? REVEAL.ttl)) api.hide(); } },
    destroy() { offs.forEach((f) => f?.()); card.remove(); },
  };
  card.addEventListener('click', () => api.hide());   // tap = skip the animation / the card (never a decision)
  const flush = () => { if (!st.pending) return; const p = st.pending; st.pending = null; setTimeout(() => api.show(p), 120); };
  const offs = [
    bus.on('story:scamEnd', (p) => { st.pending = p; if (opts.immediate) flush(); }),
    bus.on('ui:dialogue:close', flush), bus.on('story:end', () => { if (opts.immediate) flush(); }),
    bus.on('game:title', () => { st.pending = null; api.hide(); }), bus.on('eco:season', () => api.hide()),
  ];
  return api;
}
export default mountScamReveal;
