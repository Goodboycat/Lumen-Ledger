// LUMEN LEDGER — Scam / deal result, announced by the CLOUD at the side (S85; was the big Owl "Reveal" card, T5.2 S58). DOM-free now: it only talks to the HUD cloud chips.
//   const rv = mountScamReveal(root, { bus, data: storyData.reveal });   rv.show(payload) · rv.hide() · rv.visible · rv.last · rv.kind · rv.update(dt) · rv.destroy()
// Why (user, S85): "when completing a debt collector scam successfully or not, a big text of the Owl with a 1 star appears. Delete this because it is blocking the view,
//   better make the cloud announce it at the side, do the same with the stranger rewards."  The card covered the top-centre of the island for 4 s.
// Listens: story:scamEnd {id, fair, accepted, looked, outcome, tell} (stored)  ->  ui:dialogue:close / story:end (announced, 0.12 s later).
// Emits:   hud:chip { id:'deal', icons:[...], num, tone, cls, ttl }  -> ui/hud.js cloudSay (icon-only speech bubble under the HUD, left edge, fades itself in <= 5 s, never takes a tap).
//   fell for a scam : [mask, coinbag | fog]  "-N"  (or "+N" debt)   red bubble
//   spotted (looked): [star]                  "+1"                   gold bubble   (the +1 star the Journal counts)
//   fair deal taken : [check, spark]          "+N" (net)             green bubble  (the stranger's reward; S75 had silenced it)
//   walked away / said no without looking / passed on a fair deal : nothing (no nag)
// The tell itself is never lost: the Owl says it inside the dialogue (leaf lines), the Journal keeps it, the Ledger lesson card shows it.
export const REVEAL = { ttl: 5, minShowMs: 0 };

export function mountScamReveal(root, opts = {}) {
  const bus = opts.bus; if (!bus) throw new Error('mountScamReveal: opts.bus required');
  const st = { on: false, t: 0, pending: null, last: null, kind: null, shownAt: 0 };
  const fmt = (n) => Math.round(+n || 0);
  const chipFor = (kind, p) => {
    const o = p.outcome || {};
    if (kind === 'fell') {
      if (o.debtAdded > 0 && !(o.lostSpark > 0)) return { icons: ['mask', 'fog'], num: '+' + fmt(o.debtAdded), tone: 'loss', cls: 'll-chip-loss', text: 'Fooled: debt went up by ' + fmt(o.debtAdded) };
      if (o.lostSpark > 0) return { icons: ['mask', 'spark'], num: '\u2212' + fmt(o.lostSpark), tone: 'loss', cls: 'll-chip-loss', text: 'Fooled: lost ' + fmt(o.lostSpark) + ' Spark' };
      return { icons: ['mask'], num: '', tone: 'loss', cls: 'll-chip-loss', text: 'Fooled by a too-good deal' };
    }
    if (kind === 'spotted') return { icons: ['star'], num: '+1', tone: 'win', cls: 'll-chip-star', text: 'Spotted the trick: +1 star' };
    const g = o.net > 0 ? o.net : (o.gained || 0);
    return { icons: ['check', 'spark'], num: g ? '+' + fmt(g) : '', tone: 'win', cls: 'll-chip-win', text: g ? 'Fair deal: +' + fmt(g) + ' Spark' : 'Fair deal taken' };
  };
  const api = {
    el: null, get visible() { return st.on; }, get last() { return st.last; }, get kind() { return st.kind; }, get pending() { return st.pending; },
    /** Announce one result. p = story:scamEnd payload. Returns the kind shown ('fell' | 'spotted' | 'took' | null). */
    show(p) {
      if (!p) return null; let kind = null;
      if (!p.fair && p.accepted) kind = 'fell'; else if (!p.fair && !p.accepted && p.looked) kind = 'spotted'; else if (p.fair && p.accepted) kind = 'took';
      if (!kind) return null;
      const c = chipFor(kind, p);
      st.kind = kind; st.last = p; st.on = true; st.t = 0; st.shownAt = Date.now();
      bus.emit('hud:chip', { id: 'deal', icons: c.icons, num: c.num, tone: c.tone, cls: c.cls, text: c.text, ttl: opts.ttl ?? REVEAL.ttl });
      bus.emit('ui:reveal:shown', { kind, id: p.id }); return kind;
    },
    hide() { if (!st.on) return api; st.on = false; bus.emit('hud:chip', { id: 'deal', on: false }); bus.emit('ui:reveal:hidden', {}); return api; },
    update(dt) { if (st.on) { st.t += Math.min(0.1, Math.max(0, +dt || 0)); if (st.t >= (opts.ttl ?? REVEAL.ttl)) st.on = false; } },
    destroy() { offs.forEach((f) => f?.()); },
  };
  const flush = () => { if (!st.pending) return; const p = st.pending; st.pending = null; setTimeout(() => api.show(p), 120); };
  const offs = [
    bus.on('story:scamEnd', (p) => { st.pending = p; if (opts.immediate) flush(); }),
    bus.on('ui:dialogue:close', flush), bus.on('story:end', () => { if (opts.immediate) flush(); }),
    bus.on('game:title', () => { st.pending = null; api.hide(); }),
  ];
  return api;
}
export default mountScamReveal;
