// S72: pier short-pay grace (src/systems/baronPier.js) + HUD pier chip / 'Nobody sells X' want chip text (ui/hud.js). No browser: tiny DOM shim + stub economy.
import test from 'node:test'; import assert from 'node:assert/strict';
import { installDomShim } from '../tools/domshim.mjs';
installDomShim();
const { EventBus } = await import('../src/core/EventBus.js');
const { createBaronPier, PIER } = await import('../src/systems/baronPier.js');
const { mountHUD } = await import('../ui/hud.js');

// stub economy: spark moves via gain(); every change emits eco:spark like the real one
const mkEco = (bus, { spark = 3, owed = 15, debt = 100 } = {}) => {
  const eco = { pierPays: true, state: { spark, interestOwed: owed, debt, season: 1, ended: false },
    gain(n) { eco.state.spark += n; bus.emit('eco:spark', { spark: eco.state.spark, delta: n, reason: 'test' }); },
    settleInterest() { const o = eco.state.interestOwed, paid = Math.min(o, eco.state.spark), sf = o - paid; eco.state.spark -= paid; eco.state.debt += sf; eco.state.interestOwed = 0; return { paid, shortfall: sf }; },
    repay(a) { eco.state.spark -= a; eco.state.debt -= a; return a; }, closePier() {} };
  return eco;
};
const mkPier = (o) => { const bus = new EventBus(), eco = mkEco(bus, o); const ev = { due: [], pouch: [], grace: [], done: [] };
  bus.on('pier:due', (p) => ev.due.push(p)); bus.on('pier:pouch', (p) => ev.pouch.push(p)); bus.on('pier:grace', (p) => ev.grace.push(p)); bus.on('pier:done', (p) => ev.done.push(p));
  const B = createBaronPier({ bus, eco, world: { pierSpawn: { x: 0, z: -10 } }, hero: { root: { position: { x: 0, z: -9 } } } });
  return { bus, eco, B, ev }; };
const arrive = (B) => { B.begin(); B.update(PIER.walkSec + 0.1); };

test('pier:due says canPay=false and carries the pouch when short', () => { const { B, ev } = mkPier({ spark: 3, owed: 15 }); B.begin(); assert.equal(ev.due[0].canPay, false); assert.equal(ev.due[0].spark, 3); assert.equal(ev.due[0].interest, 15); });
test('pier:due canPay=true when the pouch covers it', () => { const { B, ev } = mkPier({ spark: 20, owed: 15 }); B.begin(); assert.equal(ev.due[0].canPay, true); });
test('short player collects a till while he waits: pier:pouch flips to canPay, need counts down', () => {
  const { eco, B, ev } = mkPier({ spark: 3, owed: 15 }); arrive(B); assert.equal(B.phase, 'wait');
  eco.gain(5); assert.equal(ev.pouch.at(-1).canPay, false); assert.equal(ev.pouch.at(-1).need, 7);
  eco.gain(7); assert.equal(ev.pouch.at(-1).canPay, true); assert.equal(ev.pouch.at(-1).need, 0);
  assert.equal(B.interact(), 'paid', 'pay it all after the top-up'); assert.equal(eco.state.debt, 100, 'no shortfall added');
});
test('each gain while short buys grace seconds, capped at graceMax in total', () => {
  const { eco, B, ev } = mkPier({ spark: 0, owed: 400 }); arrive(B); B.t = 15;   // 5 s left on the 20 s clock
  eco.gain(1); assert.equal(B.t, 11); eco.gain(1); assert.equal(B.t, 7); eco.gain(1); assert.equal(B.t, 3); eco.gain(1); assert.equal(B.t, 3, 'cap reached: no more time');
  assert.equal(ev.grace.reduce((a, g) => a + g.added, 0), PIER.graceMax); assert.equal(B.t, 3);
});
test('no grace once he is paid-up capable, spend is not a gain, and grace never drives t below 0', () => {
  const { eco, B, ev } = mkPier({ spark: 20, owed: 15 }); arrive(B); B.t = 2; eco.gain(3); assert.equal(B.t, 2, 'already able to pay: no extension'); assert.equal(ev.grace.length, 0);
  const s = mkPier({ spark: 0, owed: 400 }); arrive(s.B); s.B.t = 1; s.eco.gain(1); assert.equal(s.B.t, 0);
  const d = mkPier({ spark: 5, owed: 400 }); arrive(d.B); d.B.t = 10; d.eco.gain(-2); assert.equal(d.B.t, 10, 'a loss gives no time');
});
test('after he is paid (repay phase) pouch events are ignored', () => { const { eco, B, ev } = mkPier({ spark: 15, owed: 15 }); arrive(B); B.interact(); const n = ev.pouch.length; eco.gain(5); assert.equal(ev.pouch.length, n); });
test('timeout still settles short with the shortfall on the debt', () => { const { eco, B, ev } = mkPier({ spark: 3, owed: 15 }); arrive(B); B.update(PIER.waitCap + 1); assert.equal(ev.done.length, 1); assert.equal(eco.state.debt, 112); });

// ---- HUD ----
const mkHud = () => { const bus = new EventBus(); const root = document.createElement('div'); document.body.append(root); const hud = mountHUD(root, { bus, seasonsToWin: 10, selfDrive: false }); const chip = () => root.querySelectorAll('.ll-pier-chip')[0]; return { bus, root, hud, chip }; };
test('HUD pier chip: short = salmon + need N more; flips to pay-it-all on pier:pouch', () => {
  const { bus, chip, hud } = mkHud(); bus.emit('pier:due', { interest: 15, spark: 3, canPay: false, waitCap: 20 });
  assert.ok(chip().classList.contains('short')); assert.match(chip().textContent, /15/); assert.match(chip().textContent, /need 12 more/); assert.match(chip().textContent, /counters/);
  bus.emit('pier:pouch', { canPay: false, need: 4, spark: 11, interest: 15 }); assert.match(chip().textContent, /need 4 more/);
  bus.emit('pier:pouch', { canPay: true, need: 0, spark: 15, interest: 15 }); assert.ok(!chip().classList.contains('short')); assert.match(chip().textContent, /pay it all/); assert.doesNotMatch(chip().textContent, /need/);
  bus.emit('pier:done', {}); assert.equal(chip().hidden, true); hud.destroy();
});
test('HUD pier chip: affordable shows pay-it-all + countdown; nothing owed says repay', () => {
  const { bus, chip, hud } = mkHud(); bus.emit('pier:due', { interest: 15, spark: 40, canPay: true, waitCap: 20 }); assert.match(chip().textContent, /pay it all/); assert.match(chip().textContent, /20 s/);
  bus.emit('pier:tick', { left: 7.2 }); assert.match(chip().textContent, /8 s/);
  bus.emit('pier:skip', {}); bus.emit('pier:due', { interest: 0, spark: 0, canPay: true, waitCap: 20 }); assert.match(chip().textContent, /repay/); hud.destroy();
});
test('HUD want chip: "Nobody sells X! Build one." with a drawn icon, ttl removes it, glyph-free', () => {
  const { bus, root, hud } = mkHud(); const box = root.querySelectorAll('.ll-chips')[0];
  bus.emit('hud:chip', { id: 'want:tea', want: 'tea', text: 'Nobody sells tea! Build one.', on: true, ttl: 0.05 });
  const c = box.children.find((n) => n.dataset?.id === 'want:tea'); assert.ok(c, 'chip exists'); assert.match(c.textContent, /Nobody sells tea! Build one\./); assert.ok(c.classList.contains('ll-chip-want')); assert.match(c.innerHTML, /ll-ico-/);
  return new Promise((res) => setTimeout(() => { assert.equal(box.children.find((n) => n.dataset?.id === 'want:tea') || null, null, 'self-removed'); hud.destroy(); res(); }, 120));
});
