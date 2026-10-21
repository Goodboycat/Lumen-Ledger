// Sequencer: keyframed procedural animation built from named PHASES.
// This is the standard way every chat must author animations (hero moves, creature
// bounces, UI pops). It is delta-time driven, supports hit-stop (timeScale 0),
// cancellation, and per-phase callbacks.
//
// Example (the sword spec):
//   const seq = new Sequence('swordAttack')
//     .phase('anticipation', 200, Easing.outCubic, (e, ctx) => { ... })
//     .phase('windup',      100, Easing.inOutCubic, (e, ctx) => { ... })
//     .phase('strike',      100, Easing.strike, (e, ctx) => { ... }, { onEnter: ctx => sfx() })
//     .phase('follow',      200, Easing.outCubic, (e, ctx) => { ... })
//     .phase('recovery',    300, Easing.inOutCubic, (e, ctx) => { ... });
//   seq.play(ctx);   // ctx = anything the phase fns need (hero, target, vfx)
//   seq.update(dt);  // each frame (seconds)
//
// Phase fn receives (e, ctx, t, phase) where e = eased progress 0..1, t = raw 0..1.
// Each phase fn should set the pose ABSOLUTELY from values captured at phase start
// (use phase.onEnter to snapshot) so animation is deterministic at any frame rate.

import { Easing } from './Easing.js';

export class Phase {
  constructor(name, durationMs, ease, fn, opts = {}) {
    this.name = name;
    this.duration = Math.max(0.0001, durationMs / 1000);
    this.ease = ease || Easing.linear;
    this.fn = fn || null;
    this.onEnter = opts.onEnter || null;
    this.onExit = opts.onExit || null;
    this.cancellable = opts.cancellable !== undefined ? opts.cancellable : false;
    this.state = {}; // scratch per-phase, reset on enter
  }
}

export class Sequence {
  constructor(name = 'seq') {
    this.name = name;
    this.phases = [];
    this.index = -1;
    this.time = 0;
    this.playing = false;
    this.timeScale = 1;
    this.loop = false;
    this.ctx = null;
    this.onComplete = null;
    this.onPhase = null; // (phaseName, ctx)
    this.totalMs = 0;
  }
  phase(name, durationMs, ease, fn, opts) {
    this.phases.push(new Phase(name, durationMs, ease, fn, opts));
    this.totalMs += durationMs;
    return this;
  }
  setLoop(v = true) { this.loop = v; return this; }
  then(fn) { this.onComplete = fn; return this; }

  get current() { return this.index >= 0 && this.index < this.phases.length ? this.phases[this.index] : null; }
  get currentName() { const p = this.current; return p ? p.name : null; }
  /** Overall normalized progress 0..1 */
  get progress() {
    if (!this.playing) return 1;
    let ms = 0;
    for (let i = 0; i < this.index; i++) ms += this.phases[i].duration;
    ms += this.time;
    return Math.min(1, ms / (this.totalMs / 1000));
  }

  play(ctx = {}) {
    this.ctx = ctx;
    this.index = -1;
    this.time = 0;
    this.playing = true;
    this._enter(0);
    return this;
  }
  stop() {
    if (!this.playing) return;
    const p = this.current;
    if (p && p.onExit) p.onExit(this.ctx, p);
    this.playing = false;
    this.index = -1;
  }
  /** Can the current phase be interrupted (e.g. for combos / dodge cancel)? */
  get canCancel() { const p = this.current; return !p || p.cancellable; }

  _enter(i) {
    if (i >= this.phases.length) {
      if (this.loop) { i = 0; } else {
        this.playing = false; this.index = -1;
        if (this.onComplete) this.onComplete(this.ctx);
        return;
      }
    }
    this.index = i;
    this.time = 0;
    const p = this.phases[i];
    p.state = {};
    if (p.onEnter) p.onEnter(this.ctx, p);
    if (this.onPhase) this.onPhase(p.name, this.ctx);
    if (p.fn) p.fn(p.ease(0), this.ctx, 0, p);
  }

  /** @param {number} dt seconds */
  update(dt) {
    if (!this.playing) return false;
    dt *= this.timeScale;
    this.time += dt;
    // Advance through as many phases as dt covers (handles low fps / hitches)
    let guard = 16;
    while (this.playing && this.time >= this.current.duration && guard-- > 0) {
      const p = this.current;
      if (p.fn) p.fn(p.ease(1), this.ctx, 1, p); // land exactly on end pose
      const overflow = this.time - p.duration;
      if (p.onExit) p.onExit(this.ctx, p);
      this._enter(this.index + 1);
      if (this.playing) this.time = overflow;
    }
    if (this.playing) {
      const p = this.current;
      const t = this.time / p.duration;
      if (p.fn) p.fn(p.ease(t), this.ctx, t, p);
    }
    return this.playing;
  }
}

/** Runs many sequences; handles global hit-stop by scaling time. */
export class SequencePlayer {
  constructor() { this.active = []; this.timeScale = 1; }
  play(seq, ctx) { seq.play(ctx); if (!this.active.includes(seq)) this.active.push(seq); return seq; }
  update(dt) {
    dt *= this.timeScale;
    const a = this.active; let w = 0;
    for (let i = 0; i < a.length; i++) if (a[i].update(dt)) a[w++] = a[i];
    a.length = w;
  }
}

/**
 * HitStop: freezes a set of time-scaled objects for N ms (real time).
 * Objects just need a `.timeScale` number (SequencePlayer, TweenManager, Animator...).
 */
export class HitStop {
  constructor() { this.remaining = 0; this.targets = []; this.saved = []; }
  /** @param {number} ms @param {Array<{timeScale:number}>} targets */
  trigger(ms, targets) {
    if (this.disabled) return;                       // BUGFIX B23: Reduce Motion → no hit-stop freezes
    if (this.remaining > 0) { this.remaining = Math.max(this.remaining, ms / 1000); return; }
    this.remaining = ms / 1000;
    this.targets = targets;
    this.saved = targets.map((t) => t.timeScale);
    for (const t of targets) t.timeScale = 0;
  }
  /** @param {number} dtReal real (unscaled) seconds */
  update(dtReal) {
    if (this.remaining <= 0) return false;
    this.remaining -= dtReal;
    if (this.remaining <= 0) {
      this.targets.forEach((t, i) => (t.timeScale = this.saved[i]));
      this.targets = []; this.saved = [];
      return false;
    }
    return true;
  }
  get active() { return this.remaining > 0; }
}
