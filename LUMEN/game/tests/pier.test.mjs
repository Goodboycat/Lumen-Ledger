// S72: pier short-pay grace (src/systems/baronPier.js) + HUD pier chip / 'Nobody sells X' want chip text (ui/hud.js). No browser: tiny DOM shim + stub economy.
import test from 'node:test'; import assert from 'node:assert/strict';
import { installDomShim } from '../tools/domshim.mjs';
installDomShim();
const { EventBus } = await import('../src/core/EventBus.js');
const { createBaronPier, PIER } = await import('../src/systems/baronPier.js');
const { mountHUD } = await import('../ui/hud.js');

// stub economy: spark moves via gain(); every change emits eco:spark like the real one
const mkEco = (bus, { spark = 3, owed = 15, debt = 100, jar = 0 } = {}) => {
  const eco = { pierPays: true, state: { spark, interestOwed: owed, debt, season: 1, ended: false, jars: { spend: 0, save: jar, invest: 50, protect: 0 } },
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
test('pier:due / pier:pouch carry the withdrawable jar cash (Invest is locked, never counted)', () => { const { eco, B, ev } = mkPier({ spark: 3, owed: 15, jar: 40 }); B.begin(); assert.equal(ev.due[0].jar, 40); B.update(PIER.walkSec + 0.1); eco.gain(1); assert.equal(ev.pouch.at(-1).jar, 40); });
test('pier:due canPay=true when the pouch covers it', () => { const { B, ev } = mkPier({ spark: 20, owed: 15 }); B.begin(); assert.equal(ev.due[0].canPay, true); });
test('short player takes Spark out of a jar while he waits: pier:pouch flips to canPay, need counts down', () => {
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
test('grace is charged only for time really given back (early gain at t~0 keeps the budget)', () => { const { eco, B } = mkPier({ spark: 0, owed: 400 }); arrive(B); B.t = 0.5; eco.gain(1); assert.equal(B.t, 0); assert.equal(B.grace, PIER.graceMax - 0.5); });
test('after he is paid (repay phase) pouch events are ignored', () => { const { eco, B, ev } = mkPier({ spark: 15, owed: 15 }); arrive(B); B.interact(); const n = ev.pouch.length; eco.gain(5); assert.equal(ev.pouch.length, n); });
test('S85: wait ran out -> the Baron SEEKS Pip (nothing is taken from afar), contact settles short with the shortfall on the debt', () => {
  const { eco, B, ev, bus } = mkPier({ spark: 3, owed: 15 }); const seek = []; bus.on('pier:seek', (p) => seek.push(p)); arrive(B);
  B.update(PIER.waitCap + 0.1); assert.equal(B.phase, 'seek'); assert.equal(seek.length, 1); assert.equal(eco.state.spark, 3, 'pouch untouched while he walks'); assert.equal(ev.done.length, 0);
  for (let i = 0; i < 400 && B.phase === 'seek'; i++) B.update(0.05); assert.equal(B.phase, 'leave', 'contact settles'); assert.equal(ev.done.length, 1); assert.equal(ev.done[0].why, 'timeout'); assert.equal(eco.state.debt, 112);
});
test('S85: a far-away hero is still reached (seek walks across the island) and a tap on him in seek phase pays normally', () => {
  const hero = { root: { position: { x: 30, z: 20 } } }; const bus = new EventBus(), eco = mkEco(bus, { spark: 40, owed: 15 });
  const B = createBaronPier({ bus, eco, world: { pierSpawn: { x: 0, z: -10 } }, hero }); arrive(B); B.update(PIER.waitCap + 0.1); assert.equal(B.phase, 'seek');
  for (let i = 0; i < 40; i++) B.update(0.1); assert.equal(B.phase, 'seek', 'still walking after 4 s'); assert.ok(eco.state.spark === 40);
  hero.root.position.x = B.g.position.x + 1; hero.root.position.z = B.g.position.z; assert.equal(B.interact(), 'paid'); assert.equal(eco.state.spark, 25);
});

// ---- HUD ----
const mkHud = () => { const bus = new EventBus(); const root = document.createElement('div'); document.body.append(root); const hud = mountHUD(root, { bus, seasonsToWin: 10, selfDrive: false }); const chip = () => root.querySelectorAll('.ll-pier-chip')[0]; return { bus, root, hud, chip }; };
test('HUD pier chip: short = salmon + need N more; flips to pay-it-all on pier:pouch', () => {
  const { bus, chip, hud } = mkHud(); bus.emit('pier:due', { interest: 15, spark: 3, canPay: false, waitCap: 20 });
  assert.ok(chip().classList.contains('short')); assert.match(chip().textContent, /15/); assert.match(chip().textContent, /need 12 more/); assert.doesNotMatch(chip().textContent, /jar/, 'empty jars: no jar advice');
  bus.emit('pier:pouch', { canPay: false, jar: 30, need: 4, spark: 11, interest: 15 }); assert.match(chip().textContent, /need 4 more/); assert.match(chip().textContent, /jar .{1,3}helps/);
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
test('HUD want chips: at most 2 at once (a passive S3 player met 4); other chips untouched', () => {
  const { bus, root, hud } = mkHud(); const box = root.querySelectorAll('.ll-chips')[0];
  bus.emit('hud:chip', { id: 'storm', text: 'STORM COMING', on: true });
  for (const w of ['cloth', 'toy', 'pottery', 'lantern']) bus.emit('hud:chip', { id: 'want:' + w, want: w, text: `Nobody sells ${w}! Build one.`, on: true, ttl: 5 });
  const ids = box.children.map((n) => n.dataset?.id); assert.deepEqual(ids.filter((x) => x.startsWith('want:')), ['want:pottery', 'want:lantern'], 'oldest want chips dropped'); assert.ok(ids.includes('storm'), 'storm chip kept');
  bus.emit('hud:chip', { id: 'want:lantern', want: 'lantern', text: 'again', on: true, ttl: 5 }); assert.equal(box.children.filter((n) => n.dataset?.id === 'want:lantern').length, 1, 'same id reuses its chip');
  hud.destroy();
});

// S76: debt cleared AT the pier in the final season = the win (eco:win fires before pier:done; the old code only checked isWin() at season end, before the Baron was paid)
test('S76 debt paid to zero at the pier after the last season -> eco.tryWin() wins once (cinematic + ending dialogue follow)', async () => {
  const { makeEconomy } = await import('../src/systems/economyData.js');
  const bus = new EventBus(); const wins = [];
  bus.on('eco:win', (p) => wins.push(p));
  const eco = makeEconomy({ bus, seed: 1, autoSeason: false, pierPays: true });
  eco.state.season = 11; eco.state.debt = 0; eco.state.fog01 = 0.3; eco.state.ended = false;
  assert.equal(eco.isWin(), true, 'debt 0 + past season 10 + fog < 1 = win');
  assert.equal(eco.tryWin(), true); assert.equal(eco.state.ended, 'win'); assert.equal(wins.length, 1);
  assert.equal(eco.tryWin(), false, 'only once');
  const e2 = makeEconomy({ bus, seed: 1, autoSeason: false, pierPays: true }); e2.state.season = 11; e2.state.debt = 5;
  assert.equal(e2.tryWin(), false, 'still owing 5 = no win');
  const e3 = makeEconomy({ bus, seed: 1, autoSeason: false, pierPays: true }); e3.state.season = 5; e3.state.debt = 0;
  assert.equal(e3.tryWin(), false, 'a debt-free S5 is not the ending');
});

test('S87: chip turns green on pier:paid even if it was red (short) when he arrived; pier:short stays red', () => {
  const { bus, chip } = mkHud(); bus.emit('pier:due', { interest: 15, spark: 3, canPay: false, waitCap: 20 });
  assert.ok(chip().classList.contains('short'));
  bus.emit('pier:paid', { interest: 15 }); assert.ok(!chip().classList.contains('short'), 'no red once paid'); assert.ok(chip().classList.contains('repay'));
  bus.emit('pier:done', {});
  bus.emit('pier:due', { interest: 15, spark: 20, canPay: true, waitCap: 20 }); bus.emit('pier:short', { shortfall: 5 });
  assert.ok(chip().classList.contains('short') && !chip().classList.contains('repay'), 'short = red only');
});
test('S87: a tip / jar withdraw while he is still WALKING IN flips the chip (pouch event no longer ignored in the arrive phase)', () => {
  const { eco, B, ev } = mkPier({ spark: 3, owed: 15 }); B.begin(); assert.equal(B.phase, 'arrive'); eco.gain(20);
  assert.equal(ev.pouch.at(-1).canPay, true); assert.equal(B.t, 0); assert.equal(B.grace, PIER.graceMax, 'no grace spent while walking in');
});
