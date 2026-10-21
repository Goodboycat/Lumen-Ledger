// Chat 2A — CreatureAnimator: one state machine that drives ANY Foundation-shaped creature
// (anything with root.userData.parts = { body, shell?, face?, core?, mouth?, shadow? } where `body` is a
// Group pivoted at the feet). Used by Glimmer variants (2A/2D), helpers (2B) and villains (2C).
//
// Design (GAME_BIBLE §4): every clip is a Sequence of phases with explicit ms + easing. Phase fns set the
// pose ABSOLUTELY from snapshots taken in onEnter → frame-rate independent. A JellySpring adds the
// secondary jiggle (landing settle, hit react). Loops (idle/walk/browse/wait) are Sequences with setLoop.
//
// Pose channels written every frame (so clips never fight): body.position.y (hop), body squash (setSquash),
// body.rotation (lean/tilt/spin), face.scale.y (blink), mouth state, shell tint (mood), shadow scale.
//
// ───────────────────────────── PHASE TABLES (ms · easing) ─────────────────────────────
// idle    loop  breathe sine 2.4 Hz amp 0.035 (not phased; continuous), random blink every 2–5 s (80 ms)
// walk    loop  420 ms: push 90 outQuad (squash 0.90) → air 180 inOutQuad (stretch 1.12 apex, y 0.26)
//               → land 60 inQuad (squash 0.86, dust) → settle 90 outBack (→1.0)
// happy   600   crouch 120 outCubic (0.82) → leap 260 outCubic (y 0.9, stretch 1.25, spin 360°)
//               → land 80 inQuad (0.78, dust) → settle 140 outBack (→1)
// sad     500+  droop 300 outCubic (squash 0.9, lean fwd 0.35 rad, mouth flips) → hold (loops a tiny sway)
// pay     400   lean 140 inOutCubic (lean 0.3 toward target, squash 0.92) → toss 90 outQuad (snap back,
//               stretch 1.15, emits onCoin) → settle 170 outBack
// browse  loop  1400 ms: look L 300 inOutCubic → hold 300 → look R 400 inOutCubic → hold 400 (yaw ±0.5)
// wait    loop  520 ms: tap 110 outQuad (tilt 0.12, squash 0.96) → down 110 inQuad → pause 300
// angry   500   wind 80 inQuad (squash 0.9) → shake 300 linear (x jitter ±0.08, 6 cycles, red tint 1)
//               → settle 120 outBack (tint back)
// ─────────────────────────────────────────────────────────────────────────────────────
import * as THREE from '../../../vendor/three.module.js';
import { Sequence } from '../../anim/Sequencer.js';
import { Easing } from '../../anim/Easing.js';
import { JellySpring, setSquash, breathe } from '../../anim/SquashStretch.js';
import { PALETTE as P } from '../../core/Toon.js';

const _tmp = new THREE.Vector3();
const _q = new THREE.Quaternion();
const _col = new THREE.Color();
const SAD = new THREE.Color(0x7FA6C9);      // desaturated blue-grey tint for mood 0
const HAPPY = new THREE.Color(0xFFF2B0);    // warm highlight tint for mood 1
const RED = new THREE.Color(P.red);

export const CREATURE_ANIMS = ['idle', 'walk', 'happy', 'sad', 'pay', 'browse', 'wait', 'angry'];

export class CreatureAnimator {
  /**
   * @param {THREE.Group} root  creature root (feet pivot). Reads root.userData.parts.
   * @param {{ vfx?: any, onCoin?: (worldPos:THREE.Vector3)=>void }} opts
   */
  constructor(root, opts = {}) {
    this.root = root;
    this.p = root.userData.parts || {};
    this.body = this.p.body || root;
    this.vfx = opts.vfx || null;
    this.onCoin = opts.onCoin || null;
    this.spring = new JellySpring(260, 12);
    this.t = Math.random() * 10;
    this.timeScale = 1;                 // HitStop-compatible
    this.current = 'idle';
    this.seq = null;                    // active Sequence
    this.loopSeq = null;                // underlying loop to resume after a one-shot
    this.mood = 0.6;                    // 0 sad … 1 happy
    this.facing = new THREE.Vector3(0, 0, 1);
    this.turnSpeed = 10;
    this.blinkT = 2 + Math.random() * 3; this.blink = 0;
    // pose channels (reset each frame by the clip; defaults = rest)
    this.pose = { y: 0, squash: 1, lean: 0, tilt: 0, yaw: 0, spin: 0, jitter: 0 };
    // tint target (shell material is cloned per creature so we can tint without touching cache)
    this._tintables = [];
    this.body.traverse((o) => { if (o.isMesh && !o.userData.isOutline && !o.userData.noOutline && o.material && o.material.color) { o.material = o.material.clone(); o.userData.baseColor = o.material.color.clone(); this._tintables.push(o); } });
    this._angryTint = 0;
    this._clips = buildClips(this);
    this.play('idle');
  }

  /** Play a clip. One-shots (happy/sad/pay/angry) return to the previous loop when done. */
  play(name, ctx = {}) {
    const clip = this._clips[name];
    if (!clip) { console.warn('[CreatureAnimator] unknown clip', name); return this; }
    if (this.seq) this.seq.stop();
    this.current = name;
    const seq = clip();
    seq.timeScale = 1;
    if (seq.loop) this.loopSeq = name;
    else seq.then(() => { if (this.current === name) this.play(this.loopSeq || 'idle'); });
    this.seq = seq;
    seq.play(Object.assign({ a: this }, ctx));
    return this;
  }

  /** Mood 0..1 → tints body sad(grey-blue) … neutral … happy(warm); also flips the mouth. */
  moodTint(t) { this.mood = THREE.MathUtils.clamp(t, 0, 1); return this; }

  /** Turn smoothly to face a world position (yaw only). */
  faceTo(target) { _tmp.copy(target).sub(this.root.position); _tmp.y = 0; if (_tmp.lengthSq() > 1e-4) this.facing.copy(_tmp.normalize()); return this; }
  /** Snap facing instantly. */
  faceToNow(target) { this.faceTo(target); this.root.rotation.y = Math.atan2(this.facing.x, this.facing.z); return this; }

  /** Hit reaction (keeps GlimmerController API alive): squash + jiggle + angry flash. */
  hit(dir, power = 1) { this.spring.set(-0.45 * power); this.spring.kick(-2.5 * power); this._angryTint = 1; return this; }

  update(dt) {
    dt *= this.timeScale;
    this.t += dt;
    const pose = this.pose;
    // defaults; the clip overwrites what it owns
    pose.y = 0; pose.lean = 0; pose.tilt = 0; pose.jitter = 0; pose.spin = 0;
    pose.squash = breathe(this.t, 2.4, 0.035);
    if (this.seq) this.seq.update(dt);
    // facing (smooth yaw)
    const targetYaw = Math.atan2(this.facing.x, this.facing.z);
    let d = targetYaw - this.root.rotation.y; d = Math.atan2(Math.sin(d), Math.cos(d));
    this.root.rotation.y += d * Math.min(1, this.turnSpeed * dt);
    // apply pose
    const s = this.spring.update(dt);
    const b = this.body;
    setSquash(b, Math.max(0.3, pose.squash + s));
    b.position.y = pose.y;
    b.position.x = pose.jitter;
    b.rotation.set(pose.lean, pose.spin + pose.yaw, pose.tilt);
    if (this.p.shadow) { const sh = 1 - Math.min(0.8, pose.y * 0.9); this.p.shadow.scale.set(sh, 1, sh); }
    // blink (random, 80 ms, eyes scale-y via face group)
    if (this.p.face) {
      this.blinkT -= dt;
      if (this.blinkT <= 0) { this.blink = 0.08; this.blinkT = 2 + Math.random() * 3; }
      if (this.blink > 0) { this.blink -= dt; this.p.face.scale.y = this.blink > 0 ? 0.15 : 1; } else this.p.face.scale.y = 1;
    }
    // mood / angry tint
    if (this._angryTint > 0) this._angryTint = Math.max(0, this._angryTint - dt / 0.3);
    const m = this.mood;
    for (const o of this._tintables) {
      const base = o.userData.baseColor;
      if (m < 0.5) _col.copy(base).lerp(SAD, (0.5 - m) * 0.9);
      else _col.copy(base).lerp(HAPPY, (m - 0.5) * 0.5);
      if (this._angryTint > 0) _col.lerp(RED, this._angryTint * 0.7);
      o.material.color.copy(_col);
    }
    if (this.p.mouth) { // frown when sad: flip the half-torus
      const sad = m < 0.35 || this.current === 'sad' || this.current === 'angry';
      this.p.mouth.rotation.z = sad ? 0 : Math.PI;
      this.p.mouth.position.y = sad ? -0.14 : -0.11;
    }
  }

  dust(n = 6, up = 0.5) {
    if (!this.vfx) return;
    _tmp.copy(this.root.position); _tmp.y += 0.02;
    this.vfx.dust.burst(_tmp.clone(), n, { size: 0.18, speed: 1.6, dur: 0.4, up });
  }
}

// ───────────────────────────── clips ─────────────────────────────
function buildClips(a) {
  const pose = a.pose;
  return {
    idle: () => new Sequence('idle').phase('breathe', 1000, Easing.linear, () => { /* breathe is in update() */ }).setLoop(true),

    // walk: push 90 → air 180 → land 60 → settle 90 (= 420 ms per hop)
    walk: () => new Sequence('walk')
      .phase('push', 90, Easing.outQuad, (e) => { pose.squash = lerp(1, 0.90, e); pose.lean = lerp(0, 0.12, e); })
      .phase('air', 180, Easing.inOutQuad, (e, c, t) => { const h = Math.sin(t * Math.PI); pose.y = h * 0.26; pose.squash = lerp(0.9, 1.12, Math.min(1, h * 1.3)); pose.lean = 0.12 - t * 0.2; })
      .phase('land', 60, Easing.inQuad, (e) => { pose.y = 0; pose.squash = lerp(1.0, 0.86, e); pose.lean = -0.08; }, { onEnter: () => a.dust(3, 0.25) })
      .phase('settle', 90, Easing.outBack, (e) => { pose.squash = lerp(0.86, 1.0, e); pose.lean = lerp(-0.08, 0, e); })
      .setLoop(true),

    // happy: crouch 120 → leap 260 (spin 360) → land 80 → settle 140 (= 600)
    happy: () => new Sequence('happy')
      .phase('crouch', 120, Easing.outCubic, (e) => { pose.squash = lerp(1, 0.82, e); })
      .phase('leap', 260, Easing.outCubic, (e, c, t) => { const h = Math.sin(t * Math.PI); pose.y = h * 0.9; pose.squash = lerp(0.82, 1.25, Math.min(1, e * 1.4)); pose.spin = e * Math.PI * 2; }, { onEnter: () => { a.spring.kick(1.2); a.dust(5, 0.6); } })
      .phase('land', 80, Easing.inQuad, (e) => { pose.y = 0; pose.squash = lerp(1.05, 0.78, e); pose.spin = 0; }, { onEnter: () => a.dust(6, 0.3) })
      .phase('settle', 140, Easing.outBack, (e) => { pose.squash = lerp(0.78, 1, e); }),

    // sad: droop 300 → hold (loop sway) — stays until another play()
    sad: () => new Sequence('sad')
      .phase('droop', 300, Easing.outCubic, (e) => { pose.squash = lerp(1, 0.9, e); pose.lean = lerp(0, 0.35, e); })
      .phase('hold', 1200, Easing.linear, (e, c, t) => { pose.squash = 0.9 + Math.sin(t * Math.PI * 2) * 0.01; pose.lean = 0.35; pose.tilt = Math.sin(t * Math.PI * 2) * 0.04; })
      .setLoop(true),

    // pay: lean 140 → toss 90 (coin) → settle 170 (= 400)
    pay: () => new Sequence('pay')
      .phase('lean', 140, Easing.inOutCubic, (e) => { pose.lean = lerp(0, 0.3, e); pose.squash = lerp(1, 0.92, e); })
      .phase('toss', 90, Easing.outQuad, (e) => { pose.lean = lerp(0.3, -0.15, e); pose.squash = lerp(0.92, 1.15, e); pose.y = e * 0.12; },
        { onEnter: () => { a.spring.kick(0.9); if (a.onCoin) { _tmp.set(0, 0.7, 0.4).applyQuaternion(a.root.quaternion).add(a.root.position); a.onCoin(_tmp.clone()); } if (a.vfx) { _tmp.set(0, 0.8, 0.4).applyQuaternion(a.root.quaternion).add(a.root.position); a.vfx.sparks.burst(_tmp.clone(), 6, 2.2); } } })
      .phase('settle', 170, Easing.outBack, (e) => { pose.lean = lerp(-0.15, 0, e); pose.squash = lerp(1.15, 1, e); pose.y = (1 - e) * 0.12; }),

    // browse: look L 300 → hold 300 → look R 400 → hold 400 (= 1400 loop)
    browse: () => new Sequence('browse')
      .phase('lookL', 300, Easing.inOutCubic, (e) => { pose.yaw = lerp(0, 0.5, e); pose.tilt = lerp(0, 0.06, e); })
      .phase('holdL', 300, Easing.linear, () => { pose.yaw = 0.5; pose.tilt = 0.06; })
      .phase('lookR', 400, Easing.inOutCubic, (e) => { pose.yaw = lerp(0.5, -0.5, e); pose.tilt = lerp(0.06, -0.06, e); })
      .phase('holdR', 400, Easing.linear, () => { pose.yaw = -0.5; pose.tilt = -0.06; })
      .setLoop(true),

    // wait: tap 110 → down 110 → pause 300 (= 520 loop)
    wait: () => new Sequence('wait')
      .phase('tap', 110, Easing.outQuad, (e) => { pose.tilt = lerp(0, 0.12, e); pose.squash = lerp(1, 0.96, e); pose.y = e * 0.04; })
      .phase('down', 110, Easing.inQuad, (e) => { pose.tilt = lerp(0.12, 0, e); pose.squash = lerp(0.96, 1.02, e); pose.y = (1 - e) * 0.04; }, { onExit: () => a.spring.kick(-0.25) })
      .phase('pause', 300, Easing.linear, () => {})
      .setLoop(true),

    // angry: wind 80 → shake 300 (red) → settle 120 (= 500)
    angry: () => new Sequence('angry')
      .phase('wind', 80, Easing.inQuad, (e) => { pose.squash = lerp(1, 0.9, e); pose.lean = lerp(0, -0.1, e); }, { onEnter: () => { a._angryTint = 1; } })
      .phase('shake', 300, Easing.linear, (e, c, t) => { pose.jitter = Math.sin(t * Math.PI * 12) * 0.08; pose.squash = 0.9 + Math.abs(Math.sin(t * Math.PI * 12)) * 0.1; pose.lean = -0.1; a._angryTint = 1; }, { onEnter: () => a.dust(4, 0.2) })
      .phase('settle', 120, Easing.outBack, (e) => { pose.squash = lerp(1.0, 1, e); pose.lean = lerp(-0.1, 0, e); }),
  };
}

function lerp(a, b, t) { return a + (b - a) * t; }
