// 41D — unit tests for src/systems/unlocks.js. Run: node --test tests/unlocks.test.mjs  (or node tools/check.mjs --unlocks)
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/EventBus.js';
import { installUnlocks, ABILITY_START, ABILITY_UNLOCKS } from '../src/systems/unlocks.js';
import { parseSnapshot, describe as describeSnap } from '../src/systems/save.js';

function fakeSb() {
  const calls = [];
  const sb = { cooldown: {}, eco: { state: {} }, ability: (name) => { calls.push(name); return { name }; } };
  return { sb, calls };
}

test('fresh sandbox: 2 starters, locked ability does nothing', () => {
  const bus = new EventBus(); const { sb, calls } = fakeSb(); const locked = [];
  bus.on('ability:locked', (e) => locked.push(e.name));
  const u = installUnlocks(sb, bus);
  assert.equal(sb.abilities.size, 2);
  assert.deepEqual([...sb.abilities].sort(), [...ABILITY_START].sort());
  assert.equal(sb.ability('growthStomp'), 'locked');
  assert.equal(calls.length, 0, 'inner ability must not be called');
  assert.equal(sb.cooldown.growthStomp, undefined, 'no cooldown burnt');
  assert.deepEqual(locked, ['growthStomp']);
  assert.ok(sb.ability('coinMagnetDash'), 'starter passes through');
  assert.equal(calls[0], 'coinMagnetDash');
  assert.equal(u.starsTotal, 0);
});

test('stars 3,3,3,3 unlock in order; a 2-star season unlocks nothing', () => {
  const bus = new EventBus(); const { sb } = fakeSb(); const ev = [];
  bus.on('ability:unlock', (e) => ev.push(e));
  installUnlocks(sb, bus);
  bus.emit('eco:season', { season: 1, stars: 2 });
  assert.equal(ev.length, 0); assert.equal(sb.abilities.size, 2);
  for (let i = 0; i < 4; i++) bus.emit('eco:season', { season: 2 + i, stars: 3 });
  assert.equal(sb.unlocks.starsTotal, 14);
  assert.deepEqual(ev.map((e) => e.id), ABILITY_UNLOCKS.map((r) => r.id));
  assert.deepEqual(ev.map((e) => e.stars), [3, 6, 9, 12]);
  assert.ok(ev[0].title && ev[0].lesson && ev[0].key === 'E', 'event carries FINLIT title/lesson/key');
  assert.equal(sb.abilities.size, 6);
  assert.equal(sb.eco.state.starsTotal, 14);
});

test('max one unlock per season even with a big star jump', () => {
  const bus = new EventBus(); const { sb } = fakeSb(); const ev = [];
  bus.on('ability:unlock', (e) => ev.push(e.id));
  installUnlocks(sb, bus);
  bus.emit('eco:season', { season: 1, stars: 9 });
  assert.deepEqual(ev, ['growthStomp']);
  bus.emit('eco:season', { season: 2, stars: 0 });
  assert.deepEqual(ev, ['growthStomp', 'ledgerFlash'], 'next season catches up one more');
});

test('save v2 round-trip keeps the set; v1 migrates to starters', () => {
  const bus = new EventBus(); const { sb } = fakeSb();
  installUnlocks(sb, bus);
  bus.emit('eco:season', { season: 1, stars: 3 });
  const ser = sb.unlocks.serialize();
  assert.deepEqual(ser, { abilities: ['coinMagnetDash', 'bubbleShield', 'growthStomp'], starsTotal: 3 });
  const eco = { state: { season: 2, spark: 10, jars: {} } };
  const v2 = parseSnapshot({ v: 2, eco, ...ser });
  assert.ok(v2); assert.equal(v2.abilities.length, 3);
  assert.match(describeSnap(v2), /3\/6 abilities/);
  const { sb: sb2 } = fakeSb(); installUnlocks(sb2, bus);
  sb2.unlocks.restore(v2);
  assert.equal(sb2.abilities.size, 3); assert.equal(sb2.unlocks.starsTotal, 3);
  const v1 = parseSnapshot({ v: 1, eco });
  assert.ok(v1); assert.deepEqual(v1.abilities, ABILITY_START); assert.equal(v1.starsTotal, 0);
  sb2.unlocks.restore(v1); assert.equal(sb2.abilities.size, 2);
  assert.equal(parseSnapshot({ v: 2, eco, abilities: 'nope' }), null, 'bad abilities field rejected');
});

test('eco:win opens all six (endless playground); destroy restores sb.ability', () => {
  const bus = new EventBus(); const { sb } = fakeSb(); const inner = sb.ability;
  const u = installUnlocks(sb, bus);
  bus.emit('eco:win', {}); assert.equal(sb.abilities.size, 6);
  u.destroy(); assert.equal(sb.ability, inner);
});
