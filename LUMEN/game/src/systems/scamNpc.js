// LUMEN LEDGER — Scams are NPCs (Chat 42D, 2026-11-03).
// The scheduler's scam mark (odd seasons, day 0.70) no longer pops a Too-Good Deal out of thin air: a Collector in `pitch` state struts in
// from the pier to a plaza spot, waves its scroll and lures ("Psst…"). Nothing is offered until Pip talks to it: sb.interact() → S.interact()
// → eco.offerScam(id) → the 8B dialogue (story.js onScam, choices accept/refuse) runs as before. Three ways to answer without the dialogue:
//   • sword hit  → eco.refuseOffer() once + the NPC flees (VillainAnimator 'flee', shrinks away)            → scam:refused {id, why:'hit'}
//   • ledgerFlash within SCAM.flashNear → scam:tell {id, tell} (owl names the tell; the offer, if open, is refused by Game.js onReveal)
//   • SCAM.timeout s unanswered → refuse once, walk back to the pier                                       → scam:refused {id, why:'timeout'}
// Headless-safe (scene null → invisible stub group). Season end auto-refuse in Game.js stays as the safety net; S.clear() removes the NPC.
import * as THREE from '../../vendor/three.module.js';

export const SCAM = { walkSec: 2.5, timeout: 25, lureEvery: 4.6, near: 3, flashNear: 3, fleeSec: 0.6, leaveSec: 2.2,
  spots: [{ x: 3.6, z: -5.4 }, { x: -3.6, z: -5.4 }, { x: 4.2, z: -1.8 }, { x: -4.2, z: -1.8 }] };
const LURES = ['Psst. Over here. A once-in-a-lifetime deal…', 'Friend! You look like someone who deserves more Spark.', 'Today only. Don\'t tell the owl.', 'I don\'t do this for everyone, you know.'];

export function createScamNpc(deps = {}) {
  const { bus, eco, hero, creatures = {}, scene = null, game = null, world = {}, canStand = null, rng = Math.random } = deps;
  const S = { active: false, state: 'off', id: null, g: null, anim: null, t: 0, lureT: 0, from: null, to: null, tell: null, offered: false, answered: false,
    stats: { spawned: 0, offered: 0, hits: 0, tells: 0, timeouts: 0, accepted: 0, refused: 0 } };
  const offs = [];
  const heroPos = () => hero?.root?.position || hero?.position || { x: 0, z: 0 };
  const dist = () => { const h = heroPos(), p = S.g?.position; return p ? Math.hypot(p.x - h.x, p.z - h.z) : Infinity; };
  const pierPos = () => world.pierSpawn || { x: 0, z: -10 };
  const say = (text, speaker = 'collector', ttl = 3.2) => { if (text && S.g) bus.emit('story:bark', { speaker, text, anchor: { x: S.g.position.x, y: 2.1, z: S.g.position.z }, ttl, group: 'scamNpc' }); };
  const pickSpot = () => { for (const s of SCAM.spots) if (!canStand || canStand(s.x, s.z)) return s; return SCAM.spots[0]; };
  const pickId = (id) => { const ids = Object.keys(eco.scams || {}); if (!ids.length) return null; return (id && eco.scams[id]) ? id : ids[Math.floor(rng() * ids.length)]; };

  function make(seed) {
    const g = creatures.makeFogCollector ? creatures.makeFogCollector(seed % 3, { seed }) : new THREE.Group();
    if (!g.userData.parts) g.userData.parts = {};
    g.userData.type = 'collector'; g.userData.scam = true;
    const anim = creatures.VillainAnimator ? new creatures.VillainAnimator(g, { game, knockPower: 0 }) : { play() {}, update() {}, faceTo() {}, dispose() {} };
    return { g, anim };
  }
  function remove() { if (S.g) { S.g.removeFromParent?.(); S.anim?.dispose?.(); } S.g = null; S.anim = null; S.active = false; S.state = 'off'; }

  /** Spawn the pitching Collector (optionally a fixed scam id). Emits scam:npc. Returns false when a scam is already on the table. */
  S.spawn = (id) => {
    if (S.active || eco.pendingOffer) return false;
    const sid = pickId(id); if (!sid) return false;
    remove();
    const { g, anim } = make((eco.state?.season || 1) * 7 + S.stats.spawned); S.g = g; S.anim = anim;
    const p = pierPos(), to = pickSpot();
    S.from = { x: p.x, z: p.z }; S.to = { x: to.x, z: to.z };
    g.position.set(S.from.x, 0, S.from.z); (scene || game?.scene)?.add?.(g);
    anim.faceTo?.(new THREE.Vector3(S.to.x, 0, S.to.z)); anim.play?.('walk');
    S.active = true; S.state = 'arrive'; S.id = sid; S.tell = eco.scams[sid]?.tell || null; S.t = 0; S.lureT = 0.8; S.offered = false; S.answered = false;
    S.stats.spawned++;
    bus.emit('scam:npc', { id: sid, pos: { ...S.to }, season: eco.state?.season || 0 });
    return true;
  };
  S.near = (r = SCAM.near) => S.active && (S.state === 'pitch' || S.state === 'offered') && dist() <= r;
  /** Pip talks to the NPC: opens the real Too-Good Deal (eco.offerScam → story dialogue). Returns 'scam' or null. */
  S.interact = () => {
    if (!S.near() || S.state !== 'pitch') return null;
    const o = eco.offerScam(S.id); if (!o) return null;
    S.state = 'offered'; S.offered = true; S.stats.offered++; S.t = 0;
    S.anim?.faceTo?.(new THREE.Vector3(heroPos().x, 0, heroPos().z)); S.anim?.play?.('offerDeal');
    return 'scam';
  };
  /** Sword hit while pitching/offered: refuse once, flee. */
  S.hit = (dir) => {
    if (!S.active || (S.state !== 'pitch' && S.state !== 'offered')) return false;
    S.stats.hits++; refuse('hit');
    S.state = 'flee'; S.t = 0; S.anim?.play?.('flee'); if (dir && S.anim?.faceTo) S.anim.faceTo(new THREE.Vector3(S.g.position.x - dir.x, 0, S.g.position.z - dir.z));
    say(eco.scams[S.id]?.fleeLine || 'Ow! Fine, fine — no deal!', 'collector', 2.2);
    return true;
  };
  /** Ledger Flash near the NPC: the owl names the tell. Returns the tell or null. */
  S.flash = () => {
    if (!S.active || (S.state !== 'pitch' && S.state !== 'offered') || dist() > SCAM.flashNear) return null;
    S.stats.tells++; const tell = S.tell || 'Too good to be true.';
    bus.emit('scam:tell', { id: S.id, tell }); say(`Look closer, Pip: ${tell}`, 'owl', 3.6);
    if (!S.offered) leave('tell');
    return tell;
  };
  S.targets = () => (S.active && (S.state === 'pitch' || S.state === 'offered')) ? [{ root: S.g, enemy: { kind: 'collector', scam: true, id: S.id, state: S.state }, hit: (dir, power) => S.hit(dir, power) }] : [];
  function refuse(why) {
    if (S.answered) return; S.answered = true; S.stats.refused++;
    if (eco.pendingOffer && eco.pendingOffer.id === S.id) eco.refuseOffer();
    bus.emit('scam:refused', { id: S.id, why });
  }
  function leave(why) { if (!S.active || S.state === 'leave' || S.state === 'flee') return; S.state = 'leave'; S.t = 0; S.from = { x: S.g.position.x, z: S.g.position.z }; S.to = pierPos(); S.anim?.faceTo?.(new THREE.Vector3(S.to.x, 0, S.to.z)); S.anim?.play?.('walk'); bus.emit('scam:leave', { id: S.id, why }); }

  S.update = (dt) => {
    if (!S.active) return; S.t += dt; S.anim?.update?.(dt); const g = S.g;
    if (S.state === 'arrive' || S.state === 'leave') {
      const sec = S.state === 'arrive' ? SCAM.walkSec : SCAM.leaveSec, k = Math.min(1, S.t / sec), e = 1 - Math.pow(1 - k, 2);
      g.position.set(S.from.x + (S.to.x - S.from.x) * e, 0, S.from.z + (S.to.z - S.from.z) * e);
      if (k >= 1) { if (S.state === 'arrive') { S.state = 'pitch'; S.t = 0; S.anim?.play?.('taunt'); } else remove(); }
      return;
    }
    if (S.state === 'pitch' || S.state === 'offered') {
      const h = heroPos(); S.anim?.faceTo?.(new THREE.Vector3(h.x, 0, h.z));
      if (S.state === 'pitch' && (S.lureT -= dt) <= 0) { S.lureT = SCAM.lureEvery; say(LURES[S.stats.spawned % LURES.length]); }
      if (S.t >= SCAM.timeout && !S.answered) { S.stats.timeouts++; refuse('timeout'); leave('timeout'); }
      return;
    }
    if (S.state === 'flee') { const s = Math.max(0.001, 1 - S.t / SCAM.fleeSec); g.scale.setScalar(s); if (S.t >= SCAM.fleeSec) remove(); }
  };
  // the dialogue answered (accept / refuse via story choices or Game.js onReveal) → he leaves either way
  offs.push(bus.on('eco:scamResult', (r) => { if (!S.active || r?.id !== S.id) return; S.answered = true; if (r.accepted) { S.stats.accepted++; say('Pleasure doing business!', 'collector', 2.2); } else if (!S.stats.refused) S.stats.refused++; if (S.state === 'offered') leave(r.accepted ? 'accepted' : 'refused'); }));
  offs.push(bus.on('eco:season', () => { if (S.active) { refuse('season'); remove(); } }));
  S.clear = () => { if (S.active) refuse('clear'); remove(); };
  S.destroy = () => { for (const f of offs) f?.(); offs.length = 0; remove(); };
  return S;
}
export default createScamNpc;
