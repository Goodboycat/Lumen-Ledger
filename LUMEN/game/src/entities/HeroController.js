// HeroController: locomotion (idle breathe, hop-walk, turn), landing settle spring,
// and the REFERENCE sword attack built exactly to the spec with the Sequencer.
// Hero Animation chat adds more Sequences in src/anim/heroAnims.js using the same patterns.
import * as THREE from '../../vendor/three.module.js';
import { Sequence } from '../anim/Sequencer.js';
import { Easing, damp, lerp } from '../anim/Easing.js';
import { setSquash, JellySpring, walkBob } from '../anim/SquashStretch.js';
import { makeHero, makeSword } from '../assets/hero.js';

const _dir = new THREE.Vector3(), _tmp = new THREE.Vector3();

// ---------------- arm ↔ chest clearance ----------------
// Chest = G.rbox(0.62, 0.62, 0.46) (hero.js) → half extents below, + a small skin gap. Test spheres per arm (arm-local, under the
// 'armSplay' group): elbow-ish point of the capsule and the hand. Sword: grip, guard and 4 points along the blade (sword-local).
const CHEST_HALF = new THREE.Vector3(0.31 + 0.015, 0.31 + 0.015, 0.23 + 0.015);
const ARM_PTS = [[new THREE.Vector3(0, -0.22, 0), 0.1], [new THREE.Vector3(0, -0.44, 0), 0.13]];
const SWORD_PTS = [[0, 0, 0.05], [0, 0.18, 0.05]];                                       // grip + guard (x, y, r)
for (const y of [0.23, 0.4, 0.6, 0.8, 1.0, 1.17]) for (const x of [-0.07, 0.07]) SWORD_PTS.push([x, y, 0.025]);   // blade edges
for (const q of SWORD_PTS) q.splice(0, 3, new THREE.Vector3(q[0], q[1], 0), q[2]);
const _inv = new THREE.Matrix4(), _p = new THREE.Vector3();
function boxDepth(obj, local, r) {          // penetration of a sphere (obj-local point, radius) into the chest box, chest-local; 0 = clear
  _p.copy(local).applyMatrix4(obj.matrixWorld).applyMatrix4(_inv);
  const dx = CHEST_HALF.x + r - Math.abs(_p.x), dy = CHEST_HALF.y + r - Math.abs(_p.y), dz = CHEST_HALF.z + r - Math.abs(_p.z);
  return dx > 0 && dy > 0 && dz > 0 ? Math.min(dx, dy, dz) : 0;
}
function armDepth(arm, sword) {
  arm.updateMatrixWorld(true);
  const seg = arm.children[0] || arm; let d = 0;
  for (const [pt, r] of ARM_PTS) d = Math.max(d, boxDepth(seg, pt, r));
  if (sword && sword.visible) for (const [pt, r] of SWORD_PTS) d = Math.max(d, boxDepth(sword, pt, r));
  return d;
}
/** Push arms (outward / forward) and tilt the sword out of the chest. Cheap: ≤ 24 tiny steps per arm, only while penetrating. */
export function solveArmClearance(hero) {
  const p = hero.p; if (!p || !p.chest) return;
  p.torso.updateMatrixWorld(true); _inv.copy(p.chest.matrixWorld).invert();
  const STEP = 0.05, EPS = 0.004;
  for (const [arm, side, sword] of [[p.armL, -1, null], [p.armR, 1, hero.sword]]) {
    let d = armDepth(arm, sword); if (d < EPS) continue;
    for (let i = 0; i < 24 && d >= EPS; i++) {
      // candidates: splay the arm out (z), swing it forward (x), tilt the blade forward / back (sword only). Keep the best.
      const tries = [[arm.rotation, 'z', side * STEP], [arm.rotation, 'x', -STEP]];
      if (sword && sword.visible) tries.push([sword.rotation, 'x', STEP], [sword.rotation, 'x', -STEP]);
      let best = null, bestD = d;
      for (const t of tries) { t[0][t[1]] += t[2]; const dd = armDepth(arm, sword); t[0][t[1]] -= t[2]; if (dd < bestD - 1e-5) { bestD = dd; best = t; } }
      if (!best) { arm.rotation.z += side * STEP; d = armDepth(arm, sword); continue; }   // stuck → just splay out
      best[0][best[1]] += best[2]; d = bestD;
    }
  }
}

export class HeroController {
  /**
   * @param {import('../core/Game.js').Game} game
   * @param {{vfx:any, targets:()=>Array<{root:THREE.Object3D, hit:(dir:THREE.Vector3, power:number)=>void}>, isLand?:(x:number,z:number)=>boolean}} deps
   */
  constructor(game, deps) {
    this.game = game; this.deps = deps;
    this.root = makeHero(); this.p = this.root.userData.parts;
    this.sword = makeSword(); this.p.weaponSlot.add(this.sword);
    this.sword.rotation.set(0, 0, 0); // blade up by default (idle pose adjusts)
    game.scene.add(this.root);
    // BUGFIX (arms + sword inside the stomach): every animation (attack, build, celebrate, abilities…) writes arm/sword rotations
    // absolutely; this runs AFTER all of them (lateUpdate = after Sequences/Tweens) and nudges each arm (and the sword tilt) the
    // minimum needed so hands, forearms and blade stay outside the chest box. Poses that are already clear are untouched.
    // BUGFIX B05: keep a handle so destroySandbox can unregister it (it used to leak one system + the whole hero per run)
    this._lateSystem = game.add({ lateUpdate: () => { if (this.root.visible !== false) solveArmClearance(this); } });

    this.speed = 5.2;
    this.vel = new THREE.Vector3();
    this.facing = 0;               // yaw
    this.walkPhase = 0; this.moving = false;
    this.spring = new JellySpring(240, 13);
    this.t = 0;
    this.state = 'idle';           // idle | walk | attack
    this.attack = this._buildSwordAttack();
    this.pose = { torsoYaw: 0, torsoPitch: 0, armR: new THREE.Euler(), armL: new THREE.Euler(), swordRoll: 0, lunge: 0, stretchAlong: 1, stretchAcross: 1, squash: 1, headTilt: 0 };
    this._restPose();
    this.combo = 0;
    // S18 cinematics: when set, `inputOverride` replaces the player's stick for locomotion. It is `{ move: Vector2-like {x,y} }` in
    // the same screen-relative space as game.input.move (y>0 = up/−z); attack/ability presses are ignored while it is set. The
    // CinematicDirector writes it each frame to walk Pip from the pier to the plaza and clears it with null. No AI, no pathing.
    this.inputOverride = null;
  }

  get position() { return this.root.position; }

  _restPose() {
    const p = this.p;
    p.armR.rotation.set(-0.15, 0, -0.35);  // sword resting low at side
    p.armL.rotation.set(0.1, 0, 0.35);
    this.sword.rotation.set(0.35, 0, 0);
    p.torso.rotation.set(0, 0, 0);
    p.head.rotation.set(0, 0, 0);
  }

  // ---------------- SWORD ATTACK — spec-exact ----------------
  _buildSwordAttack() {
    const p = this.p, hero = this;
    const seq = new Sequence('swordAttack');
    // Shared per-attack scratch
    // BUGFIX P11: S.reach = how far the lunge may travel along S.dir and still be on land (0.46 u nominal). Both the strike and the
    // follow-through used to write hero.root.position without consulting deps.isLand, so a slash facing the shore pushed Pip past the
    // 0.5 u tile boundary into water, where every single-frame walk step was rejected → permanent soft-lock.
    const S = { dir: new THREE.Vector3(0, 0, 1), start: new THREE.Vector3(), target: null, hitDone: false, reach: 0.46 };
    seq.ctx = S;

    // --- Anticipation 200 ms: squash (scaleY .85, scaleXZ 1.1), sword pulled back, dust puff. Ease-out.
    seq.phase('anticipation', 200, Easing.outCubic, (e) => {
      p.body.scale.set(lerp(1, 1.1, e), lerp(1, 0.85, e), lerp(1, 1.1, e));
      p.armR.rotation.set(lerp(-0.15, -0.9, e), 0, lerp(-0.35, 0.3, e));      // pull back & up
      hero.sword.rotation.set(lerp(0.35, -0.6, e), 0, lerp(0, 0.4, e));
      p.torso.rotation.y = lerp(0, 0.35, e);
      p.torso.rotation.x = lerp(0, 0.12, e);
      p.head.rotation.y = lerp(0, -0.25, e);                                     // eyes on target
      p.armL.rotation.set(lerp(0.1, -0.5, e), 0, lerp(0.35, 0.6, e));
    }, { onEnter: () => {
      S.hitDone = false;
      S.target = hero._pickTarget(S.dir);
      hero.root.rotation.y = Math.atan2(S.dir.x, S.dir.z); hero.facing = hero.root.rotation.y;
      S.start.copy(hero.root.position);
      S.reach = hero.landReach(S.dir, 0.46);
      hero.deps.vfx.dust.burst(hero.root.position, 4, { size: 0.18, speed: 1.2, dur: 0.35 });
    }, cancellable: false });

    // --- Wind-up 100 ms: torso rotates away from target, sword behind. Ease-in-out.
    seq.phase('windup', 100, Easing.inOutCubic, (e) => {
      p.body.scale.set(lerp(1.1, 1.08, e), lerp(0.85, 0.88, e), lerp(1.1, 1.08, e));
      p.torso.rotation.y = lerp(0.35, 0.95, e);                                  // away from target
      p.torso.rotation.x = lerp(0.12, 0.05, e);
      p.armR.rotation.set(lerp(-0.9, -1.6, e), 0, lerp(0.3, 0.9, e));            // sword behind, high
      hero.sword.rotation.set(lerp(-0.6, -1.1, e), 0, lerp(0.4, 0.2, e));
      p.head.rotation.y = lerp(-0.25, -0.6, e);
    });

    // --- Strike 100 ms: ease-in w/ overshoot. Stretch along strike dir (1.2 / 0.9), lunge 0.4u, sword sweeps ~160°.
    seq.phase('strike', 100, Easing.strike, (e, S, t) => {
      // stretch along strike direction: body yaw == strike dir, so z is "along"
      const along = lerp(1.08, 1.2, Math.min(1, e)), across = lerp(0.88, 0.9, Math.min(1, e));
      p.body.scale.set(across, across, along);
      // lunge 0.4 units toward target
      hero.root.position.copy(S.start).addScaledVector(S.dir, Math.min(S.reach, 0.4 * Math.min(1.05, e)));
      // torso swings through: +0.95 → -0.75 (≈ 97° torso) + arm sweep makes ~160° blade arc
      p.torso.rotation.y = lerp(0.95, -0.75, e);
      p.torso.rotation.x = lerp(0.05, 0.35, e);                                  // lean into it
      p.armR.rotation.set(lerp(-1.6, -1.35, e), 0, lerp(0.9, -1.1, e));
      hero.sword.rotation.set(lerp(-1.1, 0.55, e), 0, lerp(0.2, -0.3, e));
      p.armL.rotation.set(lerp(-0.5, 0.6, e), 0, lerp(0.6, 0.9, e));
      p.head.rotation.y = lerp(-0.6, 0.15, e);
      // Impact at ~60 % of strike
      if (!S.hitDone && t >= 0.6) { S.hitDone = true; hero._impact(S); }
    }, { onEnter: () => {
      hero.deps.vfx.slash.fire(hero.root.position, S.dir, { dur: 0.12, scale: 1.05 });
    } });

    // --- Follow-through 200 ms: sword overshoots then decelerates (ease-out cubic). Small squash settle.
    seq.phase('follow', 200, Easing.outCubic, (e) => {
      p.body.scale.set(lerp(0.9, 1.04, e), lerp(0.9, 0.94, e), lerp(1.2, 1.0, e));
      p.torso.rotation.y = lerp(-0.75, -1.0, e);                                 // overshoot a bit more
      p.torso.rotation.x = lerp(0.35, 0.2, e);
      p.armR.rotation.set(lerp(-1.35, -0.9, e), 0, lerp(-1.1, -1.3, e));
      hero.sword.rotation.set(lerp(0.55, 0.9, e), 0, lerp(-0.3, -0.4, e));
      p.head.rotation.y = lerp(0.15, 0.1, e);
      hero.root.position.copy(S.start).addScaledVector(S.dir, Math.min(S.reach, 0.4 + 0.06 * Math.sin(Math.PI * e)));
    }, { onEnter: () => { hero.spring.set(0.08); hero.spring.kick(-1.1); }, cancellable: true });

    // --- Recovery 300 ms: ease-in-out back to idle pose.
    seq.phase('recovery', 300, Easing.inOutCubic, (e) => {
      p.body.scale.set(lerp(1.04, 1, e), lerp(0.94, 1, e), 1);
      p.torso.rotation.y = lerp(-1.0, 0, e); p.torso.rotation.x = lerp(0.2, 0, e);
      p.armR.rotation.set(lerp(-0.9, -0.15, e), 0, lerp(-1.3, -0.35, e));
      hero.sword.rotation.set(lerp(0.9, 0.35, e), 0, lerp(-0.4, 0, e));
      p.armL.rotation.set(lerp(0.6, 0.1, e), 0, lerp(0.9, 0.35, e));
      p.head.rotation.y = lerp(0.1, 0, e);
    }, { cancellable: true });

    seq.then(() => { hero.state = 'idle'; hero._restPose(); });
    return seq;
  }

  _pickTarget(outDir) {
    // face nearest target within 2.6u in front-ish; else keep facing
    const targets = this.deps.targets ? this.deps.targets() : [];
    let best = null, bd = 2.6;
    for (const t of targets) {
      const d = _tmp.copy(t.root.position).sub(this.root.position).setY(0).length();
      if (d < bd) { bd = d; best = t; }
    }
    if (best) outDir.copy(best.root.position).sub(this.root.position).setY(0).normalize();
    else outDir.set(Math.sin(this.facing), 0, Math.cos(this.facing));
    return best;
  }

  _impact(S) {
    const g = this.game, v = this.deps.vfx;
    const hitPos = _tmp.copy(this.root.position).addScaledVector(S.dir, 1.3); hitPos.y = 0.8;
    let hitSomething = false;
    const targets = this.deps.targets ? this.deps.targets() : [];
    for (const t of targets) {
      _dir.copy(t.root.position).sub(this.root.position).setY(0);
      const d = _dir.length(); if (d > 2.4) continue;
      _dir.normalize(); if (_dir.dot(S.dir) < 0.35) continue; // ~110° cone
      t.hit(_dir, 1);                                           // hit flash + knockback (target side)
      hitSomething = true;
      v.sparks.burst(_tmp.copy(t.root.position).setY(0.8), 10, 5);
      v.pop.show(t.root.position, ['POW!', 'WHAM!', 'BONK!'][this.combo % 3], { color: '#FFD54F' });
    }
    if (hitSomething) {
      g.hitstop(60);                 // 60 ms hit-stop on attacker and target (all seq/tween time)
      g.camera.shake(0.28);          // tiny camera shake
      v.flash.flash('#fff6c8', 80, 0.18);
      this.combo++;
    } else {
      g.camera.shake(0.08);
      v.dust.burst(hitPos.setY(0), 3, { size: 0.15, speed: 1.0, dur: 0.3 });
    }
  }

  /** BUGFIX P11: furthest distance ≤ dist along dir (from the current position) that is still land, in 0.05 u steps. No isLand dep → dist. */
  landReach(dir, dist, step = 0.05) {
    const isLand = this.deps && this.deps.isLand; if (!isLand) return dist;
    const o = this.root.position; let ok = 0, m = 0.04;   // BUGFIX P20: margin keeps the reach off the exact cell edge
    for (let d = step; d <= dist + 1e-6; d += step) { if (!isLand(o.x + dir.x * d, o.z + dir.z * d) || !isLand(o.x + dir.x * (d + m), o.z + dir.z * (d + m))) break; ok = d; }
    return Math.min(ok, dist);
  }

  /**
   * BUGFIX P11 safety net: if the hero somehow stands on a non-land cell (old save, zone shape change, any animation that wrote the
   * position directly), pull it back onto the nearest land cell so walking works again. Returns true when a correction was made.
   */
  recoverToLand() {
    const isLand = this.deps && this.deps.isLand; if (!isLand) return false;
    const o = this.root.position; if (isLand(o.x, o.z)) return false;
    const cx = Math.round(o.x), cz = Math.round(o.z); let best = null, bd = Infinity;
    for (let r = 1; r <= 3 && !best; r++) {
      for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
        if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue;
        const x = cx + dx, z = cz + dz; if (!isLand(x, z)) continue;
        const d = (x - o.x) * (x - o.x) + (z - o.z) * (z - o.z); if (d < bd) { bd = d; best = { x, z }; }
      }
    }
    if (!best) return false;
    // keep as much of the current offset as fits inside the cell (±0.45 u) so the snap is barely visible
    o.x = best.x + Math.max(-0.45, Math.min(0.45, o.x - best.x));
    o.z = best.z + Math.max(-0.45, Math.min(0.45, o.z - best.z));
    this.vel.set(0, 0, 0);
    return true;
  }

  /** Trigger attack (from input). Returns true if started. */
  doAttack() {
    if (this.state === 'attack' && !this.attack.canCancel) return false;
    if (this.state !== 'attack') this.recoverToLand();      // BUGFIX P21: never start a swing from a water coordinate
    this.state = 'attack';
    this.game.sequences.play(this.attack, this.attack.ctx);
    return true;
  }

  // ---------------- locomotion ----------------
  update(dt) {
    this.t += dt;
    const inp = this.game.input, p = this.p, ov = this.inputOverride;
    if (this.state !== 'attack') this.recoverToLand();     // BUGFIX P11/P21: runs BEFORE the attack press so mashing ⚔ on a shore edge cannot skip it
    if (!ov && inp.pressed('attack')) this.doAttack();

    if (this.state === 'attack') {
      // allow steering input to be buffered as facing only
      this.vel.set(0, 0, 0);
    } else {
      const mv = ov ? ov.move : inp.move;
      const wantMove = (mv.x * mv.x + mv.y * mv.y) > 0.001;
      // Camera-relative: screen up = -z world (camera looks toward -z from +z offset)
      _dir.set(mv.x, 0, -mv.y);
      const targetSpeed = wantMove ? this.speed * Math.min(1, _dir.length()) : 0;
      if (wantMove) _dir.normalize();
      this.vel.x = damp(this.vel.x, _dir.x * targetSpeed, 14, dt);
      this.vel.z = damp(this.vel.z, _dir.z * targetSpeed, 14, dt);
      const nx = this.root.position.x + this.vel.x * dt, nz = this.root.position.z + this.vel.z * dt;
      if (!this.deps.isLand || this.deps.isLand(nx, nz)) { this.root.position.x = nx; this.root.position.z = nz; }
      else { this.vel.set(0, 0, 0); }

      const sp = Math.hypot(this.vel.x, this.vel.z);
      if (sp > 0.3) {
        const yaw = Math.atan2(this.vel.x, this.vel.z);
        this.facing = dampAngle(this.facing, yaw, 16, dt);
        this.root.rotation.y = this.facing;
        if (!this.moving) { this.moving = true; }
        const prev = this.walkPhase;
        this.walkPhase += dt * (9 + sp * 0.8);
        // footstep dust at each hop landing
        if (Math.floor(prev / Math.PI) !== Math.floor(this.walkPhase / Math.PI)) {
          this.deps.vfx.dust.burst(this.root.position, 2, { size: 0.12, speed: 0.8, dur: 0.3 });
          this.spring.kick(-0.6);
        }
        this.state = 'walk';
      } else {
        if (this.moving) { this.moving = false; this.spring.kick(-0.9); this.deps.vfx.dust.burst(this.root.position, 3, { size: 0.14, speed: 1, dur: 0.3 }); }
        this.walkPhase = dampAngle(this.walkPhase, Math.round(this.walkPhase / Math.PI) * Math.PI, 20, dt);
        this.state = 'idle';
      }

      // body pose from locomotion
      const s = this.spring.update(dt);
      if (this.state === 'walk') {
        const wb = walkBob(this.walkPhase, 0.14);
        setSquash(p.body, Math.max(0.5, wb.squash + s));
        p.body.position.y = wb.y;
        p.body.rotation.x = 0.12 + wb.tilt * 0.4;        // lean forward
        p.body.rotation.z = wb.tilt * 0.6;
        const sw = Math.sin(this.walkPhase);
        p.legL.rotation.x = sw * 0.9; p.legR.rotation.x = -sw * 0.9;
        p.armL.rotation.x = -sw * 0.8 + 0.1; p.armR.rotation.x = sw * 0.8 - 0.15;
        p.armL.rotation.z = 0.35; p.armR.rotation.z = -0.35;
        p.head.rotation.z = -wb.tilt * 0.3;
        p.scarfTail.rotation.x = -0.6 - Math.abs(sw) * 0.4;
        this.sword.rotation.x = 0.35 + sw * 0.1;
      } else {
        // idle: breathe + tiny sway, arms relax
        const br = 1 + Math.sin(this.t * 2.3) * 0.025;
        setSquash(p.body, Math.max(0.5, br + s));
        p.body.position.y = damp(p.body.position.y, 0, 12, dt);
        p.body.rotation.x = damp(p.body.rotation.x, 0, 10, dt); p.body.rotation.z = damp(p.body.rotation.z, 0, 10, dt);
        p.legL.rotation.x = damp(p.legL.rotation.x, 0, 12, dt); p.legR.rotation.x = damp(p.legR.rotation.x, 0, 12, dt);
        p.armL.rotation.x = damp(p.armL.rotation.x, 0.1 + Math.sin(this.t * 2.3) * 0.04, 10, dt);
        p.armR.rotation.x = damp(p.armR.rotation.x, -0.15 + Math.sin(this.t * 2.3) * 0.04, 10, dt);
        p.armL.rotation.z = 0.35; p.armR.rotation.z = -0.35;
        p.head.rotation.z = Math.sin(this.t * 1.1) * 0.04; p.head.rotation.y = damp(p.head.rotation.y, 0, 8, dt);
        p.scarfTail.rotation.x = damp(p.scarfTail.rotation.x, -0.2 + Math.sin(this.t * 3) * 0.08, 8, dt);
        this.sword.rotation.x = damp(this.sword.rotation.x, 0.35, 10, dt);
      }
    }
    if (this.state === 'attack') {
      // spring layered on top of attack squash (follow-through settle)
      const s = this.spring.update(dt);
      if (this.attack.currentName === 'follow' || this.attack.currentName === 'recovery') p.body.scale.y += s * 0.6;
      p.body.position.y = damp(p.body.position.y, 0, 14, dt);
      p.body.rotation.x = damp(p.body.rotation.x, 0, 14, dt); p.body.rotation.z = damp(p.body.rotation.z, 0, 14, dt);
      p.legL.rotation.x = damp(p.legL.rotation.x, 0.3, 12, dt); p.legR.rotation.x = damp(p.legR.rotation.x, -0.3, 12, dt);
    }
    // blob shadow follows body squash footprint
    this.p.shadow.scale.set(p.body.scale.x, 1, p.body.scale.z);
  }
}

function dampAngle(a, b, k, dt) {
  let d = ((b - a + Math.PI) % (Math.PI * 2) + Math.PI * 2) % (Math.PI * 2) - Math.PI;
  return a + d * (1 - Math.exp(-k * dt));
}
