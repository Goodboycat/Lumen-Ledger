// heroAbilities.js — Chat 3B: Hero abilities set 2 (the six FinLit "powers", Mario/Smash-style, GAME_BIBLE §2):
//   coinMagnetDash (collect income fast)        bubbleShield (Emergency Fund absorbs one bad event)
//   growthStomp (compound-growth pulse)         ledgerFlash (reveal the true cost of a scam)
//   haggleShout (megaphone + sound rings)       fogSweep (push the Debt Fog back)
// Contract (API_CONTRACTS §B "Hero anims"): every ability is registered into heroAnims.HERO_MOVES via registerMoves(), so the
// 3A API works unchanged: makeMove(name, ctx) → Sequence, hero.playMove(name, opts), hero.stopMove(), hero.state === 'move'.
//   import { attachMoves } from './heroAnims.js'; import { attachAbilities } from './heroAbilities.js';
//   attachMoves(hero); attachAbilities(hero);      // either order — attachAbilities calls attachMoves itself if needed
//   hero.playMove('coinMagnetDash', { coins: [obj…], onCollect(coin, pos) })      hero.playMove('bubbleShield', { event: 'Storm', onAbsorb(evt) })
//   hero.playMove('growthStomp', { onPulse(i, radius, pct) })                     hero.playMove('ledgerFlash', { cost: 100, trueCost: 340, text?, onReveal(cost, trueCost) })
//   hero.playMove('haggleShout', { targets: [obj…], text: '−20%!', onShout(target, i) })   hero.playMove('fogSweep', { fog?: { push(origin, dir, strength) }, onSweep(origin, dir, radius) })
// Extra ability props live in hero.props.{magnetCoins, bubble, rings, ledger, megaphone, arc}; ALL hidden at rest → 0 draw calls.
// makeMove(name, { hero }) also works WITHOUT attachAbilities (props are lazily created on first use via ensureAbilityProps).
// VFX pack hooks (9A/9B) are optional and no-op when absent: vfx.sparkTrail?.emit, vfx.coinBurst?.burst, vfx.savingSparkle?.burst,
// vfx.levelRing?.show, vfx.coinRain?.burst, vfx.screenFlash?.flash (falls back to vfx.flash.flash), vfx.fogShader?.push, vfx.debtPulse?.pulse.
//
// Animation discipline (GAME_BIBLE §4): named phases with explicit ms + easing (tables below), poses set ABSOLUTELY by lerping from a pose
// snapshotted in onEnter → frame-rate independent. Anticipation slow → action instant → settle with overshoot (outBack).
import * as THREE from '../../vendor/three.module.js';
import { Sequence } from './Sequencer.js';
import { Easing, lerp } from './Easing.js';
import { G, mesh } from '../assets/geo.js';
import { PALETTE as P, toonMat, flatMat } from '../core/Toon.js';
import { addOutline } from '../core/Outline.js';
import { HERO_MOVES, registerMoves, attachMoves, REST, POSE, snapPose, lerpPose, facingDir, lungeReach } from './heroAnims.js';

const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _c = V(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = V(), _e = new THREE.Euler();
const TAU = Math.PI * 2;
/** Frame dt for phase fns (set by seq.moveUpdate via attachMoves' update wrapper; 1/60 when driven standalone through makeMove). */
const dtOf = (M) => (M.dtLast > 0 && M.dtLast < 0.25 ? M.dtLast : 1 / 60);

// ───────────────────────────── shared helpers (same shape as 3A's private ones) ─────────────────────────────
function targetPos(t) { return !t ? null : t.isVector3 ? t : t.position || (t.root && t.root.position) || null; }
function faceTo(hero, pos) { if (!pos) return; const yaw = Math.atan2(pos.x - hero.root.position.x, pos.z - hero.root.position.z); hero.facing = yaw; hero.root.rotation.y = yaw; }
function landDist(hero, dir, dist) {
  const isLand = hero.deps && hero.deps.isLand; if (!isLand) return dist;
  let ok = 0; for (let d = 0.25; d <= dist + 1e-6; d += 0.25) { _a.copy(hero.root.position).addScaledVector(dir, d); if (!isLand(_a.x, _a.z)) break; ok = d; }
  return ok;
}
/** Two-pose phase: lerps from the pose snapshotted at phase start to `to`; `fn` layers extra motion on top. */
function tw(seq, name, ms, ease, to, o = {}) {
  return seq.phase(name, ms, ease, (e, M, t, ph) => { lerpPose(M.hero, ph.state.from, to, e, M.jelly); if (o.fn) o.fn(e, M, t, ph); },
    { onEnter: (M, ph) => { ph.state.from = snapPose(M.hero); if (o.onEnter) o.onEnter(M, ph); }, onExit: o.onExit, cancellable: !!o.cancellable });
}
const vfxOf = (M) => M.vfx || (M.hero.deps && M.hero.deps.vfx) || null;
const dust = (M, pos, n, o) => { const v = vfxOf(M); if (v && v.dust) v.dust.burst(pos, n, o); };
const dustRing = (M, pos, n, size) => { const v = vfxOf(M); if (v && v.dust) { if (v.dust.ring) v.dust.ring(pos, n, size); else v.dust.burst(pos, n); } };
const sparks = (M, pos, n, sp) => { const v = vfxOf(M); if (v && v.sparks) v.sparks.burst(pos, n, sp); };
const pop = (M, pos, text, o) => { const v = vfxOf(M); if (v && v.pop) v.pop.show(pos, text, o); };
const flash = (M, css, ms, a) => { const v = vfxOf(M); if (!v) return; if (v.screenFlash && v.screenFlash.flash) v.screenFlash.flash(css, ms, a); else if (v.flash) v.flash.flash(css, ms, a); };
const shake = (M, a) => { const g = M.game || M.hero.game; if (g && g.camera && g.camera.shake) g.camera.shake(a); };
const hitstop = (M, ms) => { const g = M.game || M.hero.game; if (g && g.hitstop) g.hitstop(ms); };
/** Optional 9A/9B hook: hook(M, 'coinBurst', 'burst', args…) → true if it existed. */
const hook = (M, pool, fn, ...args) => { const v = vfxOf(M); const p = v && v[pool]; if (p && typeof p[fn] === 'function') { p[fn](...args); return true; } return false; };
const world = (hero) => (hero.props && hero.props.coin && hero.props.coin.parent) || (hero.game && hero.game.scene) || hero.root.parent || hero.root;

// ───────────────────────────── ability props (hidden at rest → 0 draw calls) ─────────────────────────────
export const MAGNET_COINS = 8;
/** 8 Spark coins orbiting Pip during coinMagnetDash. ONE InstancedMesh = 1 draw call, no outline. */
export function makeMagnetCoins() {
  const im = new THREE.InstancedMesh(G.cyl(0.14, 0.14, 0.04, 10), flatMat(P.sparkGold), MAGNET_COINS);
  im.name = 'magnetCoins'; im.instanceMatrix.setUsage(THREE.DynamicDrawUsage); im.frustumCulled = false;
  im.userData.noOutline = true; im.castShadow = false; im.receiveShadow = false; im.visible = false; return im;
}
/** Emergency-Fund bubble: translucent toon sphere + flat equator ring. 2 meshes, no outline. Pivot = Pip's chest. */
export function makeBubble() {
  const g = new THREE.Group(); g.name = 'bubble'; g.visible = false;
  const s = new THREE.Mesh(G.sphere(1.05, 14, 10), toonMat(P.glimmerBlue, { transparent: true, opacity: 0.32 }));
  s.userData.noOutline = true; s.castShadow = false; s.receiveShadow = false; g.add(s);
  const rim = new THREE.Mesh(G.torus(1.05, 0.03, 5, 20), flatMat(P.white, { transparent: true, opacity: 0.6, additive: true }));
  rim.rotation.x = Math.PI / 2; rim.position.y = 0.05; rim.userData.noOutline = true; rim.castShadow = false; rim.receiveShadow = false; rim.name = 'rim'; g.add(rim);
  g.position.y = 0.95; return g;
}
/** 3 flat additive rings (growthStomp ground pulses / haggleShout sound rings). 3 meshes, own materials (independent fade), no outline. */
export function makeRings() {
  const g = new THREE.Group(); g.name = 'rings'; g.visible = false;
  for (let i = 0; i < 3; i++) {
    const r = new THREE.Mesh(G.torus(1, 0.07, 5, 24), flatMat(P.sparkGold, { transparent: true, opacity: 0.9, additive: true, depthWrite: false }));
    r.userData.noOutline = true; r.castShadow = false; r.receiveShadow = false; r.visible = false; g.add(r);
  }
  return g;
}
/** Ledger card held up in the left hand (ledgerFlash). Paper + gold band + ink line. 3 meshes + 3 outline. Pivot = grip (bottom centre). */
export function makeLedger() {
  const g = new THREE.Group(); g.name = 'ledger'; g.visible = false;
  g.add(mesh(G.rbox(0.38, 0.48, 0.035, 0.03), P.white, 0, 0.24, 0));
  g.add(mesh(G.box(0.3, 0.07, 0.04), P.sparkGold, 0, 0.4, 0));
  g.add(mesh(G.box(0.26, 0.04, 0.04), P.black, 0, 0.2, 0));
  addOutline(g); return g;
}
/** Megaphone (haggleShout). Attaches to parts.weaponSlot like the hammer: grip at origin, mouth along +Y. 2 meshes + 2 outline. */
export function makeMegaphone() {
  const g = new THREE.Group(); g.name = 'megaphone'; g.visible = false;
  g.add(mesh(G.cyl(0.2, 0.06, 0.44, 10), P.red, 0, 0.3, 0));
  g.add(mesh(G.cyl(0.08, 0.08, 0.14, 8), P.black, 0, 0.04, 0));
  addOutline(g); return g;
}
/** Fog-sweep arc: wide additive partial torus (200°), lies flat at y 0.6, bulges toward local +Z = Pip's facing. 1 mesh, no outline.
 *  Orientation is BAKED into the geometry (arc centre → +Y → rotateX(+90°) → +Z) so the mesh only ever needs rotation.y = facing. */
export function makeArc() {
  const geo = new THREE.TorusGeometry(1.7, 0.14, 6, 18, Math.PI * 1.1);
  geo.rotateZ(Math.PI / 2 - Math.PI * 0.55);   // arc spans angles 0..1.1π (centre 0.55π) → recentre on +Y
  geo.rotateX(Math.PI / 2);                     // +Y → +Z: the bulge points forward, lying flat in XZ
  const m = new THREE.Mesh(geo, flatMat(P.sparkGold, { transparent: true, opacity: 0.85, additive: true, depthWrite: false }));
  m.name = 'arc'; m.position.y = 0.6; m.userData.noOutline = true; m.castShadow = false; m.receiveShadow = false; m.visible = false; return m;
}

// ───────────────────────────── ABILITIES ─────────────────────────────
export const ABILITIES = {};   // name → def (same shape as HERO_MOVES entries) — merged into HERO_MOVES below
/** Extra ctx keys hero.playMove(name, opts) copies for abilities (3A copies only target/onHit/onArrive/item/dir/dashDist/count). */
export const ABILITY_CTX_KEYS = ['coins', 'onCollect', 'radius', 'event', 'onAbsorb', 'onPulse', 'text', 'cost', 'trueCost', 'onReveal', 'targets', 'onShout', 'fog', 'onSweep', 'strength'];
export const FINLIT = {
  coinMagnetDash: { key: 'Q', title: 'Coin-Magnet Dash', lesson: 'Collect your income promptly — money you have not collected cannot work for you.' },
  bubbleShield:   { key: 'W', title: 'Bubble Shield',    lesson: 'Emergency Fund: 3 months of costs in the Protect jar absorbs one bad event without debt.' },
  growthStomp:    { key: 'E', title: 'Growth Stomp',     lesson: 'Compound growth: each ring is bigger than the last — interest earns interest.' },
  ledgerFlash:    { key: 'R', title: 'Ledger Flash',     lesson: 'Too-Good Deals hide fees and interest. Always add up the TRUE cost before you say yes.' },
  haggleShout:    { key: 'F', title: 'Haggle Shout',     lesson: 'Prices are not fixed — ask, compare, negotiate. A fair deal has two happy sides.' },
  fogSweep:       { key: 'G', title: 'Fog Sweep',        lesson: 'Debt Fog shrinks when you pay down the highest-interest loan first.' },
};

// ---------- coinMagnetDash (P1) ---------- collect income fast: coins in a 2.2 u radius along the path are pulled in
// | phase  | ms  | ease     | what                                                                                                   |
// | charge | 140 | outCubic | squash 0.82 wide, lean back, arms spread wide (magnet pose), 8 orbit coins appear r 1.3, dust ×4 behind |
// | dash   | 260 | outCubic | travel 4 u (clipped to land) stretch 1.35/0.85, coins spiral r 1.3→0.25 & climb, dust trail / 40 ms,   |
// |        |     |          | world coins (ctx.coins) within ctx.radius‖2.2 → onCollect(coin, pos) + sparks; vfx.sparkTrail?.emit   |
// | gather | 160 | outBack  | coins snap into the chest (scale→0), sparks ×10, pop "+N" (or "ZIP!"), vfx.coinBurst?.burst            |
// | settle | 180 | outBack  | rest with overshoot, spring kick, dust ring                                                            |
const MAG_CHARGE = POSE({ bs: [1.14, 0.82, 1.14], brx: -0.22, torso: [-0.25, 0, 0], head: [-0.2, 0, 0], armL: [-0.3, 0, 1.5], armR: [-0.3, 0, -1.5], legL: 0.35, legR: -0.35, sword: [0.6, 0, 0], scarf: 0.1 });
const MAG_DASH = POSE({ bs: [0.85, 0.85, 1.35], brx: 0.32, torso: [0.3, 0, 0], head: [-0.15, 0, 0], armL: [-0.9, 0, 1.6], armR: [-0.9, 0, -1.6], legL: 0.9, legR: 0.9, sword: [0.8, 0, 0], scarf: -1.4 });
const MAG_GATHER = POSE({ bs: [1.06, 0.96, 1.06], torso: [0.1, 0, 0], head: [0.1, 0, 0], armL: [-1.1, 0, 0.35], armR: [-1.1, 0, -0.35], legL: 0.15, legR: -0.15, sword: [0.5, 0, 0], scarf: -0.5 });
function setMagnetCoins(hero, r, y, spin, scale) {
  const im = hero.props.magnetCoins; const c = hero.root.position;
  for (let i = 0; i < MAGNET_COINS; i++) {
    const a = spin + (i / MAGNET_COINS) * TAU; const yy = y + Math.sin(a * 2) * 0.12 * r;
    _a.set(c.x + Math.cos(a) * r, yy, c.z + Math.sin(a) * r); _q.setFromEuler(_e.set(Math.PI / 2 + Math.sin(a) * 0.4, a * 1.5, 0)); _s.setScalar(Math.max(0.001, scale));
    _m.compose(_a, _q, _s); im.setMatrixAt(i, _m);
  }
  im.instanceMatrix.needsUpdate = true;
}
function magnetCollect(M) {
  const hero = M.hero, coins = M.coins; if (!coins || !coins.length) return;
  const R = M.radius || 2.2; M.taken = M.taken || new Set();
  for (let i = 0; i < coins.length; i++) {
    const c = coins[i]; if (M.taken.has(c)) continue; const p = targetPos(c); if (!p) continue;
    if (Math.hypot(p.x - hero.root.position.x, p.z - hero.root.position.z) <= R) {
      M.taken.add(c); M.collected++; sparks(M, _b.copy(p).setY(Math.max(0.3, p.y)), 4, 3);
      if (M.onCollect) M.onCollect(c, p.clone ? p.clone() : p);
    }
  }
}
function buildCoinMagnetDash(M) {
  const seq = new Sequence('coinMagnetDash');
  tw(seq, 'charge', 140, Easing.outCubic, MAG_CHARGE, { onEnter: (M) => {
    const hero = M.hero, inp = hero.game && hero.game.input; ensureAbilityProps(hero); hero.setTool('none');
    if (M.dir) hero.facing = Math.atan2(M.dir.x, M.dir.z);
    else if (inp && inp.move && inp.move.lengthSq() > 0.05) hero.facing = Math.atan2(inp.move.x, -inp.move.y);
    hero.root.rotation.y = hero.facing; facingDir(hero, M.dir0); M.start.copy(hero.root.position);
    M.dist = landDist(hero, M.dir0, M.dashDist || 4); M.dir = null; M.collected = 0; M.taken = null; M.spin = 0;
    hero.props.magnetCoins.visible = true; setMagnetCoins(hero, 1.3, 0.9, 0, 0.001);
    dust(M, hero.root.position, 4, { size: 0.2, speed: 1.4, dur: 0.4, dir: M.dir0 });
  }, fn: (e, M) => { setMagnetCoins(M.hero, 1.3, 0.9, M.spin, e); } });
  tw(seq, 'dash', 260, Easing.outCubic, MAG_DASH, { onEnter: (M, ph) => { ph.state.lastPuff = -1; }, fn: (e, M, t, ph) => {
    const hero = M.hero; hero.root.position.copy(M.start).addScaledVector(M.dir0, M.dist * e);
    M.spin += dtOf(M) * 11; setMagnetCoins(hero, lerp(1.3, 0.25, e), lerp(0.9, 1.0, e), M.spin, 1);
    magnetCollect(M);
    if (t - ph.state.lastPuff >= 0.15) { ph.state.lastPuff = t; dust(M, hero.root.position, 2, { size: 0.16, speed: 0.6, dur: 0.35, dir: M.dir0, up: 0.5 }); hook(M, 'sparkTrail', 'emit', hero.root.position, 3); }
  } });
  tw(seq, 'gather', 160, Easing.outBack, MAG_GATHER, { onEnter: (M) => {
    const hero = M.hero; _b.copy(hero.root.position).setY(1.0); sparks(M, _b, 10, 4);
    pop(M, hero.root.position, M.collected > 0 ? `+${M.collected}` : 'ZIP!', { color: '#FFD54F', dur: 0.8, size: 1.1 });
    hook(M, 'coinBurst', 'burst', _b, 8); hero.spring.kick(-0.6);
  }, fn: (e, M) => { M.spin += dtOf(M) * 16; setMagnetCoins(M.hero, lerp(0.25, 0.05, e), 1.0, M.spin, Math.max(0.001, 1 - e)); },
     onExit: (M) => { M.hero.props.magnetCoins.visible = false; } });
  tw(seq, 'settle', 180, Easing.outBack, REST, { cancellable: true, onEnter: (M) => { M.jellyOn = true; M.hero.spring.kick(-0.9); dustRing(M, M.hero.root.position, 6, 0.18); } });
  seq.moveUpdate = (dt, M) => { M.dtLast = dt; };
  return seq;
}
ABILITIES.coinMagnetDash = { build: buildCoinMagnetDash, phases: [['charge', 140, 'outCubic'], ['dash', 260, 'outCubic · 4 u + coin spiral'], ['gather', 160, 'outBack · sparks + "+N"'], ['settle', 180, 'outBack']] };

// ---------- bubbleShield (P1) ---------- Emergency Fund: a translucent bubble absorbs ONE bad event (ctx.event), then pops
// | phase   | ms  | ease     | what                                                                                             |
// | brace   | 160 | outCubic | squash 0.88, arms crossed over chest, head down (anticipation)                                   |
// | inflate | 220 | outBack  | arms fling out, bubble scale 0→1 with overshoot, sparks ×10, vfx.savingSparkle?.burst, "SAFE!"   |
// | hold    | 460 | linear   | bubble shimmers (scale ±0.03, rim spins), Pip hovers +0.06, arms out                              |
// | absorb  | 120 | outCubic | the bad event hits: bubble 1.0→1.22 flash, hit-stop 40, shake 0.14, onAbsorb(event)              |
// | burst   | 140 | outCubic | bubble 1.22→0, sparks ring ×12, dust ring, pop "ABSORBED!" (or event name)                      |
// | settle  | 200 | outBack  | rest                                                                                              |
const BUB_BRACE = POSE({ bs: [1.08, 0.88, 1.08], torso: [0.3, 0, 0], head: [0.4, 0, 0], armL: [-1.3, 0, -0.5], armR: [-1.3, 0, 0.5], legL: 0.15, legR: -0.15, sword: [0.6, 0, 0], scarf: -0.5 });
const BUB_OUT = POSE({ bs: [0.96, 1.06, 0.96], torso: [-0.12, 0, 0], head: [-0.2, 0, 0], armL: [-0.4, 0, 1.45], armR: [-0.4, 0, -1.45], legL: -0.1, legR: 0.1, sword: [0.4, 0, 0], scarf: 0.1 });
const BUB_HIT = POSE({ bs: [1.1, 0.9, 1.1], torso: [0.1, 0, 0], head: [0.15, 0, 0], armL: [-0.5, 0, 1.3], armR: [-0.5, 0, -1.3], legL: 0.2, legR: -0.2, sword: [0.5, 0, 0], scarf: -0.6 });
function setBubble(hero, s, spin) { const b = hero.props.bubble; b.scale.setScalar(Math.max(0.001, s)); b.rotation.y = spin; const rim = b.children[1]; if (rim) rim.rotation.z = spin * 1.7; }
function buildBubbleShield(M) {
  const seq = new Sequence('bubbleShield');
  tw(seq, 'brace', 160, Easing.outCubic, BUB_BRACE, { onEnter: (M) => { ensureAbilityProps(M.hero); M.hero.setTool('none'); M.spin = 0; setBubble(M.hero, 0.001, 0); } });
  tw(seq, 'inflate', 220, Easing.outBack, BUB_OUT, { onEnter: (M) => {
    const hero = M.hero; hero.props.bubble.visible = true; _b.copy(hero.root.position).setY(1.0); sparks(M, _b, 10, 3);
    if (!hook(M, 'savingSparkle', 'burst', _b, 12)) dust(M, hero.root.position, 4, { size: 0.14, speed: 1.0, dur: 0.4, up: 1.2 });
    pop(M, hero.root.position, 'SAFE!', { color: '#4FC3F7', dur: 0.8, size: 1.0 }); hero.spring.kick(-0.5);
  }, fn: (e, M) => { M.spin += dtOf(M) * 1.5; setBubble(M.hero, e, M.spin); } });
  tw(seq, 'hold', 460, Easing.linear, BUB_OUT, { fn: (e, M, t) => { M.spin += dtOf(M) * 1.5; setBubble(M.hero, 1 + Math.sin(t * TAU * 2) * 0.03, M.spin); M.hero.root.position.y = 0.06 * Math.sin(Math.PI * t); },
    onExit: (M) => { M.hero.root.position.y = 0; } });
  tw(seq, 'absorb', 120, Easing.outCubic, BUB_HIT, { onEnter: (M) => {
    hitstop(M, 40); shake(M, 0.14); M.hero.spring.kick(-0.8); const name = typeof M.event === 'string' ? M.event : (M.event && M.event.name) || null;
    _b.copy(M.hero.root.position).setY(1.6); sparks(M, _b, 6, 5); if (name) pop(M, _b, name, { color: '#7B5EA7', dur: 0.7, size: 0.9 });
    hook(M, 'debtPulse', 'pulse', M.hero.root.position, 0.5); if (M.onAbsorb) M.onAbsorb(M.event);
  }, fn: (e, M) => { M.spin += dtOf(M) * 4; setBubble(M.hero, lerp(1.0, 1.22, e), M.spin); } });
  tw(seq, 'burst', 140, Easing.outCubic, BUB_OUT, { onEnter: (M) => {
    const hero = M.hero; _b.copy(hero.root.position).setY(1.0); sparks(M, _b, 12, 4); dustRing(M, hero.root.position, 8, 0.2);
    pop(M, hero.root.position, 'ABSORBED!', { color: '#4FC3F7', dur: 0.9, size: 1.1 });
  }, fn: (e, M) => { setBubble(M.hero, lerp(1.22, 0.001, e), M.spin); }, onExit: (M) => { M.hero.props.bubble.visible = false; setBubble(M.hero, 1, 0); } });
  tw(seq, 'settle', 200, Easing.outBack, REST, { cancellable: true, onEnter: (M) => { M.jellyOn = true; M.hero.spring.kick(-0.6); } });
  seq.moveUpdate = (dt, M) => { M.dtLast = dt; };
  return seq;
}
ABILITIES.bubbleShield = { build: buildBubbleShield, phases: [['brace', 160, 'outCubic'], ['inflate', 220, 'outBack · bubble 0→1'], ['hold', 460, 'linear · shimmer'], ['absorb', 120, 'outCubic + hit-stop 40'], ['burst', 140, 'outCubic · pop'], ['settle', 200, 'outBack']] };

// ---------- growthStomp (P1) ---------- compound-growth pulse: jump + landing, then 3 ground rings each bigger than the last
// | phase  | ms  | ease       | what                                                                                           |
// | crouch | 140 | outCubic   | squash 0.8, arms back, knees bent                                                               |
// | leap   | 220 | outCubic   | rise to h 1.4, stretch 1.18, arms up, legs tuck                                                 |
// | hang   |  60 | linear     | apex hang, body curls (anticipation of the slam)                                                |
// | slam   | 110 | inQuart    | fall to ground, arms down, stretch → squash                                                     |
// | impact |  50 | linear     | HIT-STOP 50, squash 0.72, dust ×10, shake 0.22, vfx.levelRing?.show, ring 1 starts             |
// | pulse  | 480 | outCubic   | rings 1/2/3 start at 0/140/280 ms, radii 1.4/2.1/3.1 (×1.5 compounding), fade; pops +5%/+10%/+16% · onPulse(i, r, pct) |
// | settle | 220 | outBack    | rest                                                                                            |
const GS_CROUCH = POSE({ bs: [1.14, 0.8, 1.14], torso: [0.3, 0, 0], head: [-0.1, 0, 0], armL: [1.0, 0, 0.5], armR: [1.0, 0, -0.5], legL: 0.4, legR: 0.4, sword: [0.6, 0, 0], scarf: -0.6 });
const GS_AIR = POSE({ bs: [0.9, 1.18, 0.9], torso: [-0.15, 0, 0], head: [-0.3, 0, 0], armL: [-2.7, 0, 0.6], armR: [-2.7, 0, -0.6], legL: -0.8, legR: -0.6, sword: [-0.3, 0, 0], scarf: 0.6 });
const GS_HANG = POSE({ bs: [1.0, 1.0, 1.0], torso: [0.35, 0, 0], head: [0.3, 0, 0], armL: [-2.2, 0, 0.8], armR: [-2.2, 0, -0.8], legL: -1.2, legR: -1.2, sword: [-0.2, 0, 0], scarf: 0.3 });
const GS_SLAM = POSE({ bs: [0.95, 1.1, 0.95], torso: [0.4, 0, 0], head: [0.3, 0, 0], armL: [0.4, 0, 0.8], armR: [0.4, 0, -0.8], legL: 0.1, legR: 0.1, sword: [0.6, 0, 0], scarf: 0.8 });
const GS_IMPACT = POSE({ bs: [1.28, 0.72, 1.28], torso: [0.45, 0, 0], head: [0.2, 0, 0], armL: [0.6, 0, 1.0], armR: [0.6, 0, -1.0], legL: 0.5, legR: 0.5, sword: [0.7, 0, 0], scarf: -0.9 });
export const GROWTH_RINGS = [{ r: 1.4, pct: 5, at: 0 }, { r: 2.1, pct: 10, at: 0.29 }, { r: 3.1, pct: 16, at: 0.58 }];   // ×1.5 compounding
function ringsTo(hero, flat) {
  const g = hero.props.rings; const w = world(hero); if (g.parent !== w) { if (g.parent) g.parent.remove(g); w.add(g); }
  g.position.copy(hero.root.position); g.rotation.set(0, hero.facing, 0);
  for (const r of g.children) { r.rotation.set(flat ? -Math.PI / 2 : 0, 0, 0); r.position.set(0, flat ? 0.08 : 0, 0); r.scale.setScalar(0.001); r.material.opacity = 0.9; r.visible = false; }
  g.visible = true;
}
function hideRings(hero) { const g = hero.props.rings; g.visible = false; for (const r of g.children) { r.visible = false; r.scale.setScalar(1); r.material.opacity = 0.9; } }
/** Drive ring i from a normalised local time u (0..1): scale 0.3→R, fade 0.9→0. Returns true when it just started. */
function driveRing(ring, u, R, color) {
  if (u < 0) { ring.visible = false; return false; }
  ring.visible = u < 1; const k = Easing.outCubic(Math.min(1, u)); ring.scale.setScalar(Math.max(0.001, lerp(0.3, R, k))); ring.material.opacity = 0.9 * (1 - Math.min(1, u)); if (color !== undefined) ring.material.color.setHex(color); return true;
}
function buildGrowthStomp(M) {
  const seq = new Sequence('growthStomp');
  tw(seq, 'crouch', 140, Easing.outCubic, GS_CROUCH, { onEnter: (M) => { ensureAbilityProps(M.hero); M.hero.setTool(null); M.hero.root.position.y = 0; } });
  tw(seq, 'leap', 220, Easing.outCubic, GS_AIR, { fn: (e, M) => { M.hero.root.position.y = 1.4 * e; }, onEnter: (M) => { dust(M, M.hero.root.position, 4, { size: 0.16, speed: 1.2, dur: 0.35 }); } });
  tw(seq, 'hang', 60, Easing.linear, GS_HANG, { fn: (e, M) => { M.hero.root.position.y = 1.4 + 0.05 * Math.sin(Math.PI * e); } });
  tw(seq, 'slam', 110, Easing.inQuart, GS_SLAM, { fn: (e, M) => { M.hero.root.position.y = 1.4 * (1 - e); }, onExit: (M) => { M.hero.root.position.y = 0; } });
  tw(seq, 'impact', 50, Easing.linear, GS_IMPACT, { onEnter: (M) => {
    const hero = M.hero; hero.root.position.y = 0; hitstop(M, 50); shake(M, 0.22); hero.spring.kick(-1.2);
    dust(M, hero.root.position, 10, { size: 0.22, speed: 2.0, dur: 0.45 }); sparks(M, _b.copy(hero.root.position).setY(0.2), 6, 4);
    hook(M, 'levelRing', 'show', hero.root.position); ringsTo(hero, true); M.fired = 0;
  } });
  seq.phase('pulse', 480, Easing.outCubic, (e, M, t, ph) => {
    const hero = M.hero; lerpPose(hero, ph.state.from, REST, Math.min(1, t * 1.6), M.jelly);
    hero.props.rings.position.copy(hero.root.position);
    for (let i = 0; i < 3; i++) {
      const R = GROWTH_RINGS[i]; const u = (t - R.at) / 0.42;
      if (u >= 0 && M.fired <= i) { M.fired = i + 1; pop(M, _b.copy(hero.root.position).setY(0.2 + i * 0.25), `+${R.pct}%`, { color: '#7ED957', dur: 0.8, size: 0.8 + i * 0.15 }); if (i > 0) dustRing(M, hero.root.position, 6, 0.14); hook(M, 'coinRain', 'burst', hero.root.position, 4 + i * 2); if (M.onPulse) M.onPulse(i, R.r, R.pct); }
      driveRing(hero.props.rings.children[i], u, R.r, i === 2 ? P.white : P.sparkGold);
    }
  }, { onEnter: (M, ph) => { ph.state.from = snapPose(M.hero); M.jellyOn = true; }, onExit: (M) => { hideRings(M.hero); } });
  tw(seq, 'settle', 220, Easing.outBack, REST, { cancellable: true });
  return seq;
}
ABILITIES.growthStomp = { build: buildGrowthStomp, phases: [['crouch', 140, 'outCubic'], ['leap', 220, 'outCubic · h 1.4'], ['hang', 60, 'linear'], ['slam', 110, 'inQuart'], ['impact', 50, 'hit-stop 50 · shake'], ['pulse', 480, 'outCubic · rings ×1.5'], ['settle', 220, 'outBack']] };

// ---------- ledgerFlash (P2) ---------- reveal the TRUE cost of a Too-Good Deal: hold up the ledger, it flashes, the number jumps
// | phase   | ms  | ease     | what                                                                                                     |
// | draw    | 180 | outCubic | ledger appears in the left hand, arm raises overhead, squash 0.94, head looks up                       |
// | flash   |  90 | linear   | SCREEN FLASH white 160 ms (vfx.screenFlash ‖ vfx.flash), hit-stop 40, ledger scale 1→1.35, sparks ×8     |
// | reveal  | 520 | outCubic | pop ctx.cost struck out → pop "TRUE COST: ctx.trueCost" (or ctx.text), onReveal(cost, trueCost);        |
// |         |     |          | ledger wobbles rotation.z, body leans back in surprise, shake 0.08                                      |
// | lower   | 220 | outBack  | arm comes down, ledger hides, rest                                                                       |
const LF_UP = POSE({ bs: [1.02, 0.94, 1.02], torso: [-0.12, -0.1, 0], head: [-0.45, 0.1, 0], armL: [-2.8, 0, 0.25], armR: [0.2, 0, -0.5], legL: 0.15, legR: -0.15, sword: [0.5, 0, 0], scarf: -0.4 });
const LF_FLASH = POSE({ bs: [0.96, 1.08, 0.96], torso: [-0.2, -0.1, 0], head: [-0.6, 0.1, 0], armL: [-3.0, 0, 0.2], armR: [0.4, 0, -0.7], legL: 0.1, legR: -0.1, sword: [0.5, 0, 0], scarf: -0.2 });
const LF_SHOCK = POSE({ bs: [1.04, 0.98, 1.04], torso: [-0.3, -0.05, 0], head: [-0.35, 0.2, 0.1], armL: [-2.4, 0, 0.5], armR: [-0.9, 0, -1.1], legL: 0.3, legR: -0.3, sword: [0.3, 0, 0], scarf: 0.1 });
const fmt = (n) => (typeof n === 'number' ? `${n}` : `${n ?? '?'}`);
function buildLedgerFlash(M) {
  const seq = new Sequence('ledgerFlash');
  tw(seq, 'draw', 180, Easing.outCubic, LF_UP, { onEnter: (M) => {
    const hero = M.hero; ensureAbilityProps(hero); hero.setTool('none'); faceTo(hero, targetPos(M.target));
    const L = hero.props.ledger; L.visible = true; L.scale.setScalar(0.001); L.rotation.set(-0.3, 0, 0);
  }, fn: (e, M) => { M.hero.props.ledger.scale.setScalar(Math.max(0.001, e)); } });
  tw(seq, 'flash', 90, Easing.linear, LF_FLASH, { onEnter: (M) => {
    const hero = M.hero; flash(M, '#ffffff', 160, 0.75); hitstop(M, 40); hero.spring.kick(-0.5);
    hero.props.ledger.getWorldPosition(_b); sparks(M, _b, 8, 3);
  }, fn: (e, M) => { M.hero.props.ledger.scale.setScalar(lerp(1, 1.35, e)); } });
  tw(seq, 'reveal', 520, Easing.outCubic, LF_SHOCK, { onEnter: (M) => {
    const hero = M.hero; shake(M, 0.08); hero.props.ledger.getWorldPosition(_b); _c.copy(_b).setY(_b.y + 0.2);
    const cost = M.cost != null ? M.cost : 100, trueCost = M.trueCost != null ? M.trueCost : Math.round(cost * 3.4);
    pop(M, _c, M.text || `TRUE COST: ${fmt(trueCost)}`, { color: '#EF5350', dur: 1.3, size: 1.2 });
    if (!M.text) pop(M, _b.setY(_b.y - 0.1), `~~${fmt(cost)}~~ "deal"`, { color: '#90A4AE', dur: 0.9, size: 0.8 });
    hook(M, 'debtPulse', 'pulse', hero.root.position, 0.3); if (M.onReveal) M.onReveal(cost, trueCost);
  }, fn: (e, M, t) => { const L = M.hero.props.ledger; L.scale.setScalar(lerp(1.35, 1, Math.min(1, t * 2.5))); L.rotation.z = Math.sin(t * TAU * 3) * 0.18 * (1 - t); } });
  tw(seq, 'lower', 220, Easing.outBack, REST, { cancellable: true, onEnter: (M) => { M.jellyOn = true; }, fn: (e, M) => { M.hero.props.ledger.scale.setScalar(Math.max(0.001, 1 - Math.min(1, e * 1.6))); },
    onExit: (M) => { const L = M.hero.props.ledger; L.visible = false; L.scale.setScalar(1); L.rotation.set(-0.3, 0, 0); } });
  return seq;
}
ABILITIES.ledgerFlash = { build: buildLedgerFlash, phases: [['draw', 180, 'outCubic · ledger up'], ['flash', 90, 'linear · screen flash + hit-stop 40'], ['reveal', 520, 'outCubic · "TRUE COST" pop'], ['lower', 220, 'outBack']] };

// ---------- haggleShout (P2) ---------- megaphone pose + 3 expanding sound rings; each ring "hits" the next ctx.target → onShout(target, i)
// | phase   | ms  | ease     | what                                                                                                   |
// | inhale  | 200 | outCubic | megaphone appears in right hand (weaponSlot), chest puffs (stretch 1.1), lean back, left hand on hip  |
// | shout   | 420 | outCubic | lunge forward 0.2 u, squash 0.92; vertical rings ×3 fly forward from the mouth at 0/120/240 ms (r 0.3→1.6), |
// |         |     |          | pop ctx.text ‖ "−20%!" ‖ "DEAL?", shake 0.1, onShout(target_i, i) per ring (targets wrap)             |
// | ring    | 220 | outBack  | hold the pose, last ring fades, pop "✓" when ≥1 target                                                 |
// | settle  | 220 | outBack  | megaphone hidden, rest                                                                                  |
const HS_INHALE = POSE({ bs: [0.96, 1.1, 0.96], brx: -0.15, torso: [-0.3, 0, 0], head: [-0.35, 0, 0], armR: [-2.2, 0, -0.3], armL: [0.6, 0, 1.0], legL: 0.2, legR: -0.2, sword: [0.1, 0, 0], scarf: 0.2 });
const HS_SHOUT = POSE({ bs: [1.06, 0.92, 1.06], brx: 0.2, torso: [0.35, 0, 0], head: [0.15, 0, 0], armR: [-1.6, 0, -0.1], armL: [0.7, 0, 1.1], legL: -0.35, legR: 0.4, sword: [0.1, 0, 0], scarf: -0.9 });
const SHOUT_RINGS = [0, 0.29, 0.57];   // ring start times as a fraction of the 420 ms shout phase
function buildHaggleShout(M) {
  const seq = new Sequence('haggleShout');
  tw(seq, 'inhale', 200, Easing.outCubic, HS_INHALE, { onEnter: (M) => {
    const hero = M.hero; ensureAbilityProps(hero); const t0 = M.targets && M.targets.length ? M.targets[0] : M.target; faceTo(hero, targetPos(t0));
    hero.setTool('megaphone'); M.start.copy(hero.root.position); facingDir(hero, M.dir0); M.fired = 0; M.reach = lungeReach(hero, M.dir0, 0.2);   // BUGFIX P11
    const mp = hero.props.megaphone; mp.scale.setScalar(0.001);
  }, fn: (e, M) => { M.hero.props.megaphone.scale.setScalar(Math.max(0.001, e)); } });
  tw(seq, 'shout', 420, Easing.outCubic, HS_SHOUT, { onEnter: (M) => {
    const hero = M.hero; hero.props.megaphone.scale.setScalar(1); ringsTo(hero, false); hero.props.rings.position.y = 1.05;
    _b.copy(hero.root.position).addScaledVector(M.dir0, 0.6).setY(1.2); pop(M, _b, M.text || '−20%!', { color: '#EF5350', dur: 0.9, size: 1.2 }); shake(M, 0.1); hero.spring.kick(-0.6);
    hook(M, 'coinBurst', 'burst', _b, 3);
  }, fn: (e, M, t) => {
    const hero = M.hero; hero.root.position.copy(M.start).addScaledVector(M.dir0, Math.min(M.reach ?? 0.2, 0.2 * Math.min(1, e * 1.5)));
    const rg = hero.props.rings; rg.position.copy(hero.root.position).setY(1.05); rg.rotation.set(0, hero.facing, 0);
    for (let i = 0; i < 3; i++) {
      const u = (t - SHOUT_RINGS[i]) / 0.5; const r = rg.children[i];
      if (u >= 0 && M.fired <= i) { M.fired = i + 1; if (M.targets && M.targets.length) { const tg = M.targets[i % M.targets.length]; if (M.onShout) M.onShout(tg, i); sparks(M, _c.copy(targetPos(tg) || hero.root.position).setY(0.8), 3, 2); } }
      if (u < 0) { r.visible = false; continue; }
      const k = Easing.outCubic(Math.min(1, u)); r.visible = u < 1; r.position.set(0, 0, 0.35 + 1.4 * k); r.scale.setScalar(Math.max(0.001, lerp(0.3, 1.6, k))); r.material.opacity = 0.9 * (1 - Math.min(1, u)); r.material.color.setHex(i === 1 ? P.white : P.sparkGold);
    }
  } });
  tw(seq, 'ring', 220, Easing.outBack, HS_SHOUT, { onEnter: (M) => { if (M.targets && M.targets.length) pop(M, _b.copy(M.hero.root.position).setY(0.1), '✓ fair deal', { color: '#7ED957', dur: 0.8, size: 0.9 }); },
    fn: (e, M) => { const rg = M.hero.props.rings; for (const r of rg.children) if (r.visible) { r.material.opacity = Math.max(0, r.material.opacity - dtOf(M) * 4); r.position.z += dtOf(M) * 2.5; } }, onExit: (M) => { hideRings(M.hero); } });
  tw(seq, 'settle', 220, Easing.outBack, REST, { cancellable: true, onEnter: (M) => { M.jellyOn = true; M.hero.setTool(null); } });
  seq.moveUpdate = (dt, M) => { M.dtLast = dt; };
  return seq;
}
ABILITIES.haggleShout = { build: buildHaggleShout, phases: [['inhale', 200, 'outCubic · megaphone + chest puff'], ['shout', 420, 'outCubic · rings ×3 + onShout'], ['ring', 220, 'outBack'], ['settle', 220, 'outBack']] };

// ---------- fogSweep (P3) ---------- push the Debt Fog back: wide two-handed sweep + additive arc that flies forward
// | phase   | ms  | ease     | what                                                                                                    |
// | windup  | 220 | outCubic | twist torso right (yaw −0.9), both arms back-right, squash 0.9, dust ×3 at the feet                     |
// | sweep   | 140 | inQuart  | torso whips left (yaw +0.9), arms sweep across, 0.3 u step forward; arc appears at r 1.0 facing forward |
// | push    | 380 | outCubic | arc flies forward 1.0→3.6 u, scale 1→1.6, fades; onSweep(origin, dir, radius) + ctx.fog.push(origin, dir, strength) |
// |         |     |          | at phase start; hit-stop 30, shake 0.12, dust ×6 along the path, vfx.fogShader?.push, pop "FOG −!"     |
// | settle  | 240 | outBack  | rest                                                                                                    |
const FS_WIND = POSE({ bs: [1.06, 0.9, 1.06], torso: [0.1, -0.9, 0], head: [0, -0.5, 0], armL: [-1.4, 0, -0.9], armR: [-1.3, 0, -1.2], legL: 0.3, legR: -0.3, sword: [0.2, 0, 0], scarf: -0.6 });
const FS_SWEEP = POSE({ bs: [0.96, 1.05, 0.96], torso: [0.15, 0.9, 0], head: [-0.1, 0.5, 0], armL: [-1.5, 0, 1.3], armR: [-1.5, 0, 0.9], legL: -0.3, legR: 0.35, sword: [0.2, 0, 0], scarf: -1.0 });
const FS_PUSH = POSE({ bs: [1.0, 1.0, 1.0], torso: [0.1, 0.5, 0], head: [-0.15, 0.2, 0], armL: [-1.3, 0, 1.2], armR: [-1.3, 0, 0.6], legL: -0.2, legR: 0.3, sword: [0.3, 0, 0], scarf: -0.7 });
function setArc(hero, dist, scale, opacity) {
  const a = hero.props.arc; facingDir(hero, _a); a.position.copy(hero.root.position).addScaledVector(_a, dist); a.position.y = 0.6;
  a.rotation.set(0, hero.facing, 0); a.scale.set(scale, 1, scale); a.material.opacity = opacity;
}
function buildFogSweep(M) {
  const seq = new Sequence('fogSweep');
  tw(seq, 'windup', 220, Easing.outCubic, FS_WIND, { onEnter: (M) => {
    const hero = M.hero; ensureAbilityProps(hero); hero.setTool('none'); faceTo(hero, targetPos(M.target)); M.start.copy(hero.root.position); facingDir(hero, M.dir0); M.reach = lungeReach(hero, M.dir0, 0.3);   // BUGFIX P11
    const w = world(hero); if (hero.props.arc.parent !== w) { if (hero.props.arc.parent) hero.props.arc.parent.remove(hero.props.arc); w.add(hero.props.arc); }
    dust(M, hero.root.position, 3, { size: 0.14, speed: 0.8, dur: 0.35 });
  } });
  tw(seq, 'sweep', 140, Easing.inQuart, FS_SWEEP, { fn: (e, M) => { M.hero.root.position.copy(M.start).addScaledVector(M.dir0, Math.min(M.reach ?? 0.3, 0.3 * e)); },
    onExit: (M) => { M.hero.props.arc.visible = true; setArc(M.hero, 1.0, 1, 0.85); } });
  tw(seq, 'push', 380, Easing.outCubic, FS_PUSH, { onEnter: (M, ph) => {
    const hero = M.hero; ph.state.lastPuff = -1; hitstop(M, 30); shake(M, 0.12); hero.spring.kick(-0.7);
    _b.copy(hero.root.position).addScaledVector(M.dir0, 1.0); const strength = M.strength != null ? M.strength : 1;
    dust(M, _b, 6, { size: 0.24, speed: 2.2, dur: 0.5, dir: M.dir0 }); pop(M, _b, 'FOG −!', { color: '#C9B8E8', dur: 0.9, size: 1.1 });
    if (M.fog && typeof M.fog.push === 'function') M.fog.push(_b.clone(), M.dir0.clone(), strength);
    hook(M, 'fogShader', 'push', _b, M.dir0, strength); if (M.onSweep) M.onSweep(_b.clone(), M.dir0.clone(), 3.6 * strength);
  }, fn: (e, M, t, ph) => {
    setArc(M.hero, lerp(1.0, 3.6, e), lerp(1, 1.6, e), 0.85 * (1 - Math.min(1, t * 1.15)));
    if (t - ph.state.lastPuff >= 0.12 && t < 0.7) { ph.state.lastPuff = t; dust(M, M.hero.props.arc.position, 2, { size: 0.18, speed: 0.8, dur: 0.4, dir: M.dir0 }); }
  }, onExit: (M) => { const a = M.hero.props.arc; a.visible = false; a.scale.setScalar(1); a.material.opacity = 0.85; } });
  tw(seq, 'settle', 240, Easing.outBack, REST, { cancellable: true, onEnter: (M) => { M.jellyOn = true; } });
  return seq;
}
ABILITIES.fogSweep = { build: buildFogSweep, phases: [['windup', 220, 'outCubic · torso twist'], ['sweep', 140, 'inQuart · whip + 0.3 u step'], ['push', 380, 'outCubic · arc 1→3.6 u + hit-stop 30'], ['settle', 240, 'outBack']] };

// ───────────────────────────── registration / attach ─────────────────────────────
registerMoves(ABILITIES);   // HERO_MOVES now also has the abilities → makeMove('coinMagnetDash', ctx) works via heroAnims
export const ABILITY_NAMES = () => Object.keys(ABILITIES);
const ABILITY_PROPS = ['magnetCoins', 'bubble', 'rings', 'ledger', 'megaphone', 'arc'];

/** Lazy guard so makeMove(name, { hero }) works even when attachAbilities() was never called (integrator path). Idempotent. */
export function ensureAbilityProps(hero) {
  if (hero.props && hero.props.arc) return hero;
  if (!hero.playMove) attachMoves(hero);
  const p = hero.p, w = world(hero);
  hero.props.magnetCoins = makeMagnetCoins(); w.add(hero.props.magnetCoins);
  hero.props.bubble = makeBubble(); hero.root.add(hero.props.bubble);
  hero.props.rings = makeRings(); w.add(hero.props.rings);
  hero.props.ledger = makeLedger(); hero.props.ledger.position.set(0, -0.02, 0.06); hero.props.ledger.rotation.set(-0.3, 0, 0); p.handL.add(hero.props.ledger);
  hero.props.megaphone = makeMegaphone(); p.weaponSlot.add(hero.props.megaphone);
  hero.props.arc = makeArc(); w.add(hero.props.arc);
  hero.hideAbilityProps = () => {
    for (const k of ABILITY_PROPS) hero.props[k].visible = false; hideRings(hero);
    hero.props.bubble.scale.setScalar(1); hero.props.arc.scale.setScalar(1); hero.props.arc.material.opacity = 0.85; hero.props.ledger.scale.setScalar(1); hero.props.megaphone.scale.setScalar(1);
  };
  const baseSetTool = hero.setTool;
  hero.setTool = (name) => { baseSetTool(name); hero.props.megaphone.visible = name === 'megaphone'; };
  return hero;
}

/**
 * Give a HeroController the ability props + ctx plumbing. Idempotent; calls attachMoves(hero) first if 3A has not.
 * Adds hero.props.{magnetCoins, bubble, rings, ledger, megaphone, arc} (all hidden), extends hero.setTool('megaphone'),
 * copies ABILITY_CTX_KEYS from playMove opts, hides ability props whenever a move ends (even when interrupted by stopMove()).
 */
export function attachAbilities(hero) {
  if (!hero.playMove) attachMoves(hero);
  if (hero.abilitiesAttached) return hero;
  hero.abilitiesAttached = true;
  ensureAbilityProps(hero);

  const basePlay = hero.playMove;
  hero.playMove = (name, opts = {}) => {
    if (ABILITIES[name]) {
      // same block checks as 3A so we never overwrite the ctx of a move that keeps running
      if (hero.state === 'attack' && hero.attack && !hero.attack.canCancel) return null;
      if (hero.currentMove && !hero.currentMove.canCancel) return null;
      for (const k of ABILITY_CTX_KEYS) hero.moveCtx[k] = opts[k] !== undefined ? opts[k] : null;
      hero.moveCtx.dtLast = 1 / 60;
    }
    return basePlay(name, opts);
  };
  const baseUpdate = hero.update;
  hero.update = (dt) => { baseUpdate(dt); if (hero.state !== 'move') hero.hideAbilityProps(); };
  return hero;
}
export { HERO_MOVES };
