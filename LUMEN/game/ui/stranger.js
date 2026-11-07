// LUMEN LEDGER — Stranger marker (T4, S57). DOM only; projects the stranger's position through the Three camera.
//
//   import { mountStranger } from './ui/stranger.js';
//   const st = mountStranger(root, { bus });
//   st.bind({ camera: game.camera.three, scam: () => lg.sb?.scamNpc, hero: () => lg.sb?.hero });
//   per frame: st.update(dt)   · st.destroy()
//
// Why (FUN_PASS T4.3): "scammers are nowhere found". A friendly stranger now walks in from the pier; this layer makes them FINDABLE:
//   • ON SCREEN  → a golden BELL (drawn icon) bobs above their head. Same bell for a scam and a fair deal: the marker never gives the kind away.
//   • OFF SCREEN → an edge arrow (bell + chevron + metres) on the screen border pointing at them, like the Collector arrows (ui/wave.js) but gold.
//   • Hidden while Pip is already talking (state 'offered') or the stranger is leaving, and under every modal (index.js does not call update).
// The bell + arrow take taps (S58: walk to the stranger); the layer itself never does (pointer-events none), no Three import (duck-typed Vector3.project), 0 meshes, 0 draw calls.
import { icon } from './icons.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
export const STRANGER_UI = { edge: 30, top: 64, bottom: 76, lift: 2.0, nearHide: 2.2 };   // px insets: sides · top (clear of the HUD pills) · bottom (clear of Build + ability chips) · world units above the ground · metres: bell hides when Pip is this close (the speech bubble + card take over)

export function mountStranger(root, opts = {}) {
  const bus = opts.bus; if (!bus) throw new Error('mountStranger: opts.bus required');
  const layer = el('div', 'll-stranger-layer'); layer.setAttribute('aria-hidden', 'true');
  const bell = el('div', 'll-stranger-bell', icon('bell')); bell.style.display = 'none';
  const arrow = el('div', 'll-stranger-arrow'); arrow.style.display = 'none';
  const chev = el('div', 'll-stranger-chev', icon('arrow')), face = el('span', 'll-stranger-face', icon('bell')), dist = el('span', 'll-stranger-dist', '');
  arrow.append(chev, face, dist); layer.append(bell, arrow); root.append(layer);
  // S58 (open item 2): the bell / arrow are BUTTONS — a beginner taps what blinks. Tap → deps.onTap() (Game.js: Pip walks to the stranger and the talk opens).
  for (const b of [bell, arrow]) { b.setAttribute('role', 'button'); b.setAttribute('aria-label', 'A stranger wants to talk — tap to walk there'); b.addEventListener('pointerdown', (e) => { e.stopPropagation?.(); }); b.addEventListener('click', (e) => { e.stopPropagation?.(); bus.emit('ui:stranger:tap', {}); deps?.onTap?.(); }); }
  let deps = null, visible = true, shown = null;   // shown: 'bell' | 'arrow' | null (last frame, for tests)
  const _p = { x: 0, y: 0, z: 0 };

  const get = (k) => { const v = deps?.[k]; return typeof v === 'function' ? v() : v; };
  const hide = () => { bell.style.display = 'none'; arrow.style.display = 'none'; shown = null; };

  const api = {
    el: layer, bell, arrow,
    get shown() { return shown; },
    bind(d) { deps = d || null; return api; },
    setVisible(v) { visible = !!v; layer.style.display = visible ? '' : 'none'; return api; },
    /** Where would the marker sit for this world point? → { on, x, y, ang, d } (pure; used by update() and by the headless gate). */
    place(p, hp, W, H, cam, project) {
      let sx, sy, behind = false;
      if (project) { const q = project(p); sx = q.x; sy = q.y; behind = !!q.behind; }
      else if (cam && typeof cam.matrixWorldInverse !== 'undefined') {
        // hand-rolled Vector3.project so no Three import / allocation is needed: clip = projectionMatrix · matrixWorldInverse · p
        const m = cam.matrixWorldInverse.elements, pr = cam.projectionMatrix.elements, x = p.x, y = p.y + STRANGER_UI.lift, z = p.z;
        const vx = m[0] * x + m[4] * y + m[8] * z + m[12], vy = m[1] * x + m[5] * y + m[9] * z + m[13], vz = m[2] * x + m[6] * y + m[10] * z + m[14];
        const cx = pr[0] * vx + pr[4] * vy + pr[8] * vz + pr[12], cy = pr[1] * vx + pr[5] * vy + pr[9] * vz + pr[13], cw = pr[3] * vx + pr[7] * vy + pr[11] * vz + pr[15];
        behind = cw <= 0; const iw = 1 / (Math.abs(cw) || 1e-6); sx = (cx * iw + 1) / 2 * W; sy = (1 - cy * iw) / 2 * H; if (behind) { sx = W - sx; sy = H - sy; }
      } else return null;
      const d = hp ? Math.hypot(p.x - hp.x, p.z - hp.z) : 0;
      const U = STRANGER_UI, on = !behind && sx > 8 && sx < W - 8 && sy > 8 && sy < H - 8;
      // on screen → the bell, nudged down so it never hides behind the HUD row (bell box = 36–44 px tall, anchored at its bottom edge)
      if (on) return { on: true, x: Math.min(W - 24, Math.max(24, sx)), y: Math.max(sy, U.top + 40), d };
      const cx = W / 2, cy = (U.top + (H - U.bottom)) / 2; let dx = sx - cx, dy = sy - (H / 2) + (H / 2 - cy); const len = Math.hypot(dx, dy) || 1; dx /= len; dy /= len;
      const hw = cx - U.edge, hh = (H - U.bottom - U.top) / 2, t = Math.min(hw / Math.max(Math.abs(dx), 1e-6), hh / Math.max(Math.abs(dy), 1e-6));
      return { on: false, x: cx + dx * t, y: cy + dy * t, ang: Math.atan2(dy, dx) * 180 / Math.PI, d };
    },
    update() {
      if (!visible) return;
      const S = get('scam'); const g = S?.g;
      // only while the stranger is out there waiting (arrive/pitch). Offered (in conversation) / leaving / flee → no marker.
      if (!S?.active || !g || !(S.state === 'arrive' || S.state === 'pitch')) { if (shown) hide(); return; }
      if (get('cardOpen')) { if (shown) hide(); return; }   // S58 (open item 1): never behind / under a card — the bell waits until the card is gone
      const hero = get('hero'), hp = hero?.root?.position || null, cam = get('camera'); const pos = g.position;
      const W = root.clientWidth || (typeof window !== 'undefined' ? window.innerWidth : 800), H = root.clientHeight || (typeof window !== 'undefined' ? window.innerHeight : 450);
      _p.x = pos.x; _p.y = pos.y; _p.z = pos.z;
      const r = api.place(_p, hp, W, H, cam, deps?.project); if (!r) { if (shown) hide(); return; }
      if (r.on) {
        if (r.d < STRANGER_UI.nearHide) { if (shown) hide(); return; }   // right next to them: the speech bubble + card already say it
        arrow.style.display = 'none'; bell.style.display = ''; shown = 'bell';
        bell.style.transform = `translate(${r.x.toFixed(0)}px, ${r.y.toFixed(0)}px) translate(-50%, -100%)`;
      } else {
        bell.style.display = 'none'; arrow.style.display = ''; shown = 'arrow';
        arrow.style.transform = `translate(${r.x.toFixed(0)}px, ${r.y.toFixed(0)}px) translate(-50%, -50%)`;
        chev.style.transform = `rotate(${r.ang.toFixed(0)}deg)`; dist.textContent = Math.round(r.d) + ' m';
      }
    },
    destroy() { layer.remove(); },
  };
  // a stranger appears → nothing to do (update() reads the live state); leaving / season end / title → hide at once so no marker lingers a frame
  const offs = [bus.on('scam:leave', hide), bus.on('eco:season', hide), bus.on('game:title', hide), bus.on('eco:win', hide), bus.on('eco:lose', hide)];
  const destroy = api.destroy; api.destroy = () => { for (const f of offs) f?.(); destroy(); };
  return api;
}
export default mountStranger;
