// Tween: delta-time driven property interpolation. Zero allocations per frame.
// Usage:
//   const tw = new Tween(mesh.scale, { x: 1.2, y: 0.9 }, 100 /*ms*/, Easing.outCubic)
//   tweens.add(tw);  // TweenManager updates with dt (seconds)
import { Easing } from './Easing.js';

export class Tween {
  /**
   * @param {object} target     object whose numeric props we animate
   * @param {object} to         { prop: endValue }
   * @param {number} durationMs
   * @param {function} ease     Easing fn
   */
  constructor(target, to, durationMs, ease = Easing.outCubic) {
    this.target = target;
    this.to = to;
    this.from = {};
    this.keys = Object.keys(to);
    this.duration = Math.max(0.001, durationMs / 1000);
    this.ease = ease;
    this.elapsed = 0;
    this.started = false;
    this.done = false;
    this.delay = 0;
    this.onUpdate = null;
    this.onComplete = null;
    this.yoyo = false;
    this.repeat = 0;
  }
  setDelay(ms) { this.delay = ms / 1000; return this; }
  setYoyo(v = true) { this.yoyo = v; return this; }
  setRepeat(n) { this.repeat = n; return this; } // -1 = infinite
  then(fn) { this.onComplete = fn; return this; }
  each(fn) { this.onUpdate = fn; return this; }

  _start() {
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i];
      this.from[k] = this.target[k];
    }
    this.started = true;
  }

  /** @param {number} dt seconds */
  update(dt) {
    if (this.done) return true;
    if (this.delay > 0) {
      this.delay -= dt;
      if (this.delay > 0) return false;
      dt = -this.delay;
      this.delay = 0;
    }
    if (!this.started) this._start();
    this.elapsed += dt;
    let t = this.elapsed / this.duration;
    let finished = false;
    if (t >= 1) { t = 1; finished = true; }
    const e = this.ease(t);
    for (let i = 0; i < this.keys.length; i++) {
      const k = this.keys[i];
      this.target[k] = this.from[k] + (this.to[k] - this.from[k]) * e;
    }
    if (this.onUpdate) this.onUpdate(e, t);
    if (finished) {
      if (this.yoyo) {
        const tmp = this.to; this.to = { ...this.from }; this.from = { ...tmp };
        this.elapsed = 0;
        this.yoyo = this.repeat !== 0;
        if (this.repeat > 0) this.repeat--;
        return false;
      }
      if (this.repeat !== 0) {
        if (this.repeat > 0) this.repeat--;
        this.elapsed = 0;
        for (const k of this.keys) this.target[k] = this.from[k];
        return false;
      }
      this.done = true;
      if (this.onComplete) this.onComplete();
      return true;
    }
    return false;
  }
  kill() { this.done = true; }
}

export class TweenManager {
  constructor() { this.list = []; this.timeScale = 1; }
  add(tw) { this.list.push(tw); return tw; }
  /** Convenience: tween(target, to, ms, ease) */
  to(target, to, ms, ease) { return this.add(new Tween(target, to, ms, ease)); }
  killOf(target) {
    for (const tw of this.list) if (tw.target === target) tw.done = true;
  }
  update(dt) {
    dt *= this.timeScale;
    const l = this.list;
    let w = 0;
    for (let i = 0; i < l.length; i++) {
      const tw = l[i];
      if (!tw.update(dt)) l[w++] = tw;
    }
    l.length = w;
  }
  clear() { this.list.length = 0; }
}

// Global default manager (every chat may use it; Game.js updates it each frame)
export const tweens = new TweenManager();
