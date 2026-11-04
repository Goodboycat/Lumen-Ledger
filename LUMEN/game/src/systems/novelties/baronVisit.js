// src/systems/novelties/baronVisit.js — 43C S4 novelty. At `at` (S4 0.64) Baron Gilt HIMSELF (non-hostile) struts from the pier to the plaza
// centre and replaces the scam mark (seasons.json scamKind:'baron' → the scheduler spawns no Collector and opens no direct offer).
//   sb.interact() near him → eco.offerScam('zeroInterestLoan') + pitch barks (speaker 'baron' → 7B portrait) → ui:choice as today
//   ledgerFlash ≤ BARON.flashNear → scam:tell {id, tell}       sword hit → slipOnCoin + refuse once + flee        BARON.timeout s → refuse + leave
// Game.js generic hooks: sb.novelty?.near?.() / .interact() / .flash() / .targets()  (43C, 3 lines). end() sends him off and removes the mesh.
// Headless-safe: no creatures → invisible THREE.Group (gate asserts the group leaves the scene).
import * as THREE from '../../../vendor/three.module.js';

export const BARON = { walkSec: 2.5, timeout: 25, tauntEvery: 4.2, near: 3, flashNear: 3, fleeSec: 2.0, leaveSec: 2.2, scam: 'zeroInterestLoan', spot: { x: 0, z: -3.2 } };
const PITCH = ['A zero-interest* loan, keeper. 150 Spark. Today only; the Baker already took one.', 'Just initial that you looked. Most pay 20 %; for you, zero*.'];   // 48G tactic vocabulary: urgency · social proof · foot-in-the-door · anchoring

export function createBaronVisit() {
  const V = { id: 'baronVisit', g: null, anim: null, state: 'off', t: 0, tauntT: 0, from: null, to: null, offered: false, answered: false, sb: null, offs: [], pitchI: 0 };
  const heroPos = (sb) => sb.hero?.root?.position || sb.hero?.position || { x: 0, z: 0 };
  const dist = (sb) => { const h = heroPos(sb), p = V.g?.position; return p ? Math.hypot(p.x - h.x, p.z - h.z) : Infinity; };
  const say = (sb, text, speaker = 'baron', ttl = 3.4) => { if (text && V.g) sb.game.bus.emit('story:bark', { speaker, text, anchor: { x: V.g.position.x, y: 2.3, z: V.g.position.z }, ttl, group: 'baronVisit' }); };
  const line = (sb, i) => { const a = sb.storyData?.barks?.seasonNovelty?.baronVisit; const b = a?.[i]; return b ? (b.text || b) : null; };
  const pitch = (sb, i) => { const a = sb.storyData?.baron?.visit; const b = a?.[i]; return b ? (b.text || b) : PITCH[i % PITCH.length]; };

  function make(sb) {                                                            // synchronous: the gate steps the clock synchronously
    const C = (!sb.headless && sb.creatures) || {};
    const g = C.makeBaronGilt ? C.makeBaronGilt({ seed: 43 }) : new THREE.Group();
    if (!g.userData.parts) g.userData.parts = {};
    g.userData.type = 'baron'; g.userData.visit = true;
    const anim = C.VillainAnimator ? new C.VillainAnimator(g, { game: sb.game, knockPower: 0 }) : { play() {}, update() {}, faceTo() {}, dispose() {} };
    return { g, anim };
  }
  function remove() { if (V.g) { V.g.removeFromParent?.(); V.anim?.dispose?.(); } V.g = null; V.anim = null; V.state = 'off'; }
  function refuse(sb, why) {
    if (V.answered) return; V.answered = true;
    const eco = sb.eco; if (eco.pendingOffer && eco.pendingOffer.id === BARON.scam) eco.refuseOffer();
    sb.game.bus.emit('scam:refused', { id: BARON.scam, why, baron: true });
  }
  function leave(sb, why) {
    if (!V.g || V.state === 'leave' || V.state === 'flee' || V.state === 'off') return;
    V.state = 'leave'; V.t = 0; V.from = { x: V.g.position.x, z: V.g.position.z }; V.to = sb.world?.pierSpawn || { x: 0, z: -10 };
    V.anim?.faceTo?.(new THREE.Vector3(V.to.x, 0, V.to.z)); V.anim?.play?.('strut');
    if (why === 'timeout') say(sb, 'No answer? Prudence. How tiresome.', 'baron', 2.4);
  }

  V.start = (sb, season) => {
    V.sb = sb; V.state = 'spawn'; V.offered = false; V.answered = false; V.t = 0;
    const place = ({ g, anim }) => {
      if (V.state !== 'spawn') return;                                           // ended before the import resolved
      V.g = g; V.anim = anim;
      const p = sb.world?.pierSpawn || { x: 0, z: -10 }, to = BARON.spot;
      V.from = { x: p.x, z: p.z }; V.to = { x: to.x, z: to.z };
      g.position.set(V.from.x, 0, V.from.z); sb.game.scene?.add?.(g);
      anim.faceTo?.(new THREE.Vector3(to.x, 0, to.z)); anim.play?.('strut');
      V.state = 'arrive'; V.t = 0; V.tauntT = 1.0;
      sb.game.bus.emit('baron:visit', { season, pos: { ...V.to } });
      say(sb, line(sb, 0) || 'Baron Gilt, in person. Keep your pouch shut, Pip.', 'owl', 3.2);
    };
    place(make(sb));
    V.offs.push(sb.game.bus.on('eco:scamResult', (res) => { if (res?.id !== BARON.scam || V.state === 'off') return; V.answered = true;
      say(sb, res.accepted ? 'Pleasure doing business. The asterisk sends its regards.' : (line(sb, 2) || 'Refused? The owl has taught you well. Pity.'), 'baron', 2.6); leave(sb, res.accepted ? 'accepted' : 'refused'); }));
  };
  V.near = (r = BARON.near) => !!V.g && (V.state === 'pitch' || V.state === 'offered') && dist(V.sb) <= r;
  /** Pip talks to the Baron → the real Too-Good Deal (eco.offerScam → 8B dialogue). 'scam' | null */
  V.interact = () => {
    const sb = V.sb; if (!sb || !V.near() || V.state !== 'pitch') return null;
    if (sb.eco.pendingOffer) return null;
    const o = sb.eco.offerScam(BARON.scam); if (!o) return null;
    V.state = 'offered'; V.offered = true; V.t = 0; const h = heroPos(sb);
    V.anim?.faceTo?.(new THREE.Vector3(h.x, 0, h.z)); V.anim?.play?.('offerDeal');
    say(sb, pitch(sb, 0), 'baron', 3.6);
    return 'scam';
  };
  /** Ledger Flash near him: the owl names the tell (the asterisk). */
  V.flash = () => {
    const sb = V.sb; if (!sb || !V.g || (V.state !== 'pitch' && V.state !== 'offered') || dist(sb) > BARON.flashNear) return null;
    const tell = sb.eco.scams?.[BARON.scam]?.tell || 'the asterisk';
    sb.game.bus.emit('scam:tell', { id: BARON.scam, tell, baron: true }); say(sb, line(sb, 1) || `Look closer, Pip: ${tell}.`, 'owl', 3.6);
    if (!V.offered) { refuse(sb, 'tell'); leave(sb, 'tell'); }
    return tell;
  };
  /** Sword hit while pitching/offered: slip on a coin, refuse once, flee. */
  V.hit = (dir) => {
    const sb = V.sb; if (!sb || !V.g || (V.state !== 'pitch' && V.state !== 'offered')) return false;
    refuse(sb, 'hit'); V.state = 'flee'; V.t = 0;
    V.anim?.play?.('slipOnCoin'); say(sb, 'Ow— my hat! Fine. No deal!', 'baron', 2.2);
    V.from = { x: V.g.position.x, z: V.g.position.z }; V.to = sb.world?.pierSpawn || { x: 0, z: -10 };
    if (dir && V.anim?.faceTo) V.anim.faceTo(new THREE.Vector3(V.g.position.x - dir.x, 0, V.g.position.z - dir.z));
    return true;
  };
  V.targets = () => (V.g && (V.state === 'pitch' || V.state === 'offered')) ? [{ root: V.g, enemy: { kind: 'baron', scam: true, id: BARON.scam, state: V.state }, hit: (dir, power) => V.hit(dir, power) }] : [];

  V.update = (sb, dt) => {
    if (!V.g || V.state === 'off' || V.state === 'spawn' || !(dt > 0)) return; V.t += dt; V.anim?.update?.(dt); const g = V.g;
    if (V.state === 'arrive' || V.state === 'leave' || V.state === 'flee') {
      const sec = V.state === 'arrive' ? BARON.walkSec : V.state === 'flee' ? BARON.fleeSec : BARON.leaveSec, k = Math.min(1, V.t / sec), e = 1 - (1 - k) * (1 - k);
      if (V.state === 'flee') { if (V.t > 0.9) { V.anim?.play?.('flee'); const kk = (V.t - 0.9) / (sec - 0.9); g.position.set(V.from.x + (V.to.x - V.from.x) * kk, 0, V.from.z + (V.to.z - V.from.z) * kk); } }
      else g.position.set(V.from.x + (V.to.x - V.from.x) * e, 0, V.from.z + (V.to.z - V.from.z) * e);
      if (k >= 1) { if (V.state === 'arrive') { V.state = 'pitch'; V.t = 0; V.anim?.play?.('taunt'); say(sb, 'Keeper! A word. A profitable one.', 'baron', 3); } else remove(); }
      return;
    }
    if (V.state === 'pitch' || V.state === 'offered') {
      const h = heroPos(sb); if (Math.hypot(h.x - g.position.x, h.z - g.position.z) < 7) V.anim?.faceTo?.(new THREE.Vector3(h.x, 0, h.z));
      if (V.state === 'pitch' && (V.tauntT -= dt) <= 0) { V.tauntT = BARON.tauntEvery; V.anim?.play?.('taunt'); say(sb, pitch(sb, (V.pitchI++ % 2) + 0), 'baron', 3); }
      if (V.t >= BARON.timeout && !V.answered) { refuse(sb, 'timeout'); leave(sb, 'timeout'); }
    }
  };
  V.end = (sb) => { if (!V.answered && (V.state === 'pitch' || V.state === 'offered')) refuse(sb, 'season'); remove(); V.state = 'off'; };
  V.dispose = () => { for (const f of V.offs) f?.(); V.offs.length = 0; remove(); V.sb = null; };
  return V;
}
