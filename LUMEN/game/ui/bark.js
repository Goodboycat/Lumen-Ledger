// LUMEN LEDGER — Barks (Chat 41A). DOM speech bubbles projected from a 3D anchor. No Three import (duck-typed Vector3.project).
//   import { mountBarks } from './ui/bark.js';
//   const bk = mountBarks(root, { bus, max: 2, ttl: 3.2 });
//   bk.bind({ camera: () => game.camera.three, hero: () => sb.hero, owl: () => sb.owl, baron: () => sb.enemies?.baron, project?: (p) => ({x,y,behind}) });
//   per frame: bk.update(dt) · bk.destroy()
// Listens: `story:bark {speaker, text, anchor:'hero'|'owl'|'baron'|{x,y,z}, ttl}` (41A story.js, 41B hints).
// Rules (48B BARK DIET): max 1 WORD bubble on screen; a word bark < gapS (6 s) after the previous is DROPPED (never queued); anchor 'hero' is DROPPED;
// an unresolved anchor (owl before it exists, no baron, undefined) is DROPPED — no hero fallback, no bottom bubble. Glyph barks (kind want/price) keep
// their own pool of 2 and ignore the gap. Never pauses the game, pointer-events none, aria-live polite, clamps inside the viewport.
import { icon } from './icons.js';
// 44B: want bubble {kind:'want', icon:'stall_<kind>', ok} → stall kind → drawn icon (same names as ui/build.js ICONS via icons.js EMOJI map)
const WANT_ICON = { fruit: 'apple', bread: 'bread', lantern: 'lantern', fish: 'fish', flower: 'tulip', tool: 'hammer', cloth: 'thread', pottery: 'vase', toy: 'teddy', tea: 'tea', book: 'books', sparkExchange: 'spark' };
export const BARK_DEFAULTS = { max: 1, glyphMax: 2, gapS: 6, ttl: 3.2, lift: 2.1, fadeS: 0.22, pad: 8 };
const NAMES = { pip: 'Pip', owl: 'Owl', baron: 'Baron Gilt', collector: 'Collector', stranger: 'Stranger', cloud: 'Cloud' };

export function mountBarks(root, opts = {}) {
  const bus = opts.bus; if (!bus) throw new Error('mountBarks: opts.bus required');
  const cfg = { ...BARK_DEFAULTS, ...opts };
  const layer = document.createElement('div'); layer.className = 'll-barks'; layer.setAttribute('aria-live', 'polite'); root.appendChild(layer);
  const items = []; let deps = null, offs = []; let lastWordAt = -Infinity, clock = 0;   // 48B: word-bark gap clock (advanced by update(dt))
  const isGlyph = (k) => k === 'want' || k === 'price';
  const get = (k) => { const v = deps?.[k]; return typeof v === 'function' ? v() : v; };

  function anchorPos(a) {
    if (a && typeof a === 'object' && 'x' in a) return a;                                   // literal {x,y,z}
    if (a === 'hero') return null;                                                          // 48B: nothing over Pip's head, ever
    const ent = get(a); const p = ent?.root?.position || ent?.position || ent?.g?.position || null;
    return p;                                                                                // 48B: unresolved → null → dropped (no fallback)
  }
  function spawn(p) {
    if (!p || (!p.text && p.kind !== 'want')) return null;
    const anchor = p.anchor || 'hero';
    if (anchor === 'hero' || !anchorPos(anchor)) return null;                               // 48B: hero / unresolved anchor → dropped
    if (isGlyph(p.kind)) { const g = items.filter((it) => isGlyph(it.kind)); while (g.length >= cfg.glyphMax) remove(g.shift(), true); }
    else {
      if (!p.force && clock - lastWordAt < cfg.gapS) return null;                                        // 48B: too soon after the last word bark → dropped, not queued
      const w = items.filter((it) => !isGlyph(it.kind)); while (w.length >= cfg.max) remove(w.shift(), true);
      lastWordAt = clock;
    }
    if (p.kind === 'want') {   // 44B: icon-only bubble — the stall kind the customer came for; .ok green / .no red (nobody sells it)
      const el = document.createElement('div'); el.className = 'll-bark want ' + (p.ok ? 'ok' : 'no'); el.setAttribute('role', 'status'); el.setAttribute('aria-label', (p.ok ? 'wants ' : 'nobody sells ') + (p.text || ''));
      const kind = String(p.icon || p.text || '').replace(/^stall_/, ''); el.innerHTML = icon(WANT_ICON[kind] || 'think') + (p.ok ? '' : icon('cross', { cls: 'x' }));
      layer.appendChild(el);
      const it = { el, anchor, ttl: p.ttl || 1.2, t: 0, out: false, speaker: p.speaker, text: p.text, kind: 'want' };
      items.push(it); place(it); api.count++; return it;
    }
    const el = document.createElement('div'); el.className = 'll-bark ' + (p.speaker || 'owl') + (p.kind === 'price' ? (' price ' + (p.glyph === 'love' ? 'love' : p.glyph === 'bad' ? 'no' : p.ok ? 'ok' : 'no')) : ''); el.setAttribute('role', 'status');   // 43C: kind:'price' = critic price-check (no name) · 44A: glyph 'love'|'ok'|'bad' → .love (gold) / .ok / .no
    if (p.kind !== 'price') { const who = document.createElement('span'); who.className = 'who'; who.textContent = NAMES[p.speaker] || p.speaker || ''; el.appendChild(who); }
    el.appendChild(document.createTextNode(p.text));
    layer.appendChild(el);
    const it = { el, anchor, ttl: p.ttl || cfg.ttl, t: 0, out: false, speaker: p.speaker, text: p.text, kind: p.kind };
    items.push(it); place(it); api.count++; return it;
  }
  function remove(it, now = false) {
    const i = items.indexOf(it); if (i < 0) return; items.splice(i, 1);
    if (now) { it.el.remove(); return; }
    it.el.classList.add('out'); setTimeout(() => it.el.remove(), cfg.fadeS * 1000 + 30);
  }
  function place(it) {
    const W = root.clientWidth || window.innerWidth || 360, H = root.clientHeight || window.innerHeight || 640;
    const cam = get('camera'), p = anchorPos(it.anchor);
    let sx = W / 2, sy = H - 140, behind = false;
    if (p && cam && typeof p.clone === 'function' && typeof p.project === 'function') { const q = p.clone(); q.y += cfg.lift; q.project(cam); behind = q.z > 1; sx = (q.x + 1) / 2 * W; sy = (1 - q.y) / 2 * H; }
    else if (p && deps?.project) { const q = deps.project(p); sx = q.x; sy = q.y; behind = !!q.behind; }
    if (behind) { sx = W / 2; sy = H - 140; }
    const bw = it.el.offsetWidth || 160, bh = it.el.offsetHeight || 44, pad = cfg.pad;
    const cx = Math.max(pad + bw / 2, Math.min(W - pad - bw / 2, sx)); const cy = Math.max(pad + bh + 12, Math.min(H - pad, sy));
    it.el.classList.toggle('tail-left', sx < cx - 10); it.el.classList.toggle('tail-right', sx > cx + 10);
    it.el.style.transform = `translate(${cx.toFixed(0)}px, ${cy.toFixed(0)}px) translate(-50%, -100%)`;
  }

  const api = {
    el: layer, items, count: 0,
    bind(d) { deps = d || null; return api; },
    /** Programmatic bark (demo / 41B). Same payload as the bus event. */
    show(p) { return spawn(p); },
    clear() { for (const it of items.slice()) remove(it, true); return api; },
    update(dt) { clock += dt; for (const it of items.slice()) { it.t += dt; if (it.t >= it.ttl) { remove(it); continue; } place(it); } },
    destroy() { for (const off of offs) off(); offs = []; api.clear(); layer.remove(); },
  };
  offs.push(bus.on('story:bark', (p) => spawn(p)));
  offs.push(bus.on('game:title', () => api.clear()));
  return api;
}
export default mountBarks;
