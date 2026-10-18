// heroAnims.js — Chat 3A: Hero moves set 1 (hammer, dash, celebrate, build, pickUp, carry, throwCoin, sad, stunned).
// Contract (API_CONTRACTS §B "Hero anims"):
//   export const HERO_MOVES                → { name: { phases: [[name, ms, ease], …], loop, allowMove, build(ctx) } }
//   export function makeMove(name, ctx)    → Sequence   (ctx = { hero: HeroController, vfx, game, target?, item?, onHit?, onArrive? })
//   export function attachMoves(hero)      → hero.playMove(name, opts) / hero.stopMove() / hero.dropCarry() / hero.moveName / hero.carrying
//                                            HeroController.state gains 'move' while a move plays (attachMoves wraps hero.update —
//                                            HeroController.js itself is frozen and untouched).
// Chat 3B adds abilities in heroAbilities.js and can reuse: POSE, REST, snapPose, lerpPose, facingDir, attachMoves (it is additive:
// call attachMoves(hero) then register more builders via `HERO_MOVES.myAbility = { … }` BEFORE calling it, or use registerMoves()).
//
// Animation discipline (GAME_BIBLE §4): every move is a Sequence of named phases with explicit ms + easing (tables below),
// phase fns set the pose ABSOLUTELY by lerping from a pose snapshotted in the first onEnter → frame-rate independent.
// Anticipation slow → action instant → settle with overshoot (outBack). Hit-stop + dust + camera shake on every impact.
import * as THREE from '../../vendor/three.module.js';
import { Sequence } from './Sequencer.js';
import { Easing, lerp, damp } from './Easing.js';
import { walkBob } from './SquashStretch.js';
import { G, mesh } from '../assets/geo.js';
import { PALETTE as P, flatMat } from '../core/Toon.js';
import { addOutline } from '../core/Outline.js';

const V = () => new THREE.Vector3();
const _a = V(), _b = V(), _up = new THREE.Vector3(0, 1, 0);
const TAU = Math.PI * 2;

// ───────────────────────────── pose helpers ─────────────────────────────
// A pose is a plain record; lerpPose() writes it onto the rig absolutely. Keys are optional (missing = keep REST).
export const REST = Object.freeze({
  bs: [1, 1, 1], by: 0, brx: 0, brz: 0,            // body scale / y / tilt
  torso: [0, 0, 0], head: [0, 0, 0],
  armL: [0.1, 0, 0.35], armR: [-0.15, 0, -0.35],
  legL: 0, legR: 0, sword: [0.35, 0, 0], scarf: -0.2,
});
export function POSE(o) { return { ...REST, ...o }; }
export function snapPose(hero) {
  const p = hero.p, s = hero.sword;
  return {
    bs: [p.body.scale.x, p.body.scale.y, p.body.scale.z], by: p.body.position.y, brx: p.body.rotation.x, brz: p.body.rotation.z,
    torso: [p.torso.rotation.x, p.torso.rotation.y, p.torso.rotation.z], head: [p.head.rotation.x, p.head.rotation.y, p.head.rotation.z],
    armL: [p.armL.rotation.x, p.armL.rotation.y, p.armL.rotation.z], armR: [p.armR.rotation.x, p.armR.rotation.y, p.armR.rotation.z],
    legL: p.legL.rotation.x, legR: p.legR.rotation.x, sword: [s.rotation.x, s.rotation.y, s.rotation.z], scarf: p.scarfTail.rotation.x,
  };
}
const L3 = (a, b, e) => [lerp(a[0], b[0], e), lerp(a[1], b[1], e), lerp(a[2], b[2], e)];
/** Write lerp(A,B,e) onto the rig. `jelly` = extra body scaleY from the landing spring (layered on top). */
export function lerpPose(hero, A, B, e, jelly = 0) {
  const p = hero.p;
  const bs = L3(A.bs, B.bs, e); p.body.scale.set(Math.max(0.3, bs[0]), Math.max(0.3, bs[1] + jelly), Math.max(0.3, bs[2]));
  p.body.position.y = lerp(A.by, B.by, e); p.body.rotation.x = lerp(A.brx, B.brx, e); p.body.rotation.z = lerp(A.brz, B.brz, e);
  p.torso.rotation.fromArray(L3(A.torso, B.torso, e)); p.head.rotation.fromArray(L3(A.head, B.head, e));
  p.armL.rotation.fromArray(L3(A.armL, B.armL, e)); p.armR.rotation.fromArray(L3(A.armR, B.armR, e));
  p.legL.rotation.x = lerp(A.legL, B.legL, e); p.legR.rotation.x = lerp(A.legR, B.legR, e);
  hero.sword.rotation.fromArray(L3(A.sword, B.sword, e)); p.scarfTail.rotation.x = lerp(A.scarf, B.scarf, e);
  p.shadow.scale.set(p.body.scale.x, 1, p.body.scale.z);
}
export function facingDir(hero, out = V()) { return out.set(Math.sin(hero.facing), 0, Math.cos(hero.facing)); }
function faceTo(hero, pos) { if (!pos) return; const yaw = Math.atan2(pos.x - hero.root.position.x, pos.z - hero.root.position.z); hero.facing = yaw; hero.root.rotation.y = yaw; }
function targetPos(t) { return !t ? null : t.isVector3 ? t : t.position || (t.root && t.root.position) || null; }
/** Furthest point ≤ dist along dir that is still land (steps of 0.25). */
function landDist(hero, dir, dist) {
  const isLand = hero.deps && hero.deps.isLand; if (!isLand) return dist;
  let ok = 0; for (let d = 0.25; d <= dist + 1e-6; d += 0.25) { _a.copy(hero.root.position).addScaledVector(dir, d); if (!isLand(_a.x, _a.z)) break; ok = d; }
  return ok;
}
// Standard "two-pose phase": lerps from the pose snapshotted at phase start (or ctx.from) to `to`.
function tween(seq, name, ms, ease, to, opts = {}) {
  return seq.phase(name, ms, ease, (e, M, t, ph) => { lerpPose(M.hero, ph.state.from, to, e, M.jelly); if (opts.fn) opts.fn(e, M, t, ph); },
    { onEnter: (M, ph) => { ph.state.from = snapPose(M.hero); if (opts.onEnter) opts.onEnter(M, ph); }, onExit: opts.onExit, cancellable: !!opts.cancellable });
}
const vfxOf = (M) => M.vfx || (M.hero.deps && M.hero.deps.vfx) || null;
const dust = (M, pos, n, o) => { const v = vfxOf(M); if (v && v.dust) v.dust.burst(pos, n, o); };
const sparks = (M, pos, n, sp) => { const v = vfxOf(M); if (v && v.sparks) v.sparks.burst(pos, n, sp); };
const pop = (M, pos, text, o) => { const v = vfxOf(M); if (v && v.pop) v.pop.show(pos, text, o); };
const shake = (M, a) => { const g = M.game || M.hero.game; if (g && g.camera && g.camera.shake) g.camera.shake(a); };
const hitstop = (M, ms) => { const g = M.game || M.hero.game; if (g && g.hitstop) g.hitstop(ms); };

// ───────────────────────────── move props (hidden at rest → 0 draw calls) ─────────────────────────────
/** Builder's hammer, pivot at grip, head along +Y (same frame as the sword, attaches to parts.weaponSlot). 3 meshes + 3 outline. */
export function makeHammer() {
  const g = new THREE.Group(); g.name = 'hammer';
  g.add(mesh(G.cyl(0.04, 0.05, 0.62, 6), P.wood, 0, 0.26, 0));
  g.add(mesh(G.rbox(0.42, 0.2, 0.2, 0.05), P.metal, 0, 0.6, 0));
  g.add(mesh(G.box(0.1, 0.22, 0.22), P.sparkGold, 0, 0.6, 0));
  addOutline(g); g.visible = false; return g;
}
/** Carry crate (default item for pickUp/carry). 1 mesh + 1 outline. */
export function makeCarryCrate() {
  const g = new THREE.Group(); g.name = 'carryCrate';
  const m = mesh(G.rbox(0.56, 0.44, 0.5, 0.05), P.wood, 0, 0.22, 0); g.add(m);
  addOutline(g); g.visible = false; return g;
}
/** Spark coin (flat, emissive). 1 mesh, no outline. */
export function makeCoin() {
  const m = new THREE.Mesh(G.cyl(0.16, 0.16, 0.05, 10), flatMat(P.sparkGold)); m.name = 'coin';
  m.rotation.x = Math.PI / 2; m.userData.noOutline = true; m.visible = false; return m;
}
/** 3 tiny stars that orbit the head while stunned. 3 meshes, no outline. */
export function makeStars() {
  const g = new THREE.Group(); g.name = 'stars'; g.visible = false;
  for (let i = 0; i < 3; i++) { const s = new THREE.Mesh(G.ico(0.07, 0), flatMat(P.sparkGold)); s.userData.noOutline = true; s.position.set(Math.cos(i / 3 * TAU) * 0.5, 0, Math.sin(i / 3 * TAU) * 0.5); g.add(s); }
  return g;
}

// ───────────────────────────── MOVES ─────────────────────────────
export const HERO_MOVES = {};
export function registerMoves(map) { Object.assign(HERO_MOVES, map); }

// ---------- hammer (P1) ----------
// | phase     | ms  | ease       | what                                                              |
// | raise     | 180 | outCubic   | squash 0.92, hammer overhead, torso back, eyes up (anticipation)   |
// | strike    |  90 | inQuart    | hammer slams down in front, torso forward, 0.15 u lunge           |
// | impact    |  40 | linear     | HIT-STOP 40 ms, squash 0.82, dust ×8, sparks ×6, shake 0.15        |
// | recovery  | 220 | outBack    | back to rest with overshoot                                        |
const HAMMER_UP = POSE({ bs: [1.05, 0.92, 1.05], torso: [-0.22, 0.15, 0], head: [-0.4, 0, 0], armR: [-2.75, 0, -0.25], armL: [-0.6, 0, 0.7], sword: [-0.3, 0, 0], legL: 0.25, legR: -0.25, scarf: -0.5 });
const HAMMER_DOWN = POSE({ bs: [0.96, 1.06, 1.0], torso: [0.55, -0.1, 0], head: [0.25, 0, 0], armR: [0.55, 0, -0.1], armL: [0.5, 0, 0.6], sword: [0.5, 0, 0], legL: -0.35, legR: 0.4, scarf: -0.9 });
const HAMMER_HIT = POSE({ bs: [1.1, 0.82, 1.1], torso: [0.65, -0.1, 0], head: [0.35, 0, 0], armR: [0.6, 0, -0.1], armL: [0.55, 0, 0.6], sword: [0.5, 0, 0], legL: -0.3, legR: 0.4, scarf: -0.95 });
function hammerImpact(M, ms, idx) {
  const hero = M.hero; facingDir(hero, _a); _b.copy(hero.root.position).addScaledVector(_a, 1.0);
  if (ms) hitstop(M, ms);
  dust(M, _b, 8, { size: 0.2, speed: 1.6, dur: 0.4 }); sparks(M, _a.copy(_b).setY(0.3), 6, 4); shake(M, 0.15);
  if (M.onHit) M.onHit(idx, _b.clone());
}
function buildHammer(M) {
  const seq = new Sequence('hammer');
  tween(seq, 'raise', 180, Easing.outCubic, HAMMER_UP, { onEnter: (M) => { faceTo(M.hero, targetPos(M.target)); M.hero.setTool('hammer'); M.start.copy(M.hero.root.position); } });
  tween(seq, 'strike', 90, Easing.inQuart, HAMMER_DOWN, { fn: (e, M) => { facingDir(M.hero, _a); M.hero.root.position.copy(M.start).addScaledVector(_a, 0.15 * e); } });
  tween(seq, 'impact', 40, Easing.linear, HAMMER_HIT, { onEnter: (M) => hammerImpact(M, 40, 0) });
  tween(seq, 'recovery', 220, Easing.outBack, REST, { cancellable: true, onEnter: (M) => { M.jellyOn = true; M.hero.spring.kick(-0.8); } });
  return seq;
}
HERO_MOVES.hammer = { build: buildHammer, phases: [['raise', 180, 'outCubic'], ['strike', 90, 'inQuart'], ['impact', 40, 'hit-stop'], ['recovery', 220, 'outBack']] };

// ---------- dash (P1) ----------
// | phase   | ms  | ease     | what                                                                              |
// | squash  |  80 | outCubic | squash 0.8 (wide), lean back, arms back, dust ×5 behind                           |
// | travel  | 160 | outCubic | stretch along facing 1.3 / 0.85, moves 3 u (clipped to land), dust trail every 35 ms |
// | settle  | 180 | outBack  | scale back to 1 with overshoot, +0.1 u slide, dust ring, spring kick              |
const DASH_SQUASH = POSE({ bs: [1.12, 0.8, 1.12], brx: -0.25, torso: [-0.2, 0, 0], head: [-0.2, 0, 0], armL: [0.9, 0, 0.5], armR: [0.9, 0, -0.5], legL: 0.4, legR: -0.4, sword: [0.6, 0, 0], scarf: 0.1 });
const DASH_STRETCH = POSE({ bs: [0.85, 0.85, 1.3], brx: 0.3, torso: [0.3, 0, 0], head: [-0.1, 0, 0], armL: [1.3, 0, 0.4], armR: [1.3, 0, -0.4], legL: 0.8, legR: 0.8, sword: [0.8, 0, 0], scarf: -1.4 });
function buildDash(M) {
  const seq = new Sequence('dash');
  tween(seq, 'squash', 80, Easing.outCubic, DASH_SQUASH, { onEnter: (M) => {
    const hero = M.hero, inp = hero.game && hero.game.input;
    if (M.dir) hero.facing = Math.atan2(M.dir.x, M.dir.z);
    else if (inp && inp.move && inp.move.lengthSq() > 0.05) hero.facing = Math.atan2(inp.move.x, -inp.move.y);
    hero.root.rotation.y = hero.facing; facingDir(hero, M.dir0); M.start.copy(hero.root.position);
    M.dist = landDist(hero, M.dir0, M.dashDist || 3); M.dir = null;
    dust(M, hero.root.position, 5, { size: 0.2, speed: 1.4, dur: 0.4, dir: M.dir0 });
  } });
  tween(seq, 'travel', 160, Easing.outCubic, DASH_STRETCH, { fn: (e, M, t, ph) => {
    const hero = M.hero; hero.root.position.copy(M.start).addScaledVector(M.dir0, M.dist * e);
    if (t - ph.state.lastPuff >= 0.22) { ph.state.lastPuff = t; dust(M, hero.root.position, 2, { size: 0.16, speed: 0.6, dur: 0.35, dir: M.dir0, up: 0.5 }); }
  }, onEnter: (M, ph) => { ph.state.lastPuff = -1; } });
  tween(seq, 'settle', 180, Easing.outBack, REST, { cancellable: true, fn: (e, M) => { M.hero.root.position.copy(M.start).addScaledVector(M.dir0, M.dist + M.slide * Math.min(1, e)); },
    onEnter: (M) => { M.slide = M.dist > 0.5 ? Math.min(0.1, landDist(M.hero, M.dir0, 0.25)) : 0; M.jellyOn = true; M.hero.spring.kick(-1.0); const v = vfxOf(M); if (v && v.dust && v.dust.ring) v.dust.ring(M.hero.root.position, 6, 0.18); else dust(M, M.hero.root.position, 4); } });
  return seq;
}
HERO_MOVES.dash = { build: buildDash, phases: [['squash', 80, 'outCubic'], ['travel', 160, 'outCubic'], ['settle', 180, 'outBack']] };

// ---------- celebrate (P1) ----------
// | phase    | ms  | ease       | what                                                               |
// | crouch   | 120 | outCubic   | squash 0.85, arms back                                             |
// | jump1    | 240 | linear     | parabola h 0.7, stretch 1.15 going up                              |
// | land1    |  80 | outCubic   | squash 0.8, dust ×4                                                |
// | jump2    | 300 | linear     | parabola h 1.0, both arms raise, CONFETTI at apex (vfx.confetti?.burst, fallback sparks + "YAY!") |
// | land2    |  90 | outCubic   | squash 0.78, dust ring, shake 0.1                                  |
// | pose     | 320 | outBack    | V-arms, head tilt, stretch 1.04 (hold the win)                      |
// | recovery | 200 | inOutCubic | back to rest                                                        |
const CEL_CROUCH = POSE({ bs: [1.1, 0.85, 1.1], torso: [0.25, 0, 0], head: [-0.15, 0, 0], armL: [0.9, 0, 0.5], armR: [0.9, 0, -0.5], legL: 0.3, legR: 0.3 });
const CEL_AIR1 = POSE({ bs: [0.92, 1.15, 0.92], torso: [-0.1, 0, 0], head: [-0.25, 0, 0], armL: [-1.2, 0, 0.6], armR: [-1.2, 0, -0.6], legL: -0.5, legR: 0.6, sword: [0.1, 0, 0], scarf: 0.4 });
const CEL_LAND = POSE({ bs: [1.15, 0.8, 1.15], torso: [0.2, 0, 0], head: [0.1, 0, 0], armL: [0.4, 0, 0.6], armR: [0.4, 0, -0.6], legL: 0.4, legR: 0.4 });
const CEL_AIR2 = POSE({ bs: [0.9, 1.18, 0.9], torso: [-0.15, 0, 0], head: [-0.35, 0, 0.15], armL: [-2.9, 0, 0.5], armR: [-2.9, 0, -0.5], legL: -0.7, legR: 0.7, sword: [-0.4, 0, 0], scarf: 0.6 });
const CEL_LAND2 = POSE({ bs: [1.18, 0.78, 1.18], torso: [0.15, 0, 0], head: [0.05, 0, 0], armL: [-2.4, 0, 0.7], armR: [-2.4, 0, -0.7], legL: 0.45, legR: 0.45, sword: [-0.3, 0, 0] });
const CEL_POSE = POSE({ bs: [0.98, 1.04, 0.98], torso: [-0.08, 0, 0.08], head: [-0.2, 0.15, 0.2], armL: [-2.6, 0, 0.9], armR: [-2.7, 0, -1.0], legL: -0.1, legR: 0.1, sword: [-0.5, 0, 0], scarf: -0.35 });
function jumpPhase(seq, name, ms, h, to, onApex) {
  seq.phase(name, ms, Easing.linear, (e, M, t, ph) => {
    const hero = M.hero; lerpPose(hero, ph.state.from, to, Math.min(1, t * 2.2), 0);
    hero.root.position.y = h * 4 * t * (1 - t);
    const up = 1 - t * 2; hero.p.body.scale.y *= 1 + 0.12 * Math.max(0, up); hero.p.body.scale.x *= 1 - 0.05 * Math.max(0, up); hero.p.body.scale.z *= 1 - 0.05 * Math.max(0, up);
    if (onApex && !ph.state.apex && t >= 0.5) { ph.state.apex = true; onApex(M); }
  }, { onEnter: (M, ph) => { ph.state.from = snapPose(M.hero); ph.state.apex = false; M.hero.root.position.y = 0; }, onExit: (M) => { M.hero.root.position.y = 0; } });
}
function confetti(M) {
  const hero = M.hero, v = vfxOf(M); _a.copy(hero.root.position).setY(1.9);
  if (v && v.confetti && v.confetti.burst) v.confetti.burst(_a, 24);
  else { sparks(M, _a, 14, 4); pop(M, hero.root.position, 'YAY!', { color: '#FFD54F', dur: 0.9, size: 1.1 }); }
  M.celebrated = (M.celebrated || 0) + 1;
}
function buildCelebrate(M) {
  const seq = new Sequence('celebrate');
  tween(seq, 'crouch', 120, Easing.outCubic, CEL_CROUCH, { onEnter: (M) => { M.hero.setTool(null); } });
  jumpPhase(seq, 'jump1', 240, 0.7, CEL_AIR1, null);
  tween(seq, 'land1', 80, Easing.outCubic, CEL_LAND, { onEnter: (M) => { dust(M, M.hero.root.position, 4, { size: 0.16, speed: 1.2, dur: 0.35 }); M.hero.spring.kick(-0.7); } });
  jumpPhase(seq, 'jump2', 300, 1.0, CEL_AIR2, confetti);
  tween(seq, 'land2', 90, Easing.outCubic, CEL_LAND2, { onEnter: (M) => { const v = vfxOf(M); if (v && v.dust && v.dust.ring) v.dust.ring(M.hero.root.position, 8, 0.2); else dust(M, M.hero.root.position, 6); shake(M, 0.1); M.hero.spring.kick(-1.0); } });
  tween(seq, 'pose', 320, Easing.outBack, CEL_POSE, { onEnter: (M) => { M.jellyOn = true; } });
  tween(seq, 'recovery', 200, Easing.inOutCubic, REST, { cancellable: true });
  return seq;
}
HERO_MOVES.celebrate = { build: buildCelebrate, phases: [['crouch', 120, 'outCubic'], ['jump1', 240, 'linear·parabola'], ['land1', 80, 'outCubic'], ['jump2', 300, 'linear·parabola'], ['land2', 90, 'outCubic'], ['pose', 320, 'outBack'], ['recovery', 200, 'inOutCubic']] };

// ---------- build (P2) ----------  hammer ×3 then a POP
// | phase   | ms  | ease     | what                                                  |
// | raise1  | 160 | outCubic | hammer up (ctx.count hits, default 3)                 |
// | hit1    |  80 | inQuart  | slam → hit-stop 30, dust, sparks, shake 0.12, onHit(i) |
// | raise2 … hit3 (same)                                                             |
// | pop     | 160 | outBack  | hero hops back 0.2 u, stretch 1.12, "DONE!" + sparks ×12 (vfx.levelRing?.show if 9A exists) |
// | settle  | 200 | outBack  | rest                                                  |
const BUILD_UP = POSE({ bs: [1.04, 0.94, 1.04], torso: [-0.15, 0.1, 0], head: [-0.3, 0, 0], armR: [-2.6, 0, -0.25], armL: [-0.4, 0, 0.7], sword: [-0.3, 0, 0], legL: 0.2, legR: -0.2, scarf: -0.5 });
const BUILD_HIT = POSE({ bs: [1.08, 0.86, 1.08], torso: [0.5, -0.1, 0], head: [0.25, 0, 0], armR: [0.55, 0, -0.1], armL: [0.45, 0, 0.6], sword: [0.5, 0, 0], legL: -0.3, legR: 0.35, scarf: -0.9 });
const BUILD_POP = POSE({ bs: [0.94, 1.12, 0.94], torso: [-0.2, 0, 0], head: [-0.3, 0, 0.1], armR: [-2.4, 0, -0.9], armL: [-2.4, 0, 0.9], sword: [-0.3, 0, 0], legL: -0.3, legR: 0.3, scarf: 0.3 });
function buildBuild(M) {
  const seq = new Sequence('build'); const n = Math.max(1, Math.min(6, M.count || 3));
  for (let i = 0; i < n; i++) {
    tween(seq, 'raise' + (i + 1), 160, Easing.outCubic, BUILD_UP, { onEnter: (M) => { if (i === 0) { faceTo(M.hero, targetPos(M.target)); M.hero.setTool('hammer'); M.start.copy(M.hero.root.position); } } });
    tween(seq, 'hit' + (i + 1), 80, Easing.inQuart, BUILD_HIT, { onExit: (M) => { hammerImpact(M, 30, i); shake(M, 0.12); } });
  }
  tween(seq, 'pop', 160, Easing.outBack, BUILD_POP, { fn: (e, M) => { facingDir(M.hero, _a); M.hero.root.position.copy(M.start).addScaledVector(_a, -0.2 * Math.min(1, e)); M.hero.root.position.y = 0.25 * Math.sin(Math.PI * Math.min(1, e)); },
    onEnter: (M) => { M.hero.setTool(null); const v = vfxOf(M); facingDir(M.hero, _a); _b.copy(M.hero.root.position).addScaledVector(_a, 1.0);
      if (v && v.levelRing && v.levelRing.show) v.levelRing.show(_b); sparks(M, _a.copy(_b).setY(0.6), 12, 4); pop(M, _b, 'DONE!', { color: '#7ED957', dur: 0.8 }); }, onExit: (M) => { M.hero.root.position.y = 0; } });
  tween(seq, 'settle', 200, Easing.outBack, REST, { cancellable: true, onEnter: (M) => { M.jellyOn = true; M.hero.spring.kick(-0.9); } });
  return seq;
}
HERO_MOVES.build = { build: buildBuild, phases: [['raise×3', 160, 'outCubic'], ['hit×3', 80, 'inQuart + hit-stop 30'], ['pop', 160, 'outBack'], ['settle', 200, 'outBack']] };

// ---------- pickUp (P2) ----------  ends in the carry pose, hero.carrying set; chains into carry automatically (def.after → hero.moveName becomes 'carry').
// The hero keeps holding the item until hero.dropCarry(), hero.stopMove() (finish drops it), or a move without keepsCarry starts.
// | phase  | ms  | ease       | what                                                        |
// | reach  | 180 | outCubic   | bend forward, squash 0.9, arms down-front toward ctx.target |
// | grab   |  60 | linear     | item appears in hands (ctx.item or default crate)           |
// | lift   | 200 | outBack    | straighten with overshoot, arms up-front, item above chest  |
const PICK_REACH = POSE({ bs: [1.08, 0.88, 1.08], torso: [0.7, 0, 0], head: [0.2, 0, 0], armL: [0.9, 0, 0.3], armR: [0.9, 0, -0.3], legL: -0.2, legR: 0.3, sword: [0.6, 0, 0], scarf: -0.9 });
const PICK_GRAB = POSE({ bs: [1.1, 0.86, 1.1], torso: [0.75, 0, 0], head: [0.25, 0, 0], armL: [1.0, 0, 0.25], armR: [1.0, 0, -0.25], legL: -0.2, legR: 0.3, sword: [0.6, 0, 0], scarf: -0.95 });
export const CARRY_POSE = POSE({ bs: [0.98, 1.03, 0.98], torso: [-0.08, 0, 0], head: [-0.05, 0, 0], armL: [-1.25, 0, 0.3], armR: [-1.25, 0, -0.3], sword: [0.6, 0, 0], scarf: -0.3 });
function carryItem(hero, M) {
  const it = M.item && M.item.isObject3D ? M.item : hero.props.crate;
  if (it.parent !== hero.p.torso) { if (it.parent) it.parent.remove(it); hero.p.torso.add(it); }
  it.position.set(0, 0.62, 0.52); it.rotation.set(0, 0, 0); it.scale.setScalar(1); it.visible = true; hero.carrying = it; return it;
}
function buildPickUp(M) {
  const seq = new Sequence('pickUp');
  tween(seq, 'reach', 180, Easing.outCubic, PICK_REACH, { onEnter: (M) => { faceTo(M.hero, targetPos(M.target)); M.hero.setTool('none'); } });
  tween(seq, 'grab', 60, Easing.linear, PICK_GRAB, { onEnter: (M) => { const it = carryItem(M.hero, M); it.position.set(0, 0.05, 0.62); dust(M, M.hero.root.position, 2, { size: 0.12, speed: 0.6, dur: 0.3 }); } });
  seq.phase('lift', 200, Easing.outBack, (e, M, t, ph) => { lerpPose(M.hero, ph.state.from, CARRY_POSE, e, 0); const it = M.hero.carrying; if (it) { it.position.y = lerp(0.05, 0.62, e); it.position.z = lerp(0.62, 0.52, e); } },
    { onEnter: (M, ph) => { ph.state.from = snapPose(M.hero); M.hero.spring.kick(-0.5); } });
  return seq;
}
HERO_MOVES.pickUp = { build: buildPickUp, keepsCarry: true, phases: [['reach', 180, 'outCubic'], ['grab', 60, 'linear'], ['lift', 200, 'outBack']], after: (hero) => { if (hero.carrying) hero.playMove('carry'); } };

// ---------- carry (P2, LOOP, allowMove) ----------  arms up holding the item; walkBob while input.move; item bobs
// | phase | ms  | ease   | what                                                                        |
// | hold  | 600 | linear | loop: idle breathe; when moving → walkBob(phase) hop 0.1, legs swing, dust per step |
function buildCarry(M) {
  const seq = new Sequence('carry');
  seq.phase('hold', 600, Easing.linear, (e, M) => {
    const hero = M.hero, p = hero.p, it = hero.carrying;
    const moving = hero.vel.lengthSq() > 0.05;
    const sp = Math.hypot(hero.vel.x, hero.vel.z);
    if (moving) { M.walk += M.dtLast * (8 + sp); } else { const r = Math.round(M.walk / Math.PI) * Math.PI; M.walk += (r - M.walk) * (1 - Math.exp(-14 * M.dtLast)); }
    const wb = walkBob(M.walk, moving ? 0.1 : 0);
    lerpPose(hero, CARRY_POSE, CARRY_POSE, 0, M.jelly);
    const br = moving ? wb.squash : 1 + Math.sin(hero.t * 2.3) * 0.02; p.body.scale.set(1 / Math.sqrt(br), br + M.jelly, 1 / Math.sqrt(br));
    p.body.position.y = wb.y; p.body.rotation.x = moving ? 0.1 + wb.tilt * 0.3 : 0; p.body.rotation.z = wb.tilt * 0.5;
    const sw = Math.sin(M.walk) * (moving ? 0.8 : 0); p.legL.rotation.x = sw; p.legR.rotation.x = -sw;
    p.head.rotation.z = -wb.tilt * 0.3; p.scarfTail.rotation.x = -0.3 - Math.abs(sw) * 0.4;
    if (it) { it.position.y = 0.62 + wb.y * 0.5; it.rotation.z = -wb.tilt * 0.6; it.rotation.x = Math.sin(hero.t * 2.3) * 0.02; }
    if (moving && Math.floor(M.walkPrev / Math.PI) !== Math.floor(M.walk / Math.PI)) { dust(M, hero.root.position, 2, { size: 0.12, speed: 0.8, dur: 0.3 }); hero.spring.kick(-0.5); }
    M.walkPrev = M.walk;
  }, { cancellable: true, onEnter: (M) => { if (!M.hero.carrying) carryItem(M.hero, M); M.hero.setTool('none'); M.walk = M.walkPrev = 0; M.dtLast = 1 / 60; M.jellyOn = true; } });   // cancellable: any other playMove() interrupts carrying (and drops the item unless keepsCarry)
  seq.moveUpdate = (dt, M) => { M.dtLast = dt; };
  return seq;
}
HERO_MOVES.carry = { build: buildCarry, loop: true, allowMove: true, moveSpeed: 0.7, keepsCarry: true, phases: [['hold', 600, 'linear (loop, walkBob while moving)']] };

// ---------- throwCoin (P2) ----------  flips a Spark coin to ctx.target (Vector3 | {position} | {root}), default 2.5 u ahead
// | phase    | ms  | ease       | what                                                               |
// | windup   | 160 | outCubic   | coin appears in right hand, arm back, squash 0.94                  |
// | flick    |  90 | inQuart    | arm snaps forward, torso twist; coin released at end               |
// | flight   | 420 | linear     | coin parabola (h 1.2) + spin to target; hero holds follow-through  |
// | arrive   |  60 | outCubic   | coin pops (scale 1→0), sparks ×8, "+1" pop, onArrive(target), hero nods |
// | recovery | 200 | outBack    | rest                                                               |
const THROW_WIND = POSE({ bs: [1.04, 0.94, 1.04], torso: [0.05, 0.45, 0], head: [0, -0.3, 0], armR: [-0.4, 0, -1.2], armL: [0.3, 0, 0.5], sword: [0.4, 0, 0], legL: 0.2, legR: -0.2 });
const THROW_FLICK = POSE({ bs: [0.98, 1.04, 0.98], torso: [0.1, -0.35, 0], head: [-0.1, 0.1, 0], armR: [-1.9, 0, -0.1], armL: [0.6, 0, 0.6], sword: [0.4, 0, 0], legL: -0.2, legR: 0.3, scarf: -0.5 });
function buildThrowCoin(M) {
  const seq = new Sequence('throwCoin');
  tween(seq, 'windup', 160, Easing.outCubic, THROW_WIND, { onEnter: (M) => {
    const hero = M.hero; faceTo(hero, targetPos(M.target)); hero.setTool('none');
    const tp = targetPos(M.target); facingDir(hero, _a); M.to = M.to || V(); if (tp) M.to.copy(tp).setY((M.target.userData && M.target.userData.height ? M.target.userData.height * 0.5 : 0.6)); else M.to.copy(hero.root.position).addScaledVector(_a, 2.5).setY(0.3);
    const c = hero.props.coin; c.visible = true; hero.p.handR.getWorldPosition(c.position); c.rotation.set(Math.PI / 2, 0, 0); c.scale.setScalar(1);
  }, fn: (e, M) => { M.hero.p.handR.getWorldPosition(M.hero.props.coin.position); } });
  tween(seq, 'flick', 90, Easing.inQuart, THROW_FLICK, { fn: (e, M) => { M.hero.p.handR.getWorldPosition(M.hero.props.coin.position); }, onExit: (M) => { M.from = M.from || V(); M.hero.p.handR.getWorldPosition(M.from); M.hero.spring.kick(-0.4); } });
  seq.phase('flight', 420, Easing.linear, (e, M, t) => {
    const c = M.hero.props.coin; c.position.lerpVectors(M.from, M.to, t); c.position.y += 1.2 * 4 * t * (1 - t); c.rotation.x = Math.PI / 2 + t * TAU * 3; c.rotation.z = t * 2;
  }, { onEnter: (M, ph) => { ph.state.from = snapPose(M.hero); } });
  seq.phase('arrive', 60, Easing.outCubic, (e, M, t, ph) => {
    const c = M.hero.props.coin; c.position.copy(M.to); c.scale.setScalar(Math.max(0.01, 1 - e)); c.rotation.x += 0.4;
    lerpPose(M.hero, ph.state.from, THROW_FLICK, 0, 0); M.hero.p.head.rotation.x = ph.state.from.head[0] + 0.18 * Math.sin(Math.PI * e);   // tiny nod on landing
  }, { onEnter: (M, ph) => {
    ph.state.from = snapPose(M.hero); ph.state.from.head = [...ph.state.from.head];
    sparks(M, M.to, 8, 3); pop(M, _a.copy(M.to).setY(0), '+1', { color: '#FFD54F', dur: 0.7, size: 0.8 });
    if (M.onArrive) M.onArrive(M.target, M.to.clone());
  }, onExit: (M) => { const c = M.hero.props.coin; c.visible = false; c.scale.setScalar(1); } });
  tween(seq, 'recovery', 200, Easing.outBack, REST, { cancellable: true, onEnter: (M) => { M.jellyOn = true; } });
  return seq;
}
HERO_MOVES.throwCoin = { build: buildThrowCoin, phases: [['windup', 160, 'outCubic'], ['flick', 90, 'inQuart'], ['flight', 420, 'linear·parabola'], ['arrive', 60, 'outCubic · sparks + onArrive'], ['recovery', 200, 'outBack']] };

// ---------- sad (P3) ----------
// | phase   | ms  | ease       | what                                                     |
// | droop   | 320 | outCubic   | head down, shoulders in, squash 0.9, arms hang           |
// | sigh    | 700 | inOutQuad  | slow breathe out: squash 0.9 → 0.86 → 0.9, head sways    |
// | recover | 360 | outBack    | rest                                                     |
const SAD_DROOP = POSE({ bs: [1.06, 0.9, 1.06], torso: [0.35, 0, 0], head: [0.55, 0, 0.1], armL: [0.3, 0, 0.1], armR: [0.3, 0, -0.1], sword: [0.8, 0, 0], legL: 0.05, legR: -0.05, scarf: -0.1 });
const SAD_SIGH = POSE({ bs: [1.09, 0.86, 1.09], torso: [0.42, 0, 0], head: [0.6, 0, -0.1], armL: [0.35, 0, 0.1], armR: [0.35, 0, -0.1], sword: [0.85, 0, 0], legL: 0.05, legR: -0.05, scarf: -0.05 });
function buildSad(M) {
  const seq = new Sequence('sad');
  tween(seq, 'droop', 320, Easing.outCubic, SAD_DROOP, { onEnter: (M) => { M.hero.setTool(null); pop(M, M.hero.root.position, '…', { color: '#90A4AE', dur: 1.0, size: 0.8 }); } });
  seq.phase('sigh', 700, Easing.inOutQuad, (e, M) => { const k = Math.sin(Math.PI * e); lerpPose(M.hero, SAD_DROOP, SAD_SIGH, k, 0); M.hero.p.head.rotation.z = Math.sin(e * TAU) * 0.08; },
    { onExit: (M) => { dust(M, M.hero.root.position, 2, { size: 0.1, speed: 0.4, dur: 0.4, up: 0.2 }); } });
  tween(seq, 'recover', 360, Easing.outBack, REST, { cancellable: true, onEnter: (M) => { M.jellyOn = true; M.hero.spring.kick(-0.3); } });
  return seq;
}
HERO_MOVES.sad = { build: buildSad, phases: [['droop', 320, 'outCubic'], ['sigh', 700, 'inOutQuad'], ['recover', 360, 'outBack']] };

// ---------- stunned (P3) ----------  3 gold stars orbit the head
// | phase   | ms  | ease       | what                                                             |
// | bonk    | 100 | outCubic   | squash 0.78, head knocked back, stars appear, hit-stop 40, shake |
// | wobble  | 900 | linear     | body sways (sin), eyes/head circle, stars orbit 2.5 turns        |
// | shake   | 220 | outBack    | head shakes it off (yaw ±), stars hidden                         |
// | recover | 200 | outBack    | rest                                                             |
const STUN_BONK = POSE({ bs: [1.18, 0.78, 1.18], torso: [-0.25, 0, 0], head: [-0.5, 0, 0], armL: [-0.6, 0, 1.0], armR: [-0.6, 0, -1.0], sword: [0.3, 0, 0], legL: 0.3, legR: -0.3, scarf: 0.4 });
const STUN_WOB = POSE({ bs: [1.02, 0.96, 1.02], torso: [0.1, 0, 0], head: [0.15, 0, 0], armL: [0.3, 0, 0.6], armR: [0.3, 0, -0.6], sword: [0.7, 0, 0], legL: 0.15, legR: -0.15, scarf: -0.2 });
function buildStunned(M) {
  const seq = new Sequence('stunned');
  tween(seq, 'bonk', 100, Easing.outCubic, STUN_BONK, { onEnter: (M) => { M.hero.setTool(null); M.hero.props.stars.visible = true; hitstop(M, 40); shake(M, 0.2); sparks(M, _a.copy(M.hero.root.position).setY(1.9), 5, 3); dust(M, M.hero.root.position, 4, { size: 0.16, speed: 1.2, dur: 0.35 }); M.hero.spring.kick(-1.0); } });
  seq.phase('wobble', 900, Easing.linear, (e, M, t, ph) => {
    const hero = M.hero, p = hero.p; lerpPose(hero, ph.state.from, STUN_WOB, Math.min(1, t * 4), M.jelly);
    p.body.rotation.z = Math.sin(t * TAU * 2.5) * 0.12 * (1 - t * 0.5); p.body.rotation.x += Math.cos(t * TAU * 2.5) * 0.08;
    p.head.rotation.y = Math.sin(t * TAU * 2.5) * 0.35; p.head.rotation.z = Math.cos(t * TAU * 2.5) * 0.2;
    const st = hero.props.stars; st.rotation.y = t * TAU * 2.5; st.position.y = 0.95 + Math.sin(t * TAU * 5) * 0.04;
    for (let i = 0; i < st.children.length; i++) st.children[i].rotation.y = t * TAU * 3 + i;
  }, { onEnter: (M, ph) => { ph.state.from = snapPose(M.hero); M.jellyOn = true; } });
  seq.phase('shake', 220, Easing.outBack, (e, M, t, ph) => { lerpPose(M.hero, ph.state.from, REST, e, M.jelly); M.hero.p.head.rotation.y = Math.sin(t * TAU * 2) * 0.4 * (1 - t); M.hero.props.stars.scale.setScalar(Math.max(0.01, 1 - t)); },
    { onEnter: (M, ph) => { ph.state.from = snapPose(M.hero); }, onExit: (M) => { M.hero.props.stars.visible = false; M.hero.props.stars.scale.setScalar(1); M.hero.props.stars.rotation.y = 0; pop(M, M.hero.root.position, '!', { color: '#FFD54F', dur: 0.5, size: 0.8 }); } });
  tween(seq, 'recover', 200, Easing.outBack, REST, { cancellable: true });
  return seq;
}
HERO_MOVES.stunned = { build: buildStunned, phases: [['bonk', 100, 'outCubic + hit-stop 40'], ['wobble', 900, 'linear·sin sway'], ['shake', 220, 'outBack'], ['recover', 200, 'outBack']] };

// ───────────────────────────── makeMove / attachMoves ─────────────────────────────
/** Build a fresh Sequence for `name`. ctx must contain { hero }. The same ctx object is what phase fns receive. */
export function makeMove(name, ctx) {
  const def = HERO_MOVES[name]; if (!def) throw new Error(`heroAnims: unknown move "${name}" (have ${Object.keys(HERO_MOVES).join(', ')})`);
  const M = prepCtx(ctx);
  const seq = def.build(M);
  if (def.loop) seq.setLoop(true);
  seq.moveName = name; seq.ctx = M;
  return seq;
}
function prepCtx(ctx) {
  const M = ctx; if (!M.hero) throw new Error('heroAnims: ctx.hero (HeroController) required');
  M.start = M.start || V(); M.dir0 = M.dir0 || V(); M.jelly = 0; M.jellyOn = false;
  return M;
}

/**
 * Give a HeroController the move API. Idempotent. Adds hidden props (hammer in weaponSlot, crate + stars on the rig, coin in scene).
 *   hero.playMove('hammer', { target?, onHit?, onArrive?, item?, dir? }) → Sequence|null
 *   hero.stopMove()  hero.dropCarry()  hero.setTool('hammer'|null)  hero.moveName  hero.currentMove  hero.carrying
 */
export function attachMoves(hero) {
  if (hero.playMove) return hero;
  const p = hero.p;
  hero.props = hero.props || {};
  hero.props.hammer = makeHammer(); p.weaponSlot.add(hero.props.hammer);
  hero.props.crate = makeCarryCrate(); p.torso.add(hero.props.crate);
  hero.props.stars = makeStars(); hero.props.stars.position.y = 0.95; p.head.add(hero.props.stars);
  hero.props.coin = makeCoin(); (hero.game && hero.game.scene ? hero.game.scene : hero.root.parent || hero.root).add(hero.props.coin);

  const M = { hero, vfx: hero.deps && hero.deps.vfx, game: hero.game };
  prepCtx(M);
  hero.moveCtx = M; hero.moves = {}; hero.currentMove = null; hero.moveName = null; hero.carrying = null; hero.tool = null;

  hero.setTool = (name) => {
    hero.tool = name;
    hero.sword.visible = name == null;
    hero.props.hammer.visible = name === 'hammer';
  };
  // finish(keepCarry): reset to idle. The carried item is dropped unless the move chains into another carry move (pickUp → carry).
  const finish = (keepCarry = false) => {
    hero.state = 'idle'; hero.currentMove = null; hero.moveName = null; hero.root.position.y = 0; hero.vel.set(0, 0, 0);
    hero.setTool(null); hero.props.stars.visible = false; hero.props.coin.visible = false; hero.props.coin.scale.setScalar(1);
    hero._restPose(); p.body.scale.set(1, 1, 1); p.body.position.y = 0; p.body.rotation.set(0, 0, 0); p.legL.rotation.x = p.legR.rotation.x = 0;
    if (!keepCarry && hero.carrying) hero.dropCarry();
  };
  hero.stopMove = () => { const s = hero.currentMove; if (s) { s.stop(); } if (hero.state === 'move') finish(); };
  hero.dropCarry = () => {
    const it = hero.carrying; if (!it) return;
    hero.carrying = null; it.visible = false; if (it.parent) it.parent.remove(it);
    if (it !== hero.props.crate && hero.props.coin.parent) hero.props.coin.parent.add(it); // give a custom item back to the scene (hidden)
    dust(M, hero.root.position, 3, { size: 0.14, speed: 0.9, dur: 0.3 });
  };
  hero.playMove = (name, opts = {}) => {
    const def = HERO_MOVES[name]; if (!def) return null;
    if (hero.state === 'attack' && hero.attack && !hero.attack.canCancel) return null;
    if (hero.currentMove && !hero.currentMove.canCancel) return null;
    if (hero.currentMove) hero.currentMove.stop();
    if (hero.state === 'attack' && hero.attack) hero.attack.stop();
    if (hero.carrying && !def.keepsCarry) hero.dropCarry();
    for (const k of ['target', 'onHit', 'onArrive', 'item', 'dir', 'dashDist', 'count']) M[k] = opts[k] !== undefined ? opts[k] : null;
    M.jelly = 0; M.jellyOn = false;
    const seq = hero.moves[name] || (hero.moves[name] = makeMove(name, M));
    hero.state = 'move'; hero.currentMove = seq; hero.moveName = name;
    seq.then(() => { if (hero.currentMove === seq) { finish(!!def.after && !!hero.carrying); if (def.after) def.after(hero, M); } });
    if (hero.game && hero.game.sequences) hero.game.sequences.play(seq, M); else seq.play(M);
    return seq;
  };

  // Take over HeroController.update while a move plays (HeroController is frozen; it does not know 'move').
  const baseUpdate = hero.update.bind(hero);
  hero.update = (dt) => {
    if (hero.state !== 'move') { baseUpdate(dt); return; }
    const seq = hero.currentMove; const def = seq && HERO_MOVES[seq.moveName];
    if (!seq || !seq.playing) { finish(); return; }
    hero.t += dt; hero.vel.set(0, 0, 0);
    const inp = hero.game && hero.game.input;
    // cancel a cancellable tail by moving / attacking → snappy controls
    if (inp && seq.canCancel && !def.loop && ((inp.move && inp.move.lengthSq() > 0.1) || (inp.pressed && inp.pressed('attack')))) { hero.stopMove(); baseUpdate(dt); return; }
    const s = hero.spring.update(dt); M.jelly = M.jellyOn ? s * 0.6 : 0;
    if (def && def.allowMove && inp && inp.move) moveWhileAnimating(hero, inp.move, dt, def.moveSpeed || 0.7);
    if (seq.moveUpdate) seq.moveUpdate(dt, M);
    p.shadow.scale.set(p.body.scale.x, 1, p.body.scale.z);
  };
  return hero;
}
/** Simplified locomotion for loop moves that allow walking (carry): slower, no leg anim (the move owns the legs). */
function moveWhileAnimating(hero, mv, dt, speedMul) {
  if (mv.lengthSq() < 0.001) return;
  _a.set(mv.x, 0, -mv.y); const sp = hero.speed * speedMul * Math.min(1, _a.length()); _a.normalize();
  const nx = hero.root.position.x + _a.x * sp * dt, nz = hero.root.position.z + _a.z * sp * dt;
  if (!hero.deps || !hero.deps.isLand || hero.deps.isLand(nx, nz)) { hero.root.position.x = nx; hero.root.position.z = nz; }
  const yaw = Math.atan2(_a.x, _a.z); let d = ((yaw - hero.facing + Math.PI) % TAU + TAU) % TAU - Math.PI;
  hero.facing += d * (1 - Math.exp(-14 * dt)); hero.root.rotation.y = hero.facing;
  hero.vel.set(_a.x * sp, 0, _a.z * sp);
}
export const MOVE_NAMES = () => Object.keys(HERO_MOVES);
