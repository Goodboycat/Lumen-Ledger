// heroFace.js (S82) — Pip's expressions. attachHeroFace(hero, bus, opts) → hero.face = { set(name, dur, prio, snap), name, rig, update(dt), destroy() }.
// Every expression is a partial param record merged over BASE and eased toward each frame (damp), so faces glide instead of popping.
// Params: ey/lx/ly eye offset · esx/esy eye scale · asy L/R eye height skew · espread eye spacing · happy (>0.5 = shut ^ eyes, ac = their bow)
//         bl/ba/bsx brow lift / tilt (+ = angry: inner ends down) / width · mw/mc mouth half-width / smile bow (− = frown) ·
//         op/ow/oh open mouth (op>0.3) + size · teeth (white row instead of tongue) · tg tongue poke · blush · sweat drop.
// Who wins: highest priority among { timed event (ouch 9, others 5), attack/move state (3), build hold (4), threat (2) } else neutral.
import { damp } from './Easing.js';
import { buildHeroFace } from '../assets/heroFace.js';

export const BASE = Object.freeze({ espread: 1, ey: 0, lx: 0, ly: 0, esx: 1, esy: 1, asy: 0, happy: 0, ac: -1.2, bl: 0, ba: 0, bsx: 1,
  mw: 0.11, mc: 0.55, op: 0, ow: 0.2, oh: 0.14, teeth: 0, tg: 0, blush: 0.55, sweat: 0 });
const E = (o) => Object.freeze({ ...BASE, ...o });
export const EXPRESSIONS = Object.freeze({
  neutral: BASE,
  happy: E({ happy: 1, ac: -0.85, mw: 0.16, mc: 1.0, bl: 0.03, blush: 0.9 }),
  cheer: E({ happy: 1, ac: -0.95, bl: 0.05, op: 1, ow: 0.3, oh: 0.14, blush: 0.95 }),
  angry: E({ esy: 0.6, esx: 1.05, ey: -0.02, ba: 0.62, bl: -0.05, bsx: 1.1, op: 1, ow: 0.3, oh: 0.085, teeth: 1, blush: 0 }),
  dash: E({ esy: 0.72, ba: 0.32, bl: -0.025, mw: 0.12, mc: -0.45, blush: 0.25 }),
  focus: E({ esy: 0.42, esx: 0.9, ly: -0.04, ba: 0.34, bl: -0.04, bsx: 1.05, mw: 0.07, mc: -0.1, tg: 1, blush: 0.5, espread: 0.94 }),
  strain: E({ esy: 0.5, ba: 0.4, bl: -0.03, op: 1, ow: 0.26, oh: 0.07, teeth: 1, blush: 0.2 }),
  ouch: E({ esy: 0.12, esx: 1.25, ba: -0.55, bl: 0.07, op: 1, ow: 0.27, oh: 0.15, sweat: 1, blush: 0 }),
  sad: E({ esy: 0.88, ly: -0.03, ey: -0.01, ba: -0.42, bl: 0.03, mw: 0.12, mc: -1.1, blush: 0.2 }),
  worried: E({ esy: 1.12, esx: 0.95, ba: -0.5, bl: 0.06, mw: 0.095, mc: -0.75, sweat: 1, blush: 0.15 }),
  surprised: E({ esy: 1.3, esx: 1.1, bl: 0.1, op: 1, ow: 0.15, oh: 0.15, blush: 0.4 }),
  proud: E({ esy: 0.72, ba: 0.14, mw: 0.16, mc: 1.4, blush: 0.8 }),
  dizzy: E({ esy: 1.1, esx: 1.1, asy: 0.25, ba: -0.2, op: 1, ow: 0.2, oh: 0.1, blush: 0.2 }),
});
export const EXPRESSION_NAMES = Object.keys(EXPRESSIONS);

// hero move name → expression while it plays (priority 3)
const MOVE_FACE = { hammer: 'focus', build: 'focus', celebrate: 'cheer', sad: 'sad', stunned: 'dizzy', pickUp: 'strain', carry: 'strain', dash: 'dash',
  coinMagnetDash: 'dash', growthStomp: 'angry', haggleShout: 'cheer', fogSweep: 'angry', ledgerFlash: 'focus', bubbleShield: 'proud', throwCoin: 'happy' };
const KEYS = Object.keys(BASE);

export function attachHeroFace(hero, bus, opts = {}) {
  const rig = hero.p.face; if (!rig || hero.face) return hero.face || null;
  const Q = { ...BASE }; let T = EXPRESSIONS.neutral, target = 'neutral';
  let t = 0, blinkIn = 2.5, blinkT = 0, threatT = 0, threat = false, attackUntil = 0, buildHold = false, buildHoldSince = -9;
  let ev = null;   // { name, until, prio }
  const F = { name: 'neutral', rig, Q, hold: null };

  /** set(name, dur = 1, prio = 5, snap = false) → timed expression (ouch uses prio 9). Same / higher priority replaces the current one. */
  F.set = (name, dur = 1, prio = 5, snap = false) => {
    if (!EXPRESSIONS[name]) return false;
    if (ev && t < ev.until && prio < ev.prio) return false;
    ev = { name, until: t + dur, prio };
    if (snap) { Object.assign(Q, EXPRESSIONS[name]); target = name; T = EXPRESSIONS[name]; F.name = name; rig.apply(Q, t); }
    return true;
  };
  F.clear = () => { ev = null; };

  const pick = () => {
    let best = null, bp = -1; const take = (n, p) => { if (p > bp) { best = n; bp = p; } };
    if (ev && t < ev.until) take(ev.name, ev.prio);
    if (hero.state === 'attack' || t < attackUntil) take('angry', 3);
    else if (hero.state === 'move' && hero.moveName && MOVE_FACE[hero.moveName]) take(MOVE_FACE[hero.moveName], 3);
    if (buildHold) take('focus', 4);
    if (threat) take('worried', 2);
    return best || 'neutral';
  };

  F.update = (dt) => {
    t += dt;
    if (hero.state === 'attack') attackUntil = t + 0.45;   // keep the scowl for a beat after the swing (readable at 30 fps and below)
    if (buildHold && t - buildHoldSince > 25) buildHold = false;   // safety: never stuck on 'focus'
    if (opts.threat) { threatT -= dt; if (threatT <= 0) { threatT = 0.25; threat = !!opts.threat(); } }
    const n = pick();
    if (n !== target) { target = n; T = EXPRESSIONS[n]; F.name = n; }
    const k = n === 'ouch' ? 40 : 20;
    for (const key of KEYS) Q[key] = damp(Q[key], T[key], k, dt);
    // blink (not for shut eyes / ouch)
    let esy = Q.esy;
    blinkIn -= dt;
    if (blinkIn <= 0) { blinkT = 0.13; blinkIn = 2.2 + ((t * 7.31) % 1) * 3.2; }
    if (blinkT > 0) { blinkT -= dt; esy *= 0.12; }
    // dizzy eyes circle
    const dz = n === 'dizzy' ? 1 : 0, lx0 = Q.lx, ly0 = Q.ly, es0 = Q.esy;
    Q.lx = lx0 + dz * Math.sin(t * 9) * 0.045; Q.ly = ly0 + dz * Math.cos(t * 9) * 0.035; Q.esy = esy;
    rig.apply(Q, t);
    Q.lx = lx0; Q.ly = ly0; Q.esy = es0;
  };

  // ---- event wiring (all optional: no bus → manual set() only) --------------------------------------------------------------------
  const offs = [];
  if (bus) {
    const on = (n, f) => offs.push(bus.on(n, f));
    on('enemy:heroHit', () => F.set('ouch', 0.8, 9));
    on('storm:hit', () => F.set('ouch', 0.6, 9));
    on('storm:warn', () => F.set('worried', 2.5, 5));
    on('enemy:baronWarn', () => F.set('worried', 2.5, 5));
    on('enemy:wave', () => F.set('surprised', 0.7, 5));
    on('enemy:blocked', () => F.set('proud', 0.9, 5));
    on('enemy:defeated', () => F.set('cheer', 1.2, 5));
    on('jars:spill', () => F.set('surprised', 0.9, 6));
    on('jars:deposit', () => F.set('happy', 0.9, 5));
    on('till:collect', () => F.set('happy', 0.9, 5));
    on('eco:sale', () => F.set('happy', 0.6, 4));
    on('build:enter', () => { buildHold = true; buildHoldSince = t; });
    on('build:exit', () => { buildHold = false; });
    on('build:placed', (p) => { if (p?.silent) return; buildHold = false; F.set('focus', 0.5, 6); ev && (ev.next = 'cheer'); });
    on('build:upgraded', () => { F.set('focus', 0.5, 6); ev && (ev.next = 'cheer'); });
    on('build:removed', () => F.set('proud', 0.8, 5));
    on('build:denied', () => F.set('sad', 0.9, 5));
    on('sandbox:denied', () => F.set('sad', 0.8, 4));
    on('eco:win', () => F.set('cheer', 6, 8));
    on('eco:lose', () => F.set('sad', 6, 8));
    on('eco:loan', (p) => { if (p?.kind === 'forced') F.set('worried', 1.5, 5); });
  }
  // chain: a finished 'focus' flash flows into 'cheer' (placing a stall: concentrate → DONE!)
  const baseUpdate = F.update;
  F.update = (dt) => { const e = ev; baseUpdate(dt); if (e && e === ev && t >= e.until && e.next) { const nx = e.next; ev = null; F.set(nx, 0.9, 5); } };

  F.destroy = () => { for (const f of offs) f(); offs.length = 0; if (hero.face === F) hero.face = null; };
  hero.face = F;
  // tick with the hero (hero.update is already wrapped by attachMoves/attachAbilities → this is the outermost wrap)
  const prev = hero.update;
  hero.update = (dt) => { prev(dt); F.update(dt); };
  return F;
}
