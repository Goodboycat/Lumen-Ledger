// LUMEN LEDGER — Strangers are people (T4, S57; started as "Scams are NPCs", Chat 42D).
// A FRIENDLY STRANGER (own species: `makeStranger`, round, smiling, sun hat — NOT a Collector) walks in from the pier, strolls the plaza waving, and
// waits for Pip. Some strangers carry a Too-Good Deal (a scam), some carry a genuinely FAIR deal ('fair') — from the outside they look and sound the same.
// Nothing is offered until Pip talks to them: sb.interact() → S.interact() → eco.offerScam(id) | eco.offerFair(id) → the story dialogue (choices as before).
//   • SWORD: a stranger is NOT an enemy. A swing near them whiffs: they hop back giggling, the Owl barks "Not an enemy. Talk to them." (scam:whiff).
//     A sword never refuses, never flees, never resolves a deal (T4.2). `targets()` is always [] (no POW / hit-stop / spark on them).
//   • STAY: 25–40 s (SCAM.stay, per stranger) while the deal is not on the table → then they leave quietly: no penalty, no reward (T4.4; scam:leave why 'timeout').
//   • ledgerFlash near them: scam → scam:tell (owl names the tell, the stranger slinks off) · fair → owl confirms the terms, the stranger stays.
//   • accepted SCAM → they skip away laughing ('flee', fleeLaugh clip) · accepted FAIR → a thank-you and a wave goodbye · refused → they walk back to the pier.
// Which stranger: `spawn('fair')` → a fair deal · `spawn(scamId|fairId)` → that deal · `spawn()` → the next scam the player has NOT met yet (all six first, then a remix).
// Headless-safe (scene null → invisible group). Season end auto-refuse in Game.js stays as the safety net; S.clear() removes the stranger.
import * as THREE from '../../vendor/three.module.js';

export const SCAM = { walkSec: 2.5, stay: [25, 40], timeout: 25, lureEvery: 5.4, near: 3.4, flashNear: 3, whiffNear: 2.6, whiffBark: 3.2, leaveSec: 2.2, fleeSec: 1.9, strollSpeed: 1.0, pauseSec: 1.6, hearR: 9,
  spots: [{ x: 3.6, z: -5.4 }, { x: -3.6, z: -5.4 }, { x: 4.2, z: -1.8 }, { x: -4.2, z: -1.8 }, { x: 0, z: -3.2 }, { x: 0, z: 2.6 }] };
// the SAME warm pool for scams and fair deals: a bark must never give the kind away (the guide says "a stranger wants to talk", nothing more)
const HELLO = ['Hello, friend! Got a minute?', 'What a lovely island! A word?', 'Ah, a stallholder! May I show you something?', 'You look like a clever one, friend.'];

export function createScamNpc(deps = {}) {
  const { bus, eco, hero, creatures = {}, scene = null, game = null, world = {}, canStand = null, rng = Math.random } = deps;
  const S = { active: false, state: 'off', id: null, kind: 'scam', g: null, anim: null, t: 0, stayT: 0, stay: 30, lureT: 0, from: null, to: null, wp: null, pauseT: 0, tell: null, offered: false, answered: false,
    lastWhiffT: -9, lastWhiffBark: -99, lastScam: null, met: new Set(), metFair: new Set(), heard: 0,
    stats: { spawned: 0, offered: 0, hits: 0, whiffs: 0, tells: 0, timeouts: 0, accepted: 0, refused: 0, fair: 0 } };
  const offs = [];
  const heroPos = () => hero?.root?.position || hero?.position || { x: 0, z: 0 };
  const dist = () => { const h = heroPos(), p = S.g?.position; return p ? Math.hypot(p.x - h.x, p.z - h.z) : Infinity; };
  const pierPos = () => world.pierSpawn || { x: 0, z: -10 };
  const clock = () => game?.time ?? S.t;
  const say = (text, speaker = 'stranger', ttl = 3.2, force = false) => { if (text && S.g) bus.emit('story:bark', { speaker, text, anchor: { x: S.g.position.x, y: 2.1, z: S.g.position.z }, ttl, group: 'scamNpc', force }); };   // force: lesson lines (whiff / flash) bypass the 6 s bark-diet gap
  const free = (x, z) => !canStand || canStand(x, z);
  const spotsFree = () => SCAM.spots.filter((s) => free(s.x, s.z));
  const pickSpot = () => (spotsFree()[0] || SCAM.spots[0]);
  const look = (x, z) => S.anim?.faceTo?.(new THREE.Vector3(x, 0, z));
  const play = (n) => { if (S.anim && S.anim.current !== n) S.anim.play?.(n); };
  const oneShot = () => S.anim && (S.anim.current === 'dodge' || S.anim.current === 'leanIn' || S.anim.current === 'offerDeal');

  /** Next deal id. 'fair' → an unmet fair deal (then random) · a known id → itself · undefined → an unmet scam first (T4: all six, then a remix that never repeats the last one). */
  function pickId(id) {
    const scamIds = Object.keys(eco.scams || {}), fairIds = Object.keys(eco.fairs || {});
    if (id && id !== 'fair') return (eco.scams?.[id] || eco.fairs?.[id]) ? id : null;
    if (id === 'fair') { if (!fairIds.length) return null; const un = fairIds.filter((i) => !S.metFair.has(i)); const pool = un.length ? un : fairIds; return pool[Math.floor(rng() * pool.length)]; }
    if (!scamIds.length) return null;
    const un = scamIds.filter((i) => !S.met.has(i)); const pool = un.length ? un : (scamIds.length > 1 ? scamIds.filter((i) => i !== S.lastScam) : scamIds);
    return pool[Math.floor(rng() * pool.length)];
  }

  function make(seed) {
    const g = creatures.makeStranger ? creatures.makeStranger(seed % 3, { seed }) : new THREE.Group();
    if (!g.userData.parts) g.userData.parts = {};
    if (!creatures.makeStranger) g.userData.type = 'stranger' + (seed % 3);
    g.userData.scam = true; g.userData.stranger = true;
    const anim = creatures.VillainAnimator ? new creatures.VillainAnimator(g, { game, knockPower: 0, canStand }) : { play() {}, update() {}, faceTo() {}, dispose() {}, current: 'idle' };
    return { g, anim };
  }
  function remove() { if (S.g) { S.g.removeFromParent?.(); S.anim?.dispose?.(); } S.g = null; S.anim = null; S.active = false; S.state = 'off'; }

  /** Spawn a stranger (see header for `id`). Emits scam:npc {id, kind, pos, season, stay}. Returns false when one is already out / a deal is on the table / unknown id. */
  S.spawn = (id) => {
    if (S.active || eco.pendingOffer) return false;
    const sid = pickId(id); if (!sid) return false;
    remove();
    const kind = eco.fairs?.[sid] ? 'fair' : 'scam';
    const { g, anim } = make((eco.state?.season || 1) * 7 + S.stats.spawned); S.g = g; S.anim = anim;
    const p = pierPos(), to = pickSpot();
    S.from = { x: p.x, z: p.z }; S.to = { x: to.x, z: to.z };
    g.position.set(S.from.x, 0, S.from.z); (scene || game?.scene)?.add?.(g);
    look(S.to.x, S.to.z); play('walk');
    S.active = true; S.state = 'arrive'; S.id = sid; S.kind = kind; S.tell = kind === 'scam' ? (eco.scams[sid]?.tell || null) : null;
    S.t = 0; S.stayT = 0; S.stay = SCAM.stay[0] + rng() * (SCAM.stay[1] - SCAM.stay[0]); S.lureT = 1.2; S.offered = false; S.answered = false; S.wp = null; S.pauseT = 0; S.heard = 0;
    S.stats.spawned++; if (kind === 'fair') { S.stats.fair++; S.metFair.add(sid); } else { S.met.add(sid); S.lastScam = sid; }   // a stranger the player skipped still counts: the NEXT one is always a different deal
    bus.emit('scam:npc', { id: sid, kind, pos: { ...S.to }, season: eco.state?.season || 0, stay: +S.stay.toFixed(1), model: g.userData.type });
    return true;
  };
  S.near = (r = SCAM.near) => S.active && (S.state === 'pitch' || S.state === 'offered') && dist() <= r;
  /** Pip talks to the stranger: opens the real deal (eco.offerScam | eco.offerFair → story dialogue). Returns 'scam' (any deal; the caller must not learn which kind) or null. */
  S.interact = () => {
    if (!S.near() || S.state !== 'pitch') return null;
    const o = S.kind === 'fair' ? eco.offerFair(S.id) : eco.offerScam(S.id); if (!o) return null;
    if (S.kind === 'scam') { S.met.add(S.id); S.lastScam = S.id; } else S.metFair.add(S.id);
    S.state = 'offered'; S.offered = true; S.stats.offered++; S.t = 0; bus.emit('scam:talk', { id: S.id });   // S83: friendly pip greeting blip
    look(heroPos().x, heroPos().z); S.anim?.play?.('offerDeal');
    return 'scam';
  };
  /** A sword swing near the stranger: they dodge (hop back, giggle) and the Owl says what they are. NEVER resolves anything. Returns true when it whiffed on them. */
  S.whiff = () => {
    if (!S.active || (S.state !== 'pitch' && S.state !== 'offered')) return false;
    S.stats.whiffs++; S.stats.hits++;
    if (S.t - S.lastWhiffT > 0.45) { S.lastWhiffT = S.t; S.anim?.play?.('dodge'); }
    if (clock() - S.lastWhiffBark > SCAM.whiffBark) { S.lastWhiffBark = clock(); say('Not an enemy. Talk to them.', 'owl', 2.8, true); }
    bus.emit('scam:whiff', { id: S.id, kind: S.kind });
    return true;
  };
  S.hit = () => S.whiff();                       // legacy entry point (old gates / debug): a hit is only ever a whiff
  /** Ledger Flash near the stranger. scam → the owl names the tell (they slink off) · fair → the owl confirms the written terms (they stay). Returns the line or null. */
  S.flash = () => {
    if (!S.active || (S.state !== 'pitch' && S.state !== 'offered') || dist() > SCAM.flashNear) return null;
    S.stats.tells++;
    if (S.kind === 'fair') { const terms = eco.fairs?.[S.id]?.terms || 'Terms in writing.'; bus.emit('scam:tell', { id: S.id, fair: true, tell: terms }); say(`Looks fair, Pip: ${terms}`, 'owl', 3.6); return terms; }
    const tell = S.tell || 'Too good to be true.';
    bus.emit('scam:tell', { id: S.id, tell }); say(`Look closer, Pip: ${tell}`, 'owl', 3.6);
    if (!S.offered) leave('tell');
    return tell;
  };
  S.targets = () => [];                          // T4.2: not a combat target — no POW, no hit-stop, no spark on a stranger
  function refuse(why) {
    if (S.answered) return; S.answered = true; S.stats.refused++;
    if (eco.pendingOffer && eco.pendingOffer.id === S.id) eco.refuseOffer();
    bus.emit('scam:refused', { id: S.id, why, kind: S.kind });
  }
  function leave(why) { if (!S.active || S.state === 'leave' || S.state === 'flee') return; S.state = 'leave'; S.t = 0; S.from = { x: S.g.position.x, z: S.g.position.z }; S.to = pierPos(); look(S.to.x, S.to.z); play('walk'); bus.emit('scam:leave', { id: S.id, why, kind: S.kind }); }
  function flee(why) { if (!S.active || S.state === 'leave' || S.state === 'flee') return; S.state = 'flee'; S.t = 0; S.from = { x: S.g.position.x, z: S.g.position.z }; S.to = pierPos(); look(S.to.x, S.to.z); S.anim?.play?.('fleeLaugh'); bus.emit('scam:leave', { id: S.id, why, kind: S.kind, laughing: true }); }

  /** Plaza stroll: pick the next free spot (never the same twice), walk there at SCAM.strollSpeed, pause + wave, repeat. Hero close → stop and face them. */
  function stroll(dt) {
    const g = S.g, hp = heroPos(), d = dist();
    if (d <= SCAM.near + 1) { look(hp.x, hp.z); if (!oneShot()) { if (S.anim && S.anim.current !== 'wave' && S.anim.current !== 'leanIn') S.anim.play?.('leanIn'); else play('wave'); } S.wp = null; return; }
    if (S.pauseT > 0) { S.pauseT -= dt; play('wave'); return; }
    if (!S.wp) { const c = spotsFree().filter((s) => Math.hypot(s.x - g.position.x, s.z - g.position.z) > 1.2); const pool = c.length ? c : spotsFree(); S.wp = pool.length ? pool[Math.floor(rng() * pool.length)] : null; if (!S.wp) { play('wave'); return; } }
    const dx = S.wp.x - g.position.x, dz = S.wp.z - g.position.z, len = Math.hypot(dx, dz);
    if (len < 0.15) { S.wp = null; S.pauseT = SCAM.pauseSec; return; }
    const step = Math.min(len, SCAM.strollSpeed * dt), nx = g.position.x + dx / len * step, nz = g.position.z + dz / len * step;
    if (free(nx, nz) || true) { g.position.x = nx; g.position.z = nz; }
    look(S.wp.x, S.wp.z); if (!oneShot()) play('walk');
  }

  S.update = (dt) => {
    if (!S.active) return; S.t += dt; S.anim?.update?.(dt); const g = S.g;
    if (S.state === 'arrive' || S.state === 'leave' || S.state === 'flee') {
      const sec = S.state === 'arrive' ? SCAM.walkSec : (S.state === 'flee' ? SCAM.fleeSec : SCAM.leaveSec), k = Math.min(1, S.t / sec), e = S.state === 'flee' ? k : 1 - Math.pow(1 - k, 2);
      g.position.set(S.from.x + (S.to.x - S.from.x) * e, 0, S.from.z + (S.to.z - S.from.z) * e);
      if (k >= 1) { if (S.state === 'arrive') { S.state = 'pitch'; S.t = 0; S.anim?.play?.('wave'); } else remove(); }
      return;
    }
    if (S.state === 'pitch') {
      S.stayT += dt; stroll(dt);
      if ((S.lureT -= dt) <= 0 && dist() <= SCAM.hearR) { S.lureT = SCAM.lureEvery; say(HELLO[(S.stats.spawned + S.heard++) % HELLO.length]); }
      if (S.stayT >= S.stay && !S.answered) { S.stats.timeouts++; refuse('timeout'); leave('timeout'); }   // quiet exit: nothing offered, nothing charged, nothing earned (T4.4)
      return;
    }
    if (S.state === 'offered') { const h = heroPos(); look(h.x, h.z); return; }
  };
  // the dialogue answered (accept / refuse via story choices or Game.js onReveal) → they go either way
  const onResult = (r) => {
    if (!S.active || r?.id !== S.id) return; S.answered = true;
    if (r.accepted) { S.stats.accepted++; if (S.kind === 'fair') { say('Thank you, friend!', 'stranger', 2.2); if (S.state === 'offered') leave('accepted'); } else { say('Pleasure doing business!', 'stranger', 2.2); if (S.state === 'offered') flee('accepted'); } }
    else { if (!S.stats.refused) S.stats.refused++; if (S.state === 'offered') leave('refused'); }
  };
  offs.push(bus.on('eco:scamResult', onResult), bus.on('eco:fairResult', onResult));
  offs.push(bus.on('combat:miss', () => { if (S.active && (S.state === 'pitch' || S.state === 'offered') && dist() <= SCAM.whiffNear) S.whiff(); }));
  offs.push(bus.on('eco:season', () => { if (S.active) { refuse('season'); remove(); } }));
  S.clear = () => { if (S.active) refuse('clear'); remove(); };
  S.destroy = () => { for (const f of offs) f?.(); offs.length = 0; remove(); };
  return S;
}
export default createScamNpc;
