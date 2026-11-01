// LUMEN 17A — Regions.js unit tests. Run from game/:  node --test tests/regions.test.mjs     (no browser, no Three)
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { createRegions, hasFlag, emptyFlags, hintFor } from '../src/world/regions/index.js';
import { EventBus } from '../src/core/EventBus.js';

const data = JSON.parse(readFileSync(new URL('../data/regions.json', import.meta.url), 'utf8'));
const island = { isLand: (x, z) => x * x + z * z < 121 };
const mk = (flags = emptyFlags()) => { const bus = new EventBus(); const ev = {}; for (const n of ['region:enter', 'region:gate', 'region:load', 'region:unload', 'region:return']) bus.on(n, (p) => (ev[n] ??= []).push(p)); return { R: createRegions({ island, bus, flags: () => flags, data }), bus, ev, flags }; };

test('hasFlag truth table', () => {
  const f = emptyFlags();
  assert.equal(hasFlag(f, null), true);
  assert.equal(hasFlag(f, { power: 'sparkTether' }), false);
  f.powers.add('sparkTether'); assert.equal(hasFlag(f, { power: 'sparkTether' }), true);
  assert.equal(hasFlag(f, { mission: 'T2-1' }), false); f.missions.add('T2-1'); assert.equal(hasFlag(f, { mission: 'T2-1' }), true);
  f.keys = 3; assert.equal(hasFlag(f, { keys: 4 }), false); f.keys = 4; assert.equal(hasFlag(f, { keys: 4, power: 'heatStomp' }), false);
  f.rep = 2; assert.equal(hasFlag(f, { power: 'sparkTether', rep: 2 }), true);
});

test('at() hub / rootwood / null', () => {
  const { R } = mk();
  assert.equal(R.list.length, 7);
  assert.equal(R.at(0, 1), 'hub'); assert.equal(R.at(-34, 0), 'rootwood'); assert.equal(R.at(100, 100), null);
  assert.equal(R.at(10.5, 0), 'hub', 'inside island polygon counts as hub');
});

test('6 gates, all locked with empty flags; tryEnter after flags → open + region:gate', () => {
  const { R, ev, flags } = mk();
  assert.equal(R.gates.length, 6);
  assert.ok(R.gates.every((g) => !R.canOpen(g)));
  R.register('crags', { group: { visible: true, userData: {} }, isLand: (x, z) => Math.hypot(x - 34, z) < 12 });
  assert.equal(R.tryEnter('hub>crags'), 'locked'); assert.equal(ev['region:gate'].at(-1).state, 'locked');
  flags.powers.add('sparkTether');
  assert.equal(R.tryEnter('hub>crags'), 'open'); assert.equal(ev['region:gate'].at(-1).state, 'open'); assert.equal(R.gate('hub>crags').open, true);
  assert.equal(R.tryEnter('hub>rootwood'), 'noregion', 'unregistered → sealed');
  assert.equal(hintFor({ keys: 4, power: 'heatStomp' }), 'Needs Heat Stomp · Needs 4 Ledger Keys');
});

test('update: debounce, load/unload, return path, nearestPier', () => {
  const { R, ev } = mk();
  const hub = { visible: true, userData: { animators: [{ paused: false }] } }, rw = { visible: true, userData: { animators: [{ paused: false }] } };
  R.register('hub', { group: hub, anchors: { pier: { x: 0, y: 0, z: 9 } } });
  const pos = { x: 0, y: 0, z: 1 };
  R.update(1 / 60, pos); R.update(1 / 60, pos);
  assert.equal(R.current, 'hub'); assert.equal(ev['region:enter'].length, 1);
  pos.x = -34; R.update(1 / 60, pos); assert.equal(R.current, 'hub', 'one frame is not enough'); R.update(1 / 60, pos);
  assert.equal(R.current, 'rootwood'); assert.equal(hub.visible, false); assert.equal(hub.userData.animators[0].paused, true);
  assert.deepEqual(ev['region:unload'].map((e) => e.id), ['hub']);
  assert.equal(R.isLand(-34, 0), false);
  R.register('rootwood', { group: rw, isLand: (x, z) => Math.hypot(x + 34, z) < 12, anchors: { pier: { x: -44, y: 0, z: 0 } } });
  assert.equal(R.isLand(-34, 0), true); assert.equal(rw.visible, true); assert.deepEqual(ev['region:load'].map((e) => e.id), ['rootwood']);
  assert.deepEqual(R.nearestPier(0, 0), { x: -44, y: 0, z: 0 });
  assert.equal(R.useReturn('rootwood', pos), false, 'locked return path');
  R.unlockReturn('rootwood'); assert.equal(R.useReturn('rootwood', pos), true); assert.equal(pos.x, -12); assert.equal(ev['region:return'].length, 1);
  R.destroy(); assert.equal(R.current, null);
});
