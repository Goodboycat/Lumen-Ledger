// src/combat/Combat.js — 16B P1 (S43): hero ↔ enemy resolver. 3-hit sword combo with input buffering + facing-aware soft lock-on.
//
//   createCombat({ hero, game, targets, bus }) → { update(dt), attack(), lockOn(), target, combo: 0..3, step, destroy() }
//   installCombat(sb, game) → sets sb.hero.combat (HeroController.doAttack() routes to combat.attack() when installed).
//
// Combo (phase table, ms — anticipate / strike / recover · power · knockback × ENEMY_RULES.knockback):
//   slash1  120 /  90 / 260   power 1   ×1.0   overhead → forehand sweep (the S0 reference swing, shortened)
//   slash2  100 /  90 / 240   power 1   ×1.0   horizontal BACKHAND (torso swings the other way)
//   slash3  180 / 140 / 420   power 2   ×2.0   SPIN — full 360°, hits everything in 2.6 u, bigger hit-stop
// Input buffering: a press during anticipate/strike is queued and fires the next step when `recovery` begins; a press DURING recovery
//   cancels it into the next step at once (recovery is the cancellable phase). The chain window is the recovery itself (≤ BUFFER_MS = 350 ms
//   of it is accepted); when recovery runs out with no press the combo resets to 0.
// Hit rules: `Hitbox.arc` = targets inside RANGE and within the ±55° cone (slash3: 360°), measured from Pip's PRE-lunge position (16A), point-blank
//   (< 0.9 u) always hits. Each target is hit ONCE per step → `t.hit(dir, power)` (enemies: knockback × power, hp −1; Glimmers only wobble →
//   `cust:bonked`, they are never damaged). On any hit: game.hitstop(60 | 90 on slash3), camera.shake, sparks + 'POW!' pop, in-world slash ribbon.
//   NO ScreenFlash anywhere (15A / 16B rule) — the only visuals are in-world.
// Lock-on (soft): every frame outside an attack, the nearest *enemy* target within LOCK_RANGE = 5 u and ±70° of the stick direction (or Pip's facing
//   when the stick is idle) becomes `combat.target`; HeroController faces it while walking (strafe) and every strike auto-aims at it.
//   Changes emit `combat:lock { id | null }`.
// Bus: `combat:hit { id, combo, power }` · `combat:miss { combo }` · `combat:combo { n }` · `combat:lock { id | null }`
import * as THREE from '../../vendor/three.module.js';
import { Sequence } from '../anim/Sequencer.js';
import { Easing } from '../anim/Easing.js';

export const COMBO_STEPS = [
  { name: 'slash1', ant: 120, strike: 90, recover: 260, power: 1, range: 2.4, cone: 0.35, lunge: 0.4, hitstop: 60, shake: 0.28 },
  { name: 'slash2', ant: 100, strike: 90, recover: 240, power: 1, range: 2.4, cone: 0.35, lunge: 0.35, hitstop: 60, shake: 0.3 },
  { name: 'slash3', ant: 180, strike: 140, recover: 420, power: 2, range: 2.6, cone: -1, lunge: 0.5, hitstop: 90, shake: 0.45 },
];
export const BUFFER_MS = 350;
export const LOCK_RANGE = 5, LOCK_COS = Math.cos((70 * Math.PI) / 180);
const POINT_BLANK = 0.9;
const lerp = (a, b, t) => a + (b - a) * t;
const _dir0 = new THREE.Vector3(), _d = new THREE.Vector3(), _c = new THREE.Vector3(), _t = new THREE.Vector3();

// S77-SW keyframes (hero frame; ty/tx = torso yaw/pitch, ax/az = right-arm x/z, sx = sword pitch). Solved with tools/sword_solve.mjs so the BLADE TIP lands where the move says:
//   s1 forehand : tip high behind the sword shoulder -> sweeps through the front at head height -> ends low across the body (left)
//   s2 backhand : starts low-left where s1 ended -> sweeps through the front at chest height -> finishes wide on the sword side
//   th thrust   : elbow back, blade level beside the hip -> arm straight, point forward at chest height (a lunge; picked when the target is > 1.6 u away)
export const KF = {
  s1: [{ ty: 1.04, tx: -0.05, ax: -0.6, az: -0.76, sx: 1.26 }, { ty: 0.14, tx: 0.1, ax: -0.53, az: -0.77, sx: 1.52 }, { ty: -0.28, tx: 0.15, ax: -0.44, az: -0.77, sx: 1.6 }, { ty: -0.66, tx: 0.2, ax: -0.31, az: -0.78, sx: 1.62 }, { ty: -1.13, tx: 0.25, ax: -0.16, az: -0.73, sx: 1.69 }],   // S78: 5 chained keys (solver 'chain' mode) - no mid-strike tip dip
  s2: [{ ty: -1.09, tx: 0.1, ax: 0, az: 0.54, sx: 1.31 }, { ty: -0.88, tx: 0.12, ax: -0.17, az: 0.62, sx: 1.53 }, { ty: -0.63, tx: 0.15, ax: -0.36, az: 0.61, sx: 1.81 }, { ty: -0.15, tx: 0.18, ax: -0.45, az: 0.44, sx: 1.79 }, { ty: 0.49, tx: 0.2, ax: -0.34, az: 0.19, sx: 1.61 }],   // S78: re-solved with POST-clearance angles (no solveArmClearance pop)
  th: [{ ty: 0.35, tx: 0.1, ax: 0.35, az: -0.2, sx: 1.45 }, { ty: -0.2, tx: 0.2, ax: -1.45, az: -0.15, sx: 2.95 }],
};
const REST_K = { ty: 0, tx: 0, ax: -0.15, az: -0.35, sx: 0.35 };
const mixK = (a, b, e) => ({ ty: a.ty + (b.ty - a.ty) * e, tx: a.tx + (b.tx - a.tx) * e, ax: a.ax + (b.ax - a.ax) * e, az: a.az + (b.az - a.az) * e, sx: a.sx + (b.sx - a.sx) * e });
export const THRUST_STEP = { name: 'thrust', ant: 140, strike: 110, recover: 280, power: 1, range: 3.1, cone: 0.55, lunge: 1.0, hitstop: 60, shake: 0.3 };

export function createCombat({ hero, game, targets, bus }) {
  const p = hero.p; const vfx = () => hero.deps.vfx || {};
  const C = { hero, combo: 0, step: -1, target: null, targetId: null, buffered: false, playing: false, seqs: [], stats: { hits: 0, misses: 0, combos3: 0 }, lockEnabled: true };
  const S = { dir: new THREE.Vector3(0, 0, 1), start: new THREE.Vector3(), reach: 0.46, hitDone: false, hitSet: new Set(), step: null, spin0: 0 };
  const allTargets = () => (targets ? targets() : (hero.deps.targets ? hero.deps.targets() : []));
  const capK = () => ({ ty: p.torso.rotation.y, tx: p.torso.rotation.x, ax: p.armR.rotation.x, az: p.armR.rotation.z, sx: hero.sword.rotation.x });
  const putK = (k) => { p.torso.rotation.y = k.ty; p.torso.rotation.x = k.tx; p.armR.rotation.set(k.ax, 0, k.az); hero.sword.rotation.set(k.sx, 0, 0); };
  const idOf = (t) => t?.enemy ? (t.enemy.id ?? `${t.enemy.kind}${t.enemy.i ?? ''}`) : (t?.cust ? `cust${t.cust.id ?? ''}` : null);

  // ---- aiming: lock target first, else nearest target within 2.6 u (16A behaviour), else keep facing
  function aim(outDir) {
    const o = hero.root.position; let best = null, bd = 2.6;
    if (C.target && C.target.root) { const d = _t.copy(C.target.root.position).sub(o).setY(0).length(); if (d <= LOCK_RANGE + 0.5) { best = C.target; bd = d; } }
    if (!best) for (const t of allTargets()) { const d = _t.copy(t.root.position).sub(o).setY(0).length(); if (d < bd) { bd = d; best = t; } }
    if (best && bd > 1e-3) outDir.copy(best.root.position).sub(o).setY(0).normalize();
    else outDir.set(Math.sin(hero.facing), 0, Math.cos(hero.facing));
    return best;
  }

  // ---- Hitbox.arc + resolve
  function impact(st) {
    const g = game, v = vfx(); let hits = 0; const o = hero.root.position;
    for (const t of allTargets()) {
      if (S.hitSet.has(t.root)) continue;
      _d.copy(t.root.position).sub(o).setY(0); const d = _d.length(); if (d > st.range) continue;
      if (st.cone >= 0 && d > POINT_BLANK) { _c.copy(t.root.position).sub(S.start).setY(0); if (_c.lengthSq() > 1e-6 && _c.normalize().dot(S.dir) < st.cone) continue; }
      if (d < 1e-3) _d.copy(S.dir); else _d.normalize();
      S.hitSet.add(t.root); t.hit(_d, st.power); hits++; C.stats.hits++;
      if (t.cust) bus?.emit('cust:bonked', { id: idOf(t), combo: C.combo });
      bus?.emit('combat:hit', { id: idOf(t), combo: C.combo, power: st.power, enemy: !!t.enemy });
      v.sparks?.burst?.(_t.copy(t.root.position).setY(0.8), 8 + 6 * st.power, 5);
      v.pop?.show?.(t.root.position, C.combo === 3 ? 'WHAM!!' : ['POW!', 'BONK!'][C.combo % 2], { color: C.combo === 3 ? '#FF8A65' : '#FFD54F' });
    }
    if (hits) { g.hitstop?.(st.hitstop); g.camera?.shake?.(st.shake); hero.combo = (hero.combo || 0) + 1; }
    else { C.stats.misses++; g.camera?.shake?.(0.08); v.dust?.burst?.(_t.copy(o).addScaledVector(S.dir, 1.2).setY(0), 3, { size: 0.15, speed: 1, dur: 0.3 }); bus?.emit('combat:miss', { combo: C.combo }); }
  }

  // ---- shared phase scaffolding (anticipate → strike → recovery); the pose fns differ per step
  function build(i, variant) {
    const st = variant === 'thrust' ? THRUST_STEP : COMBO_STEPS[i], seq = new Sequence(st.name); seq.ctx = S;
    const enter = () => {
      S.hitDone = false; S.hitSet.clear(); S.step = st;
      aim(S.dir); hero.root.rotation.y = Math.atan2(S.dir.x, S.dir.z); hero.facing = hero.root.rotation.y; S.spin0 = hero.facing;
      S.start.copy(hero.root.position); S.reach = hero.landReach ? hero.landReach(S.dir, st.lunge + 0.06) : st.lunge;
      vfx().dust?.burst?.(hero.root.position, i === 2 ? 7 : 4, { size: 0.18, speed: 1.2, dur: 0.35 });
    };
    const strikeEnter = () => { vfx().slash?.fire?.(hero.root.position, S.dir, { dur: i === 2 ? 0.2 : 0.12, scale: i === 2 ? 1.2 : 1.0, blade: hero.sword }); };
    const lungeTo = (f) => hero.root.position.copy(S.start).addScaledVector(S.dir, Math.min(S.reach, st.lunge * Math.min(1.05, f)));
    if (i === 0 || i === 1 || variant === 'thrust') {
      // S77-SW: keyframed from tools/sword_solve.mjs (blade-tip targets in Pip's frame). The old poses snapped the blade through the body in 2 frames;
      // now: wind-up (from WHATEVER pose Pip is in, so chains flow) -> strike through 3 keys (ease in-out, hit when the blade is in front) -> settle.
      const K = variant === 'thrust' ? KF.th : i === 0 ? KF.s1 : KF.s2, wind = K[0], end = K[K.length - 1];
      const at = (e) => { const n = K.length - 1, f = Math.min(n - 1e-6, Math.max(0, e * n)), j = Math.floor(f); return mixK(K[j], K[j + 1], f - j); };   // S78: piecewise over any number of keys
      const squash = (a0, a1, e) => p.body.scale.set(lerp(a0[0], a1[0], e), lerp(a0[1], a1[1], e), lerp(a0[2], a1[2], e));
      const thr = variant === 'thrust';
      seq.phase('anticipation', st.ant, Easing.outCubic, (e) => { putK(mixK(S.from || wind, wind, e)); squash([1, 1, 1], thr ? [0.95, 0.9, 1.12] : [1.08, 0.88, 1.08], e); p.head.rotation.y = lerp(0, thr ? 0.1 : -0.35 * Math.sign(wind.ty || 1), e); p.armL.rotation.set(lerp(0.1, thr ? 0.5 : -0.4, e), 0, lerp(0.35, 0.6, e)); }, { onEnter: () => { enter(); S.from = capK(); } });
      seq.phase('strike', st.strike, Easing.inOutCubic, (e, _, t) => { putK(at(e)); squash(thr ? [0.95, 0.9, 1.12] : [1.08, 0.88, 1.08], thr ? [0.88, 0.92, 1.28] : [0.9, 0.92, 1.2], e); lungeTo(thr ? Math.min(1, e * 1.4) : e); p.armL.rotation.set(lerp(thr ? 0.5 : -0.4, 0.6, e), 0, lerp(0.6, 0.9, e)); p.head.rotation.y = lerp(thr ? 0.1 : -0.35 * Math.sign(wind.ty || 1), 0.1, e); if (!S.hitDone && t >= (thr ? 0.6 : 0.48)) { S.hitDone = true; impact(st); } vfx().slash?.track?.(); }, { onEnter: strikeEnter });
      seq.phase('recovery', st.recover, Easing.outCubic, (e) => { putK(mixK(S.endPose || end, REST_K, e)); squash(thr ? [0.88, 0.92, 1.28] : [0.9, 0.92, 1.2], [1, 1, 1], e); p.armL.rotation.set(lerp(0.6, 0.1, e), 0, lerp(0.9, 0.35, e)); p.head.rotation.y = lerp(0.1, 0, e); if (e < 0.3) vfx().slash?.track?.(); else vfx().slash?.release?.(); }, { onEnter: () => { S.endPose = capK(); /* S78: blend from the pose the player SEES (after arm-clearance), not the raw key */ hero.spring?.set?.(0.08); hero.spring?.kick?.(thr ? -1.3 : -1.1); recoverEnter(); }, cancellable: true });
    } else {
      // spin: deep crouch, then the whole root turns 360° with the blade held out flat; hop on the way round
      seq.phase('anticipation', st.ant, Easing.outCubic, (e) => { p.body.scale.set(lerp(1, 1.15, e), lerp(1, 0.78, e), lerp(1, 1.15, e)); p.torso.rotation.y = lerp(0.15, 1.2, e); p.torso.rotation.x = lerp(0, 0.1, e); p.armR.rotation.set(lerp(-0.3, -0.78, e), 0, lerp(-0.3, -0.4, e)); hero.sword.rotation.set(lerp(0.4, 2.25, e), 0, 0);   /* S78: solver sp_out2 - blade flat, out to the side */ p.armL.rotation.set(lerp(0.1, -0.8, e), 0, lerp(0.35, 0.8, e)); p.head.rotation.y = lerp(0, -0.5, e); }, { onEnter: enter });
      seq.phase('strike', st.strike, Easing.inOutCubic, (e, _, t) => { const hop = Math.sin(Math.PI * Math.min(1, e)); p.body.scale.set(lerp(1.15, 0.95, e), lerp(0.78, 1.1, e), lerp(1.15, 0.95, e)); p.body.position.y = hop * 0.25; lungeTo(e); hero.root.rotation.y = S.spin0 + Math.PI * 2 * e; p.torso.rotation.y = lerp(1.2, 0.9, e); p.torso.rotation.x = 0.1; p.armR.rotation.set(-0.78, 0, -0.4); hero.sword.rotation.set(2.25, 0, 0); p.armL.rotation.set(-0.8, 0, lerp(0.8, 1.1, e)); p.head.rotation.y = lerp(-0.5, 0.3, e); if (!S.hitDone && t >= 0.5) { S.hitDone = true; impact(st); } vfx().slash?.track?.(); }, { onEnter: strikeEnter });
      seq.phase('recovery', st.recover, Easing.outCubic, (e) => { hero.root.rotation.y = S.spin0; hero.facing = S.spin0; p.body.scale.set(lerp(0.95, 1, e), lerp(1.1, 1, e), lerp(0.95, 1, e)); p.body.position.y = lerp(0.25 * 0, 0, e); p.torso.rotation.y = lerp(0.9, 0, e); p.torso.rotation.x = lerp(0.1, 0, e); p.armR.rotation.set(lerp(-0.78, -0.15, e), 0, lerp(-0.4, -0.35, e)); hero.sword.rotation.set(lerp(2.25, 0.35, e), 0, 0); p.armL.rotation.set(lerp(-0.8, 0.1, e), 0, lerp(1.1, 0.35, e)); p.head.rotation.y = lerp(0.3, 0, e); if (e < 0.25) vfx().slash?.track?.(); else vfx().slash?.release?.(); }, { onEnter: () => { hero.spring?.set?.(0.1); hero.spring?.kick?.(-1.4); recoverEnter(); }, cancellable: true });
    }
    seq.then(() => finish(i));
    return seq;
  }
  // a press that arrived during anticipate/strike fires now (start of recovery) — the "buffered" chain
  function recoverEnter() { if (C.buffered && C.step < 2) { C.buffered = false; C._chainNext = true; } }   // pollChain() (next hero.update) stops this seq and starts the next step
  function finish(i) {
    C.playing = false;
    if (C.step === i && C.step < 2 && C._chainNext) { C._chainNext = false; return start(i + 1); }
    C._chainNext = false; C.buffered = false; C.step = -1; C.combo = 0;
    hero.state = 'idle'; hero.attack = hero._swordAttack || hero.attack; hero._restPose?.(); vfx().slash?.release?.();
  }
  function start(i) {
    if (i === 0) { const tgt = aim(_dir0); const d = tgt ? _t.copy(tgt.root.position).sub(hero.root.position).setY(0).length() : 0; C.seqs[0] = tgt && d > 1.6 ? C.thrustSeq : C.slashSeq; }   // S77-SW: a target farther than 1.6 u = lunge THRUST, closer = forehand SLASH
    const seq = C.seqs[i]; C.step = i; C.combo = i + 1; C.playing = true; C.buffered = false; C._chainNext = false;
    if (hero.state !== 'attack') hero.recoverToLand?.();
    hero.state = 'attack'; hero.attack = seq;                 // HeroController reads attack.currentName / canCancel for its spring layer
    bus?.emit('combat:combo', { n: C.combo }); if (C.combo === 3) C.stats.combos3++;
    game.sequences.play(seq, S);
    return true;
  }
  for (let i = 0; i < 3; i++) C.seqs.push(build(i));
  C.slashSeq = C.seqs[0]; C.thrustSeq = build(0, 'thrust');

  /** Attack press. idle → slash1 · during anticipate/strike → buffered · during recovery → cancel into next step · after slash3 → nothing until it ends. */
  C.attack = function attack() {
    if (!C.playing) return start(0);
    const seq = C.seqs[C.step]; const cur = seq.currentName;
    if (C.step >= 2) return false;
    if (cur === 'recovery') { if (seq.time * 1000 <= BUFFER_MS + 1e-3) { seq.stop(); C.playing = false; return start(C.step + 1); } return false; }
    C.buffered = true; return true;
  };
  // the chain decision must happen when recovery STARTS, not at its end — poll it in update() (Sequence has no onPhase hook per phase here)
  function pollChain() {
    if (!C.playing) return; const seq = C.seqs[C.step];
    if (C._chainNext && seq.currentName === 'recovery') { C._chainNext = false; seq.stop(); C.playing = false; start(C.step + 1); }
  }

  /** Soft lock-on: nearest ENEMY target within LOCK_RANGE and ±70° of the stick direction (facing when idle). */
  C.lockOn = function lockOn(force) {
    let best = null, bd = LOCK_RANGE; const o = hero.root.position;
    if (C.lockEnabled || force) {
      const mv = game.input?.move; let dx, dz;
      if (mv && (mv.x * mv.x + mv.y * mv.y) > 0.01) { const l = Math.hypot(mv.x, mv.y); dx = mv.x / l; dz = -mv.y / l; } else { dx = Math.sin(hero.facing); dz = Math.cos(hero.facing); }
      for (const t of allTargets()) {
        if (!t.enemy) continue;
        _t.copy(t.root.position).sub(o).setY(0); const d = _t.length(); if (d >= bd || d < 1e-3) continue;
        if (d > POINT_BLANK && (_t.x * dx + _t.z * dz) / d < LOCK_COS) continue;
        bd = d; best = t;
      }
    }
    const id = idOf(best);
    if (id !== C.targetId) { C.targetId = id; C.target = best; bus?.emit('combat:lock', { id }); } else C.target = best;
    return best;
  };
  C.update = function update(dt) { pollChain(); if (!C.playing) C.lockOn(); };
  C.destroy = function destroy() { for (const s of C.seqs) s.stop(); C.playing = false; C.target = null; C.targetId = null; hero.combat = null; hero.attack = hero._swordAttack || hero.attack; };
  return C;
}

/** Game.js hook: hero targets = enemies ∪ customers ∪ helpers (sb.hero.deps.targets already merges them). Installs on sb.hero and returns the combat. */
export function installCombat(sb, game) {
  const hero = sb.hero; if (!hero) return null;
  hero._swordAttack = hero._swordAttack || hero.attack;
  const combat = createCombat({ hero, game, bus: game.bus, targets: () => (hero.deps.targets ? hero.deps.targets() : []) });
  hero.combat = combat; sb.combat = combat;
  return combat;
}
