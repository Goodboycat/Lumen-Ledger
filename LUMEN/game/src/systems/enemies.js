// LUMEN LEDGER — EnemySystem (S16, 2026-10-23). Debt Collectors chase Pip; Baron Gilt is the boss from Season 6.
//
//   import { EnemySystem } from './systems/enemies.js';
//   sb.enemies = new EnemySystem(game, { hero, eco, island, vfx, creatures: { makeFogCollector, makeBaronGilt, VillainAnimator, FogPuffPool },
//                                        spawnPoint: {x,z}, onCoin: (x,z,value) => sb.dropTip(...), isShielded: () => bool })
//   sb.enemies.update(dt)          every frame (after hero.update)
//   sb.enemies.spawnWave(season)   wave for `season` (scheduler calls it right after the Baron's Too-Good Deal offer, day 0.7)
//   sb.enemies.targets()           [{root, hit(dir,power)}] → merged into the hero's attack targets (HeroController deps.targets)
//   sb.enemies.clear()             send everyone home (season end / win / lose / teardown)   sb.enemies.dispose()
//   sb.enemies.list                live enemies [{ kind:'collector'|'baron', g, anim, hp, state, … }]   (perf LOD / blob shadows read .g)
//
// Rules (GAME_BIBLE §2 — cozy, never scary):
//   • Collector: hp 2 (Pip's sword hits knock it back; the 2nd hit "defeats" it → it flees off the island → drops 1 ✦ tip coin).
//     Contact with Pip (≤ 0.75 u, 1.1 s cooldown per enemy) takes 1 ✦ from the POUCH (never from jars, never below 0, never debt).
//     Bubble Shield (W) blocks the hit (deps.isShielded). Speed 2.9 u/s < Pip's 5.2 so a player can always walk away.
//   • Wave size = min(5, season). S19: #0 (and the Baron) land at the pier, the others at different shore points ≥ 5 u apart and ≥ 6 u from Pip
//     (island.landEdge in 12 directions, cached) with a fog-puff arrival; chasing enemies are pushed apart (separation 0.8 u). Only one wave per season.
//   • Season ≥ 6: the five Collectors stay home; BARON GILT comes as the boss (hp 6, contact 2 ✦) plus (season − 6) minions, max 5.
//     S20 (revised 2026-10-24): the Baron is a VERY SLOW chaser (speed 1.1 u/s — Pip 5.2) that lands at the pier and plods after Pip.
//     Every `attackEvery` s (2–4 s, random) he picks ONE attack; each shows a ground decal (BaronDecalPool, red/purple ring) for ≥ `telegraph` s
//     (0.8 s) BEFORE anything lands. He stops walking while winding up / recovering:
//       cannon  (S6+)  Debt-Fog Cannon — a ring appears where Pip stands; when the fog ball lands, 1 ✦ if Pip is still inside (radius 1.3 u)
//                      and a fog PUDDLE stays `puddleSeconds` s: Pip walks at 60 % inside it (S7 'puddle' power = longer puddles).
//       stomp   (S8+)  Big Stomp — he crouches (shadow grows), a big ring (r 3.5 u) grows at PIP'S LAST POSITION, he jumps high toward it
//                      and lands there: 2 ✦ + knockback inside, then he is DAZED `dazed` s (hp window: run in and hit him).
//       minigun (S9+)  Fog Minigun — 2 s of fog pellets that AIM-CHASE Pip (a small ring tracks him with lag `aimLag`, one pellet every
//                      `minigunEvery` s lands where the ring was): 1 ✦ per pellet that catches Pip (0.5 s mercy between pellets).
//       umbrella (S10+) Umbrella Dash — he aims (ring tracks Pip for the telegraph), then dashes 7 u/s along the aimed line: 2 ✦ + shove if he
//                      passes within 1.1 u. Either way he ends PARALYSED `umbrellaStun` s (4 s) — the biggest hit window.
//     Bubble Shield (W) still blocks every hit. Defeating the Baron pays 3 ✦ (P60) and ends the wave for the season.
//     Pip damages him by running in: he is a target whenever he is not mid-air (stomp jump) or mid-dash.
//   • S16b: a Collector hit at 0 ✦ does nothing ("empty!"), but a BARON hit at 0 ✦ bills the shortfall as DEBT (state.debt += missing, eco:loan kind 'forced').
//   • S16b: at season end nobody vanishes in place — sendHome() makes everyone turn and WALK back to the shore point they landed on (S19; e.home, pier for #0)
//     and step off the island there (state 'home'); not a defeat: no coin, no stats. clear() is still the instant teardown (win / lose / dispose).
//   • Transient: never saved. A season end / CONTINUE just clears the wave; the next season's scam re-spawns it.
//   • Pure data + Three transforms. Works headless with the mock vfx (every vfx call is optional-chained).
import * as THREE from '../../vendor/three.module.js';

export const ENEMY_RULES = {
  collector: { hp: 2, speed: 2.9, radius: 0.75, hitSpark: 1, hitCooldown: 1.1, reward: 1 },
  // S20 (revised): very slow chaser. podium kept only as a fallback landing spot when there is no shore point.
  baron:     { hp: 6, speed: 1.1, homeSpeed: 2.4, radius: 0.95, hitSpark: 2, hitCooldown: 1.4, reward: 3, podium: { x: 0, z: -4.5 },   // P60: reward 5 → 3
               attackMin: 2, attackMax: 4, attackEvery: 3, telegraph: 0.8, cannonRadius: 1.3, cannonSpark: 1, puddleSeconds: 4, puddleMul: 0.6,
               stompRadius: 3.5, stompSpark: 2, stompKnock: 3.2, stompAir: 0.7, stompRange: 9, dazed: 2.5, fanSpread: 1.8,
               minigunSeconds: 2, minigunEvery: 0.25, minigunRadius: 0.8, minigunSpark: 1, minigunMercy: 0.5, aimLag: 4,
               umbrellaSpeed: 7, umbrellaRange: 8, umbrellaRadius: 1.1, umbrellaSpark: 2, umbrellaKnock: 2.5, umbrellaStun: 4 },
  waveCap: 5, bossFrom: 6, minionCap: 5, knockback: 1.6, fleeSeconds: 2.2, approachMin: 0.55,
  homeSpeedMul: 1.25, homeRadius: 0.6, homeTimeout: 14,   // S16b walk-home: a bit brisk, arrive within 0.6 u of the exit, hard cap so nobody is stuck forever
  // S19 / P58: Collectors keep apart (O(n²) separation, n ≤ 10) and land at DIFFERENT shore points (≥ spawnSpread u apart, ≥ spawnHeroMin u from Pip)
  separation: 0.8, separationPush: 2.5, spawnSpread: 5, spawnHeroMin: 6,
};
/** Baron attacks by the season he FIRST has them (cumulative). S20: every entry is a telegraphed attack picked by the attack cycle. */
export const BARON_POWERS = [
  { season: 6,  id: 'cannon',   title: 'Debt-Fog Cannon', text: 'A ring marks where Pip stands — step out before the fog ball lands (1 ✦). It leaves a slowing puddle.' },
  { season: 7,  id: 'puddle',   title: 'Fog Puddles',     text: 'Cannon puddles linger longer and Pip walks at 60 % inside them.', seconds: 7 },
  { season: 8,  id: 'stomp',    title: 'Big Stomp',       text: 'He crouches, a wide ring grows where you stood, he leaps there — 2 ✦ and a shove inside it. Dazed after: hit him!' },
  { season: 9,  id: 'minigun',  title: 'Fog Minigun',     text: 'Two seconds of fog pellets that follow you — keep moving, the aim lags behind.' },
  { season: 10, id: 'umbrella', title: 'Umbrella Dash',   text: 'He aims his umbrella and dashes along the line. Sidestep — then hit him: he is paralysed for 4 s.' },
];
export function baronPowersFor(season) { return BARON_POWERS.filter((p) => season >= p.season).map((p) => p.id); }

/** S20: pool of flat ground rings (ONE InstancedMesh, 1 draw call) — the warning decal before every Baron attack + the fog puddles. Headless-safe (no scene → no mesh). */
export class BaronDecalPool {
  constructor(scene, n = 12) {
    this.n = n; this.items = Array.from({ length: n }, () => ({ life: 0, dur: 1, r: 1, pos: new THREE.Vector3(), kind: 'warn' }));
    this.mesh = null;
    if (scene) {
      const mat = new THREE.MeshBasicMaterial({ color: 0xE53970, transparent: true, opacity: 0.55, depthWrite: false, side: THREE.DoubleSide });
      this.mesh = new THREE.InstancedMesh(new THREE.RingGeometry(0.72, 1, 40, 1), mat, n);
      this.mesh.frustumCulled = false; this.mesh.castShadow = false; this.mesh.receiveShadow = false; this.mesh.renderOrder = 2; this.mesh.name = 'baronDecals'; this.mesh.userData.noOutline = true;
      this._m = new THREE.Matrix4(); this._q = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2); this._s = new THREE.Vector3(); this._hidden = new THREE.Matrix4().makeScale(0, 0, 0);
      for (let i = 0; i < n; i++) { this.mesh.setMatrixAt(i, this._hidden); this.mesh.setColorAt?.(i, new THREE.Color(0xE53970)); }
      scene.add(this.mesh);
    }
  }
  /** kind 'warn' (red ring that pulses, grows to r) or 'puddle' (purple disc that shrinks out). Returns the item or null. */
  show(pos, r, dur, kind = 'warn') {
    const it = this.items.find((x) => x.life <= 0); if (!it) return null;
    it.life = it.dur = Math.max(0.05, dur); it.r = r; it.pos.set(pos.x, 0.06, pos.z); it.kind = kind; it.t0 = 0;
    if (this.mesh?.setColorAt) { this.mesh.setColorAt(this.items.indexOf(it), new THREE.Color(kind === 'puddle' ? 0x7E57C2 : 0xE53970)); if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true; }
    return it;
  }
  get active() { return this.items.filter((x) => x.life > 0).length; }
  update(dt) {
    let any = false;
    for (let i = 0; i < this.items.length; i++) {
      const it = this.items[i]; if (it.life <= 0) continue;
      it.life -= dt; any = true;
      if (!this.mesh) continue;
      if (it.life <= 0) { this.mesh.setMatrixAt(i, this._hidden); continue; }
      const t = 1 - it.life / it.dur;
      let s;
      if (it.kind === 'warn') s = it.r * (0.35 + 0.65 * Math.min(1, t * 1.6)) * (1 + 0.06 * Math.sin(t * 28));   // grows to full radius then pulses
      else s = it.r * (t < 0.8 ? 1 : 1 - (t - 0.8) / 0.2);                                                       // puddle: steady, then shrinks out
      this._m.compose(it.pos, this._q, this._s.set(Math.max(0.001, s), Math.max(0.001, s), 1));
      this.mesh.setMatrixAt(i, this._m);
    }
    if (any && this.mesh) this.mesh.instanceMatrix.needsUpdate = true;
  }
  clearAll() { for (let i = 0; i < this.items.length; i++) { this.items[i].life = 0; this.mesh?.setMatrixAt(i, this._hidden); } if (this.mesh) this.mesh.instanceMatrix.needsUpdate = true; }
  dispose() { this.mesh?.removeFromParent?.(); this.mesh?.geometry?.dispose?.(); this.mesh?.material?.dispose?.(); this.mesh = null; }
}

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);

export class EnemySystem {
  constructor(game, deps = {}) {
    this.game = game; this.deps = deps; this.bus = game.bus;
    this.hero = deps.hero; this.eco = deps.eco; this.island = deps.island; this.vfx = deps.vfx || null;
    this.C = deps.creatures || {};
    this.list = [];
    this.waveSeason = 0;               // season of the last spawned wave (one per season)
    this.stats = { spawned: 0, defeated: 0, hitsTaken: 0, sparkLost: 0, sparkWon: 0, baronDefeats: 0, cannons: 0, stomps: 0, miniguns: 0, pellets: 0, dashes: 0, attacksDodged: 0 };
    this._rng = deps.rng || Math.random;
    this.fogPool = (!deps.headless && this.C.FogPuffPool && game.scene) ? new this.C.FogPuffPool(game.scene, 24) : null;
    this.decals = new BaronDecalPool(deps.headless ? null : game.scene, 12);   // S20: warning rings + fog puddles (headless: logic only)
    this.puddles = [];                 // S20: [{x,z,r,until}] fog puddles that slow Pip (puddleMul) while he stands inside
    this.heroSpeedMul = 1;             // puddles write this; applied to hero.speed
    this.enabled = true;
    this._spawn = deps.spawnPoint ? { x: deps.spawnPoint.x, z: deps.spawnPoint.z } : { x: 0, z: -10 };
    this._exit = deps.exitPoint ? { x: deps.exitPoint.x, z: deps.exitPoint.z } : this._spawn;   // S16b: where they walk back to
    this._baseHeroSpeed = this.hero?.speed ?? 5.2;
    this._shore = null;                // S19: lazily computed shore landing points (pier first, then around the island)
  }

  // ------------------------------------------------------------------ S19 landing points
  /** Shore land cells around the island, reached by walking out from the origin in 12 directions (pier first). Cached. */
  _shorePoints() {
    if (this._shore) return this._shore;
    const out = [{ x: this._spawn.x, z: this._spawn.z }];
    const edge = this.island?.landEdge;
    if (typeof edge === 'function') {
      for (let i = 0; i < 12; i++) {
        const a = (i / 12) * Math.PI * 2 + 0.26; const p = edge.call(this.island, Math.cos(a), Math.sin(a));
        if (p && out.every((q) => Math.hypot(q.x - p.x, q.z - p.z) >= 2)) out.push({ x: p.x, z: p.z });
      }
    }
    return (this._shore = out);
  }
  /** Pick a landing point for wave member `i`: far from Pip and from the points already used this wave; the pier is always the first. */
  _landingPoint(i, used) {
    const pts = this._shorePoints(), hp = this.hero?.root?.position;
    if (i === 0 || pts.length === 1) return pts[0];
    let best = null, bestScore = -Infinity;
    for (const p of pts) {
      const dHero = hp ? Math.hypot(p.x - hp.x, p.z - hp.z) : 99;
      let dUsed = 99; for (const u of used) dUsed = Math.min(dUsed, Math.hypot(p.x - u.x, p.z - u.z));
      // score: spread first (capped at spawnSpread), then distance from Pip (capped at spawnHeroMin), tiny jitter so ties vary by season
      const score = Math.min(dUsed, ENEMY_RULES.spawnSpread) * 2 + Math.min(dHero, ENEMY_RULES.spawnHeroMin) + ((p.x * 7 + p.z * 13 + i) % 5) * 0.01;
      if (score > bestScore) { bestScore = score; best = p; }
    }
    return best || pts[0];
  }

  get baron() { return this.list.find((e) => e.kind === 'baron' && e.state !== 'flee') || null; }
  get active() { return this.list.filter((e) => e.state === 'chase'); }
  get leaving() { return this.list.filter((e) => e.state === 'home'); }

  // ------------------------------------------------------------------ spawning
  /** Spawn the wave for `season`. Returns the enemies created (empty when the wave already ran this season). */
  spawnWave(season = this.eco?.state?.season || 1) {
    if (!this.enabled || this.waveSeason === season || this.eco?.state?.ended) return [];
    this.waveSeason = season; this._waveUsed = [];
    const out = [];
    if (season >= ENEMY_RULES.bossFrom) {
      out.push(this._spawnOne('baron', season));
      const minions = Math.min(ENEMY_RULES.minionCap, season - ENEMY_RULES.bossFrom);
      for (let i = 0; i < minions; i++) out.push(this._spawnOne('collector', season, i));
    } else {
      const n = Math.min(ENEMY_RULES.waveCap, Math.max(1, season));
      for (let i = 0; i < n; i++) out.push(this._spawnOne('collector', season, i));
    }
    this.bus?.emit('enemy:wave', { season, count: out.length, boss: season >= ENEMY_RULES.bossFrom, powers: season >= ENEMY_RULES.bossFrom ? baronPowersFor(season) : [] });
    return out;
  }
  _spawnOne(kind, season, i = 0) {
    const R = ENEMY_RULES[kind]; let e_home = this._spawn;
    const g = kind === 'baron' ? (this.C.makeBaronGilt ? this.C.makeBaronGilt({ seed: season }) : stub()) : (this.C.makeFogCollector ? this.C.makeFogCollector(i % 3, { seed: season * 10 + i }) : stub());
    // S34 / P66: enemies manage their own knockback (e.knock, land + stall clamp) — the animator must NOT slide the root too (double knockback,
    //   Baron sliding, water / stall clipping). knockPower 0 keeps the squash + angry flash + face-the-attacker reaction only.
    const anim = this.C.VillainAnimator ? new this.C.VillainAnimator(g, { vfx: this.vfx, fogPool: this.fogPool, game: this.game, knockPower: 0, canStand: (x, z) => this._canStand(x, z) }) : stubAnim(g);
    // S19: each wave member lands at its own shore point (pier for #0 / the Baron, then spread ≥ 5 u apart and ≥ 6 u from Pip)
    const used = this._waveUsed || (this._waveUsed = []); const lp = this._landingPoint(i, used); used.push(lp); e_home = lp;
    const a = (i / Math.max(1, ENEMY_RULES.waveCap)) * Math.PI * 0.6 - Math.PI * 0.3;
    g.position.set(lp.x + Math.sin(a) * 0.3, 0, lp.z + Math.cos(a) * 0.3);
    let podium = null;
    if (kind === 'baron') { podium = this._podium(); if (!this.island?.isLand?.(lp.x, lp.z) && !this.island?.landEdge) g.position.set(podium.x, 0, podium.z); }   // S20 (revised): the boss lands at the pier like everyone else; podium only as a headless fallback
    this.game.scene?.add(g);
    if (this.fogPool && (i > 0 || kind === 'baron')) this.fogPool.spawn?.(_v.set(g.position.x, 0.3, g.position.z), _d.set(0, 1, 0), kind === 'baron' ? 10 : 6);   // arrival puff so it does not look like popping in
    const e = { kind, g, root: g, anim, hp: R.hp, maxHp: R.hp, state: 'chase', hitAt: -99, knock: new THREE.Vector3(), fleeT: 0, powers: kind === 'baron' ? baronPowersFor(season) : [], timers: { attack: kind === 'baron' ? R.attackEvery * 0.5 : 0, summon: 0 }, season, i, home: e_home,
      podium, attack: null, dazed: 0, phase: 'idle', nextAttack: kind === 'baron' ? R.attackMin : 0 };   // S20 boss fields: attack = the telegraphed attack in flight, dazed = recovery window, phase 'idle'|'warn'|'air'|'fire'|'dash'|'dazed'
    anim.play?.(kind === 'baron' ? 'strut' : 'walk');
    this.list.push(e); this.stats.spawned++;
    this.bus?.emit('enemy:spawn', { kind, season, powers: e.powers });
    return e;
  }

  /** S34 / P66 / P73: a walkable cell for enemies = land and not inside a placed STALL footprint (decor / paths are fine). */
  _canStand(x, z) {
    if (!(this.island?.isLand?.(x, z) ?? true)) return false;
    const o = this.deps.occupied?.(x, z); return !(o && (o.id?.startsWith?.('stall_') || o.category === 'stall'));
  }
  /** S34 / P66: move `p` toward (nx, nz) with an axis-slide fallback; an enemy that is ALREADY off land walks freely so it can come back (no water soft-lock). */
  _moveTo(p, nx, nz) {
    if (this._canStand(nx, nz)) { p.x = nx; p.z = nz; return true; }
    if (this._canStand(nx, p.z)) { p.x = nx; return true; }
    if (this._canStand(p.x, nz)) { p.z = nz; return true; }
    if (!(this.island?.isLand?.(p.x, p.z) ?? true)) { p.x = nx; p.z = nz; return true; }   // stranded in water → keep walking toward the target
    return false;
  }
  /** S34 / P67: nearest land point between `p` and Pip (Pip is always on land) — reward coins never drop in the sea. */
  _landNear(p) {
    if (this._canStand(p.x, p.z)) return p;
    const hp = this.hero?.root?.position; if (!hp) return p;
    const dx = hp.x - p.x, dz = hp.z - p.z, L = Math.hypot(dx, dz) || 1;
    for (let s = 0.25; s <= L + 1e-6; s += 0.25) { const x = p.x + (dx / L) * s, z = p.z + (dz / L) * s; if (this._canStand(x, z)) return { x, z }; }
    return { x: hp.x, z: hp.z };
  }

  /** S20: fallback landing cell — ENEMY_RULES.baron.podium snapped to the nearest land cell (spiral search). Only used headless without island.landEdge. */
  _podium() {
    if (this._podiumPt) return this._podiumPt;
    const P = ENEMY_RULES.baron.podium; const ok = (x, z) => (this.island?.isLand?.(x, z) ?? true) && !(this.deps.occupied?.(x, z));
    let best = { x: P.x, z: P.z };
    if (!ok(P.x, P.z)) { outer: for (let r = 1; r <= 6; r++) for (let dx = -r; dx <= r; dx++) for (let dz = -r; dz <= r; dz++) { if (Math.max(Math.abs(dx), Math.abs(dz)) !== r) continue; if (ok(P.x + dx, P.z + dz)) { best = { x: P.x + dx, z: P.z + dz }; break outer; } } }
    return (this._podiumPt = best);
  }

  /** Targets for the hero's sword (HeroController deps.targets shape). The Baron is untouchable only while in the air (stomp) or mid-dash. */
  targets() { return this.list.filter((e) => e.state === 'chase' && e.phase !== 'air' && e.phase !== 'dash').map((e) => ({ root: e.g, enemy: e, hit: (dir, power) => this.hitEnemy(e, dir, power) })); }

  /** Pip's hit landed on `e`: knockback + flinch; hp 0 → defeated (flee + reward coin). The Baron does not slide (stationary boss) but the hit still cancels his wind-up. */
  hitEnemy(e, dir, power = 1) {
    if (e.state !== 'chase' || e.phase === 'air' || e.phase === 'dash') return false;
    e.hp -= 1;
    if (e.kind === 'baron') { if ((e.phase === 'warn' || e.phase === 'fire') && e.attack) this._cancelAttack(e); }   // S34 / P77: an interrupted minigun is a cancel, not a DODGE
    else e.knock.copy(dir).setY(0).normalize().multiplyScalar(ENEMY_RULES.knockback * power);
    e.anim.hit?.(dir, power);
    if (e.hp <= 0) this._defeat(e); else if (e.kind !== 'baron' || e.phase === 'idle') { e.anim.play?.('flee'); e._fleeAnimT = 0.45; }
    this.bus?.emit('enemy:hit', { kind: e.kind, hp: e.hp });
    return true;
  }
  _defeat(e) {
    const R = ENEMY_RULES[e.kind]; e.state = 'flee'; e.fleeT = ENEMY_RULES.fleeSeconds; e.anim.play?.('flee');
    this.stats.defeated++; this.stats.sparkWon += R.reward;
    const p = this._landNear(e.g.position); this.deps.onCoin?.(p.x, p.z, R.reward);   // S34 / P67: coin lands on walkable ground
    this.vfx?.pop?.show?.(_v.set(p.x, 1.4, p.z).clone(), e.kind === 'baron' ? 'HARRUMPH!' : 'EEK!', { color: '#CE93D8' });
    this.vfx?.sparks?.burst?.(_v.set(p.x, 0.9, p.z).clone(), 12, 4);
    if (e.kind === 'baron') { this.stats.baronDefeats++; for (const m of this.list) if (m !== e && m.state === 'chase') { m.state = 'flee'; m.fleeT = ENEMY_RULES.fleeSeconds; m.anim.play?.('flee'); } }
    this.bus?.emit('enemy:defeated', { kind: e.kind, reward: R.reward, season: e.season });
  }

  /** Enemy touches Pip: take Spark from the pouch (never below 0, never from jars). */
  _hitHero(e, spark) {
    if (this.deps.isShielded?.()) { this.vfx?.pop?.show?.(_v.copy(this.hero.root.position).setY(1.6).clone(), 'BLOCKED', { color: '#80DEEA' }); this.bus?.emit('enemy:blocked', { kind: e.kind }); return 0; }
    const have = this.eco?.state?.spark || 0; const take = Math.min(spark, Math.max(0, have));
    if (take > 0) { this.eco._addSpark(-take, 'enemy:' + e.kind); this.eco.ledger.expenses += take; }
    // S16b: the Baron bills what the pouch cannot pay — it becomes debt (a Collector just finds an empty pouch)
    let billed = 0;
    if (e.kind === 'baron' && take < spark && this.eco?.state) {
      billed = spark - take; this.eco.state.debt += billed; this.eco.ledger.expenses += billed; this.stats.debtBilled = (this.stats.debtBilled || 0) + billed;
      this.bus?.emit('eco:loan', { debt: this.eco.state.debt, delta: billed, kind: 'forced', source: 'baron' });
    }
    this.stats.hitsTaken++; this.stats.sparkLost += take;
    this.hero.anim?.hit?.(); this.game.camera?.shake?.(billed ? 0.22 : 0.15);
    const label = take && billed ? `−${take} ✦ +${billed} debt` : take ? `−${take} ✦` : billed ? `+${billed} DEBT` : 'empty!';
    this.vfx?.pop?.show?.(_v.copy(this.hero.root.position).setY(1.6).clone(), label, { color: billed ? '#CE93D8' : '#EF5350' });
    this.vfx?.debtPulse?.(billed ? 0.5 : 0.25);
    this.bus?.emit('enemy:heroHit', { kind: e.kind, spark: take, debt: billed });
    return take + billed;
  }

  // ------------------------------------------------------------------ loop
  update(dt) {
    // S34 / P78: decals + puddles keep running even when the last enemy has left (no frozen fog puddle for the rest of the season)
    this.decals.update(dt); this.fogPool?.update(dt);
    const t = this.game.time;
    if (this.puddles.length) for (let i = this.puddles.length - 1; i >= 0; i--) if (t >= this.puddles[i].until) this.puddles.splice(i, 1);
    if (!this.list.length) { if (this.heroSpeedMul !== 1) this._setHeroSpeed(1); return; }
    const hp = this.hero.root.position; let slow = 1;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i], R = ENEMY_RULES[e.kind], p = e.g.position;
      // knockback decays
      if (e.knock.lengthSq() > 1e-4) { const nx = p.x + e.knock.x * dt * 4, nz = p.z + e.knock.z * dt * 4; if (this._canStand(nx, nz)) p.set(nx, 0, nz); else if (this._canStand(nx, p.z)) { p.x = nx; e.knock.z = 0; } else if (this._canStand(p.x, nz)) { p.z = nz; e.knock.x = 0; } else e.knock.set(0, 0, 0); e.knock.multiplyScalar(Math.max(0, 1 - 6 * dt)); }   // S34 / P66: land + stall clamp, axis slide
      if (e._fleeAnimT > 0) { e._fleeAnimT -= dt; if (e._fleeAnimT <= 0) e.anim.play?.(e.kind === 'baron' ? 'strut' : 'walk'); }
      if (e.state === 'home') {                                   // S16b: walking back to the pier, then stepping off
        const ex = e.home || this._exit;                                 // S19: each one walks back to the shore point it landed on
        _d.set(ex.x - p.x, 0, ex.z - p.z); const dd = _d.length(); if (dd > 1e-4) _d.divideScalar(dd);
        e.homeT += dt;
        if (dd > ENEMY_RULES.homeRadius && e.homeT < ENEMY_RULES.homeTimeout) {
          const sp = (R.homeSpeed || R.speed) * ENEMY_RULES.homeSpeedMul;   // the slow Baron hurries a bit on the way out
          const nx = p.x + _d.x * sp * dt, nz = p.z + _d.z * sp * dt;
          if (this.island?.isLand?.(nx, nz) ?? true) p.set(nx, 0, nz); else { p.x += _d.x * sp * dt * 0.5; p.z += _d.z * sp * dt * 0.5; }   // the pier itself is off the land grid: keep going
          e.anim.faceTo?.(_v.set(p.x + _d.x, 0, p.z + _d.z));
        } else {                                                  // arrived (or timed out): fade out over 0.6 s — no coin, no stats
          e.offT = (e.offT || 0) + dt; const s = Math.max(0.001, 1 - e.offT / 0.6); e.g.scale.setScalar(s);
          if (e.offT >= 0.6) { this._remove(i, 'home'); continue; }
        }
        e.anim.update?.(dt); continue;
      }
      if (e.state === 'flee') {
        _d.set(p.x - hp.x, 0, p.z - hp.z); if (_d.lengthSq() < 1e-4) _d.set(0, 0, -1); _d.normalize();
        p.x += _d.x * R.speed * 1.6 * dt; p.z += _d.z * R.speed * 1.6 * dt; e.anim.faceTo?.(_v.set(p.x + _d.x, 0, p.z + _d.z));
        e.fleeT -= dt; const s = Math.max(0.001, Math.min(1, e.fleeT / 0.6)); e.g.scale.setScalar(s);
        if (e.fleeT <= 0) { this._remove(i); }
        e.anim.update?.(dt); continue;
      }
      // chase (Collectors) — the Baron (S20) plods after Pip very slowly and runs the attack cycle
      _d.set(hp.x - p.x, 0, hp.z - p.z); const dist = _d.length(); if (dist > 1e-4) _d.divideScalar(dist);
      if (e.kind === 'baron') { this._baronUpdate(e, dt, dist); e.anim.update?.(dt); continue; }
      if (dist > ENEMY_RULES.approachMin) {
        const nx = p.x + _d.x * R.speed * dt, nz = p.z + _d.z * R.speed * dt;
        if (!this._moveTo(p, nx, nz)) { this._moveTo(p, p.x + _d.x * R.speed * dt * 0.3, p.z + _d.z * R.speed * dt * 0.3); }   // S34 / P66: axis-slide along the shore / stall wall (both axes)
      }
      e.anim.faceTo?.(hp);
      // contact
      if (dist <= R.radius && t - e.hitAt >= R.hitCooldown) { e.hitAt = t; this._hitHero(e, R.hitSpark); e.anim.play?.('fogPuff'); }
      e.anim.update?.(dt);
    }
    this._separate(dt);
    // S20: fog puddles slow Pip while he stands inside one
    for (const q of this.puddles) if (Math.hypot(hp.x - q.x, hp.z - q.z) <= q.r) slow = Math.min(slow, ENEMY_RULES.baron.puddleMul);
    if (slow !== this.heroSpeedMul) this._setHeroSpeed(slow);
  }

  // ------------------------------------------------------------------ S20 Baron boss cycle (revised: slow chaser + 4 telegraphed attacks)
  /** Slow chaser: idle (walks at R.speed) → every 2–4 s pick ONE attack → warn (decal ≥ telegraph s, he stands still) → land → idle / dazed / stunned. */
  _baronUpdate(e, dt, dist) {
    const R = ENEMY_RULES.baron, hp = this.hero.root.position, p = e.g.position, t = this.game.time;
    // contact still hurts (he is big) — not mid-jump / mid-dash (those have their own hits)
    // S34 / P71: no contact damage while DAZED / paralysed — those are the "hit him now!" windows
    if (e.phase !== 'air' && e.phase !== 'dash' && e.phase !== 'dazed' && dist <= R.radius && t - e.hitAt >= R.hitCooldown) { e.hitAt = t; this._hitHero(e, R.hitSpark); if (e.phase === 'idle') e.anim.play?.('taunt'); }
    if (e.phase === 'dazed') {
      e.dazed -= dt;
      if (e.dazed <= 0) { e.phase = 'idle'; e.timers.attack = 0; e.hitAt = t; if (e.anim) e.anim.timeScale = 1; e.anim.play?.('strut'); }   // hitAt: a short grace so standing on him when he gets up is not an instant 2 ✦
      else if (e.anim && e.anim.current !== 'slipOnCoin' && e.anim.current !== 'flee') { e.anim.timeScale = 1; e.anim.play?.('idle'); }   // S34 / P76: never strut while dazed
      return;
    }
    if (e.phase === 'idle') {
      e.anim.faceTo?.(hp);
      if (dist > ENEMY_RULES.approachMin) {   // very slow plod toward Pip
        const nx = p.x + _d.x * R.speed * dt, nz = p.z + _d.z * R.speed * dt;
        if (!this._moveTo(p, nx, nz)) { this._moveTo(p, p.x + _d.x * R.speed * dt * 0.3, p.z + _d.z * R.speed * dt * 0.3); }   // S34 / P66 / P73
      }
      e.timers.attack += dt;
      if (e.timers.attack >= e.nextAttack) { e.timers.attack = 0; e.nextAttack = R.attackMin + (R.attackMax - R.attackMin) * this._rng(); this._baronPick(e, dist); }
      return;
    }
    const A = e.attack; if (!A) { e.phase = 'idle'; return; }
    A.t += dt;
    if (e.phase === 'warn') {
      if (A.kind === 'stomp') { const k = Math.min(1, A.t / R.telegraph); e.g.scale.set(1 + 0.08 * k, 1 - 0.22 * k, 1 + 0.08 * k); const sh = e.g.userData?.parts?.shadow; if (sh) sh.scale.setScalar(1 + 0.8 * k); }   // crouch + shadow grows
      if (A.kind === 'minigun' || A.kind === 'umbrella') this._aimTrack(e, A, dt);   // aim ring chases Pip during the wind-up
      else e.anim.faceTo?.(hp);
      if (A.t >= R.telegraph) this._baronLand(e, A);
      return;
    }
    if (e.phase === 'air') {   // stomp jump: a high arc from the take-off point to the target ring over stompAir s
      const k = Math.min(1, A.t / R.stompAir), s0 = A.spots[0];
      p.x = A.from.x + (s0.x - A.from.x) * k; p.z = A.from.z + (s0.z - A.from.z) * k; p.y = Math.sin(k * Math.PI) * 3.2; e.g.scale.set(1, 1 + 0.25 * Math.sin(k * Math.PI), 1);
      const sh = e.g.userData?.parts?.shadow; if (sh) { sh.position.y = -p.y + 0.012; sh.scale.setScalar(1.8 - 0.8 * Math.sin(k * Math.PI)); }
      if (k >= 1) { p.y = 0; e.g.scale.set(1, 1, 1); if (sh) { sh.position.y = 0.012; sh.scale.setScalar(1); } this._stompLand(e, A); }
      return;
    }
    if (e.phase === 'fire') {   // minigun: aim ring keeps chasing Pip, a pellet lands at its position every minigunEvery s
      this._aimTrack(e, A, dt);
      A.fireT += dt;
      while (A.fireT >= R.minigunEvery) { A.fireT -= R.minigunEvery; this._pellet(e, A); }
      if (A.t >= R.minigunSeconds) this._endMinigun(e);
      return;
    }
    if (e.phase === 'dash') {   // umbrella dash along the aimed line until the range is used up (or the shore)
      const step = R.umbrellaSpeed * dt, nx = p.x + A.dir.x * step, nz = p.z + A.dir.z * step;
      if (this._canStand(nx, nz) && A.gone < R.umbrellaRange) { p.set(nx, 0, nz); A.gone += step; } else A.gone = R.umbrellaRange;   // S34 / P73: a stall wall stops the dash too
      if (!A.hit && Math.hypot(hp.x - p.x, hp.z - p.z) <= R.umbrellaRadius) {
        A.hit = true; this._hitHero(e, R.umbrellaSpark);
        this._shove(hp, p, R.umbrellaKnock, A.dir);   // S34 / P72: the shield blocks the Spark loss, never the push (it is a bubble)
      }
      if (A.gone >= R.umbrellaRange) this._dashEnd(e, A);
    }
  }
  /** Choose the next attack from the powers the Baron has this season (round-robin over a weighted pool; stomp/umbrella only in range). */
  _baronPick(e, dist) {
    const R = ENEMY_RULES.baron, has = (id) => e.powers.includes(id), hp = this.hero.root.position, p = e.g.position;
    const pool = ['cannon'];
    if (has('stomp') && dist <= R.stompRange) pool.push('stomp', 'stomp');
    if (has('minigun')) pool.push('minigun');
    if (has('umbrella') && dist <= R.umbrellaRange) pool.push('umbrella', 'umbrella');
    const kind = pool[(e._pick = (e._pick || 0) + 1) % pool.length];
    const A = { kind, t: 0, spots: [], from: { x: p.x, z: p.z } };
    if (kind === 'stomp') { A.spots.push({ x: hp.x, z: hp.z, r: R.stompRadius }); e.anim.play?.('taunt'); }                      // ring at Pip's LAST position
    else if (kind === 'cannon') { A.spots.push({ x: hp.x, z: hp.z, r: R.cannonRadius }); e.anim.play?.('offerDeal'); }
    else { A.aim = { x: hp.x, z: hp.z }; A.spots.push({ x: hp.x, z: hp.z, r: kind === 'minigun' ? R.minigunRadius : R.umbrellaRadius }); A.fireT = 0; e.anim.play?.(kind === 'minigun' ? 'fogPuff' : 'taunt'); }
    for (const s of A.spots) s.decal = this.decals.show(s, s.r, R.telegraph + 0.05, 'warn');
    e.attack = A; e.phase = 'warn';
    this.vfx?.pop?.show?.(_v.set(p.x, 2.0, p.z).clone(), kind === 'stomp' ? 'HRRM…' : kind === 'umbrella' ? 'EN GARDE!' : kind === 'minigun' ? 'BRRR!' : 'PAY UP!', { color: '#FFD54F' });
    this.bus?.emit('enemy:baronWarn', { kind, spots: A.spots.length, telegraph: R.telegraph });
  }
  /** Minigun / umbrella aim: the warning ring chases Pip with lag (exp. smoothing, aimLag per second) and the decal follows. */
  _aimTrack(e, A, dt) {
    const R = ENEMY_RULES.baron, hp = this.hero.root.position, k = 1 - Math.exp(-R.aimLag * dt);
    A.aim.x += (hp.x - A.aim.x) * k; A.aim.z += (hp.z - A.aim.z) * k;
    const s = A.spots[0]; s.x = A.aim.x; s.z = A.aim.z; if (s.decal) { s.decal.pos.set(s.x, 0.06, s.z); s.decal.life = Math.max(s.decal.life, 0.2); }
    e.anim.faceTo?.(_v.set(A.aim.x, 0, A.aim.z));
  }
  /** Telegraph is over: the attack lands. Cannon hits now; the stomp lifts him into the air; minigun starts firing; umbrella starts the dash. */
  _baronLand(e, A) {
    const R = ENEMY_RULES.baron, p = e.g.position;
    if (A.kind === 'stomp') { e.phase = 'air'; A.t = 0; A.from = { x: p.x, z: p.z }; e.g.scale.set(1, 1, 1); return; }
    if (A.kind === 'minigun') { e.phase = 'fire'; A.t = 0; A.fireT = 0; A.hitAt = -99; this.stats.miniguns++; if (A.spots[0].decal) A.spots[0].decal.life = Math.max(A.spots[0].decal.life, R.minigunSeconds + 0.1); this.bus?.emit('enemy:minigun', {}); return; }
    if (A.kind === 'umbrella') {
      const dx = A.aim.x - p.x, dz = A.aim.z - p.z, L = Math.hypot(dx, dz) || 1; A.dir = { x: dx / L, z: dz / L }; A.gone = 0; A.hit = false;
      if (A.spots[0].decal) A.spots[0].decal.life = Math.min(A.spots[0].decal.life, 0.3);
      e.phase = 'dash'; A.t = 0; this.stats.dashes++; e.anim.play?.('strut'); if (e.anim) e.anim.timeScale = 2.5;
      this.vfx?.sparks?.burst?.(_v.set(p.x, 0.5, p.z).clone(), 6, 3); this.bus?.emit('enemy:dash', {}); return;
    }
    const hp = this.hero.root.position; let hit = false;
    for (const s of A.spots) {
      this.stats.cannons++;
      this.fogPool?.spawn?.(_v.set(s.x, 0.4, s.z), _d.set(0, 1, 0), 8);
      this.vfx?.sparks?.burst?.(_v.set(s.x, 0.5, s.z).clone(), 8, 3);
      const until = this.game.time + R.puddleSeconds * (e.powers.includes('puddle') ? (BARON_POWERS[1].seconds / R.puddleSeconds) : 1);
      this.puddles.push({ x: s.x, z: s.z, r: s.r, until }); this.decals.show(s, s.r, until - this.game.time, 'puddle');
      if (!hit && Math.hypot(hp.x - s.x, hp.z - s.z) <= s.r) { hit = true; this._hitHero(e, R.cannonSpark); }
    }
    if (!hit) { this.stats.attacksDodged++; this.vfx?.pop?.show?.(_v.copy(hp).setY(1.6).clone(), 'DODGED', { color: '#A5D6A7' }); }
    this.game.camera?.shake?.(0.12);
    this.bus?.emit('enemy:cannon', { kind: A.kind, shots: A.spots.length, hit });
    e.attack = null; e.phase = 'idle'; e.timers.attack = 0;
  }
  /** One minigun pellet lands where the aim ring is now: fog puff + 1 ✦ if Pip is inside (mercy gap between hits). */
  _pellet(e, A) {
    const R = ENEMY_RULES.baron, hp = this.hero.root.position, s = A.spots[0]; this.stats.pellets++;
    this.fogPool?.spawn?.(_v.set(s.x, 0.3, s.z), _d.set(0, 1, 0), 2);
    if (Math.hypot(hp.x - s.x, hp.z - s.z) <= s.r && A.t - A.hitAt >= R.minigunMercy) { A.hitAt = A.t; A.hits = (A.hits || 0) + 1; this._hitHero(e, R.minigunSpark); }
  }
  _endMinigun(e) {
    const A = e.attack; if (!A) { e.phase = 'idle'; return; }
    if (A.spots[0]?.decal) A.spots[0].decal.life = Math.min(A.spots[0].decal.life, 0.15);
    if (!A.hits) { this.stats.attacksDodged++; this.vfx?.pop?.show?.(_v.copy(this.hero.root.position).setY(1.6).clone(), 'DODGED', { color: '#A5D6A7' }); }
    this.bus?.emit('enemy:minigunEnd', { hits: A.hits || 0 });
    e.attack = null; e.phase = 'idle'; e.timers.attack = 0; e.anim.play?.('strut');
  }
  /** The dash is spent: the Baron trips over his umbrella and is PARALYSED umbrellaStun s (biggest hit window). */
  _dashEnd(e, A) {
    const R = ENEMY_RULES.baron, p = e.g.position;
    if (e.anim) e.anim.timeScale = 1;
    if (!A.hit) { this.stats.attacksDodged++; this.vfx?.pop?.show?.(_v.copy(this.hero.root.position).setY(1.6).clone(), 'DODGED', { color: '#A5D6A7' }); }
    this.vfx?.sparks?.burst?.(_v.set(p.x, 0.4, p.z).clone(), 10, 4); this.game.camera?.shake?.(0.18);
    e.attack = null; e.phase = 'dazed'; e.dazed = R.umbrellaStun; e.timers.attack = 0; this._playDazed(e, R.umbrellaStun);
    this.vfx?.pop?.show?.(_v.set(p.x, 2.0, p.z).clone(), 'PARALYSED!', { color: '#80DEEA', dur: 1.6 });
    this.bus?.emit('enemy:dashEnd', { hit: A.hit, stun: R.umbrellaStun });
  }
  /** Shove Pip `dist` u away from `from` (or along `dir`), staying on land and out of stalls (S34 / P73: walks the line in 0.25 u steps and
   *  stops at the first blocked sample). S34 / P75: a running hero move (dash / hammer / build …) rebases its M.start so it does not snap Pip back. */
  _shove(hp, from, dist, dir) {
    const d = Math.hypot(hp.x - from.x, hp.z - from.z);
    const nx = d > 1e-3 ? (hp.x - from.x) / d : (dir?.x ?? 0), nz = d > 1e-3 ? (hp.z - from.z) / d : (dir?.z ?? 1);
    const x0 = hp.x, z0 = hp.z; let gx = x0, gz = z0;
    for (let s = 0.25; s <= dist + 1e-6; s += 0.25) { const x = x0 + nx * s, z = z0 + nz * s; if (!this._canStand(x, z)) break; gx = x; gz = z; }
    hp.set(gx, hp.y, gz);
    const M = this.hero.moveCtx; if (M?.start && this.hero.currentMove) { M.start.x += gx - x0; M.start.z += gz - z0; }
    this.hero.recoverToLand?.();
  }
  _stompLand(e, A) {
    const R = ENEMY_RULES.baron, hp = this.hero.root.position, s = A.spots[0]; this.stats.stomps++;
    const d = Math.hypot(hp.x - s.x, hp.z - s.z); const hit = d <= s.r;
    if (hit) {
      this._hitHero(e, R.stompSpark);
      // S34 / P72: the shield blocks the Spark loss, not the push — it is a bubble. P74: a Pip standing exactly on the ring centre is shoved along the jump direction.
      const jx = s.x - A.from.x, jz = s.z - A.from.z, jl = Math.hypot(jx, jz) || 1;
      this._shove(hp, s, R.stompKnock, { x: jx / jl, z: jz / jl });
    } else { this.stats.attacksDodged++; this.vfx?.pop?.show?.(_v.copy(hp).setY(1.6).clone(), 'DODGED', { color: '#A5D6A7' }); }
    this.vfx?.rings?.show?.(_v.set(s.x, 0.1, s.z).clone(), { radius: s.r, color: 0xE53970, dur: 0.6 }); this.vfx?.sparks?.burst?.(_v.set(s.x, 0.4, s.z).clone(), 16, 5);
    this.game.camera?.shake?.(0.35); this.game.hitstop?.(0.06);
    e.hitAt = this.game.time;   // S34 / P71: landing on Pip is the stomp hit, not an extra contact hit next frame
    e.attack = null; e.phase = 'dazed'; e.dazed = R.dazed; e.timers.attack = 0; this._playDazed(e, R.dazed);
    this.vfx?.pop?.show?.(_v.set(e.g.position.x, 2.0, e.g.position.z).clone(), 'DAZED!', { color: '#80DEEA' });
    this.bus?.emit('enemy:stomp', { hit, dazed: R.dazed });
  }
  /** S34 / P76: the 0.9 s slipOnCoin one-shot is stretched (animator timeScale) over the whole daze so the Baron stays down until he can act again. */
  _playDazed(e, seconds) { e.anim.play?.('slipOnCoin'); if (e.anim) e.anim.timeScale = Math.min(1, 0.9 / Math.max(0.9, seconds)); }
  /** Pip's hit interrupts a wind-up (any telegraph): the decals fade, no attack lands. */
  _cancelAttack(e) {
    if (!e.attack) return;
    for (const s of e.attack.spots) if (s.decal) s.decal.life = Math.min(s.decal.life, 0.15);
    const sh = e.g.userData?.parts?.shadow; if (sh) { sh.scale.setScalar(1); sh.position.y = 0.012; }
    if (e.anim) e.anim.timeScale = 1;
    e.attack = null; e.phase = 'idle'; e.timers.attack = ENEMY_RULES.baron.attackMin * 0.4; e.g.scale.set(1, 1, 1);
    this.bus?.emit('enemy:baronInterrupted', {});
  }
  /** S19 / P58: push chasing enemies apart so they never read as one blob (O(n²), n ≤ 10). Respects isLand. */
  _separate(dt) {
    const L = this.list, minD = ENEMY_RULES.separation, push = ENEMY_RULES.separationPush * dt;
    for (let i = 0; i < L.length; i++) {
      const a = L[i]; if (a.state !== 'chase') continue;
      for (let j = i + 1; j < L.length; j++) {
        const b = L[j]; if (b.state !== 'chase') continue;
        const pa = a.g.position, pb = b.g.position; let dx = pb.x - pa.x, dz = pb.z - pa.z; let d = Math.hypot(dx, dz);
        if (d >= minD) continue;
        if (d < 1e-4) { dx = Math.cos(i * 2.4 + j); dz = Math.sin(i * 2.4 + j); d = 1; }   // exactly stacked → pick a deterministic direction
        const f = Math.min(push, (minD - d) * 0.5) / d; const ox = dx * f, oz = dz * f;
        // the Baron is heavier: minions move out of his way
        const wa = a.kind === 'baron' ? 0 : b.kind === 'baron' ? 1 : 0.5, wb = 1 - wa;
        if (wa && (this.island?.isLand?.(pa.x - ox * wa * 2, pa.z - oz * wa * 2) ?? true)) { pa.x -= ox * wa * 2; pa.z -= oz * wa * 2; }
        if (wb && (this.island?.isLand?.(pb.x + ox * wb * 2, pb.z + oz * wb * 2) ?? true)) { pb.x += ox * wb * 2; pb.z += oz * wb * 2; }
      }
    }
  }
  _setHeroSpeed(mul) { this.heroSpeedMul = mul; if (this.hero) this.hero.speed = this._baseHeroSpeed * mul; }

  _remove(i, why = 'flee') { const e = this.list[i]; this.list.splice(i, 1); e.anim.dispose?.(); e.g.removeFromParent?.(); this.bus?.emit('enemy:gone', { kind: e.kind, why }); }
  /** S16b: season is over — everyone still chasing turns around and WALKS back to the pier, then steps off (not a defeat). Returns how many were sent. */
  sendHome() {
    let n = 0;
    for (const e of this.list) if (e.state === 'chase') { e.state = 'home'; e.homeT = 0; e.offT = 0; e.knock.set(0, 0, 0); if (e.kind === 'baron') { /* S34 / P77: leaving mid-minigun is a cancel, not a DODGE */ this._cancelAttack(e); e.phase = 'idle'; e.g.position.y = 0; e.g.scale.set(1, 1, 1); if (e.anim) e.anim.timeScale = 1; } e.anim.play?.(e.kind === 'baron' ? 'strut' : 'walk'); n++; }
    this._setHeroSpeed(1);
    if (n) { const h = this.hero?.root?.position; if (h) this.vfx?.pop?.show?.(_v.set(h.x, 2.1, h.z).clone(), 'season over — they leave', { color: '#B0BEC5', dur: 1.4 }); this.bus?.emit('enemy:home', { count: n }); }
    return n;
  }
  /** Everyone vanishes now (no coins). Used on win / lose / teardown; season end uses sendHome(). */
  clear() { for (let i = this.list.length - 1; i >= 0; i--) this._remove(i, 'clear'); this._setHeroSpeed(1); this.puddles.length = 0; this.decals.clearAll(); }
  dispose() { this.clear(); this.fogPool?.mesh?.removeFromParent?.(); this.fogPool = null; this.decals.dispose(); }
}

// headless stand-ins (creature factories not injected)
function stub() { const g = new THREE.Group(); g.userData.parts = {}; return g; }
function stubAnim(g) { return { root: g, play() {}, update() {}, hit() {}, faceTo() {}, dispose() {} }; }
export default EnemySystem;
