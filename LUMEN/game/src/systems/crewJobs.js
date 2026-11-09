// T3 (FUN_PASS §4 T3, S56) — the crew DO visible jobs. PRESENTATION ONLY: no balance number is changed here.
//   const crew = installCrew(sb);   // sb.crew; Game.js: hireHelper → crew.hire(h, { restore }) · sb.update → crew.update(dt) · seatHelper → crew.retarget(h)
//
// Every hired helper gets
//   1. a HIRE MOMENT   it appears at the pier, a hello pop, and walks to its post (≤ ARRIVE_S seconds, any distance)      bus crew:arrive {type} → crew:posted {type}
//   2. a POST          that never needs a stall: Owl → Save jar · Tortoise → Protect jar · Fox → pier lookout · Snail → wanders by the cottage ·
//                      Mole → patrols the stalls · Bee → circles the busiest stall. Missing anchor (jar not built / no stall) → near the cottage.
//   3. a JOB LOOP      idle ⇄ work (the HelperAnimator clips), re-evaluated every 1 s so a jar built later pulls its keeper over      bus crew:work {type}
//   4. a PAYOFF POP    icon + ≤ 4 chars each time the effect "fires", carrying the REAL numbers the economy applies anyway:
//                      Owl +N (Save interest bonus, spread over the season, remainder flushed at season end) · Mole −N (stall upkeep it cut) ·
//                      Bee +10% per sale at its stall (attributed share of the sale) · Tortoise 🛡 N (extra the Protect jar absorbed) ·
//                      Fox ! over a stranger (scam:npc) · Snail 🌱 flower trail + one bloom bed per season                    bus crew:payoff {type, value, text}
//   5. a LEDGER LINE   report.crew = { total, rows:[{type,name,value,label}] } — informational (already inside the other rows, never added to Net)
// Fox hook for T4/T5: bus crew:alert {type:'scoutFox', x, z} fires whenever it spots a stranger.
// Draw calls: +1 (one InstancedMesh of flowers, hidden at 0 flowers). Allocation: none per frame (module temps).
import * as THREE from '../../vendor/three.module.js';

export const HELPER_ORDER = ['tallyOwl', 'packMole', 'sparkBee', 'guardTortoise', 'scoutFox', 'gardenerSnail', 'cloud'];
export const ARRIVE_S = 2.7;           // longest a hire walk may take (speed scales with distance), seconds
export const WALK = { min: 2.2, max: 9 };
export const NAMES = { tallyOwl: 'Owl', packMole: 'Mole', sparkBee: 'Bee', guardTortoise: 'Tortoise', scoutFox: 'Fox', gardenerSnail: 'Snail', cloud: 'Cloud' };
export const HELLO = { tallyOwl: 'Hoo!', packMole: 'Hi!', sparkBee: 'Bzz!', guardTortoise: 'Hm.', scoutFox: 'Yip!', gardenerSnail: 'Hi~', cloud: 'Pwuff!' };
export const COLOR = { tallyOwl: '#FFD54F', packMole: '#90CAF9', sparkBee: '#FFF176', guardTortoise: '#A5D6A7', scoutFox: '#FFAB91', gardenerSnail: '#F48FB1', cloud: '#B3E5FC' };
// [work seconds, idle seconds] of the loop (bees / snails move; their "work" is a bout of the zip / pour clip)
export const CYCLE = { tallyOwl: [4.5, 3], packMole: [5, 3], sparkBee: [1.2, 8], guardTortoise: [2.4, 8], scoutFox: [2.2, 9], gardenerSnail: [1.4, 3.5], cloud: [0.4, 1] };
const CLOUD = { fetchR: 10, flySpeed: 5.6, carrySpeed: 6.4, pickR: 0.45, giveR: 0.95, side: 1.0, follow: 4.5 };   // S78-D: pet Cloud tuning (units, u/s)
const PATROL_S = 24, RETARGET_S = 1, TICK_POP_S = 2.5, FLOWER_CAP = 80, FLOWER_EVERY = 1.1, ORBIT_R = 1.5, ORBIT_W = 1.6, SNAIL_SPEED = 0.55, SNAIL_RADIUS = 3.2;

const _a = new THREE.Vector3(), _p = new THREE.Vector3(), _m = new THREE.Matrix4(), _q = new THREE.Quaternion(), _s = new THREE.Vector3(), _c = new THREE.Color();
const FLOWER_COLORS = [0xF48FB1, 0xFFF176, 0xFFFFFF, 0xCE93D8, 0xFFAB91];
const fresh = () => ({ tallyOwl: 0, packMole: 0, sparkBee: 0, guardTortoise: 0, scoutFox: 0, gardenerSnail: 0, cloud: 0 });
const fmt = (v) => (v >= 10 ? String(Math.round(v)) : String(Math.round(v * 10) / 10));   // pops stay <= 4 chars: "+0.3" "-12" "+10%"

export function installCrew(sb) {
  const { eco } = sb, bus = sb.game.bus, offs = [];   // own list: installCrew runs BEFORE createSandbox reassigns sb._offs, so dispose() (destroySandbox) unsubscribes these itself
  const C = { on: true, sum: fresh(), cnt: fresh(), beeAcc: 0, beePopT: -9, sales: new Map(), t: 0, retargetT: 0, foxSeen: 0, flowers: null, flowerCount: 0, lastSeason: 0 };

  // ------------------------------------------------------------------ anchors
  const isLand = (x, z) => sb.island.isLand(x, z);
  const cottage = () => { const c = sb.world?.cottage?.position; return c ? { x: c.x, z: c.z } : { x: -6, z: 6 }; };
  const jarAt = (id) => { const m = sb.jarsWorld?.get?.(id); const p = m?.position || null; return p ? { x: p.x, z: p.z } : null; };
  const pier = () => sb.world?.pierSpawn || { x: 0, z: -10 };
  const stalls = () => [...sb.build.placed.values()].filter((e) => e.id.startsWith('stall_'));
  const keyOf = (e) => String(e.id).replace(/^stall_/, '');
  const apart = (h, x, z) => !sb.helpers.some((o) => o !== h && o.post && Math.hypot(o.post.x - x, o.post.z - z) < 0.8);
  /** A free land spot on a ring around `a`, different per crew type so six keepers never stack. */
  function spotAround(h, a, r0 = 1.4) {
    const k = Math.max(0, HELPER_ORDER.indexOf(h.type));
    for (let i = 0; i < 24; i++) {
      const ang = k * 1.1 + i * 0.5, r = r0 + Math.floor(i / 8) * 0.55; const x = a.x + Math.sin(ang) * r, z = a.z + Math.cos(ang) * r;
      if (isLand(x, z) && !sb.build.occupied(x, z) && apart(h, x, z)) return { x, z };
    }
    return { x: a.x, z: a.z };
  }
  /** The post of `h` right now: { x, z, fx, fz } (fx/fz = what it faces). Pure of side effects except Mole/Bee stall choice (h.stall). */
  function postOf(h) {
    const t = h.type, list = stalls();
    if (t === 'packMole') {
      if (!list.length) { h.jobStall = null; const a = cottage(), s = spotAround(h, a); return { ...s, fx: a.x, fz: a.z }; }
      if (!h.jobStall || !list.includes(h.jobStall)) h.jobStall = list[0];
      const g = h.jobStall.group, r = g.rotation.y, bx = -0.9 * Math.sin(r), bz = -0.9 * Math.cos(r);
      return { x: g.position.x + bx, z: g.position.z + bz, fx: g.position.x - bx * 3, fz: g.position.z - bz * 3 };
    }
    if (t === 'sparkBee') {
      let best = null, bs = -1; for (const e of list) { const s = C.sales.get(keyOf(e)) || 0; if (s > bs) { bs = s; best = e; } }
      h.jobStall = best || null; const a = best ? { x: best.group.position.x, z: best.group.position.z } : cottage();
      h.orbit = a; return { x: a.x + ORBIT_R, z: a.z, fx: a.x, fz: a.z };
    }
    if (t === 'cloud') { const hp = sb.hero.root.position; return { x: hp.x - CLOUD.side, z: hp.z + 0.3, fx: hp.x, fz: hp.z }; }   // S78-D: the pet floats beside Pip (the 'post' only matters for the hire walk-in)
    if (t === 'tallyOwl') { const a = jarAt('save') || cottage(); return { ...spotAround(h, a, 1.3), fx: a.x, fz: a.z }; }
    if (t === 'guardTortoise') { const a = jarAt('protect') || cottage(); return { ...spotAround(h, a, 1.4), fx: a.x, fz: a.z }; }
    if (t === 'scoutFox') { const p = pier(), d = Math.hypot(p.x, p.z) || 1; const a = { x: p.x - (p.x / d) * 2.4, z: p.z - (p.z / d) * 2.4 }; return { ...spotAround(h, a, 0.9), fx: p.x, fz: p.z }; }
    const a = cottage(); return { ...spotAround(h, a, 2.0), fx: a.x, fz: a.z };   // gardenerSnail: home = by the cottage, then it wanders
  }

  // ------------------------------------------------------------------ pops + payoffs
  const popAt = (x, z, text, color, y = 0.2) => sb.vfx?.pop?.show?.(_p.set(x, y, z), text, { color, dur: 0.9, size: 0.9 });
  function work(h, dur) { const j = h.job; if (!j || j.state === 'arrive' || j.state === 'move') return; j.state = 'work'; j.t = 0; j.workS = dur ?? CYCLE[h.type][0]; h.anim.play('work'); bus.emit('crew:work', { type: h.type }); }
  /** One payoff: pop on the helper, count it, wake its work clip. value = ✦ (0 for non-money jobs). */
  function payoff(h, value, text, at, wake = true) {
    C.sum[h.type] += value; C.cnt[h.type]++;
    const p = at || h.g.position; popAt(p.x, p.z, text, COLOR[h.type]);
    bus.emit('crew:payoff', { type: h.type, value, text }); if (wake) work(h, 2.2);
  }
  const helper = (type) => sb.helpers.find((h) => h.type === type) || null;

  // ------------------------------------------------------------------ hire + movement
  /** Shortest walkable route from (sx,sz) to (tx,tz): BFS on the integer land grid (8 neighbours, no corner cutting). Runs once per hire / retarget,
   *  never per frame. Returns [{x,z}…] ending exactly on the target, or null when the target is unreachable (caller snaps instead of wandering). */
  function findPath(h, sx, sz, tx, tz) {
    const ok = h.anim.canStand || isLand, K = (x, z) => x * 4096 + z, R = Math.round;
    const s0 = { x: R(sx), z: R(sz) }, t0 = { x: R(tx), z: R(tz) };
    if (s0.x === t0.x && s0.z === t0.z) return [{ x: tx, z: tz }];
    const prev = new Map([[K(s0.x, s0.z), null]]); let q = [s0], qi = 0, found = false;
    const walkable = (x, z) => (x === t0.x && z === t0.z) || (x === s0.x && z === s0.z) || ok(x, z);
    while (qi < q.length && q.length < 2500 && !found) {
      const c = q[qi++];
      for (let d = 0; d < 8; d++) {
        const dx = DIRS[d][0], dz = DIRS[d][1], nx = c.x + dx, nz = c.z + dz, k = K(nx, nz);
        if (prev.has(k) || !walkable(nx, nz)) continue;
        if (dx && dz && (!walkable(c.x + dx, c.z) || !walkable(c.x, c.z + dz))) continue;   // no cutting a water / stall corner
        prev.set(k, c); const n = { x: nx, z: nz }; q.push(n); if (nx === t0.x && nz === t0.z) { found = true; break; }
      }
    }
    if (!found) return null;
    const out = []; for (let c = t0; c; c = prev.get(K(c.x, c.z))) out.push({ x: c.x, z: c.z }); out.reverse(); out.shift();   // drop the start cell
    if (out.length) out[out.length - 1] = { x: tx, z: tz }; else out.push({ x: tx, z: tz });
    return out;
  }
  const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
  const pathLen = (sx, sz, pts) => { let l = 0, x = sx, z = sz; for (const p of pts) { l += Math.hypot(p.x - x, p.z - z); x = p.x; z = p.z; } return l; };
  /** Start walking h to its post. speed from the route length so the walk always takes ≤ ARRIVE_S (hire) — returns seconds. */
  function goPost(h, speed) {
    const p = h.g.position, post = h.post, path = findPath(h, p.x, p.z, post.x, post.z);
    if (!path) { p.x = post.x; p.z = post.z; h.job.path = null; return 0; }   // unreachable (an island cut in two by the player's builds) → snap, never stuck
    h.job.path = path; h.job.pi = 0; h.job.stuck = 0; const len = pathLen(p.x, p.z, path);
    h.job.speed = speed || Math.max(2.2, Math.min(WALK.max, len / ARRIVE_S)); return len / h.job.speed;
  }
  /** Follow h.job.path; true when the last point is reached. */
  function followPath(h, dt) {
    const j = h.job, p = h.g.position, path = j.path; if (!path) return true;
    let budget = j.speed * dt;
    while (j.pi < path.length && budget > 0) {
      const w = path[j.pi], dx = w.x - p.x, dz = w.z - p.z, d = Math.hypot(dx, dz);
      if (d <= budget) { p.x = w.x; p.z = w.z; budget -= d; j.pi++; continue; }
      p.x += (dx / d) * budget; p.z += (dz / d) * budget; budget = 0; _a.set(w.x, 0, w.z); h.anim.faceTo(_a);
    }
    return j.pi >= path.length;
  }
  /** Short free hop (snail wander, ≤ 4 u on open ground): straight line, gives up quietly. */
  function stepToward(h, tx, tz, speed, dt) {
    const p = h.g.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d < 0.06) { p.x = tx; p.z = tz; return true; }
    const s = Math.min(d, speed * dt), ok = h.anim.canStand || isLand, nx = p.x + (dx / d) * s, nz = p.z + (dz / d) * s;
    if (ok(nx, nz)) { p.x = nx; p.z = nz; _a.set(tx, 0, tz); h.anim.faceTo(_a); h.job.stuck = 0; return false; }
    h.job.stuck = (h.job.stuck || 0) + dt; return h.job.stuck > 0.6;   // blocked → the wander ends here
  }
  function setPost(h, post) {
    h.post = post; h.seat = { x: post.x, z: post.z, fx: post.fx, fz: post.fz };
    h.anim.canStand = (x, z) => { if (!isLand(x, z)) return false; const o = sb.build.occupied(x, z); return !(o && o !== h.stall && o !== h.jobStall && o.id?.startsWith?.('stall_')); };
  }
  /** Hire moment (called by hireHelper). restore → instant (CONTINUE must not replay the arrival). */
  function hire(h, { restore = false } = {}) {
    if (!C.on) return h;   // baseline mode (gate T3.4): legacy seat at the stall, no job
    h.job = { state: 'idle', t: 0, workS: 0, idleS: CYCLE[h.type][1], stuck: 0, acc: 0, dist: 0, wander: null, ang: Math.random() * 6.28, patrolT: 0 };
    setPost(h, postOf(h));
    const post = h.post;
    if (restore || sb.game.noCrewArrival) { h.g.position.set(post.x, 0, post.z); _a.set(post.fx, 0, post.fz); h.anim.faceToNow(_a); h.anim.play('idle'); return h; }
    const from = pier(); h.g.position.set(from.x, 0, from.z); h.job.state = 'arrive'; h.job.t = 0; h.anim.play('walk');
    const secs = goPost(h);
    popAt(from.x, from.z, HELLO[h.type] || 'Hi!', COLOR[h.type], 0.6);
    bus.emit('crew:arrive', { type: h.type, x: from.x, z: from.z, seconds: +secs.toFixed(2) });
    return h;
  }
  /** seatHelper / build:moved / build:removed route here: re-read the post now, walk there if it moved. */
  function retarget(h) {
    if (!h.job) return;
    const next = postOf(h), old = h.post;
    if (!old || Math.hypot(next.x - old.x, next.z - old.z) > 0.6 || h.type === 'sparkBee') {
      setPost(h, next);
      if (h.job.state !== 'arrive' && h.type !== 'sparkBee' && h.type !== 'gardenerSnail' && h.type !== 'cloud') { h.job.state = 'move'; goPost(h, 2.8); h.anim.play('walk'); }
    }
  }

  // ------------------------------------------------------------------ flowers (Gardener Snail): ONE InstancedMesh = 1 draw call, hidden at 0
  function flowers() {
    if (C.flowers) return C.flowers;
    const im = new THREE.InstancedMesh(new THREE.IcosahedronGeometry(0.12, 0), new THREE.MeshBasicMaterial({ color: 0xffffff }), FLOWER_CAP);
    im.name = 'crewFlowers'; im.frustumCulled = false; im.userData.noOutline = true; im.count = 0; sb.game.scene.add(im); C.flowers = im; return im;
  }
  function plant(x, z, scale = 1) {
    const im = flowers(), i = C.flowerCount % FLOWER_CAP; C.flowerCount++;
    _m.compose(_p.set(x, 0.16 * scale, z), _q.identity(), _s.setScalar(scale)); im.setMatrixAt(i, _m); im.setColorAt(i, _c.setHex(FLOWER_COLORS[(C.flowerCount * 7) % FLOWER_COLORS.length]));
    im.count = Math.min(FLOWER_CAP, C.flowerCount); im.instanceMatrix.needsUpdate = true; if (im.instanceColor) im.instanceColor.needsUpdate = true;
  }

  // ------------------------------------------------------------------ Cloud (S78-D): a pet that floats beside Pip and carries DROPPED COINS to him
  //   follow -> (coin on the ground within CLOUD.fetchR) fetch -> grab (the coin rides on the cloud) -> carry back to Pip -> sb.collectCoin(c,'cloud') = the coin vanishes + is paid.
  //   Pip walking over a coin still collects it himself; a coin taken by someone else mid-trip just ends the trip. Presentation + the same tip money Pip would pick up: no new income.
  // S79: a coin lying within 3 u of a live Collector / the Baron is left alone (the Cloud would fly into the fight); it is fetched once the enemy walks off or dies
  const nearEnemy = (x, z) => { const l = sb.enemies?.active; if (!l || !l.length) return false; for (const e of l) { const q = e.g?.position; if (q && Math.hypot(q.x - x, q.z - z) < 3) return true; } return false; };
  const nearestCoin = (h) => {
    let best = null, bd = CLOUD.fetchR * CLOUD.fetchR; const p = h.g.position, hp = sb.hero.root.position;
    for (const c of sb.coins || []) { if (c.carried && c.carried !== h) continue; const dx = c.position.x - p.x, dz = c.position.z - p.z, d = dx * dx + dz * dz; if (d >= bd) continue; if (Math.hypot(c.position.x - hp.x, c.position.z - hp.z) < 0.8) continue; if (nearEnemy(c.position.x, c.position.z)) continue; bd = d; best = c; }
    return best;
  };
  const flyTo = (h, tx, tz, speed, dt) => { const p = h.g.position, dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz); if (d < 1e-4) return 0; const s = Math.min(d, speed * dt); p.x += (dx / d) * s; p.z += (dz / d) * s; _a.set(tx, 0, tz); h.anim.faceTo(_a); return d - s; };
  function dropCarried(h) { const c = h.job.coin; if (c && c.carried === h) c.carried = null; h.job.coin = null; }
  function cloudTick(h, dt) {
    const j = h.job, p = h.g.position, hp = sb.hero.root.position; h.seat.x = p.x; h.seat.z = p.z;
    const hasCoin = () => j.coin && sb.coins.indexOf(j.coin) >= 0;
    if (j.state === 'puff') { if ((j.puffT -= dt) <= 0) { j.state = 'follow'; h.anim.play('idle'); } }
    else if (j.state === 'fetch') {
      if (!hasCoin() || (j.coin.carried && j.coin.carried !== h)) { dropCarried(h); j.state = 'follow'; }
      else if (flyTo(h, j.coin.position.x, j.coin.position.z, CLOUD.flySpeed, dt) <= CLOUD.pickR) { j.coin.carried = h; j.state = 'carry'; bus.emit('crew:grab', { type: 'cloud', value: j.coin.value }); }
    } else if (j.state === 'carry') {
      if (!hasCoin()) { dropCarried(h); j.state = 'follow'; }
      else {
        const fy = h.g.rotation.y, c = j.coin; const left = flyTo(h, hp.x, hp.z, CLOUD.carrySpeed, dt);
        c.position.set(p.x + Math.sin(fy) * 0.38, 0.62 + Math.sin(C.t * 8) * 0.03, p.z + Math.cos(fy) * 0.38);
        if (left <= CLOUD.giveR) {
          const v = c.value; c.carried = null; j.coin = null; const got = sb.collectCoin(c, 'cloud');
          if (got) { C.sum.cloud += got; C.cnt.cloud++; bus.emit('crew:payoff', { type: 'cloud', value: got, text: '+' + got }); bus.emit('crew:work', { type: 'cloud' }); }
          j.state = 'puff'; j.puffT = 0.4; h.anim.play('work'); return;
        }
      }
    }
    if (j.state === 'follow' || j.state === 'idle') {
      // lazy side-follow: float to the left of Pip (his sword is on the right), eased so it trails a little
      const fy = sb.hero.facing || 0, rx = Math.cos(fy), rz = -Math.sin(fy), bob = Math.sin(C.t * 1.7) * 0.12;
      const tx = hp.x - rx * CLOUD.side + Math.sin(fy) * -0.25 + bob * rx, tz = hp.z - rz * CLOUD.side + Math.cos(fy) * -0.25 + bob * rz;
      const k = 1 - Math.exp(-CLOUD.follow * dt); const dx = tx - p.x, dz = tz - p.z, d = Math.hypot(dx, dz);
      if (d > 14) { p.x = tx; p.z = tz; } else { p.x += dx * k; p.z += dz * k; }
      _a.set(p.x + (hp.x - p.x) * 0.3, 0, p.z + 3); h.anim.faceTo(_a);   // S79: face the iso camera (+z) with a slight lean toward Pip, so the face is always readable
      if (j.state === 'idle') j.state = 'follow';
      j.scanT = (j.scanT || 0) - dt;
      if (j.scanT <= 0) { j.scanT = 0.25; const c = nearestCoin(h); if (c) { j.coin = c; j.state = 'fetch'; } }
    }
  }

  // ------------------------------------------------------------------ per-frame job loop
  function updateOne(h, dt) {
    const j = h.job; if (!j || h.returning || h.anim.knocked) return;
    j.t += dt; const p = h.g.position, post = h.post;
    if (j.state === 'arrive' || j.state === 'move') {
      if (h.type === 'sparkBee' && j.state === 'move') { j.state = 'idle'; return; }
      if (followPath(h, dt)) {
        const first = j.state === 'arrive'; j.state = 'idle'; j.t = 0; h.anim.play('idle'); _a.set(post.fx, 0, post.fz); h.anim.faceTo(_a);
        if (first) bus.emit('crew:posted', { type: h.type, seconds: +(C.t - (j.born ?? C.t)).toFixed(2) });
      } else if (h.anim.current !== 'walk') h.anim.play('walk');
      return;
    }
    if (j.state === 'idle' && h.anim.current === 'work') h.anim.play('idle');   // a knocked helper's walk-back ends in 'work'
    if (h.type === 'cloud') { cloudTick(h, dt); return; }   // S78-D
    if (h.type === 'sparkBee') {   // circles its stall: the position is the orbit, the clip is idle (hover) with a zip bout per sale
      const o = h.orbit || post; j.ang += ORBIT_W * dt; const nx = o.x + Math.cos(j.ang) * ORBIT_R, nz = o.z + Math.sin(j.ang) * ORBIT_R;
      if (isLand(nx, nz) || isLand(o.x, o.z)) { p.x = nx; p.z = nz; } _a.set(o.x + Math.cos(j.ang + 0.6) * ORBIT_R, 0, o.z + Math.sin(j.ang + 0.6) * ORBIT_R); h.anim.faceTo(_a);
      h.seat.x = p.x; h.seat.z = p.z;
    } else if (h.type === 'gardenerSnail') {   // slow wander around the cottage; a flower every FLOWER_EVERY units, a pour bout at each stop
      if (j.state === 'idle' || j.state === 'work') {
        if (j.state === 'work' && j.t >= j.workS) { j.state = 'idle'; j.t = 0; j.idleS = 2 + Math.random() * 2.5; h.anim.play('idle'); }
        if (j.state === 'idle' && j.t >= j.idleS) {
          const a = post, ang = Math.random() * 6.28, r = 0.8 + Math.random() * SNAIL_RADIUS, wx = a.x + Math.sin(ang) * r, wz = a.z + Math.cos(ang) * r;
          if (isLand(wx, wz) && !sb.build.occupied(wx, wz)) { j.wander = { x: wx, z: wz }; j.state = 'wander'; j.t = 0; h.anim.play('walk'); } else j.t = j.idleS - 0.3;
        }
      } else if (j.state === 'wander') {
        const w = j.wander, bx = p.x, bz = p.z; const done = stepToward(h, w.x, w.z, SNAIL_SPEED, dt); j.dist += Math.hypot(p.x - bx, p.z - bz);
        if (j.dist >= FLOWER_EVERY) { j.dist = 0; plant(p.x, p.z); }
        if (done || j.t > 14) { j.state = 'work'; j.t = 0; j.workS = CYCLE.gardenerSnail[0]; h.anim.play('work'); bus.emit('crew:work', { type: h.type }); plant(p.x + 0.3, p.z + 0.2, 1.25); payoff(h, 0, '🌱'); }
      }
      h.seat.x = p.x; h.seat.z = p.z; return;
    }
    // static posts (Owl, Mole, Tortoise, Fox, and the Bee's bouts): idle → work → idle
    const [w, i] = CYCLE[h.type];
    if (j.state === 'work' && j.t >= (j.workS || w)) { j.state = 'idle'; j.t = 0; j.idleS = i; if (h.type !== 'sparkBee') h.anim.play('idle'); else h.anim.play('idle'); }
    else if (j.state === 'idle' && j.t >= (j.idleS || i)) { work(h, w); boutPop(h); if (h.type === 'packMole' && sb.build && stalls().length > 1 && C.t - (j.patrolAt || 0) > PATROL_S) { j.patrolAt = C.t; const l = stalls(), k = (l.indexOf(h.jobStall) + 1) % l.length; h.jobStall = l[k]; retarget(h); } }
    else if (j.state === 'idle' && h.type === 'packMole') { /* waits at its counter */ }
  }

  // ------------------------------------------------------------------ economy-fed payoffs (numbers the economy applies anyway)
  const mod = (k, d) => eco.mod?.(k, d) ?? d;
  const seasonLen = () => Math.max(20, eco.seasonSecondsFor?.(eco.state.season) || 150);
  function rawStallUpkeep() { const c = eco.config, s = eco.state; return (c.upkeepPerStall * s.stalls + (s.stallUpkeepExtra || 0)); }
  /** What Owl (Save interest bonus) and Mole (stall upkeep cut) will really be worth at season end. Pure read. */
  function realNow() {
    const s = eco.state, k = eco.seasonCostScale?.(s.season) ?? 1;
    return { tallyOwl: Math.round(s.jars.save * mod('interestBonus', 0) * 100) / 100, packMole: Math.round(rawStallUpkeep() * (1 - mod('upkeepMul', 1)) * k * 100) / 100 };
  }
  const acc = { tallyOwl: 0, packMole: 0 };   // accrued, not yet popped (✦): the season total spread over time, never above what the economy will really apply
  function accrue(dt) {
    const len = seasonLen(), r = realNow();
    for (const t of ['tallyOwl', 'packMole']) if (helper(t)) acc[t] = Math.max(0, Math.min(acc[t] + Math.max(0, r[t]) * dt / len, r[t] - C.sum[t]));
  }
  const stallPos = (h) => (h.jobStall ? { x: h.jobStall.group.position.x, z: h.jobStall.group.position.z } : null);
  /** Owl / Mole work bout: pop what accrued since the last bout (1 decimal below 10 ✦). S57: NEVER a "+0" — with nothing accrued the keeper just works
   *  silently (the amount keeps accruing and pops later as one real number). Tiny crumbs (< POP_MIN_V) wait so a pop is always worth reading. */
  const POP_MIN_V = 0.1;
  function boutPop(h) {
    const t = h.type; if (t !== 'tallyOwl' && t !== 'packMole') return; const sign = t === 'tallyOwl' ? '+' : '−', v = acc[t];
    if (v < POP_MIN_V) return;
    const shown = v >= 10 ? Math.floor(v) : Math.floor(v * 10) / 10; acc[t] -= shown; payoff(h, shown, sign + fmt(shown), t === 'packMole' ? stallPos(h) : null, false);
  }
  const onSale = (out) => {
    if (!out || !(out.paid > 0)) return; const k = String(out.stallId || '').replace(/^stall_/, ''); C.sales.set(k, (C.sales.get(k) || 0) + 1);
    const m = mod('baseMulAll', 1); const h = helper('sparkBee'); if (!h || !(m > 1)) return;
    C.beeAcc += out.paid * (1 - 1 / m);
    const mine = h.jobStall && keyOf(h.jobStall) === k;
    if (mine && C.t - C.beePopT >= TICK_POP_S) { C.beePopT = C.t; const v = C.beeAcc; C.beeAcc = 0; payoff(h, v, '+10%'); }
  };
  // Tortoise: extra Protect-jar cover the +50 % bought, measured around applyLoss (no number in economy.js changes)
  const baseLoss = eco.applyLoss.bind(eco);
  eco.applyLoss = (amount, reason, o = {}) => {
    const pb = eco.state.jars.protect, r = baseLoss(amount, reason, o); const h = C.on ? helper('guardTortoise') : null;
    if (h && r && o.useProtect !== false && r.absorbed > 0) {
      const base = Math.min(pb, Math.round(Math.max(0, +amount || 0)), Math.round(amount * eco.config.protectAbsorb)), extra = Math.max(0, r.absorbed - base);
      if (extra > 0) payoff(h, extra, '🛡 ' + fmt(extra)); else payoff(h, 0, '🛡');   // Protect already covered 100 % → the shell still flashes (value 0: nothing extra to credit)
    }
    return r;
  };
  // Season end: flush what the spread did not pop, publish report.crew, bloom bed, reset
  const baseEnd = eco.endSeason.bind(eco);
  eco.endSeason = (...a) => {
    if (eco.state.ended || !C.on) return baseEnd(...a);
    const real = realNow(), owl = helper('tallyOwl'), mole = helper('packMole'), bee = helper('sparkBee'), snail = helper('gardenerSnail'), season = eco.state.season;
    for (const [t, h, sign] of [['tallyOwl', owl, '+'], ['packMole', mole, '−']]) { if (!h || !(real[t] > 0)) continue; const rem = Math.round((real[t] - C.sum[t]) * 10) / 10; if (rem >= 0.1) { acc[t] = 0; payoff(h, rem, sign + fmt(rem), t === 'packMole' ? stallPos(h) : null); } }
    if (bee && C.beeAcc > 0.05) { const v = C.beeAcc; C.beeAcc = 0; payoff(bee, v, '+10%'); }
    if (snail) { const p = snail.g.position; for (let i = 0; i < 6; i++) plant(p.x + Math.sin(i * 1.05) * 0.55, p.z + Math.cos(i * 1.05) * 0.55, 1.35); payoff(snail, 0, '🌱'); }
    const r = baseEnd(...a); if (!r) return r;
    r.crew = report(real); r.crew.season = season; C.lastReport = r.crew; resetSeason(); return r;
  };
  function report(real) {
    const rows = []; let total = 0;
    const add = (type, value, label) => { rows.push({ type, name: NAMES[type], value: Math.round(value * 10) / 10, label }); };
    for (const t of HELPER_ORDER) {
      if (!helper(t)) continue;
      if (t === 'tallyOwl' || t === 'packMole') { const v = Math.round(C.sum[t] * 10) / 10; total += v; add(t, v, t === 'tallyOwl' ? `Owl +${fmt(v)} ✦ interest` : `Mole −${fmt(v)} ✦ upkeep`); }
      else if (t === 'sparkBee') { const v = Math.round(C.sum[t] * 10) / 10; total += v; add(t, v, `Bee +${v} ✦ sales`); }
      else if (t === 'guardTortoise') { const v = Math.round(C.sum[t] * 10) / 10; total += v; add(t, v, `Tortoise ${v} ✦ covered`); }
      else if (t === 'cloud') { const v = Math.round(C.sum[t] * 10) / 10; total += v; add(t, v, `Cloud fetched +${fmt(v)} ✦ (${C.cnt[t]})`); }
      else if (t === 'scoutFox') add(t, C.cnt[t], `Fox spotted ${C.cnt[t]}`);
      else add(t, mod('reputationBonus', 0) * 100, `Snail trust +${Math.round(mod('reputationBonus', 0) * 100)} %`);
    }
    return { total: Math.round(total * 10) / 10, rows };
  }
  function resetSeason() { C.sum = fresh(); C.cnt = fresh(); acc.tallyOwl = 0; acc.packMole = 0; C.sales.forEach((v, k) => C.sales.set(k, v * 0.5)); }

  // Fox: a stranger shows up → ears up + "!" over it
  offs.push(bus.on('scam:npc', (p) => { const h = C.on ? helper('scoutFox') : null; if (!h || !p) return; const x = p.pos?.x ?? pier().x, z = p.pos?.z ?? pier().z; _a.set(x, 0, z); h.anim.faceTo(_a); C.foxSeen++; payoff(h, 0, '!', { x, z }); bus.emit('crew:alert', { type: 'scoutFox', x, z }); }));
  offs.push(bus.on('eco:absorbed', (p) => { const h = C.on ? helper('guardTortoise') : null; if (!h) return; const sp = eco.events?.[p?.id]?.effect?.spark; const n = typeof sp === 'number' && sp < 0 ? -sp : 0; popAt(h.g.position.x, h.g.position.z, n ? '🛡 ' + fmt(n) : '🛡', COLOR.guardTortoise); C.cnt.guardTortoise++; bus.emit('crew:payoff', { type: 'guardTortoise', value: 0, text: '🛡' }); work(h, 2.2); }));
  offs.push(bus.on('eco:sale', (o) => { if (C.on) onSale(o); }));
  offs.push(bus.on('build:placed', () => C.retargetT = RETARGET_S)); offs.push(bus.on('build:removed', () => C.retargetT = RETARGET_S)); offs.push(bus.on('jars:placed', () => C.retargetT = RETARGET_S));

  Object.assign(C, {
    hire, retarget, helper, postOf, report: () => report(realNow()), plant,
    update(dt) {
      if (!C.on) return;
      C.t += dt; accrue(dt);
      C.retargetT += dt; if (C.retargetT >= RETARGET_S) { C.retargetT = 0; C.sales.forEach((v, k) => C.sales.set(k, v * 0.97)); for (const h of sb.helpers) if (h.job && h.job.state !== 'arrive') retarget(h); }
      for (const h of sb.helpers) { if (h.job && h.job.born == null) h.job.born = C.t; updateOne(h, dt); }
    },
    dispose() { for (const f of offs.splice(0)) { try { f(); } catch { /* ok */ } } if (C.flowers) { sb.game.scene.remove(C.flowers); C.flowers.geometry.dispose(); C.flowers.material.dispose(); C.flowers = null; } eco.applyLoss = baseLoss; },
  });
  return C;
}
export default installCrew;
