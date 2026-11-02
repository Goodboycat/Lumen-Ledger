// tests/telemetry.test.mjs — 40A. node --test tests/telemetry.test.mjs   (pure: mock bus, injected storage, fake clock)
import test from 'node:test';
import assert from 'node:assert/strict';
import { createTelemetry, TELEMETRY_KEY } from '../src/systems/telemetry.js';

function mockBus() {
  const map = new Map();
  return {
    on(n, f) { if (!map.has(n)) map.set(n, new Set()); map.get(n).add(f); return () => map.get(n).delete(f); },
    emit(n, p) { for (const f of Array.from(map.get(n) || [])) f(p); },
    count() { let c = 0; for (const s of map.values()) c += s.size; return c; },
  };
}
function mem() { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k) }; }
function rig() { let t = 0; const bus = mockBus(), storage = mem(); const T = createTelemetry({ bus, storage, now: () => t }); return { bus, storage, T, tick: (ms) => { t += ms; } }; }

test('play → firstStall → firstSale order and times; mark is idempotent', () => {
  const { bus, T, tick } = rig();
  bus.emit('ui:start', { mode: 'story' });
  tick(12_000); bus.emit('build:placed', { id: 'bench', entry: {} });                 // not a stall
  bus.emit('build:placed', { id: 'stall_fruit', entry: { scenery: true } });           // scenery stall does not count
  tick(3_000); bus.emit('build:placed', { id: 'stall_fruit', entry: {} });
  tick(5_000); bus.emit('eco:sale', { paid: 10 }); bus.emit('eco:sale', { paid: 12 });
  const s = T.session;
  assert.equal(s.steps.play, 0); assert.equal(s.steps.firstStall, 15); assert.equal(s.steps.firstSale, 20);
  assert.equal(T.mark('firstSale'), false, 'second mark ignored');
  assert.equal(T.mark('play'), false);
});

test('spark totals, firstCoinInHand only for tip:/till: reasons, s2/s3 from eco:season', () => {
  const { bus, T, tick } = rig();
  const marks = []; bus.on('telemetry:mark', (p) => marks.push(p.step));
  bus.emit('ui:start', { mode: 'story' });
  bus.emit('eco:spark', { delta: 40, reason: 'sale' });
  bus.emit('eco:spark', { delta: -14, reason: 'upkeep' });                              // negative never counted
  tick(30_000); bus.emit('eco:spark', { delta: 2, reason: 'tip:walk' });
  bus.emit('eco:spark', { delta: 3, reason: 'till:collect' });
  const s = T.session;
  assert.equal(s.sparkTotal, 45); assert.equal(s.sparkHandled, 5); assert.equal(s.steps.firstCoinInHand, 30);
  assert.ok(s.sparkHandled <= s.sparkTotal);
  bus.emit('eco:season', { season: 1 }); assert.equal(s.steps.s2, 30); assert.equal(s.steps.s3, undefined); assert.equal(s.seasonsPlayed, 1);
  tick(70_000); bus.emit('eco:season', { season: 2 }); assert.equal(s.steps.s3, 100);
  assert.deepEqual(marks, ['play', 'firstCoinInHand', 's2', 's3']);
  assert.equal(T.summary().reachedS3, true); assert.equal(T.summary().handledRatio, +(5 / 45).toFixed(3));
});

test('quit captured with state/season/day01; flush ring buffer; export parses', () => {
  const { bus, T, storage, tick } = rig();
  bus.emit('ui:start', { mode: 'story' });
  bus.emit('eco:season', { season: 1 }); bus.emit('eco:tick', { day01: 0.42, season: 2, spark: 10 });
  bus.emit('game:state', { state: 'playing', prev: 'review' });
  tick(55_000); bus.emit('ui:title');
  const q = T.session.quit; assert.equal(q.reason, 'title'); assert.equal(q.state, 'playing'); assert.equal(q.season, 2); assert.equal(q.day01, 0.42); assert.equal(q.t, 55);
  assert.equal(T.end('again'), false, 'end is once');
  const all = JSON.parse(storage.getItem(TELEMETRY_KEY)); assert.equal(all.length, 1); assert.equal(all[0].quit.reason, 'title');
  assert.equal(JSON.parse(T.export()).length, 1);
  assert.ok(storage.getItem(TELEMETRY_KEY).length < 1024, 'session ≤ 1 KB');
  // a new PLAY after a quit starts a new session; the old one stays in the buffer
  bus.emit('ui:start', { mode: 'story' }); assert.notEqual(T.session.id, all[0].id); bus.emit('eco:lose', { season: 1 });
  assert.equal(JSON.parse(T.export()).length, 2); assert.equal(T.session.quit.reason, 'lose'); assert.equal(T.session.quit.state, 'ending');
});

test('ring buffer trims at 50; modal seconds sample only inside the first 90 s; destroy → 0 listeners', () => {
  const bus = mockBus(), storage = mem(); let t = 0, modal = false;
  const T = createTelemetry({ bus, storage, now: () => t, isModal: () => modal });
  for (let i = 0; i < 55; i++) { bus.emit('ui:start', { mode: 'story' }); t += 1000; bus.emit('ui:title'); }
  assert.equal(JSON.parse(T.export()).length, 50);
  bus.emit('ui:start', { mode: 'story' }); modal = true;
  for (let i = 0; i < 1200; i++) { t += 100; bus.emit('eco:tick', { day01: i / 1200, season: 1 }); }     // 120 s of modal at 10 Hz
  assert.ok(Math.abs(T.session.modalSeconds - 90) < 0.6, 'modalSeconds ' + T.session.modalSeconds);
  const before = bus.count(); T.destroy(); assert.equal(bus.count(), 0); assert.ok(before > 0);
});

test('disabled → records nothing, never throws', () => {
  const bus = mockBus(); const T = createTelemetry({ bus, enabled: false });
  bus.emit('ui:start', { mode: 'story' }); bus.emit('eco:spark', { delta: 5, reason: 'tip:walk' }); bus.emit('ui:title');
  assert.equal(T.session, null); assert.equal(T.export(), '[]');
});
