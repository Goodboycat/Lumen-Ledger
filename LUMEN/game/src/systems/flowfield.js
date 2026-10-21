// Chat 6A — FlowField: BFS distance field on the Island grid, cached per target cell. PURE JS (no Three import)
// so it runs headless in Node (tools/check.mjs --customers).
//
//   const ff = new FlowField({ isLand: (x,z)=>bool, isBlocked?: (x,z)=>bool, cells: () => [{x,z}], maxCache: 24 });
//   const field = ff.get(tx, tz)                 // { tx, tz, dist: Map "x,z" → steps, next: Map "x,z" → "x,z" }  (cached)
//   ff.direction(field, x, z, out={x,z})          // unit step toward the target from the cell containing (x,z); {0,0} when there
//   ff.distance(field, x, z) → steps | Infinity
//   ff.invalidate()                               // call when the walkable set changes (build:placed / build:removed / zone unlock)
//   ff.nearestWalkable(x, z, r=4) → {x,z}|null    // nearest walkable cell (spiral search) — used for spawn/leave points
//
// Grid = integer cells, same as Island.isLand() and BuildSystem.occupied(). Walkable = isLand && !isBlocked.
// 8-neighbour BFS with corner cutting forbidden (both orthogonal cells must be walkable) so blobs never clip
// a stall corner. Diagonal steps cost 1.4, straight 1 (Dijkstra-lite via a two-bucket queue; integer+fraction
// costs are small so a simple sorted insertion is fine for ≤ ~1500 cells).

const key = (x, z) => `${x},${z}`;
const N8 = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.4], [1, -1, 1.4], [-1, 1, 1.4], [-1, -1, 1.4]];

export class FlowField {
  constructor(opts = {}) {
    this.isLand = opts.isLand || (() => true);
    this.isBlocked = opts.isBlocked || (() => false);
    this.cellsFn = opts.cells || null;
    this.maxCache = opts.maxCache ?? 24;
    this.cache = new Map();          // "tx,tz" → field
    this.order = [];                 // LRU keys
    this.version = 0;
    this.stats = { builds: 0, hits: 0 };
  }

  walkable(x, z) { x = Math.round(x); z = Math.round(z); return this.isLand(x, z) && !this.isBlocked(x, z); }

  /** Drop every cached field (walkable set changed). */
  invalidate() { this.cache.clear(); this.order.length = 0; this.version++; return this; }

  /** Field toward target cell (tx,tz). If the target itself is blocked (a stall slot sits inside the footprint — it does not;
   *  but a counter slot may be at the edge), the BFS still seeds from it so neighbours can route to it. */
  get(tx, tz) {
    tx = Math.round(tx); tz = Math.round(tz);
    const k = key(tx, tz);
    let f = this.cache.get(k);
    if (f) { this.stats.hits++; return f; }
    f = this._build(tx, tz);
    this.cache.set(k, f); this.order.push(k);
    if (this.order.length > this.maxCache) { const old = this.order.shift(); this.cache.delete(old); }
    return f;
  }

  _build(tx, tz) {
    this.stats.builds++;
    const dist = new Map(); const next = new Map();
    const tk = key(tx, tz);
    dist.set(tk, 0);
    // small priority queue (costs are 1 / 1.4 so a sorted array insertion is cheap)
    const open = [{ x: tx, z: tz, d: 0 }];
    while (open.length) {
      const cur = open.shift();
      const ck = key(cur.x, cur.z);
      if (dist.get(ck) < cur.d) continue;           // stale entry
      for (const [dx, dz, w] of N8) {
        const nx = cur.x + dx, nz = cur.z + dz;
        if (!this.walkable(nx, nz)) continue;
        if (dx !== 0 && dz !== 0 && (!this.walkable(cur.x + dx, cur.z) || !this.walkable(cur.x, cur.z + dz))) continue; // no corner cutting
        const nd = cur.d + w;
        const nk = key(nx, nz);
        const prev = dist.get(nk);
        if (prev !== undefined && prev <= nd) continue;
        dist.set(nk, nd); next.set(nk, ck);
        // sorted insert
        let i = open.length; while (i > 0 && open[i - 1].d > nd) i--;
        open.splice(i, 0, { x: nx, z: nz, d: nd });
      }
    }
    return { tx, tz, dist, next, version: this.version };
  }

  distance(field, x, z) { const d = field.dist.get(key(Math.round(x), Math.round(z))); return d === undefined ? Infinity : d; }

  /** Unit direction from world (x,z) toward the next cell on the path. Returns {x:0,z:0} at the target / when unreachable. */
  direction(field, x, z, out = { x: 0, z: 0 }) {
    const cx = Math.round(x), cz = Math.round(z);
    const ck = key(cx, cz);
    if (cx === field.tx && cz === field.tz) { out.x = field.tx - x; out.z = field.tz - z; return norm(out); }
    const nk = field.next.get(ck);
    if (!nk) {
      // off-field (e.g. standing on a blocked cell): aim at the nearest walkable neighbour that IS on the field
      let best = null, bd = Infinity;
      for (const [dx, dz] of N8) { const d = field.dist.get(key(cx + dx, cz + dz)); if (d !== undefined && d < bd) { bd = d; best = [cx + dx, cz + dz]; } }
      if (!best) { out.x = 0; out.z = 0; return out; }
      out.x = best[0] - x; out.z = best[1] - z; return norm(out);
    }
    const [nx, nz] = nk.split(',').map(Number);
    // steer toward the centre of the next cell, but look one more step ahead for smoother diagonals
    const nnk = field.next.get(nk);
    let ax = nx, az = nz;
    if (nnk) { const [mx, mz] = nnk.split(',').map(Number); if (this._clear(x, z, mx, mz)) { ax = mx; az = mz; } }
    out.x = ax - x; out.z = az - z;
    return norm(out);
  }

  /** Straight-line clearance test (samples every 0.5 u). */
  _clear(x0, z0, x1, z1) {
    const dx = x1 - x0, dz = z1 - z0, L = Math.hypot(dx, dz); if (L < 1e-6) return true;
    const n = Math.ceil(L / 0.5);
    for (let i = 1; i <= n; i++) { const t = i / n; if (!this.walkable(x0 + dx * t, z0 + dz * t)) return false; }
    return true;
  }

  /** Nearest walkable cell to (x,z) within radius r (spiral), or null. */
  nearestWalkable(x, z, r = 4) {
    const cx = Math.round(x), cz = Math.round(z);
    if (this.walkable(cx, cz)) return { x: cx, z: cz };
    let best = null, bd = Infinity;
    for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) {
      const d = dx * dx + dz * dz; if (d >= bd) continue;
      if (this.walkable(cx + dx, cz + dz)) { bd = d; best = { x: cx + dx, z: cz + dz }; }
    }
    return best;
  }

  /** Reachable cell count from a target (debug / tests). */
  reach(tx, tz) { return this.get(tx, tz).dist.size; }
}

function norm(v) { const L = Math.hypot(v.x, v.z); if (L > 1e-6) { v.x /= L; v.z /= L; } else { v.x = 0; v.z = 0; } return v; }

export default FlowField;
