// LUMEN LEDGER — Scam Journal (T5, S58). Pure data + bus, no DOM, no Three.
//   const J = createScamJournal({ bus, eco, ids?: () => [...] });   J.entries · J.slots() · J.summary() · J.serialize() · J.restore(obj) · J.destroy()
// One sticker per deal id (6 Too-Good Deals + 3 fair deals = 9 slots). A sticker is filled the moment the player MEETS the deal (the talk opens) and is
// re-stamped when the conversation ends:   scam  ✓ spotted (refused)  ·  ✗ fell for it (accepted)  ·  … met (walked away / timed out)
//                                          fair  ✓ took it · … passed
// `spotted` = refused AFTER looking / asking (the tell was exposed) → +1 ★ in `stars` (T6 reads it; this file never touches the economy).
// Listens: eco:scam / eco:fair {id} (met) · story:scamEnd {id, fair, accepted, looked, tell, outcome} (result).  Emits: journal:update {id, entry, summary} · journal:spotted {id, stars}.
// Save: additive v4 field `scamJournal` { v:1, e:{ id:{ r, n, s } }, stars }   r = 'met'|'spotted'|'fell'|'refused'|'took'|'passed', n = times met, s = season of last meeting.
const RESULTS = ['met', 'spotted', 'fell', 'refused', 'took', 'passed'];

export function createScamJournal(deps = {}) {
  const { bus, eco } = deps;
  const J = { entries: {}, stars: 0 };
  const offs = [];
  const allIds = () => { const s = Object.keys(eco?.scams || {}), f = Object.keys(eco?.fairs || {}); return deps.ids ? deps.ids() : [...s.map((id) => ({ id, kind: 'scam' })), ...f.map((id) => ({ id, kind: 'fair' }))]; };
  const kindOf = (id) => (eco?.fairs?.[id] ? 'fair' : 'scam');
  const season = () => eco?.state?.season || 0;
  const emit = (id) => bus?.emit('journal:update', { id, entry: J.entries[id], summary: J.summary() });
  const touch = (id) => (J.entries[id] ||= { r: 'met', n: 0, s: 0 });

  /** The talk opened → the sticker exists. Never downgrades a result the player already earned. */
  J.meet = (id) => { if (!id) return null; const e = touch(id); e.n++; e.s = season(); emit(id); return e; };
  /** Conversation over. spotted = refused after looking (stars +1, once per deal id per run). */
  J.result = ({ id, fair, accepted, looked }) => {
    if (!id) return null; const e = touch(id); if (!e.n) { e.n = 1; e.s = season(); }
    const prev = e.r;
    if (fair) e.r = accepted ? 'took' : 'passed';
    else if (accepted) e.r = 'fell';
    else e.r = looked ? 'spotted' : 'refused';
    // one ★ per deal id: the first time it is spotted. A later 'fell' never takes the ★ back (you learned it once).
    if (e.r === 'spotted' && !e.star) { e.star = 1; J.stars++; bus?.emit('journal:spotted', { id, stars: J.stars }); }
    emit(id); return { entry: e, prev };
  };
  /** Ordered slots for the UI: scams first, then fair deals. */
  J.slots = () => allIds().map(({ id, kind }) => ({ id, kind, title: (kind === 'fair' ? eco?.fairs?.[id]?.title : eco?.scams?.[id]?.title) || id, tell: kind === 'fair' ? (eco?.fairs?.[id]?.terms || '') : (eco?.scams?.[id]?.tell || ''), entry: J.entries[id] || null }));
  J.summary = () => { const sl = J.slots(); let met = 0, spotted = 0, fell = 0, fair = 0; for (const s of sl) { const r = s.entry?.r; if (!r) continue; met++; if (r === 'spotted') spotted++; else if (r === 'fell') fell++; else if (r === 'took' || r === 'passed') fair++; } return { met, total: sl.length, spotted, fell, fair, stars: J.stars }; };
  J.serialize = () => { const e = {}; for (const [id, v] of Object.entries(J.entries)) e[id] = { r: v.r, n: v.n, s: v.s, ...(v.star ? { star: 1 } : {}) }; return { v: 1, e, stars: J.stars }; };
  /** Tolerant: missing / malformed → empty journal (old saves load). Unknown ids are kept (a later build may know them). */
  J.restore = (obj) => {
    J.entries = {}; J.stars = 0;
    if (!obj || typeof obj !== 'object' || Array.isArray(obj) || !obj.e || typeof obj.e !== 'object') return J;
    for (const [id, v] of Object.entries(obj.e)) { if (!v || typeof v !== 'object' || !RESULTS.includes(v.r)) continue; J.entries[id] = { r: v.r, n: Math.max(1, Math.floor(+v.n) || 1), s: Math.max(0, Math.floor(+v.s) || 0), ...(v.star ? { star: 1 } : {}) }; }
    J.stars = Object.values(J.entries).filter((e) => e.star).length;
    bus?.emit('journal:update', { id: null, entry: null, summary: J.summary() }); return J;
  };
  J.clear = () => { J.entries = {}; J.stars = 0; };
  if (bus) offs.push(
    bus.on('eco:scam', (o) => { if (o?.id) J.meet(o.id); }),
    bus.on('eco:fair', (o) => { if (o?.id) J.meet(o.id); }),
    bus.on('story:scamEnd', (p) => J.result(p || {})),
  );
  // a stranger that was never talked to (timeout / season end) leaves NO sticker: you cannot fill a slot by ignoring it
  J.destroy = () => { for (const f of offs) f?.(); offs.length = 0; };
  return J;
}
export default createScamJournal;
