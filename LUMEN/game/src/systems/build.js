// Chat 5 — Build & placement system. Owned: src/systems/build.js, demo_build.html.
// Contract (API_CONTRACTS §B "Build"):
//   new BuildSystem(game, { island, economy, catalog: PROP_CATALOG, vfx? })
//     .enter(propId) .exit() .rotate() .confirm() .demolish(at) .upgrade(at) .update(dt)
//     .placed: Map<"x,z", { id, group, level, cells, rot, cost, category }>   (key = ANCHOR cell)
//     .occupied(x,z) → entry|null      .stalls() → [{ id, group, slots (WORLD Vector3s), level, entry }]
//   emits (game.bus): 'build:enter' 'build:exit' 'build:ghost' 'build:placed' 'build:removed' 'build:upgraded' 'build:denied'
//
// Grid: 1 u, cells are integer (x,z) — the same cells Island.isLand() / island.tiles use.
// A prop with footprint [w,d] anchored at cell (cx,cz) occupies cx..cx+w-1 × cz..cz+d-1 and its group sits at
// (cx + (w-1)/2, 0, cz + (d-1)/2). rot ∈ 0..3 (×90°); odd rot swaps w/d. Stalls face +Z at rot 0.
//
// Cost source (first that answers): economy.stallCost(id) (4A/4B balance) → catalog[id].cost → 0.
// Economy is OPTIONAL: without it everything is free and always affordable (stub canAfford).
//
// PLACE SEQUENCE  "buildPlace"  (ms, delta-time driven, pose set absolutely from onEnter snapshots)
//   drop     180  inQuad    y: +2.0 → 0, scale 1 (falls), stretch-y 1.15 while falling
//   land      90  outCubic  y 0, squash 1 → 0.80 (volume preserving)   onEnter: dust ring, pop "−cost", shake 0.12
//   pop      220  outBack   squash 0.80 → 1.0 (overshoot from outBack)
//   settle   120  outCubic  residual: scale → exactly 1
// DEMOLISH SEQUENCE  "buildDemolish"
//   anticipation 120 outBack   scale 1 → 1.12 (puff up)
//   shrink       220 inBack    scale 1.12 → 0.0, y sinks 0 → −0.3      onExit: dust burst, remove from scene, refund pop
// UPGRADE: delegates to the stall's own userData.setLevel(lvl, { animate:true, game, vfx }) (1A "stallLevelUp").

import * as THREE from '../../vendor/three.module.js';
/** P10: friendly ids → catalog ids (the Warm Loaf Bakery card is `stall_bread`); saves keep the catalog id. */
export const PROP_ALIASES = { stall_bakery: 'stall_bread', stall_loaf: 'stall_bread' };
import { Sequence } from '../anim/Sequencer.js';
import { Easing } from '../anim/Easing.js';
import { setSquash } from '../anim/SquashStretch.js';
import { bus as globalBus } from '../core/EventBus.js';

const key = (x, z) => `${x},${z}`;
const GHOST_OK = 0x66ff88, GHOST_BAD = 0xff5566, GHOST_ALPHA = 0.55;
const DEFAULT_LEVEL_COST = { 2: 90, 3: 180 };     // used when economy.upgrades has no stallL2/stallL3
export const REFUND_RATIO = 0.5;

export class BuildSystem {
  /**
   * @param {object} game  Game (or a mock with scene, input, sequences, bus?, camera?)
   * @param {{island?:any, economy?:any, catalog:object, vfx?:any, grid?:number, scene?:THREE.Object3D}} deps
   */
  constructor(game, deps = {}) {
    this.game = game;
    this.island = deps.island || null;
    this.economy = deps.economy || null;
    this.catalog = deps.catalog || {};
    this.vfx = deps.vfx || null;
    this.bus = (game && game.bus) || globalBus;
    this.parent = deps.scene || game.scene;
    this.grid = deps.grid || 1;
    this.makeProp = deps.makeProp || null;      // optional override (default: catalog[id].make)

    this.placed = new Map();   // anchor "x,z" → entry
    this.cells = new Map();    // every occupied "x,z" → entry
    this.mode = 'idle';        // 'idle' | 'place'
    this.propId = null;
    this.rot = 0;
    this.ghost = null;         // { group, pad, mats:Material[], ok:boolean, cx, cz }
    this.cursor = { cx: 0, cz: 0, ok: false };
    this.lastPointer = new THREE.Vector3();
    this.busy = new Set();     // groups mid-sequence (demolish/place) — ignore double input
    this.debugMesh = null;
    this._counter = 0;
    this._tmp = new THREE.Vector3();

    // touch flow (P3): Input.press('build') while a ghost is up → confirm. Build key with no ghost → nothing (UI decides what to enter).
    this._onAction = (name) => { if (name === 'build' && this.mode === 'place') this.confirm(); };
  }

  // --------------------------------------------------------------- queries
  entry(id) { return this.catalog[id] || this.catalog[PROP_ALIASES[id]] || null; }
  /** footprint [w,d] for id at rotation rot */
  footprint(id, rot = this.rot) {
    const e = this.entry(id); const fp = (e && e.footprint) || [1, 1];
    return (rot & 1) ? [fp[1], fp[0]] : [fp[0], fp[1]];
  }
  /** cells covered by id anchored at (cx,cz) with rot */
  cellsFor(id, cx, cz, rot = this.rot) {
    const [w, d] = this.footprint(id, rot); const out = [];
    for (let i = 0; i < w; i++) for (let j = 0; j < d; j++) out.push({ x: cx + i, z: cz + j });
    return out;
  }
  /** world position of the group for an anchor */
  anchorToWorld(id, cx, cz, rot = this.rot) {
    const [w, d] = this.footprint(id, rot);
    return new THREE.Vector3(cx + (w - 1) / 2, 0, cz + (d - 1) / 2);
  }
  /** snap a world point to the anchor cell so the footprint is centred on it */
  worldToAnchor(id, x, z, rot = this.rot) {
    const [w, d] = this.footprint(id, rot);
    return { cx: Math.round(x - (w - 1) / 2), cz: Math.round(z - (d - 1) / 2) };
  }
  isLand(x, z) { return this.island ? this.island.isLand(x, z) : true; }
  occupied(x, z) { return this.cells.get(key(Math.round(x), Math.round(z))) || null; }
  /** true when every cell is land and free */
  canPlace(id, cx, cz, rot = this.rot) {
    if (!this.entry(id)) return false;
    for (const c of this.cellsFor(id, cx, cz, rot)) if (!this.isLand(c.x, c.z) || this.cells.has(key(c.x, c.z))) return false;
    return true;
  }
  cost(id) {
    const e = this.entry(id);
    if (this.economy && typeof this.economy.stallCost === 'function' && e && e.category === 'stall') {
      const c = this.economy.stallCost(id); if (isFinite(c)) return c;
    }
    return (e && e.cost) || 0;
  }
  upgradeCost(level) { // cost to go TO `level`
    const u = this.economy && this.economy.upgrades;
    const id = level === 2 ? 'stallL2' : 'stallL3';
    return (u && u[id] && u[id].cost) || DEFAULT_LEVEL_COST[level] || Infinity;
  }
  canAfford(cost) { return this.economy ? this.economy.canAfford(cost) : true; }
  /** all placed stalls with WORLD-space slots (for the customer system) */
  stalls() {
    const out = [];
    for (const e of this.placed.values()) {
      if (e.category !== 'stall') continue;
      const s = e.group.userData.slots || {};
      e.group.updateMatrixWorld(true);
      const w = (v) => e.group.localToWorld(v.clone());
      out.push({ id: e.id, group: e.group, level: e.level, entry: e,
        slots: { counter: s.counter ? w(s.counter) : e.group.position.clone(), queue: (s.queue || []).map(w), sign: s.sign || null } });
    }
    return out;
  }
  /** entry whose footprint contains / is nearest to a point (x,z) within `radius`.
   *  BUGFIX P14: a pre-spawned scenery sentinel (`entry.scenery`, cost 0, not in `placed`) under the point no longer wins over a
   *  real placed prop within `radius` — the plaza has ~100 scenery cells, so most slightly-off taps used to resolve to scenery and
   *  the caller's `!e.scenery` filter silently aborted. Scenery is returned only when nothing placed is in range. */
  nearest(x, z, radius = 1.6) {
    const hit = this.occupied(x, z); if (hit && !hit.scenery) return hit;
    let best = null, bd = radius;
    for (const e of this.placed.values()) {
      // distance to the footprint (0 inside), not just to the anchor, so wide props are picked from any of their cells
      let d = Infinity; for (const c of e.cells) d = Math.min(d, Math.hypot(c.x - x, c.z - z));
      d = Math.min(d, Math.hypot(e.group.position.x - x, e.group.position.z - z));
      if (d < bd) { bd = d; best = e; }
    }
    return best || hit;
  }
  /** BUGFIX P17: the placed prop whose 3D meshes the camera ray hits (so a click on a stall's roof/sign/awning picks THAT stall, not the
   *  ground 1.9 u behind it). `ray` is a THREE.Ray (e.g. input._ray.ray after _project()). Returns entry | null. Ghost / busy groups skipped. */
  pick(ray) {
    if (!ray || this.placed.size === 0) return null;
    const rc = this._picker || (this._picker = new THREE.Raycaster()); rc.ray.copy(ray); rc.near = 0; rc.far = Infinity;
    const groups = []; for (const e of this.placed.values()) if (e.group.visible && !this.busy.has(e.group)) groups.push(e.group);
    const hits = rc.intersectObjects(groups, true); if (!hits.length) return null;
    let o = hits[0].object; while (o) { for (const e of this.placed.values()) if (e.group === o) return e; o = o.parent; }
    return null;
  }
  /** resolve "at": entry | group | {x,z} | Vector3 | "x,z" */
  _resolve(at) {
    if (!at) return null;
    if (at.group && at.cells) return at;
    if (at.isObject3D) { for (const e of this.placed.values()) if (e.group === at) return e; return null; }
    if (typeof at === 'string') { const [x, z] = at.split(',').map(Number); return this.nearest(x, z); }
    return this.nearest(at.x, at.z);
  }

  // --------------------------------------------------------------- ghost / mode
  enter(propId) {
    if (!this.entry(propId)) { this._deny('unknown prop ' + propId, { id: propId }); return false; }
    if (!this.catalog[propId] && PROP_ALIASES[propId]) propId = PROP_ALIASES[propId];   // P10: normalise to the catalog id (placed/save use it)
    this.exit(true);
    this.mode = 'place'; this.propId = propId;
    this._makeGhost();
    if (this.game && this.game.input && !this._bound) { const prev = this.game.input.onAction; this.game.input.onAction = (n) => { if (prev) prev(n); this._onAction(n); }; this._bound = true; }
    this.bus.emit('build:enter', { id: propId, cost: this.cost(propId), rot: this.rot });
    const f = this.followTarget && this.game && this.game.input && this.game.input.isTouch ? this.followTarget() : null;   // touch: spawn in front of Pip
    if (f) this.lastPointer.set(f.x, 0, f.z);
    this._placeGhost(this.lastPointer.x, this.lastPointer.z, true);
    return true;
  }
  exit(silent = false) {
    if (this.ghost) { this.parent.remove(this.ghost.group); this.parent.remove(this.ghost.pad); for (const m of this.ghost.mats) m.dispose(); this.ghost.pad.geometry.dispose(); this.ghost = null; }
    const was = this.mode; this.mode = 'idle';
    if (!silent && was === 'place') this.bus.emit('build:exit', { id: this.propId });
  }
  rotate(dir = 1) {
    this.rot = (this.rot + dir + 4) % 4;
    if (this.ghost) { this.ghost.group.rotation.y = this.rot * Math.PI / 2; this._placeGhost(this.lastPointer.x, this.lastPointer.z, true); }
    return this.rot;
  }
  _build(id, opts = {}) {
    const e = this.entry(id);
    const g = this.makeProp ? this.makeProp(id, opts) : e.make(opts);
    g.userData.propId = id; g.userData.footprint = g.userData.footprint || e.footprint || [1, 1]; g.userData.category = g.userData.category || e.category || 'prop';
    return g;
  }
  _makeGhost() {
    const g = this._build(this.propId, { level: 1, outline: false, sway: false });
    const okMat = new THREE.MeshBasicMaterial({ color: GHOST_OK, transparent: true, opacity: GHOST_ALPHA, depthWrite: false });
    const badMat = new THREE.MeshBasicMaterial({ color: GHOST_BAD, transparent: true, opacity: GHOST_ALPHA, depthWrite: false });
    g.traverse((o) => { if (o.isMesh) { o.castShadow = false; o.receiveShadow = false; o.material = okMat; } });
    g.rotation.y = this.rot * Math.PI / 2;
    const [w, d] = this.footprint(this.propId, 0);
    const pad = new THREE.Mesh(new THREE.PlaneGeometry(w, d), new THREE.MeshBasicMaterial({ color: GHOST_OK, transparent: true, opacity: 0.35, depthWrite: false, side: THREE.DoubleSide }));
    pad.rotation.x = -Math.PI / 2; pad.position.y = 0.03; pad.userData.noOutline = true; pad.name = 'buildPad';
    g.name = 'buildGhost'; g.userData.isGhost = true;
    this.parent.add(g); this.parent.add(pad);
    this.ghost = { group: g, pad, okMat, badMat, mats: [okMat, badMat, pad.material], ok: false, cx: 0, cz: 0 };
  }
  _placeGhost(x, z, force = false) {
    if (!this.ghost) return;
    const { cx, cz } = this.worldToAnchor(this.propId, x, z);
    const ok = this.canPlace(this.propId, cx, cz);
    const moved = cx !== this.ghost.cx || cz !== this.ghost.cz || ok !== this.ghost.ok;
    if (!moved && !force) return;
    this.ghost.cx = cx; this.ghost.cz = cz; this.ghost.ok = ok;
    this.cursor = { cx, cz, ok };
    const p = this.anchorToWorld(this.propId, cx, cz);
    this.ghost.group.position.copy(p);
    this.ghost.pad.position.set(p.x, 0.03, p.z); this.ghost.pad.rotation.z = this.rot * Math.PI / 2;
    const mat = ok ? this.ghost.okMat : this.ghost.badMat;
    this.ghost.group.traverse((o) => { if (o.isMesh && o.material !== mat) o.material = mat; });
    this.ghost.pad.material.color.setHex(ok ? GHOST_OK : GHOST_BAD);
    this.bus.emit('build:ghost', { id: this.propId, cx, cz, ok, rot: this.rot });
  }
  /** move the ghost to a world point (tap-to-move on touch); returns validity */
  moveTo(x, z) { this.lastPointer.set(x, 0, z); this._placeGhost(x, z); return this.cursor.ok; }

  // --------------------------------------------------------------- place
  /** Place the current ghost. Returns the entry or null (emits 'build:denied' with why). */
  confirm() {
    if (this.mode !== 'place' || !this.ghost) { this._deny('not in build mode'); return null; }
    const id = this.propId, { cx, cz } = this.ghost;
    return this.place(id, cx, cz, this.rot, { animate: true, pay: true });
  }
  /**
   * Place `id` at anchor (cx,cz). opts: { rot, animate=true, pay=true, level=1, silent }
   * Used by confirm() and by save/load (pay:false, animate:false).
   */
  place(id, cx, cz, rot = this.rot, opts = {}) {
    const animate = opts.animate !== false, pay = opts.pay !== false;
    if (!this.canPlace(id, cx, cz, rot)) { this._deny('blocked', { id, cx, cz }); return null; }
    // BUGFIX P24: a stall placed without paying (starter / restore) still has a resale value — its catalog price (+ later upgrades).
    // opts.cost overrides (save/load passes the accumulated cost). Only the ECONOMY charge depends on `pay`.
    const e = this.entry(id);
    const cost = opts.cost != null ? opts.cost : this.cost(id);
    if (pay && this.economy) {
      if (!this.canAfford(cost)) { this._deny('cannot afford', { id, cost, spark: this.economy.state && this.economy.state.spark }); return null; }
      const ok = (e.category === 'stall' && this.economy.buyStall) ? this.economy.buyStall(id) : this.economy.spend(cost, 'build:' + id);
      if (!ok) { this._deny('economy refused', { id, cost }); return null; }
    }
    // real prop (ghost stays a ghost: cheaper than restoring ~40 materials; we rebuild with outline)
    const group = this._build(id, { level: opts.level || 1 });
    group.rotation.y = rot * Math.PI / 2;
    group.position.copy(this.anchorToWorld(id, cx, cz, rot));
    const entry = { id, group, level: group.userData.level || opts.level || 1, cells: this.cellsFor(id, cx, cz, rot), rot, cost: cost + (opts.level > 1 && opts.cost == null ? [2, 3].slice(0, opts.level - 1).reduce((a, l) => a + this.upgradeCost(l), 0) : 0), cx, cz, category: group.userData.category || e.category || 'prop', uid: ++this._counter };
    this.placed.set(key(cx, cz), entry);
    for (const c of entry.cells) this.cells.set(key(c.x, c.z), entry);
    this.parent.add(group);
    if (animate && this.game && this.game.sequences) {
      this.busy.add(group);
      const seq = this.makePlaceSequence(entry, pay ? cost : 0);
      seq.then(() => this.busy.delete(group));
      this.game.sequences.play(seq, entry);
      entry.seq = seq;
    }
    this._updateDebug();
    if (!opts.silent) this.bus.emit('build:placed', { id, group, level: entry.level, cx, cz, rot, cost, cells: entry.cells, entry });
    // stay in build mode: re-arm the ghost (it is now red where we just built)
    if (this.mode === 'place' && this.ghost) this._placeGhost(this.lastPointer.x, this.lastPointer.z, true);
    return entry;
  }
  makePlaceSequence(entry, cost) {
    const g = entry.group, vfx = this.vfx, game = this.game;
    const from = 2.0;
    return new Sequence('buildPlace')
      .phase('drop', 180, Easing.inQuad, (e) => { g.position.y = from * (1 - e); const s = 1 + 0.15 * (1 - e); g.scale.set(1 / Math.sqrt(s), s, 1 / Math.sqrt(s)); },
        { onEnter: () => { g.position.y = from; } })
      .phase('land', 90, Easing.outCubic, (e) => { g.position.y = 0; setSquash(g, 1 - 0.2 * e, 'y'); },
        { onEnter: () => {
          g.position.y = 0;
          if (vfx) { vfx.dust.ring(g.position, 10, 0.26); vfx.dust.burst(g.position, 6, { size: 0.3, speed: 2, dur: 0.5, up: 0.6 });
            if (cost > 0) { const p = g.position.clone(); p.y = 1.8; vfx.pop.show(p, `−${cost}`, { color: '#FF7043', dur: 0.9, size: 1 }); } }
          if (game && game.camera && game.camera.shake) game.camera.shake(0.12);
        } })
      .phase('pop', 220, Easing.outBack, (e) => { setSquash(g, 0.8 + 0.2 * e, 'y'); })
      .phase('settle', 120, Easing.outCubic, (e, ctx, t, ph) => { const s = ph.state; g.scale.set(s.x + (1 - s.x) * e, s.y + (1 - s.y) * e, s.z + (1 - s.z) * e); },
        { onEnter: (ctx, ph) => { ph.state.x = g.scale.x; ph.state.y = g.scale.y; ph.state.z = g.scale.z; }, onExit: () => { g.scale.set(1, 1, 1); g.position.y = 0; } });
  }

  // --------------------------------------------------------------- demolish
  /** Remove a placed prop. Refund 50 %. `at` = entry | group | {x,z} | Vector3 | "x,z". opts { animate=true, refund=true } */
  demolish(at, opts = {}) {
    const entry = this._resolve(at);
    if (!entry) { this._deny('nothing to demolish', { at }); return false; }
    if (entry.scenery || !this.placed.has(key(entry.cx, entry.cz))) { this._deny('not yours to demolish', { id: entry.id, scenery: !!entry.scenery }); return false; }   // BUGFIX P19
    if (this.busy.has(entry.group) || entry.group.userData.swapping) { this._deny('still building — wait a moment', { id: entry.id }); return false; }   // BUGFIX P26: no demolish mid level-up
    const animate = opts.animate !== false;
    const refund = opts.refund === false ? 0 : Math.round(entry.cost * REFUND_RATIO + 1e-9);
    // bookkeeping first (so the cells are free immediately for the ghost)
    this.placed.delete(key(entry.cx, entry.cz));
    for (const c of entry.cells) if (this.cells.get(key(c.x, c.z)) === entry) this.cells.delete(key(c.x, c.z));
    if (this.economy) {
      if (refund > 0 && this.economy.earn) this.economy.earn(refund, 'refund:' + entry.id);
      if (entry.category === 'stall' && this.economy.removeStall) this.economy.removeStall(1);
    }
    const finish = () => { this.parent.remove(entry.group); this.busy.delete(entry.group); if (entry.group.userData.dispose) entry.group.userData.dispose(); };
    if (animate && this.game && this.game.sequences) {
      this.busy.add(entry.group);
      const seq = this.makeDemolishSequence(entry, refund);
      seq.then(finish);
      this.game.sequences.play(seq, entry);
    } else finish();
    this._updateDebug();
    this.bus.emit('build:removed', { id: entry.id, group: entry.group, cx: entry.cx, cz: entry.cz, refund, entry });
    if (this.mode === 'place' && this.ghost) this._placeGhost(this.lastPointer.x, this.lastPointer.z, true);
    return true;
  }
  makeDemolishSequence(entry, refund) {
    const g = entry.group, vfx = this.vfx;
    return new Sequence('buildDemolish')
      .phase('anticipation', 120, Easing.outBack, (e) => { const s = 1 + 0.12 * e; g.scale.set(s, s, s); })
      .phase('shrink', 220, Easing.inBack, (e) => { const s = Math.max(0.001, 1.12 * (1 - e)); g.scale.set(s, s, s); g.position.y = -0.3 * e; },
        { onExit: () => {
          if (vfx) { vfx.dust.burst(new THREE.Vector3(g.position.x, 0, g.position.z), 10, { size: 0.3, speed: 2.2, dur: 0.5, up: 0.9 });
            if (refund > 0) vfx.pop.show(new THREE.Vector3(g.position.x, 1.4, g.position.z), `+${refund}`, { color: '#FFD54F', dur: 0.9, size: 1 }); }
          g.visible = false;
        } });
  }

  // --------------------------------------------------------------- upgrade
  /** Upgrade a stall one level (max 3). Pays economy.upgrades.stallL2/L3 cost. Returns the Sequence | true | false. */
  upgrade(at) {
    const entry = this._resolve(at);
    if (!entry) { this._deny('nothing to upgrade', { at }); return false; }
    if (entry.scenery) { this._deny('not upgradable', { id: entry.id }); return false; }   // BUGFIX P19
    if (entry.category !== 'stall' || typeof entry.group.userData.setLevel !== 'function') { this._deny('not upgradable', { id: entry.id }); return false; }
    if (entry.level >= 3) { this._deny('max level', { id: entry.id, level: entry.level }); return false; }
    if (entry.group.userData.swapping || this.busy.has(entry.group)) { this._deny('still upgrading — wait a moment', { id: entry.id, level: entry.level }); return false; }   // BUGFIX P25: tell the UI instead of a silent false
    const to = entry.level + 1, cost = this.upgradeCost(to);
    if (this.economy) {
      if (!this.canAfford(cost)) { this._deny('cannot afford', { id: entry.id, cost, spark: this.economy.state && this.economy.state.spark }); return false; }
      if (!this.economy.spend(cost, 'upgrade:' + entry.id + ':L' + to)) { this._deny('economy refused', { id: entry.id, cost }); return false; }
    }
    const canAnim = !!(this.game && this.game.sequences);
    const seq = entry.group.userData.setLevel(to, { animate: canAnim, game: this.game, sequences: this.game && this.game.sequences, vfx: this.vfx });
    entry.level = to; entry.cost += cost;   // cost accumulates → 50 % refund includes upgrades
    // BUGFIX P26: the group is busy (not pickable / demolishable) until the level-up sequence ends.
    if (seq && typeof seq.then === 'function') { this.busy.add(entry.group); seq.then(() => { this.busy.delete(entry.group); this.bus.emit('build:upgraded:done', { id: entry.id, level: to, entry }); }); }
    if (this.vfx && cost > 0) { const p = entry.group.position.clone(); p.y = 2.2; this.vfx.pop.show(p, `L${to}  −${cost}`, { color: '#FFD54F', dur: 1, size: 1 }); }
    this.bus.emit('build:upgraded', { id: entry.id, group: entry.group, level: to, cost, entry });
    return seq || true;
  }

  // --------------------------------------------------------------- per frame
  update(dt) {
    const input = this.game && this.game.input;
    if (this.mode === 'place' && input && input.hasPointerWorld && !input.isTouch) {
      this.lastPointer.copy(input.pointerWorld);
      this._placeGhost(this.lastPointer.x, this.lastPointer.z);
    } else if (this.mode === 'place' && input && input.isTouch) {
      // BUGFIX (mobile): on touch the ghost used to stay where it spawned (map centre) — only rotate worked.
      //  • a finger dragging on the island (not the joystick) drags the ghost under it
      //  • walking Pip with the joystick carries the ghost 2 cells in front of him (so you can "walk it" to the spot)
      //  • a tap on the ground jumps it there (Game.js onTap → moveTo); ✓ place / 🔨 confirms
      if (input.pointerDrag >= 0 && input.pointerDown && input.hasPointerWorld) { this.lastPointer.copy(input.pointerWorld); this._placeGhost(this.lastPointer.x, this.lastPointer.z); }
      else if (this.followTarget && input.move && input.move.lengthSq() > 0.04) {
        const f = this.followTarget(); if (f) { this.lastPointer.set(f.x, 0, f.z); this._placeGhost(f.x, f.z); }
      }
    }
    if (this.ghost) { // gentle hover so the ghost reads as "not yet real"
      const t = (this.game && this.game.time) || 0;
      this.ghost.group.position.y = 0.08 + Math.sin(t * 4) * 0.04;
    }
    for (const e of this.placed.values()) if (e.group.userData.update) e.group.userData.update(dt);
  }

  // --------------------------------------------------------------- debug overlay (P3)
  setDebug(on = true) {
    if (on && !this.debugMesh) {
      const geo = new THREE.PlaneGeometry(0.92, 0.92); geo.rotateX(-Math.PI / 2);
      const m = new THREE.InstancedMesh(geo, new THREE.MeshBasicMaterial({ color: 0xff5566, transparent: true, opacity: 0.35, depthWrite: false }), 512);
      m.name = 'buildDebug'; m.userData.noOutline = true; m.frustumCulled = false; m.count = 0; this.debugMesh = m; this.parent.add(m);
    }
    if (!on && this.debugMesh) { this.parent.remove(this.debugMesh); this.debugMesh.geometry.dispose(); this.debugMesh.material.dispose(); this.debugMesh = null; }
    this._updateDebug();
    return !!this.debugMesh;
  }
  _updateDebug() {
    const m = this.debugMesh; if (!m) return;
    const mat = new THREE.Matrix4(); let i = 0;
    for (const k of this.cells.keys()) { if (i >= 512) break; const [x, z] = k.split(',').map(Number); mat.makeTranslation(x, 0.05, z); m.setMatrixAt(i++, mat); }
    m.count = i; m.instanceMatrix.needsUpdate = true;
  }

  // --------------------------------------------------------------- save / load (for Chat 10D)
  serialize() { return [...this.placed.values()].map((e) => ({ id: e.id, cx: e.cx, cz: e.cz, rot: e.rot, level: e.level, cost: e.cost })); }
  /** Re-place saved props instantly, no cost, no events per item. Returns count. */
  load(list = []) {
    let n = 0;
    for (const s of list) { const e = this.place(s.id, s.cx, s.cz, s.rot || 0, { animate: false, pay: false, level: s.level || 1, silent: true, cost: s.cost }); if (e) n++; }
    this.bus.emit('build:loaded', { count: n });
    return n;
  }
  clear() { for (const e of [...this.placed.values()]) this.demolish(e, { animate: false, refund: false }); }

  _deny(why, extra = {}) { this.bus.emit('build:denied', { why, ...extra }); }
}

export default BuildSystem;
