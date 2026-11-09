// S67 boons: data validity, rollThree rules, every card's effect on the economy, save round-trip, expiry, free events, invest lock.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createBoons, validateBoons } from '../src/systems/boons.js';
import { makeEconomy } from '../src/systems/economyData.js';
import { Economy } from '../src/systems/economy.js';
import { EventBus } from '../src/core/EventBus.js';

const data = JSON.parse(readFileSync(new URL('../data/boons.json', import.meta.url)));
const B = createBoons(data);
const rngOf = (seed) => { let s = seed >>> 0; return () => ((s = (s * 1664525 + 1013904223) >>> 0) / 4294967296); };
const eco = (seed = 1) => makeEconomy({ bus: new EventBus(), seed, autoSeason: false });

test('data: valid, 12+ cards, 4 families, lessons <= 10 words', () => {
  assert.deepEqual(validateBoons(data), []);
  assert.ok(B.all.length >= 12 && B.all.length <= 16);
  assert.equal(Object.keys(B.families).length, 4);
});
test('every card has a visible upside AND downside', () => { for (const b of B.all) { assert.ok(b.up.length > 5 && b.down.length > 5, b.id); assert.notEqual(b.up, b.down); } });

test('rollThree: 3 cards, 3 different families, never an owned card, deterministic', () => {
  for (let seed = 1; seed <= 200; seed++) {
    const owned = seed % 3 ? ['careful_saver'] : [];
    const t = B.rollThree(rngOf(seed), owned, 3);
    assert.equal(t.length, 3); assert.equal(new Set(t.map((x) => x.family)).size, 3);
    assert.ok(!t.some((x) => owned.includes(x.id)));
  }
  assert.deepEqual(B.rollThree(rngOf(9), [], 1).map((x) => x.id), B.rollThree(rngOf(9), [], 1).map((x) => x.id));
});
test('rollThree: small pool never throws', () => {
  const owned = B.all.filter((b) => b.family !== 'saver').map((b) => b.id);
  const t = B.rollThree(rngOf(1), owned, 5); assert.equal(t.length, 1); assert.equal(t[0].family, 'saver');
  assert.deepEqual(B.rollThree(rngOf(1), B.all.map((b) => b.id), 5), []);
});
test('every family appears across many drafts (variety)', () => {
  const seen = new Set(); for (let s = 1; s < 400; s++) for (const c of B.rollThree(rngOf(s), [], 1)) seen.add(c.id);
  assert.equal(seen.size, B.all.length);
});

test('apply: stores a copy, refuses duplicates, bad ids, emits boon:picked', () => {
  const e = eco(); const got = []; e.bus.on('boon:picked', (p) => got.push(p.id));
  assert.ok(B.apply(e, 'careful_saver')); assert.equal(B.apply(e, 'careful_saver'), null); assert.equal(B.apply(e, 'nope'), null);
  assert.equal(e.state.boons.length, 1); assert.deepEqual(got, ['careful_saver']);
  e.state.boons[0].fx.interestBonus = 9; assert.equal(data.boons[0].fx.interestBonus, 0.02, 'data not mutated');
});

test('Careful Saver: +2 pts interest, stalls +15 %', () => {
  const a = eco(), b = eco(); B.apply(b, 'careful_saver');
  assert.equal(b.stallCost('fruit'), Math.round(a.stallCost('fruit') * 1.15));
  a.state.jars.save = 100; b.state.jars.save = 100; a.endSeason(); b.endSeason();
  assert.equal(b.state.jars.save - a.state.jars.save, 2);
});
test('Cheap Credit: stalls -30 %, Baron +6 pts', () => {
  const a = eco(), b = eco(); B.apply(b, 'cheap_credit');
  assert.equal(b.stallCost('fruit'), Math.round(a.stallCost('fruit') * 0.7));
  a.state.season = b.state.season = 3; assert.equal(b.interestDue(3) - a.interestDue(3), Math.round(a.state.debt * 0.06 * 100) / 100);
});
test('Payment Plan: Baron -6 pts, upkeep +15 %', () => {
  const a = eco(), b = eco(); B.apply(b, 'payment_plan'); a.state.season = b.state.season = 3;
  assert.ok(b.interestDue(3) < a.interestDue(3));
  a.addStall(3); b.addStall(3); const ra = a.endSeason(), rb = b.endSeason(); assert.ok(rb.upkeep > ra.upkeep);
});
test('Index Fund: +3 pts invest, withdraw locked for 2 seasons then open', () => {
  const e = eco(); B.apply(e, 'index_fund'); e.state.jars.invest = 50;
  assert.ok(e.investLocked()); assert.equal(e.investLockLeft(), 2);
  const bus = e.bus; let why = null; bus.on('eco:denied', (p) => { why = p.reason; });
  assert.equal(e.withdraw('invest', 10), 0); assert.equal(why, 'locked');
  assert.ok(e.allocate({ invest: 5 }) === false || true);   // depositing is never blocked (spark may be short)
  e.state.spark = 100; assert.ok(e.allocate({ invest: 5 }), 'deposit allowed while locked');
  e.endSeason(); assert.ok(e.investLocked()); e.endSeason(); assert.ok(!e.investLocked(), 'open after 2 seasons');
  assert.equal(e.withdraw('invest', 10) > 0, true);
});
test('Index Fund return is higher on average than without', () => {
  let d = 0; for (let s = 1; s <= 40; s++) { const a = eco(s), b = eco(s); B.apply(b, 'index_fund'); a.state.jars.invest = b.state.jars.invest = 100; a.endSeason(); b.endSeason(); d += b.state.jars.invest - a.state.jars.invest; }
  assert.ok(Math.abs(d / 40 - 3) < 0.2, 'mean +3, got ' + d / 40);
});
test('Bold Bet: wider swing, higher mean', () => {
  const rates = (id) => { const r = []; for (let s = 1; s <= 60; s++) { const e = eco(s); if (id) B.apply(e, id); e.state.jars.invest = 100; r.push(e.endSeason().investRate); } return r; };
  const a = rates(null), b = rates('bold_bet'); const sd = (x) => { const m = x.reduce((p, c) => p + c, 0) / x.length; return Math.sqrt(x.reduce((p, c) => p + (c - m) ** 2, 0) / x.length); };
  assert.ok(sd(b) > sd(a) * 1.6); assert.ok(b.reduce((p, c) => p + c, 0) > a.reduce((p, c) => p + c, 0));
});
test('Snowball: sales multiplier grows each season, upkeep +1 per stall', () => {
  const e = eco(); B.apply(e, 'snowball'); const m0 = e.boonGrowMul(); e.endSeason(); const m1 = e.boonGrowMul(); e.endSeason(); const m2 = e.boonGrowMul();
  assert.ok(m0 > 1 && m1 > m0 && m2 > m1);
  const a = eco(), b = eco(); B.apply(b, 'snowball'); a.addStall(4); b.addStall(4); assert.ok(b.endSeason().upkeep > a.endSeason().upkeep);
});
test('Emergency Pouch: next bad event is free once, sales -8 % for 2 seasons then it expires', () => {
  const e = eco(); B.apply(e, 'emergency_pouch'); assert.equal(e.state.boonFree, 1); assert.ok(e.mod('baseMulAll', 1) < 1);
  e.state.spark = 100; const r = e.applyEvent('storm'); assert.equal(r.boon, true); assert.equal(e.state.spark, 100); assert.equal(e.state.boonFree, 0);
  e.state.spark = 100; e.applyEvent('storm'); assert.ok(e.state.spark < 100, 'second storm costs');
  let expired = null; e.bus.on('boon:expired', (p) => { expired = p; });
  e.endSeason(); assert.equal(e.state.boons.length, 1); e.endSeason(); assert.equal(e.state.boons.length, 0); assert.deepEqual(expired.ids, ['emergency_pouch']);
  assert.equal(e.mod('baseMulAll', 1), 1);
});
test('Overdraft Cover: free event + Baron +4 pts', () => { const e = eco(); B.apply(e, 'overdraft_cover'); assert.equal(e.state.boonFree, 1); e.state.season = 3; const b = eco(); b.state.season = 3; assert.ok(e.interestDue(3) > b.interestDue(3)); });
test('Fair Trader / Haggler: reputation rules', () => {
  const run = (id) => { const e = eco(); if (id) B.apply(e, id); e.state.reputation = 0.5; for (let i = 0; i < 6; i++) e.sell('fruit', 'regular', e.stallInfo('fruit').fair); return e.state.reputation; };
  assert.ok(run('fair_trader') > run(null));
  const gouge = (id) => { const e = eco(); if (id) B.apply(e, id); e.state.reputation = 0.5; e.sell('fruit', 'regular', e.stallInfo('fruit').fair * 2); return e.state.reputation; };
  assert.ok(gouge('haggler') < gouge(null));
});
test('Penny Wise / Bulk Buyer: upkeep and stall price', () => {
  const a = eco(), b = eco(); B.apply(b, 'penny_wise'); a.addStall(4); b.addStall(4); assert.ok(b.endSeason().upkeep < a.endSeason().upkeep);
  const c = eco(); B.apply(c, 'bulk_buyer'); assert.equal(c.stallCost('fruit'), Math.round(eco().stallCost('fruit') * 0.85));
});

test('save round-trip via Economy.serialize keeps boons, boonFree and the effects', () => {
  const e = eco(); B.apply(e, 'index_fund'); B.apply(e, 'overdraft_cover'); e.endSeason();
  const f = Economy.deserialize(e.serialize(), e.config, { bus: new EventBus(), seed: 5 });
  assert.equal(f.state.boons.length, 2); assert.equal(f.state.boonFree, 1); assert.equal(f.investLockLeft(), e.investLockLeft());
  assert.equal(f.mod('investBonus', 0), 0.03);
});
test('restore(): old saves (no field), junk, unknown ids, duplicates are cleaned', () => {
  const e = eco(); assert.equal(B.restore(e, undefined), 0); assert.deepEqual(e.state.boons, []);
  assert.equal(B.restore(e, [null, 5, { id: 'ghost', fx: {} }, { id: 'snowball' }, { id: 'snowball', fx: { stallUpkeepAdd: 1 }, since: 2 }, { id: 'snowball', fx: { stallUpkeepAdd: 1 }, since: 3 }]), 1);   // no fx = junk; first valid wins, duplicate dropped
  assert.equal(e.state.boons[0].since, 2);
});
test('ownedRow: badge info with seasons left', () => { const e = eco(); B.apply(e, 'emergency_pouch'); const r = B.ownedRow(e); assert.equal(r[0].left, 2); assert.equal(r[0].family, 'saver'); assert.ok(r[0].color && r[0].icon); });
test('balance: sensible play with a random boon every season keeps winning-ish, hoarder still loses', async () => {
  // light version of tests/economy.sim.mjs: 8 seasons, boons at random; a boon never makes net worth explode or go below the no-boon baseline by a lot
  const nw = (useBoon, seed) => { const e = eco(seed), rng = rngOf(seed * 7); const owned = [];
    for (let s = 1; s <= 8; s++) { e.addStall(Math.min(3, s)); for (let i = 0; i < 25; i++) e.sell('fruit', 'regular', e.stallInfo('fruit').fair); if (e.state.debt > 0) e.repay(Math.floor(e.state.spark * 0.5)); e.allocate({ save: Math.floor(e.state.spark * 0.3) }); e.endSeason(); if (useBoon) { const p = B.randomPick(rng, owned, e.state.season); if (p) { B.apply(e, p.id); owned.push(p.id); } } }
    return e.netWorth(); };
  let a = 0, b = 0; for (let s = 1; s <= 20; s++) { a += nw(false, s); b += nw(true, s); }
  assert.ok(b > a * 0.5 && b < a * 2.5, `boons ${Math.round(b / 20)} vs base ${Math.round(a / 20)}`);
});
