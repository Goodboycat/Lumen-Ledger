// LUMEN LEDGER — Pay the Baron at the pier (Chat 42D, 2026-11-03).
// The season's loan interest is no longer charged silently at the ledger: when `eco.pierPays` is on, economy.endSeason() parks it in
// `eco.state.interestOwed` and Baron Gilt strides onto the pier to collect it. Pip walks over and presses E (sb.interact() → B.interact()):
// the pouch pays the interest (coinFly), what the pouch cannot cover becomes debt and the Baron SAYS so (the old silent rule, now spoken).
// Then an optional repay: every further E tap repays DEPOSIT_STEP ✦; releasing E (or 10 s idle) ends the visit → `pier:done` → the ledger.
// 20 s with no visit → auto-settle (never a soft-lock). Debt-free + nothing owed → the Baron does not come (`pier:skip`).
//
//   import { createBaronPier, PIER } from './systems/baronPier.js';
//   const B = createBaronPier({ bus, eco, world, hero, vfx, creatures, scene, game, story });
//   B.active            true while the Baron is at the pier (Game.js: state 'pier', eco clock does not tick)
//   B.phase             'off' | 'arrive' | 'wait' | 'repay' | 'leave'
//   B.due()             { interest, minimum, debt }   (minimum = interest the pouch can cover right now)
//   B.near(r = 3.4)     hero within r of the Baron (and he is waiting / repaying)
//   B.interact()        'paid' | 'short' | 'repaid' | 'done' | null      B.release() ends a repay hold
//   B.update(dt)        walk + animator + timers (call from sb.update)      B.begin() force a visit (demo / tests / resume)
//   B.settle(why)       settle now (timeout / teardown) → pier:paid|short, then done
//   B.destroy()
// bus: pier:due {interest, debt, pos} · pier:paid {interest, repaid, debt} · pier:short {shortfall, paid, debt} · pier:repaid {amount, debt}
//      pier:done {interest, repaid, shortfall, why} · pier:skip {season}
// Lines: data/story.json "pier" { paid: {t1,t2,t3: [..]}, short: {...} } via opts.story?.data (optional; built-in fallbacks below).
import * as THREE from '../../vendor/three.module.js';
import { DEPOSIT_STEP } from './jarsWorld.js';

export const PIER = { walkSec: 2.5, waitCap: 20, repayIdle: 10, tauntEvery: 3.4, standIn: 1.1, near: 3.4, leaveSec: 2.2, graceMax: 12, graceStep: 4 };   // S72: graceMax/Step = extra seconds a SHORT player earns by getting ✦ into the pouch while he waits

const FALLBACK = {
  paid:  { t1: ['Interest, on time. How… dull of you.', 'Every coin counted. The fog will have to wait.'],
           t2: ['Paid in full? The fog grows thin on honest ledgers.', 'You read the small print now. Pity.'],
           t3: ['Still paying. Still standing. I am almost impressed.', 'The lighthouse keeper pays like a clerk. Tsk.'] },
  short: { t1: ['Short again? No matter — I add it to the debt. With interest.', 'An empty pouch is my favourite kind. The rest goes on the ledger.'],
           t2: ['Cannot pay? Then you owe me more. That is how I like it.', 'Shortfall noted. The fog thanks you.'],
           t3: ['Pockets empty at season ten? Delicious. On the pile it goes.', 'You cannot pay a Baron with hope. Debt it is.'] },
  repaid: { t1: ['Principal, is it? Someone has been listening to the owl.'], t2: ['Every repaid coin is one I cannot compound.'], t3: ['Debt almost gone. I shall miss our little chats.'] },
};
const tierOf = (s) => (s <= 3 ? 't1' : s <= 6 ? 't2' : 't3');

export function createBaronPier(deps = {}) {
  const { bus, eco, world = {}, hero, vfx, creatures = {}, scene = null, game = null, story = null } = deps;
  const B = { active: false, phase: 'off', g: null, anim: null, t: 0, idle: 0, tauntT: 0, from: null, to: null, season: 0,
    interest: 0, paid: 0, shortfall: 0, repaid: 0, settled: false, canPay: true, grace: 0, stats: { visits: 0, paid: 0, short: 0, repaid: 0, timeouts: 0, skips: 0 } };
  const offs = [];
  const heroPos = () => hero?.root?.position || hero?.position || { x: 0, z: 0 };
  const spawn = () => world.pierSpawn || { x: 0, z: -10 };
  const lines = () => story?.data?.pier || (story?.pier) || FALLBACK;
  const pick = (kind, season) => { const L = lines(), arr = (L[kind] && (L[kind][tierOf(season)] || L[kind].t1)) || FALLBACK[kind][tierOf(season)]; return arr[Math.floor(Math.random() * arr.length)] || ''; };
  const say = (text, ttl = 3.4) => { if (text && B.g) bus.emit('story:bark', { speaker: 'baron', text, anchor: { x: B.g.position.x, y: 2.3, z: B.g.position.z }, ttl, group: 'pier' }); };

  function makeBaron() {
    const g = creatures.makeBaronGilt ? creatures.makeBaronGilt({ seed: 42 }) : new THREE.Group();
    if (!g.userData.parts) g.userData.parts = {};
    g.userData.type = 'baron'; g.userData.pier = true;
    const anim = creatures.VillainAnimator ? new creatures.VillainAnimator(g, { game, knockPower: 0 }) : { play() {}, update() {}, faceTo() {}, dispose() {} };
    return { g, anim };
  }
  function remove() { if (B.g) { B.g.removeFromParent?.(); B.anim?.dispose?.(); } B.g = null; B.anim = null; }

  /** Start a visit: the Baron strides from the water edge to the pier landing. Returns false when there is nothing to collect. */
  B.begin = ({ force = false } = {}) => {
    if (B.active) return true;
    const s = eco.state, owed = Math.round(s.interestOwed || 0);
    if (!force && owed <= 0 && s.debt <= 0) { B.stats.skips++; bus.emit('pier:skip', { season: s.season }); return false; }
    remove();
    const { g, anim } = makeBaron(); B.g = g; B.anim = anim;
    const p = spawn(), len = Math.hypot(p.x, p.z) || 1, dx = p.x / len, dz = p.z / len;   // the pier points away from the island centre
    B.from = { x: p.x + dx * 2.6, z: p.z + dz * 2.6 }; B.to = { x: p.x - dx * PIER.standIn, z: p.z - dz * PIER.standIn };
    g.position.set(B.from.x, 0, B.from.z); (scene || game?.scene)?.add?.(g);
    anim.faceTo?.(new THREE.Vector3(B.to.x, 0, B.to.z)); anim.play?.('strut');
    B.active = true; B.phase = 'arrive'; B.t = 0; B.lastTick = -1; B.idle = 0; B.tauntT = 1.2; B.settled = false; B.season = s.season;
    B.interest = owed; B.canPay = (s.spark || 0) + 1e-9 >= owed; B.grace = PIER.graceMax; B.paid = 0; B.shortfall = 0; B.repaid = 0; B.stats.visits++;
    bus.emit('pier:due', { interest: owed, debt: s.debt, pos: { ...B.to }, season: s.season, waitCap: PIER.waitCap, spark: Math.round(s.spark || 0), canPay: (s.spark || 0) + 1e-9 >= owed });   // S71: canPay → the HUD hint 'pay it all = ★' / 'need N more'
    return true;
  };

  B.due = () => ({ interest: Math.round(eco.state.interestOwed || 0), minimum: Math.min(Math.round(eco.state.interestOwed || 0), Math.max(0, eco.state.spark)), debt: eco.state.debt });
  B.near = (r = PIER.near) => { if (!B.active || !B.g || B.phase === 'arrive' || B.phase === 'leave') return false; const h = heroPos(); return Math.hypot(h.x - B.g.position.x, h.z - B.g.position.z) <= r; };

  /** Pay the interest from the pouch (shortfall → debt). Idempotent. */
  function settleInterest(why = 'interact') {
    if (B.settled) return { paid: B.paid, shortfall: B.shortfall };
    B.settled = true;
    const owed = Math.round(eco.state.interestOwed || 0);
    const r = eco.settleInterest ? eco.settleInterest() : { paid: 0, shortfall: 0 };
    B.paid = r.paid; B.shortfall = r.shortfall;
    if (r.paid > 0 && vfx?.coinFly && B.g) { const h = heroPos(); vfx.coinFly(new THREE.Vector3(h.x, 0.8, h.z), new THREE.Vector3(B.g.position.x, 1.4, B.g.position.z), null, { count: Math.min(8, 2 + Math.ceil(r.paid / 6)) }); }
    if (r.shortfall > 0) { B.stats.short++; bus.emit('pier:short', { shortfall: r.shortfall, paid: r.paid, debt: eco.state.debt, why }); say(pick('short', B.season) + ` (+${r.shortfall} ✦ debt)`); vfx?.debtPulse?.(0.5); }
    else { B.stats.paid++; bus.emit('pier:paid', { interest: owed, repaid: 0, debt: eco.state.debt, why }); if (owed > 0) say(pick('paid', B.season)); else say('No interest due. Keep it that way… or don\u2019t.'); }
    B.anim?.play?.(r.shortfall > 0 ? 'taunt' : 'offerDeal');
    return r;
  }
  function done(why = 'release') {
    if (!B.active || B.phase === 'leave') return;
    if (!B.settled) settleInterest(why);
    B.phase = 'leave'; B.t = 0;
    B.anim?.faceTo?.(new THREE.Vector3(B.from.x, 0, B.from.z)); B.anim?.play?.('strut');
    eco.closePier?.(why);   // S70: what was paid / repaid at the pier counts for the season that just closed → final stars, BEFORE the ledger opens
    bus.emit('pier:done', { interest: B.interest, paid: B.paid, repaid: B.repaid, shortfall: B.shortfall, debt: eco.state.debt, why, season: B.season });
  }

  B.interact = () => {
    if (!B.active || !B.near()) return null;
    B.idle = 0;
    if (!B.settled) { const r = settleInterest('interact'); if (eco.state.debt <= 0) { done('debtfree'); return 'done'; } B.phase = 'repay'; return r.shortfall > 0 ? 'short' : 'paid'; }
    // repay taps (hold E): DEPOSIT_STEP per tap, capped by debt and pouch
    if (B.phase === 'repay' && eco.state.debt > 0 && eco.state.spark > 0) {
      const amt = eco.repay(Math.min(DEPOSIT_STEP, eco.state.debt, eco.state.spark));
      if (amt > 0) { B.repaid += amt; B.stats.repaid += amt; bus.emit('pier:repaid', { amount: amt, debt: eco.state.debt, total: B.repaid }); if (B.repaid === amt) say(pick('repaid', B.season), 2.6); vfx?.pop?.show?.(new THREE.Vector3(B.g.position.x, 2.0, B.g.position.z), `debt −${amt}`, { color: '#FFD54F', dur: 0.9 }); if (eco.state.debt <= 0) { say('Paid off?! …This is not over.'); done('debtfree'); return 'done'; } return 'repaid'; }
    }
    done('release'); return 'done';
  };
  B.release = () => { if (B.active && B.phase === 'repay' && B.settled) done('release'); };
  B.settle = (why = 'timeout') => { if (!B.active) return; if (why === 'timeout') B.stats.timeouts++; done(why); };
  B.done = () => done('done');

  B.update = (dt) => {
    if (!B.active || !(dt > 0)) return;
    B.t += dt; B.anim?.update?.(dt);
    const g = B.g;
    if (B.phase === 'arrive') {
      const k = Math.min(1, B.t / PIER.walkSec), e = 1 - (1 - k) * (1 - k);
      g.position.set(B.from.x + (B.to.x - B.from.x) * e, 0, B.from.z + (B.to.z - B.from.z) * e);
      if (k >= 1) { B.phase = 'wait'; B.t = 0; B.anim?.play?.('idle'); B.anim?.faceTo?.(new THREE.Vector3(0, 0, 0)); say(B.interest > 0 ? `Interest due: ${B.interest} ✦. Come here and pay, keeper.${eco.state.spark + 1e-9 >= B.interest && eco.state.season <= 3 ? ' (Pay it all = ★.)' : ''}` : `No interest… yet. Anything to repay while I am here?`, 4); }
    } else if (B.phase === 'wait' || B.phase === 'repay') {
      const h = heroPos(); if (Math.hypot(h.x - g.position.x, h.z - g.position.z) < 6) B.anim?.faceTo?.(new THREE.Vector3(h.x, 0, h.z));
      B.tauntT -= dt; if (B.tauntT <= 0 && B.phase === 'wait') { B.tauntT = PIER.tauntEvery; B.anim?.play?.('taunt'); }
      if (B.phase === 'wait') { const left = Math.max(0, PIER.waitCap - B.t), sec = Math.ceil(left); if (sec !== B.lastTick) { B.lastTick = sec; bus.emit('pier:tick', { left, cap: PIER.waitCap }); } }   // 42D P2: HUD countdown (≤ 1 Hz)
      if (B.phase === 'wait' && B.t >= PIER.waitCap) { B.settle('timeout'); return; }
      if (B.phase === 'repay') { B.idle += dt; if (B.idle >= PIER.repayIdle) done('idle'); }
    } else if (B.phase === 'leave') {
      const k = Math.min(1, B.t / PIER.leaveSec);
      g.position.set(B.to.x + (B.from.x - B.to.x) * k, 0, B.to.z + (B.from.z - B.to.z) * k);
      if (k >= 1) { B.active = false; B.phase = 'off'; remove(); }
    }
  };

  // the season closes → the Baron comes to collect (only in pierPays mode; win/lose go their own way)
  offs.push(bus.on('eco:season', () => { if (eco.pierPays && !eco.state.ended) B.begin(); }));
  // S72: a short player who gets Spark into the pouch while he waits (till walk-over, tip coin, jar withdraw) sees the chip update live
  // ('need N more' -> 'pay it all = star'), and each gain buys a few extra seconds (graceMax in total) so the fix is not a race against the countdown.
  offs.push(bus.on('eco:spark', (p) => {
    if (!B.active || B.settled || B.phase !== 'wait' || !(B.interest > 0)) return;
    const spark = Math.round(eco.state.spark || 0), can = eco.state.spark + 1e-9 >= B.interest;
    if (!B.canPay && p?.delta > 0 && B.grace > 0) { const add = Math.min(PIER.graceStep, B.grace); B.grace -= add; B.t = Math.max(0, B.t - add); bus.emit('pier:grace', { added: add, left: B.grace }); }
    B.canPay = can;
    bus.emit('pier:pouch', { spark, interest: B.interest, canPay: can, need: Math.max(0, Math.ceil(B.interest - eco.state.spark - 1e-9)) });
  }));
  offs.push(bus.on('eco:win', () => B.destroyVisit())); offs.push(bus.on('eco:lose', () => B.destroyVisit()));
  B.destroyVisit = () => { B.active = false; B.phase = 'off'; remove(); };
  B.destroy = () => { for (const f of offs) f?.(); offs.length = 0; B.destroyVisit(); };
  return B;
}
export default createBaronPier;
