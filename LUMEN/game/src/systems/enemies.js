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
//   • Wave size = min(5, season). Spawns at the pier (customers' boat) and walks in. Only one wave per season.
//   • Season ≥ 6: the five Collectors stay home; BARON GILT comes as the boss (hp 6, speed 2.4, contact 2 ✦) plus (season − 6) minions, max 5.
//     Baron powers unlock one per season (BARON_POWERS): S7 fogSlow (Pip walks at 60 % within 3 u of the Baron) · S8 levy (every 9 s, if ≥ 4 u away,
//     he raises his cane and takes 1 ✦ remotely — "a bill by post") · S9 summon (every 14 s, calls one more Collector while below the minion cap) ·
//     S10 charge (every 8 s dashes at Pip, 2 ✦ on contact). Defeating the Baron pays 3 ✦ (P60) and ends the wave for the season.
//   • S16b: a Collector hit at 0 ✦ does nothing ("empty!"), but a BARON hit at 0 ✦ bills the shortfall as DEBT (state.debt += missing, eco:loan kind 'forced').
//   • S16b: at season end nobody vanishes in place — sendHome() makes everyone turn and WALK back to the pier (deps.exitPoint = spawnPoint)
//     and step off the island there (state 'home'); not a defeat: no coin, no stats. clear() is still the instant teardown (win / lose / dispose).
//   • Transient: never saved. A season end / CONTINUE just clears the wave; the next season's scam re-spawns it.
//   • Pure data + Three transforms. Works headless with the mock vfx (every vfx call is optional-chained).
import * as THREE from '../../vendor/three.module.js';

export const ENEMY_RULES = {
  collector: { hp: 2, speed: 2.9, radius: 0.75, hitSpark: 1, hitCooldown: 1.1, reward: 1 },
  baron:     { hp: 6, speed: 2.4, radius: 0.95, hitSpark: 2, hitCooldown: 1.4, reward: 3 },   // P60: reward 5 → 3
  waveCap: 5, bossFrom: 6, minionCap: 5, knockback: 1.6, fleeSeconds: 2.2, approachMin: 0.55,
  homeSpeedMul: 1.25, homeRadius: 0.6, homeTimeout: 14,   // S16b walk-home: a bit brisk, arrive within 0.6 u of the exit, hard cap so nobody is stuck forever
};
/** Baron powers by the season he FIRST has them (cumulative). */
export const BARON_POWERS = [
  { season: 7,  id: 'fogSlow', title: 'Fog Drag',    text: 'Pip walks slower inside the Baron\'s fog (3 u).', radius: 3, mul: 0.6 },
  { season: 8,  id: 'levy',    title: 'Bill by Post', text: 'Every 9 s the Baron sends a 1 ✦ levy from afar.', every: 9, minDist: 4, spark: 1 },
  { season: 9,  id: 'summon',  title: 'Summons',      text: 'Every 14 s the Baron calls another Collector.', every: 14 },
  { season: 10, id: 'charge',  title: 'Gilt Charge',  text: 'Every 8 s the Baron charges at Pip (2 ✦ on contact).', every: 8, speed: 7.5, dur: 0.7 },
];
export function baronPowersFor(season) { return BARON_POWERS.filter((p) => season >= p.season).map((p) => p.id); }

const _v = new THREE.Vector3(), _d = new THREE.Vector3(), _UP = new THREE.Vector3(0, 1, 0);

export class EnemySystem {
  constructor(game, deps = {}) {
    this.game = game; this.deps = deps; this.bus = game.bus;
    this.hero = deps.hero; this.eco = deps.eco; this.island = deps.island; this.vfx = deps.vfx || null;
    this.C = deps.creatures || {};
    this.list = [];
    this.waveSeason = 0;               // season of the last spawned wave (one per season)
    this.stats = { spawned: 0, defeated: 0, hitsTaken: 0, sparkLost: 0, sparkWon: 0, baronDefeats: 0, levies: 0, charges: 0, summons: 0 };
    this.fogPool = (!deps.headless && this.C.FogPuffPool && game.scene) ? new this.C.FogPuffPool(game.scene, 24) : null;
    this.heroSpeedMul = 1;             // fogSlow writes this; Game.js applies it to hero.speed
    this.enabled = true;
    this._spawn = deps.spawnPoint ? { x: deps.spawnPoint.x, z: deps.spawnPoint.z } : { x: 0, z: -10 };
    this._exit = deps.exitPoint ? { x: deps.exitPoint.x, z: deps.exitPoint.z } : this._spawn;   // S16b: where they walk back to
    this._baseHeroSpeed = this.hero?.speed ?? 5.2;
  }

  get baron() { return this.list.find((e) => e.kind === 'baron' && e.state !== 'flee') || null; }
  get active() { return this.list.filter((e) => e.state === 'chase'); }
  get leaving() { return this.list.filter((e) => e.state === 'home'); }

  // ------------------------------------------------------------------ spawning
  /** Spawn the wave for `season`. Returns the enemies created (empty when the wave already ran this season). */
  spawnWave(season = this.eco?.state?.season || 1) {
    if (!this.enabled || this.waveSeason === season || this.eco?.state?.ended) return [];
    this.waveSeason = season;
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
    const R = ENEMY_RULES[kind];
    const g = kind === 'baron' ? (this.C.makeBaronGilt ? this.C.makeBaronGilt({ seed: season }) : stub()) : (this.C.makeFogCollector ? this.C.makeFogCollector(i % 3, { seed: season * 10 + i }) : stub());
    const anim = this.C.VillainAnimator ? new this.C.VillainAnimator(g, { vfx: this.vfx, fogPool: this.fogPool, game: this.game }) : stubAnim(g);
    const a = (i / Math.max(1, ENEMY_RULES.waveCap)) * Math.PI * 0.6 - Math.PI * 0.3;
    g.position.set(this._spawn.x + Math.sin(a) * (0.6 + i * 0.4), 0, this._spawn.z + Math.cos(a) * 0.3 * i);
    this.game.scene?.add(g);
    const e = { kind, g, root: g, anim, hp: R.hp, maxHp: R.hp, state: 'chase', hitAt: -99, knock: new THREE.Vector3(), fleeT: 0, powers: kind === 'baron' ? baronPowersFor(season) : [], timers: { levy: 0, summon: 0, charge: 0 }, charging: 0, season, i };
    anim.play?.(kind === 'baron' ? 'strut' : 'walk');
    this.list.push(e); this.stats.spawned++;
    this.bus?.emit('enemy:spawn', { kind, season, powers: e.powers });
    return e;
  }

  /** Targets for the hero's sword (HeroController deps.targets shape). */
  targets() { return this.list.filter((e) => e.state === 'chase').map((e) => ({ root: e.g, enemy: e, hit: (dir, power) => this.hitEnemy(e, dir, power) })); }

  /** Pip's hit landed on `e`: knockback + flinch; hp 0 → defeated (flee + reward coin). */
  hitEnemy(e, dir, power = 1) {
    if (e.state !== 'chase') return false;
    e.hp -= 1; e.knock.copy(dir).setY(0).normalize().multiplyScalar(ENEMY_RULES.knockback * power); e.charging = 0;
    e.anim.hit?.(dir, power);
    if (e.hp <= 0) this._defeat(e); else { e.anim.play?.('flee'); e._fleeAnimT = 0.45; }
    this.bus?.emit('enemy:hit', { kind: e.kind, hp: e.hp });
    return true;
  }
  _defeat(e) {
    const R = ENEMY_RULES[e.kind]; e.state = 'flee'; e.fleeT = ENEMY_RULES.fleeSeconds; e.anim.play?.('flee');
    this.stats.defeated++; this.stats.sparkWon += R.reward;
    const p = e.g.position; this.deps.onCoin?.(p.x, p.z, R.reward);
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
    if (!this.list.length) { if (this.heroSpeedMul !== 1) this._setHeroSpeed(1); this.fogPool?.update(dt); return; }
    const hp = this.hero.root.position, t = this.game.time; let slow = 1;
    for (let i = this.list.length - 1; i >= 0; i--) {
      const e = this.list[i], R = ENEMY_RULES[e.kind], p = e.g.position;
      // knockback decays
      if (e.knock.lengthSq() > 1e-4) { const nx = p.x + e.knock.x * dt * 4, nz = p.z + e.knock.z * dt * 4; if (this.island?.isLand?.(nx, nz) ?? true) p.set(nx, 0, nz); e.knock.multiplyScalar(Math.max(0, 1 - 6 * dt)); }
      if (e._fleeAnimT > 0) { e._fleeAnimT -= dt; if (e._fleeAnimT <= 0) e.anim.play?.(e.kind === 'baron' ? 'strut' : 'walk'); }
      if (e.state === 'home') {                                   // S16b: walking back to the pier, then stepping off
        _d.set(this._exit.x - p.x, 0, this._exit.z - p.z); const dd = _d.length(); if (dd > 1e-4) _d.divideScalar(dd);
        e.homeT += dt;
        if (dd > ENEMY_RULES.homeRadius && e.homeT < ENEMY_RULES.homeTimeout) {
          const sp = R.speed * ENEMY_RULES.homeSpeedMul; const nx = p.x + _d.x * sp * dt, nz = p.z + _d.z * sp * dt;
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
      // chase
      _d.set(hp.x - p.x, 0, hp.z - p.z); const dist = _d.length(); if (dist > 1e-4) _d.divideScalar(dist);
      let speed = R.speed; if (e.charging > 0) { e.charging -= dt; speed = BARON_POWERS[3].speed; }
      if (dist > ENEMY_RULES.approachMin) {
        const nx = p.x + _d.x * speed * dt, nz = p.z + _d.z * speed * dt;
        if (this.island?.isLand?.(nx, nz) ?? true) p.set(nx, 0, nz); else { p.x += _d.x * speed * dt * 0.3; }   // hug the shore
      }
      e.anim.faceTo?.(hp);
      // contact
      if (dist <= R.radius && t - e.hitAt >= R.hitCooldown) { e.hitAt = t; this._hitHero(e, e.charging > 0 ? BARON_POWERS[3].spark ?? R.hitSpark : R.hitSpark); e.anim.play?.(e.kind === 'baron' ? 'taunt' : 'fogPuff'); e.charging = 0; }
      // Baron powers
      if (e.kind === 'baron') {
        if (e.powers.includes('fogSlow') && dist <= BARON_POWERS[0].radius) slow = Math.min(slow, BARON_POWERS[0].mul);
        if (e.powers.includes('levy')) { e.timers.levy += dt; if (e.timers.levy >= BARON_POWERS[1].every) { e.timers.levy = 0; if (dist >= BARON_POWERS[1].minDist) { e.anim.play?.('offerDeal'); this.stats.levies++; this._hitHero(e, BARON_POWERS[1].spark); this.bus?.emit('enemy:levy', {}); } } }
        if (e.powers.includes('summon')) { e.timers.summon += dt; if (e.timers.summon >= BARON_POWERS[2].every) { e.timers.summon = 0; if (this.list.filter((m) => m.kind === 'collector' && m.state !== 'flee').length < ENEMY_RULES.minionCap) { e.anim.play?.('fogPuff'); this.stats.summons++; const m = this._spawnOne('collector', e.season, this.stats.summons); m.g.position.set(p.x + 0.8, 0, p.z + 0.8); this.bus?.emit('enemy:summon', {}); } } }
        if (e.powers.includes('charge')) { e.timers.charge += dt; if (e.timers.charge >= BARON_POWERS[3].every && dist > 2) { e.timers.charge = 0; e.charging = BARON_POWERS[3].dur; this.stats.charges++; e.anim.play?.('taunt'); this.vfx?.pop?.show?.(_v.set(p.x, 1.8, p.z).clone(), 'MINE!', { color: '#FFD54F' }); this.bus?.emit('enemy:charge', {}); } }
      }
      e.anim.update?.(dt);
    }
    if (slow !== this.heroSpeedMul) this._setHeroSpeed(slow);
    this.fogPool?.update(dt);
  }
  _setHeroSpeed(mul) { this.heroSpeedMul = mul; if (this.hero) this.hero.speed = this._baseHeroSpeed * mul; }

  _remove(i, why = 'flee') { const e = this.list[i]; this.list.splice(i, 1); e.anim.dispose?.(); e.g.removeFromParent?.(); this.bus?.emit('enemy:gone', { kind: e.kind, why }); }
  /** S16b: season is over — everyone still chasing turns around and WALKS back to the pier, then steps off (not a defeat). Returns how many were sent. */
  sendHome() {
    let n = 0;
    for (const e of this.list) if (e.state === 'chase') { e.state = 'home'; e.homeT = 0; e.offT = 0; e.knock.set(0, 0, 0); e.charging = 0; e.anim.play?.(e.kind === 'baron' ? 'strut' : 'walk'); n++; }
    this._setHeroSpeed(1);
    if (n) { const h = this.hero?.root?.position; if (h) this.vfx?.pop?.show?.(_v.set(h.x, 2.1, h.z).clone(), 'season over — they leave', { color: '#B0BEC5', dur: 1.4 }); this.bus?.emit('enemy:home', { count: n }); }
    return n;
  }
  /** Everyone vanishes now (no coins). Used on win / lose / teardown; season end uses sendHome(). */
  clear() { for (let i = this.list.length - 1; i >= 0; i--) this._remove(i, 'clear'); this._setHeroSpeed(1); }
  dispose() { this.clear(); this.fogPool?.mesh?.removeFromParent?.(); this.fogPool = null; }
}

// headless stand-ins (creature factories not injected)
function stub() { const g = new THREE.Group(); g.userData.parts = {}; return g; }
function stubAnim(g) { return { root: g, play() {}, update() {}, hit() {}, faceTo() {}, dispose() {} }; }
export default EnemySystem;
