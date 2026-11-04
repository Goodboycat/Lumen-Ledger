// LUMEN LEDGER — Collector wave banner + edge arrows (S41 / 15D). DOM only; projects through the Three camera when bound.
//
//   import { mountWave } from './ui/wave.js';
//   const wv = mountWave(root, { bus });            // banner on 'enemy:wave' (works headless / without a camera)
//   wv.bind({ camera: game.camera.three, enemies: () => lg.sb?.enemies, hero: () => lg.sb?.hero });   // arrows need these
//   wv.update(dt)  per frame (ui.update calls it)   · wv.destroy()
//
// Why: playtest — "Collectors landed" was a 6 s toast at the top; players read it late (or never) and did not know WHERE the
//   fog-men were, because they spawn at the pier, often off-screen. Now:
//   • BANNER: a big red ribbon slides across the screen for ~2.4 s ("⚠ 2 DEBT COLLECTORS LANDED" / "🎩 BARON GILT LANDS").
//   • EDGE ARROWS: while any enemy is in 'chase' state and OFF-SCREEN, a pulsing red chevron sits on the screen edge pointing at it
//     (distance in metres under it). On-screen enemies get no arrow (the red ring + sprite are enough). Arrows vanish when the wave
//     is beaten / walks home / the season ends. Hidden under modals (dialogue, pause, ledger) by index.js not calling update.

import { iconize, icon } from './icons.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const MAX_ARROWS = 6, EDGE = 26;   // px inset from the viewport edge (clear of the HUD bar / jars)

export function mountWave(root, opts = {}) {
  const bus = opts.bus; if (!bus) throw new Error('mountWave: opts.bus required');
  const layer = el('div', 'll-wave-layer'); layer.setAttribute('aria-hidden', 'true');
  const banner = el('div', 'll-wave-banner'); banner.setAttribute('role', 'status'); layer.append(banner);
  root.append(layer);
  const arrows = []; let deps = null, bannerT = 0, tracking = false, visible = true;
  const _v = { x: 0, y: 0, z: 0 };

  const api = {
    el: layer, banner, arrows, get tracking() { return tracking; },
    bind(d) { deps = d || null; return api; },
    // text banner (also used by tests)
    show(text, { kind = 'warn', duration = 2.4 } = {}) {
      banner.innerHTML = iconize(text); banner.className = 'll-wave-banner show ' + kind; bannerT = duration; return api;
    },
    hide() { banner.classList.remove('show'); bannerT = 0; return api; },
    setVisible(v) { visible = !!v; layer.style.display = visible ? '' : 'none'; return api; },
    update(dt) {
      if (bannerT > 0) { bannerT -= dt; if (bannerT <= 0) api.hide(); }
      if (!tracking || !deps) { if (arrows.some((a) => a.el.style.display !== 'none')) hideArrows(); return; }
      const sys = typeof deps.enemies === 'function' ? deps.enemies() : deps.enemies; const cam = typeof deps.camera === 'function' ? deps.camera() : deps.camera;
      const list = sys?.active || []; if (!list.length || !cam) { hideArrows(); if (!list.length && sys) tracking = false; return; }
      const hero = typeof deps.hero === 'function' ? deps.hero() : deps.hero; const hp = hero?.root?.position;
      const W = root.clientWidth || window.innerWidth, H = root.clientHeight || window.innerHeight, cx = W / 2, cy = H / 2;
      let used = 0;
      for (const e of list) {
        if (used >= MAX_ARROWS) break; const p = e.g?.position; if (!p) continue;
        // project through the camera (Three: Vector3.project(cam)); fall back to a hand-rolled projection for mocks
        let sx, sy, behind = false;
        if (typeof p.clone === 'function' && typeof p.project === 'function') { const q = p.clone(); q.y += 1.2; q.project(cam); behind = q.z > 1; sx = (q.x + 1) / 2 * W; sy = (1 - q.y) / 2 * H; }
        else if (deps.project) { const q = deps.project(p); sx = q.x; sy = q.y; behind = !!q.behind; }
        else continue;
        const on = !behind && sx > 0 && sx < W && sy > 0 && sy < H; if (on) continue;
        // direction from the screen centre; clamp to the edge rect
        let dx = sx - cx, dy = sy - cy; if (behind) { dx = -dx; dy = -dy; }
        const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
        const hw = cx - EDGE, hh = cy - EDGE; const t = Math.min(hw / Math.max(Math.abs(dx), 1e-6), hh / Math.max(Math.abs(dy), 1e-6));
        const ax = cx + dx * t, ay = cy + dy * t; const ang = Math.atan2(dy, dx) * 180 / Math.PI;
        const a = arrows[used] || (arrows[used] = mkArrow()); used++;
        a.el.style.display = ''; a.el.style.transform = `translate(${ax.toFixed(0)}px, ${ay.toFixed(0)}px) translate(-50%, -50%)`;
        a.chev.style.transform = `rotate(${ang.toFixed(0)}deg)`; a.el.classList.toggle('baron', e.kind === 'baron'); a.icon.innerHTML = icon(e.kind === 'baron' ? 'tophat' : 'fog');   // 48C: drawn icon
        if (hp) { const d = Math.hypot(p.x - hp.x, p.z - hp.z); a.dist.textContent = Math.round(d) + ' m'; } else a.dist.textContent = '';
      }
      for (let i = used; i < arrows.length; i++) arrows[i].el.style.display = 'none';
    },
    destroy() { for (const f of offs) f(); layer.remove(); },
  };
  function mkArrow() { const a = { el: el('div', 'll-wave-arrow'), chev: el('div', 'll-wave-chev', '➤'), icon: el('span', 'll-wave-ico', icon('fog')), dist: el('span', 'll-wave-dist', '') }; a.el.append(a.chev, a.icon, a.dist); layer.append(a.el); return a; }
  function hideArrows() { for (const a of arrows) a.el.style.display = 'none'; }

  const offs = [
    bus.on('enemy:wave', (p) => {
      if (!p) return; tracking = true;
      if (p.boss) api.show(`${icon('tophat')} BARON GILT LANDS AT THE PIER${p.count > 1 ? ` · +${p.count - 1} ${icon('fog')}` : ''}`, { kind: 'boss', duration: 2.8 });   // 48C: drawn icons
      else api.show(`${icon('warn')} ${p.count} DEBT COLLECTOR${p.count > 1 ? 'S' : ''} LANDED — follow the arrows`, { kind: 'warn', duration: 2.6 });
    }),
    bus.on('enemy:defeated', () => { const sys = deps && (typeof deps.enemies === 'function' ? deps.enemies() : deps.enemies); if (sys && !sys.active.length) { tracking = false; hideArrows(); api.show(`${icon('check')} Collectors beaten!`, { kind: 'good', duration: 1.6 }); } }),
    bus.on('eco:season', () => { tracking = false; hideArrows(); api.hide(); }),
    bus.on('eco:win', () => { tracking = false; hideArrows(); api.hide(); }),
    bus.on('eco:lose', () => { tracking = false; hideArrows(); api.hide(); }),
    bus.on('game:title', () => { tracking = false; hideArrows(); api.hide(); }),
  ];
  return api;
}
export default mountWave;
