// Chat 6A — CustomerSystem: Glimmer customers that spawn at the pier, path over a flow field to a stall queue,
// browse, pay (economy.sell), react (happy/sad/angry), and leave back to the pier where they are pooled.
//
// Contract (API_CONTRACTS §B Customers):
//   const cust = new CustomerSystem(game, { island, build, economy, creatures?, vfx?, flow?, maxActive? })
//   cust.spawnWave(season = 1, n?)   cust.update(dt)   cust.count   cust.active (array)   cust.setPrice(stallId, price)
//   cust.setSpawnPoint(x,z)          cust.clear()      cust.serialize()  (counters only)
//   emits on game.bus: 'cust:spawn' 'cust:paid' 'cust:left' 'cust:angry' 'cust:state' (debug) 'cust:wave'
//
// FSM (per customer):  spawn → pickStall → walk → queue (wait anim, shuffles forward) → browse 1.5 s → pay
//                      → happy | sad → leave (walk to pier) → pool.
//                      give-up: no stall 3 s → angry 'no stall' · all queues full > 0.6·patience → angry 'full' · in queue > patience → angry 'waited'
// Steering: flow-field direction (FlowField.direction) + separation from neighbours (radius 0.7) + arrive slow-down.
// Speed 1.9 u/s × type patience-inverse (impulse/kid faster, elder slower). Pool reuses Glimmer groups (no GC spikes).
//
// Mood: price vs fair (economy.stallInfo(id).fair). ratio ≤ 0.9 → delighted (mood 1, pop "✦ +N" gold, happy anim)
//       ratio ≤ 1.1 → content (0.75, happy) · ≤ 1.4 → grumbly (0.35, sad) · else rip-off (0.1, angry + 'cust:angry').
// Type preference: GLIMMER_INFO-like table PREFS below (type → stall type weights); pickStall = weighted by
// preference / (1 + queueLen) / (1 + distance/12) with a tiny rng jitter so crowds spread.
//
// ───────────── ANIM TABLE (delta-time; creature clips come from 2A CreatureAnimator, see its phase table) ─────────────
// walk      loop   CreatureAnimator 'walk' (420 ms hop)        speed-scaled via animator.timeScale (0.8..1.3)
// wait      loop   'wait' (520 ms tap) while in queue slot
// browse    1500   'browse' loop (look L/R) for BROWSE_MS, face the counter
// pay       400    'pay' one-shot (lean/toss/settle); coin spawns from onCoin → vfx.pop "+N" + coinFly if 9A registered it
// react     600    'happy' (leap) | 'sad' (droop) | 'angry' (shake, red tint) then leave
// spawnPop  260    scale 0 → 1.15 outBack → 1 (120 outCubic) with dust puff           (custom Sequence 'custSpawn')
// despawn   220    scale 1 → 0 inBack, y −0.2                                        (custom Sequence 'custLeave')
// ──────────────────────────────────────────────────────────────────────────────────────────────────────────────
import * as THREE from '../../vendor/three.module.js';
import { Sequence } from '../anim/Sequencer.js';
import { Easing } from '../anim/Easing.js';
import { bus as globalBus } from '../core/EventBus.js';
import { FlowField } from './flowfield.js';

export const POOL_CAP_PER_TYPE = 3;   // 11A: 12 types × 3 = 36 idle roots max (each fused Glimmer owns 3 merged geometries)
export const CUSTOMER_STATES = ['spawn', 'pickStall', 'walk', 'queue', 'browse', 'pay', 'react', 'leave', 'pooled'];
export const BROWSE_MS = 1500;
export const MAX_ACTIVE_DEFAULT = 20;
export const MAX_ACTIVE_HARD = 40;
const SEP_RADIUS = 0.7, SEP_FORCE = 1.6, ARRIVE_R = 0.35, BASE_SPEED = 1.9;
const _v = new THREE.Vector3(), _d = { x: 0, z: 0 };

/** Type → stall type preference weights (unlisted stall = 1). Mirrors GAME_BIBLE flavour text. */
export const PREFS = {
  regular:   {},
  saver:     { fruit: 2, bread: 2, tea: 1.5, tool: 0.5, lantern: 0.5, sparkExchange: 1.5 },
  spender:   { cloth: 2, toy: 2, pottery: 1.5, lantern: 1.5, fruit: 0.5 },
  impulse:   { toy: 2.5, flower: 2, cloth: 1.5, book: 0.5 },
  haggler:   { fish: 2, fruit: 1.5, tool: 1.5, sparkExchange: 0.3 },
  vip:       { lantern: 2.5, cloth: 2, pottery: 2, tea: 0.3, fruit: 0.3 },
  kid:       { toy: 3, fruit: 1.5, tea: 0.3, tool: 0.1, sparkExchange: 0.1 },
  elder:     { tea: 2.5, book: 2, bread: 1.5, toy: 0.3 },
  tourist:   { lantern: 2, pottery: 2, flower: 1.5, fish: 1.5 },
  critic:    { book: 2, tea: 1.5, pottery: 1.5, toy: 0.5 },
  collector: { pottery: 3, book: 2, lantern: 1.5, fruit: 0.3, bread: 0.3 },
  newbie:    { fruit: 1.5, bread: 1.5, sparkExchange: 1.5 },
};
/** Patience in seconds a customer waits in a queue before giving up (scaled by GLIMMER_INFO.patience when present). */
export const BASE_PATIENCE_S = 14;
/** Season → wave size + type mix (P3). Later seasons bring pickier / richer types. */
export const WAVES = [
  /* S1 */ { n: 6,  types: ['regular', 'regular', 'newbie', 'kid', 'saver'] },
  /* S2 */ { n: 8,  types: ['regular', 'newbie', 'kid', 'saver', 'spender', 'elder'] },
  /* S3 */ { n: 10, types: ['regular', 'saver', 'spender', 'elder', 'impulse', 'tourist'] },
  /* S4 */ { n: 11, types: ['regular', 'saver', 'spender', 'impulse', 'tourist', 'haggler', 'critic'] },
  /* S5 */ { n: 12, types: ['regular', 'spender', 'impulse', 'tourist', 'haggler', 'critic', 'collector', 'vip'] },
  /* S6+*/ { n: 14, types: ['regular', 'saver', 'spender', 'impulse', 'tourist', 'haggler', 'critic', 'collector', 'vip', 'elder', 'kid'] },
];

export class CustomerSystem {
  /**
   * @param {object} game  Game or mock { scene, sequences, bus?, time? }
   * @param {{ island:any, build:any, economy?:any, creatures?:{ makeGlimmer(type)=>Group, CreatureAnimator }, vfx?:any,
   *           flow?:FlowField, maxActive?:number, spawn?:{x,z}, seed?:number, scene?:THREE.Object3D }} deps
   */
  constructor(game, deps = {}) {
    this.game = game;
    this.bus = game.bus || globalBus;
    this.scene = deps.scene || game.scene;
    this.island = deps.island;
    this.build = deps.build;
    this.economy = deps.economy || null;
    this.creatures = deps.creatures || null;        // { makeGlimmer, CreatureAnimator } — injected to keep this file testable without Three creatures
    this.vfx = deps.vfx || null;
    this.maxActive = Math.min(MAX_ACTIVE_HARD, deps.maxActive ?? MAX_ACTIVE_DEFAULT);
    this.rng = mulberry(deps.seed ?? 11);
    this.prices = new Map();                        // stallId (prop id) → price (default: fair)
    this.active = [];                               // customers on the island
    this.pool = new Map();                          // type → [customer]
    this.poolCap = deps.poolCap ?? POOL_CAP_PER_TYPE;  // 11A: idle roots kept per type; surplus is disposed (merged geometries freed)
    this.totalsPool = { created: 0, disposed: 0 };
    this.count = 0;
    this.totals = { spawned: 0, paid: 0, sparkEarned: 0, left: 0, angry: 0, gaveUp: 0 };
    this.time = 0;
    this.queues = new Map();                        // stall entry → [customer] (ordered)
    this.pendingSpawns = [];                        // { type, at } timed spawns from spawnWave
    this.flow = deps.flow || new FlowField({
      isLand: (x, z) => this.island.isLand(x, z),
      isBlocked: (x, z) => !!(this.build && this.build.occupied && this.build.occupied(x, z)),
    });
    // spawn point: pier side (−Z edge) by default, or supplied
    const edge = deps.spawn || (this.island.landEdge ? this.island.landEdge(0, -1) : null) || { x: 0, z: -8 };
    this.spawn = { x: edge.x, z: edge.z };
    // walkable set changes → drop flow cache, reroute walkers
    this._offs = [];
    for (const n of ['build:placed', 'build:removed', 'island:unlock']) this._offs.push(this.bus.on(n, () => this.reroute()));
    this.bus.emit('cust:ready', { spawn: this.spawn });
  }

  dispose() { for (const off of this._offs) if (typeof off === 'function') off(); this.clear(); }

  // ------------------------------------------------------------------ prices / config
  setPrice(stallId, price) { this.prices.set(stallId, Math.max(0, +price || 0)); return this; }
  price(stallId) { if (this.prices.has(stallId)) return this.prices.get(stallId); const i = this.economy && this.economy.stallInfo ? this.economy.stallInfo(stallId) : null; return i ? i.fair : 5; }
  fair(stallId) { const i = this.economy && this.economy.stallInfo ? this.economy.stallInfo(stallId) : null; return i ? i.fair : this.price(stallId); }
  setSpawnPoint(x, z) { const c = this.flow.nearestWalkable(x, z, 6) || { x, z }; this.spawn = { x: c.x, z: c.z }; return this; }
  reroute() { this.flow.invalidate(); for (const c of this.active) c.field = null; }

  // ------------------------------------------------------------------ spawning
  /** Spawn a wave for `season` (P3 table) or exactly `n` customers; spaced 0.45 s apart. Returns the number queued. */
  spawnWave(season = 1, n) {
    const w = WAVES[Math.min(WAVES.length - 1, Math.max(0, (season | 0) - 1))];
    const total = n ?? w.n;
    let queued = 0;
    for (let i = 0; i < total; i++) {
      const type = w.types[Math.floor(this.rng() * w.types.length)];
      this.pendingSpawns.push({ type, at: this.time + i * 0.45 });
      queued++;
    }
    this.bus.emit('cust:wave', { season, n: total });
    return queued;
  }

  /** Spawn one customer now (type optional). Returns the customer or null when at maxActive. */
  spawnOne(type) {
    if (this.active.length >= this.maxActive) return null;
    type = type || 'regular';
    const c = this._acquire(type);
    const sp = this.flow.nearestWalkable(this.spawn.x, this.spawn.z, 6) || this.spawn;
    const jx = (this.rng() - 0.5) * 0.6, jz = (this.rng() - 0.5) * 0.6;
    c.root.position.set(sp.x + jx, 0, sp.z + jz);
    c.root.visible = true; c.root.scale.setScalar(0.001);
    c.state = 'spawn'; c.t = 0; c.waited = 0; c.stall = null; c.slot = -1; c.field = null; c.result = null;
    c.speed = BASE_SPEED * (0.85 + 0.3 * this.rng()) * c.speedMul;
    if (c.anim) { c.anim.moodTint(0.6); c.anim.play('idle'); }
    this.active.push(c); this.count = this.active.length; this.totals.spawned++;
    this._playSpawn(c);
    this.bus.emit('cust:spawn', { type, id: c.id, count: this.count });
    return c;
  }

  _acquire(type) {
    const list = this.pool.get(type);
    if (list && list.length) { const c = list.pop(); return c; }
    const root = this.creatures && this.creatures.makeGlimmer ? this.creatures.makeGlimmer(type) : fallbackBlob(type);
    root.name = 'cust_' + type;
    const anim = this.creatures && this.creatures.CreatureAnimator ? new this.creatures.CreatureAnimator(root, { vfx: this.vfx, onCoin: (p) => this._onCoin(p) }) : null;
    if (anim) anim._cust = null;
    const info = root.userData.info || {};
    const c = {
      id: ++_ids, type, root, anim, info,
      state: 'pooled', t: 0, waited: 0, stall: null, slot: -1, field: null, target: { x: 0, z: 0 }, result: null,
      speedMul: speedFor(type, info), patience: BASE_PATIENCE_S * (info.patience || 1),
      vel: { x: 0, z: 0 },
    };
    if (anim) anim._cust = c;
    this.scene.add(root); this.totalsPool.created++;
    return c;
  }

  /** 11A: free a surplus pooled root — merged (fused) geometries are per-instance, everything else is shared. */
  _dispose(c) {
    c.anim?.dispose?.(); c.anim = null;
    this.scene.remove(c.root);
    c.root.traverse((o) => { if (o.isMesh && o.geometry && /^merged_/.test(o.name)) o.geometry.dispose(); });
    this.totalsPool.disposed++;
  }

  _release(c) {
    c.state = 'pooled'; c.root.visible = false; c.root.scale.setScalar(1); c.root.position.set(0, -5, 0);
    this._leaveQueue(c);
    const i = this.active.indexOf(c); if (i >= 0) this.active.splice(i, 1);
    this.count = this.active.length;
    const list = this.pool.get(c.type) || this.pool.set(c.type, []).get(c.type);
    if (list.length >= this.poolCap) this._dispose(c); else list.push(c);
  }

  clear() {
    for (const c of this.active.slice()) this._release(c);
    this.pendingSpawns.length = 0; this.queues.clear(); this.count = 0;
  }

  // ------------------------------------------------------------------ stall choice + queues
  _stallList() { return this.build && this.build.stalls ? this.build.stalls() : []; }
  _queue(entry) { let q = this.queues.get(entry); if (!q) { q = []; this.queues.set(entry, q); } return q; }
  _leaveQueue(c) {
    if (!c.stall) return;
    const q = this.queues.get(c.stall.entry); if (q) { const i = q.indexOf(c); if (i >= 0) q.splice(i, 1); }
    c.stall = null; c.slot = -1;
  }
  /** Weighted stall pick: preference × 1/(1+queue) × 1/(1+dist/12). Returns a stalls() record or null. */
  pickStall(c) {
    const stalls = this._stallList(); if (!stalls.length) return null;
    const prefs = PREFS[c.type] || {};
    let best = null, bw = -1;
    for (const s of stalls) {
      const q = this._queue(s.entry);
      if (q.length >= s.slots.queue.length) continue;                    // full → not an option
      const kind = String(s.id).replace(/^stall_/, '');
      const pref = prefs[kind] ?? 1;
      const d = Math.hypot(s.slots.counter.x - c.root.position.x, s.slots.counter.z - c.root.position.z);
      const w = pref / (1 + q.length) / (1 + d / 12) * (0.85 + 0.3 * this.rng());
      if (w > bw) { bw = w; best = s; }
    }
    return best;
  }
  _join(c, s) {
    const q = this._queue(s.entry); q.push(c);
    c.stall = s; c.slot = q.length - 1;
    this._retarget(c);
  }
  _retarget(c) {
    if (!c.stall) return;
    const q = this._queue(c.stall.entry); c.slot = q.indexOf(c);
    const slot = c.stall.slots.queue[Math.min(c.slot, c.stall.slots.queue.length - 1)] || c.stall.slots.counter;
    c.target.x = slot.x; c.target.z = slot.z; c.field = null;
  }
  _stallAlive(c) { const live = this._stallList(); return live.some((s) => s.entry === c.stall.entry) ? true : false; }

  // ------------------------------------------------------------------ update
  update(dt) {
    this.time += dt;
    // timed spawns
    while (this.pendingSpawns.length && this.pendingSpawns[0].at <= this.time) {
      const p = this.pendingSpawns.shift();
      if (!this.spawnOne(p.type)) { this.pendingSpawns.unshift(p); p.at = this.time + 0.5; break; }
    }
    // stall removed under a queue? → everyone in it re-picks
    for (const [entry, q] of this.queues) {
      if (!this.build.placed || [...this.build.placed.values()].includes(entry)) continue;
      for (const c of q.slice()) { this._leaveQueue(c); if (c.state === 'walk' || c.state === 'queue' || c.state === 'browse') this._set(c, 'pickStall'); }
      this.queues.delete(entry);
    }
    for (let i = this.active.length - 1; i >= 0; i--) {
      const c = this.active[i];
      c.t += dt;
      switch (c.state) {
        case 'spawn': if (c.t >= 0.4) this._set(c, 'pickStall'); break;
        case 'pickStall': {
          const s = this.pickStall(c);
          if (s) { this._join(c, s); this._set(c, 'walk'); }
          else {
            // no stall at all → give up after 3 s ("no stall"); stalls exist but every queue is full → wait up to patience ("full")
            c.waited += dt; const any = this._stallList().length > 0;
            if (c.waited > (any ? Math.max(3, c.patience * 0.6) : 3)) { this.totals.gaveUp++; this._react(c, 'angry', any ? 'full' : 'no stall'); }
            else if (c.anim && c.anim.current !== 'wait') c.anim.play('wait');
          }
          break;
        }
        case 'walk': {
          const arrived = this._steer(c, dt);
          if (arrived) {
            if (c.slot === 0) { c.anim && c.anim.faceToNow(c.stall.group.position); this._set(c, 'browse'); }
            else { c.anim && c.anim.faceTo(c.stall.slots.counter); this._set(c, 'queue'); }
          }
          break;
        }
        case 'queue': {
          c.waited += dt;
          const q = this._queue(c.stall.entry); const idx = q.indexOf(c);
          if (idx !== c.slot) { this._retarget(c); this._set(c, 'walk'); break; }          // shuffle forward
          if (c.waited > c.patience) { this.totals.gaveUp++; this._react(c, 'angry', 'waited'); break; }
          if (idx === 0) { this._retarget(c); this._set(c, 'walk'); }
          break;
        }
        case 'browse': if (c.t * 1000 >= BROWSE_MS) this._set(c, 'pay'); break;
        case 'pay': if (c.t >= 0.4) this._settle(c); break;
        case 'react': if (c.t >= 0.6) this._set(c, 'leave'); break;
        case 'leave': {
          const arrived = this._steer(c, dt);
          if (arrived) { this._playLeave(c); }
          break;
        }
        case 'despawn': if (c.t >= 0.25) { this.totals.left++; this.bus.emit('cust:left', { id: c.id, type: c.type, result: c.result }); this._release(c); } break;
      }
      if (c.anim) c.anim.update(dt);
      if (c.root.userData.update) c.root.userData.update(dt);
    }
  }

  _set(c, state) {
    c.state = state; c.t = 0;
    const a = c.anim;
    if (state === 'pickStall') c.waited = 0;
    if (state === 'walk' && a) a.play('walk');
    if (state === 'queue' && a) a.play('wait');
    if (state === 'browse' && a) { a.play('browse'); c.waited = 0; }
    if (state === 'pay' && a) { a.faceToNow(c.stall.group.position); a.play('pay'); }
    if (state === 'leave') { this._leaveQueue(c); c.target.x = this.spawn.x; c.target.z = this.spawn.z; c.field = null; if (a) a.play('walk'); }
    this.bus.emit('cust:state', { id: c.id, state });
  }

  /** Flow-field + separation steering. Returns true when within ARRIVE_R of the target. */
  _steer(c, dt) {
    const p = c.root.position;
    const dx = c.target.x - p.x, dz = c.target.z - p.z, dist = Math.hypot(dx, dz);
    if (dist <= ARRIVE_R) { c.vel.x = c.vel.z = 0; return true; }
    if (!c.field) c.field = this.flow.get(c.target.x, c.target.z);
    let sx, sz;
    if (dist < 1.3 && this.flow._clear(p.x, p.z, c.target.x, c.target.z)) { sx = dx / dist; sz = dz / dist; }   // final approach straight in
    else { this.flow.direction(c.field, p.x, p.z, _d); sx = _d.x; sz = _d.z; if (sx === 0 && sz === 0) { sx = dx / dist; sz = dz / dist; } }
    // separation
    let fx = 0, fz = 0;
    for (const o of this.active) {
      if (o === c || o.state === 'pooled' || o.state === 'despawn') continue;
      const ox = p.x - o.root.position.x, oz = p.z - o.root.position.z; const d2 = ox * ox + oz * oz;
      if (d2 < SEP_RADIUS * SEP_RADIUS && d2 > 1e-6) { const d = Math.sqrt(d2); const k = (SEP_RADIUS - d) / SEP_RADIUS; fx += (ox / d) * k; fz += (oz / d) * k; }
    }
    sx += fx * SEP_FORCE; sz += fz * SEP_FORCE;
    const L = Math.hypot(sx, sz); if (L > 1e-6) { sx /= L; sz /= L; }
    const sp = c.speed * Math.min(1, 0.35 + dist / 1.2);           // arrive slow-down
    // smooth velocity
    c.vel.x += (sx * sp - c.vel.x) * Math.min(1, 10 * dt); c.vel.z += (sz * sp - c.vel.z) * Math.min(1, 10 * dt);
    let nx = p.x + c.vel.x * dt, nz = p.z + c.vel.z * dt;
    // never step into water / a stall footprint (slide along)
    if (!this.flow.walkable(nx, nz)) { if (this.flow.walkable(nx, p.z)) nz = p.z; else if (this.flow.walkable(p.x, nz)) nx = p.x; else { nx = p.x; nz = p.z; } }
    p.x = nx; p.z = nz;
    if (c.anim) { if (Math.hypot(c.vel.x, c.vel.z) > 0.05) { _v.set(p.x + c.vel.x, 0, p.z + c.vel.z); c.anim.faceTo(_v); } c.anim.timeScale = THREE.MathUtils.clamp(c.speed / BASE_SPEED, 0.8, 1.3); }
    return false;
  }

  // ------------------------------------------------------------------ transaction
  _settle(c) {
    const s = c.stall; if (!s || !this._stallAlive(c)) { this._react(c, 'sad', 'stall gone'); return; }
    const price = this.price(s.id), fair = this.fair(s.id);
    let r;
    // BUGFIX B10: the stall's CURRENT level (live BuildSystem entry) is passed so paid L2/L3 upgrades apply their sales multiplier
    if (this.economy && this.economy.sell) r = this.economy.sell(s.id, c.type, price, { level: (s.entry && s.entry.level) || s.level || 1 });
    else { r = { paid: price, sold: 1, fair, happy: price <= fair * 1.1, mood: 1 }; }
    const ratio = fair > 0 ? price / fair : 1;
    let mood, reaction;
    if (ratio > 1.4) { mood = 0.1; reaction = 'angry'; }                       // rip-off → angry (cust:angry)
    else if (r.sold === 0) { mood = 0.3; reaction = 'sad'; }                    // fair-ish price but nothing bought (wallet/demand) → sad
    else if (ratio <= 0.9) { mood = 1.0; reaction = 'happy'; }
    else if (ratio <= 1.1) { mood = 0.75; reaction = 'happy'; }
    else { mood = 0.35; reaction = 'sad'; }
    c.result = { paid: r.paid, sold: r.sold, price, fair, ratio: +ratio.toFixed(2), mood, reaction, stallId: s.id, type: c.type };
    if (c.anim) c.anim.moodTint(mood);
    if (r.paid > 0) {
      this.totals.paid++; this.totals.sparkEarned += r.paid;
      if (this.vfx && this.vfx.pop) { const p = c.root.position.clone(); p.y = 1.4; this.vfx.pop.show(p, `+${r.paid}`, { color: '#FFD54F', dur: 0.9, size: reaction === 'happy' && ratio <= 0.9 ? 1.2 : 1 }); }
      this.bus.emit('cust:paid', { id: c.id, type: c.type, stallId: s.id, paid: r.paid, sold: r.sold, price, fair, mood, reaction, at: { x: c.root.position.x, z: c.root.position.z } });
    }
    this._react(c, reaction, r.paid > 0 ? 'paid' : 'refused');
  }
  _react(c, reaction, why) {
    this._leaveQueue(c);
    c.state = 'react'; c.t = 0;
    if (c.anim) c.anim.play(reaction);
    if (reaction === 'angry') {
      this.totals.angry++;
      if (this.vfx && this.vfx.pop) { const p = c.root.position.clone(); p.y = 1.4; this.vfx.pop.show(p, why === 'waited' || why === 'full' ? 'zzz…' : why === 'no stall' ? '?' : '✗', { color: '#FF5252', dur: 0.8, size: 0.9 }); }
      this.bus.emit('cust:angry', { id: c.id, type: c.type, why, stallId: c.result ? c.result.stallId : null });
    }
    this.bus.emit('cust:state', { id: c.id, state: 'react', reaction, why });
  }
  _onCoin(worldPos) { // pay clip toss → VFX hook (9A coinFly if registered)
    if (!this.vfx) return;
    if (this.vfx.coinFly && this.game.followTarget) this.vfx.coinFly(worldPos, this.game.followTarget);
    else if (this.vfx.sparks) this.vfx.sparks.burst(worldPos, 4, 2);
  }

  // ------------------------------------------------------------------ spawn / leave sequences
  _playSpawn(c) {
    const g = c.root;
    const seq = new Sequence('custSpawn')
      .phase('pop', 260, Easing.outBack, (e) => { const s = 0.001 + 1.149 * e; g.scale.set(s, s, s); },
        { onEnter: () => { g.scale.setScalar(0.001); if (this.vfx && this.vfx.dust) this.vfx.dust.burst(g.position, 5, { size: 0.22, speed: 1.6, dur: 0.4, up: 0.5 }); } })
      .phase('settle', 120, Easing.outCubic, (e) => { const s = 1.15 + (1 - 1.15) * e; g.scale.set(s, s, s); }, { onExit: () => g.scale.setScalar(1) });
    this.game.sequences.play(seq, c);
    c.seq = seq;
  }
  _playLeave(c) {
    c.state = 'despawn'; c.t = 0;
    const g = c.root;
    const seq = new Sequence('custLeave')
      .phase('shrink', 220, Easing.inBack, (e) => { const s = Math.max(0.001, 1 - e); g.scale.set(s, s, s); g.position.y = -0.2 * e; },
        { onExit: () => { g.position.y = 0; if (this.vfx && this.vfx.dust) this.vfx.dust.burst(g.position, 4, { size: 0.2, speed: 1.4, dur: 0.35, up: 0.4 }); } });
    this.game.sequences.play(seq, c);
    c.seq = seq;
  }

  // ------------------------------------------------------------------ debug / save
  serialize() { return { totals: { ...this.totals }, prices: [...this.prices.entries()] }; }
  load(data) { if (data && data.prices) for (const [k, v] of data.prices) this.prices.set(k, v); if (data && data.totals) Object.assign(this.totals, data.totals); }
  byState() { const o = {}; for (const c of this.active) o[c.state] = (o[c.state] || 0) + 1; return o; }
}

let _ids = 0;
function speedFor(type, info) { const pat = info.patience || 1; return THREE.MathUtils.clamp(1.25 - 0.25 * pat, 0.75, 1.25) * (type === 'elder' ? 0.8 : type === 'kid' || type === 'impulse' ? 1.15 : 1); }
function mulberry(a) { return () => { a |= 0; a = (a + 0x6D2B79F5) | 0; let t = Math.imul(a ^ (a >>> 15), 1 | a); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; }; }
/** Minimal stand-in when no creature factory is injected (headless tests / integration without 2A). */
function fallbackBlob(type) {
  const g = new THREE.Group(); const body = new THREE.Group(); body.name = 'body'; g.add(body);
  const m = new THREE.Mesh(new THREE.SphereGeometry(0.4, 8, 6), new THREE.MeshBasicMaterial({ color: 0x4fc3f7 })); m.position.y = 0.4; body.add(m);
  g.userData.parts = { body, shell: m }; g.userData.type = type; g.userData.info = {};
  return g;
}

export default CustomerSystem;
