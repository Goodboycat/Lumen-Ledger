// T2 CURIOSITY REGISTRY — node --test tests/curiosity.test.mjs (run by `node tools/check.mjs --curiosity`). Pure JS + real EventBus + ui/tutor.js on domshim.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDomShim } from '../tools/domshim.mjs';
installDomShim();
const { EventBus } = await import('../src/core/EventBus.js');
const { createCuriosity } = await import('../src/systems/curiosity.js');
const { mountTutor } = await import('../ui/tutor.js');
const data = JSON.parse(readFileSync(new URL('../data/tutor.json', import.meta.url), 'utf8'));

function rig({ blocked = false, quiet = false } = {}) {
  const bus = new EventBus(); const hero = { x: 20, z: 0 }; const flags = { blocked, quiet }; const log = [];
  for (const n of ['curious', 'curious:ping']) bus.on(n, (p) => log.push([n, p]));
  const C = createCuriosity({ bus, hero: () => hero, blocked: () => flags.blocked, quiet: () => flags.quiet });
  const run = (sec) => { for (let i = 0; i < Math.round(sec / 0.05); i++) C.update(0.05); };
  return { bus, C, hero, flags, log, run, why: () => log.filter((e) => e[0] === 'curious').map((e) => e[1].why) };
}

test('approach: silent at start, fires ≤ 1.5 s after entering the radius, never earlier (T2.1)', () => {
  const r = rig(); r.C.register({ id: 'stall:a', getPos: () => ({ x: 0, z: 0 }), hint: 'stall:any', radius: 2.4 });
  r.run(1); assert.equal(r.log.length, 0, 'nothing announced while far');
  r.hero.x = 3.0; r.run(1); assert.equal(r.log.length, 0, 'outside the radius = nothing');
  r.hero.x = 2.3; r.run(0.05); assert.equal(r.log.length, 0, 'not before the next 5 Hz check');
  r.run(0.3); assert.deepEqual(r.why(), ['approach'], 'enters → approach within one check');
  assert.equal(r.log[0][1].hint, 'stall:any');
});

test('repeat: leave and return → fires again; linger once per visit when still; a walking hero does not linger', () => {
  const r = rig(); r.C.register({ id: 'j', getPos: () => ({ x: 0, z: 0 }), hint: 'jar:save', lingerHint: 'jar:withdraw', radius: 2 });
  r.run(1); r.hero.x = 1; r.run(0.4); assert.deepEqual(r.why(), ['approach']);
  r.run(2); assert.deepEqual(r.why(), ['approach', 'linger'], 'still inside ≥ 1.2 s → one linger');
  r.run(3); assert.equal(r.why().length, 2, 'linger is once per visit');
  r.hero.x = 9; r.run(1); r.hero.x = 1; r.run(0.4); assert.deepEqual(r.why(), ['approach', 'linger', 'approach'], 'return → again');
  const w = rig(); w.C.register({ id: 'j', getPos: () => ({ x: 0, z: 0 }), hint: 'jar:save', radius: 2 }); w.run(0.5);
  w.hero.x = 1.9; w.run(0.3); for (let i = 0; i < 60; i++) { w.hero.x = 0.2 + ((i * 0.25) % 1.6); w.run(0.1); }   // 2.5 u/s inside the radius (an i%2 zig-zag would sample the SAME spot every 5 Hz check)
  assert.equal(w.why().includes('linger'), false, 'moving → no linger');
});

test('lingerHint false / null answer = no linger card; function answers are evaluated at emit time', () => {
  const r = rig(); let bal = 0; r.C.register({ id: 'j', getPos: () => ({ x: 0, z: 0 }), hint: 'jar:save', lingerHint: () => (bal > 0 ? 'jar:withdraw' : null), radius: 2 });
  r.run(1); r.hero.x = 1; r.run(3); assert.deepEqual(r.why(), ['approach']);
  r.hero.x = 9; r.run(1); bal = 5; r.hero.x = 1; r.run(3); assert.deepEqual(r.why().slice(-2), ['approach', 'linger']); assert.equal(r.log.at(-1)[1].hint, 'jar:withdraw');
});

test('done → never: tutor offers ≤ maxShows, doneOn retires; leave/return again shows again until then (T2.2)', () => {
  const bus = new EventBus(); const root = document.createElement('div'); document.body.append(root);
  const tutor = mountTutor(root, { bus, data, seen: [] }); const shown = []; bus.on('tutor:shown', (p) => shown.push(p.id));
  const tick = (s) => { for (let i = 0; i < s * 10; i++) tutor.update(0.1); };
  const visit = () => { bus.emit('curious', { id: 'jar:save', hint: 'jar:save', why: 'approach', x: 1, z: 1 }); tick(13); };   // 8 s ttl + 12 s repeatGap
  visit(); visit(); assert.deepEqual(shown, ['jar:save', 'jar:save'], 'shows again on return');
  visit(); visit(); assert.equal(shown.length, 3, 'max 3');
  const t2 = mountTutor(document.createElement('div'), { bus: new EventBus(), data, seen: [] }); const b2 = t2; void b2;
  const bus3 = new EventBus(); const t3 = mountTutor(document.createElement('div'), { bus: bus3, data, seen: [] }); const s3 = []; bus3.on('tutor:shown', (p) => s3.push(p.id));
  bus3.emit('curious', { hint: 'jar:save', why: 'approach' }); t3.dismiss(); bus3.emit('jars:deposit', { jar: 'save', amount: 10 });
  for (let i = 0; i < 200; i++) t3.update(0.1); bus3.emit('curious', { hint: 'jar:save', why: 'approach' });
  assert.deepEqual(s3.filter((id) => id === 'jar:save'), ['jar:save'], 'deposit into save → the jar card never again (the 48F onFirstDeposit event card is a different card)');
  assert.equal(t3.ask('jar:save'), true, 'but a TAP still answers (ask ignores retirement)');
  tutor.destroy(); t3.destroy(); t2.destroy();
});

test('queue of 2: two triggers within 1 s → both shown in order, none dropped; a third is dropped (T2.3)', () => {
  const bus = new EventBus(); const tutor = mountTutor(document.createElement('div'), { bus, data, seen: [] }); const shown = []; bus.on('tutor:shown', (p) => shown.push(p.id));
  bus.emit('curious', { hint: 'jar:save', why: 'approach' }); bus.emit('curious', { hint: 'till:coins', why: 'approach' }); bus.emit('curious', { hint: 'enemy:collector', why: 'approach' }); bus.emit('curious', { hint: 'stall:any', why: 'approach' });
  assert.deepEqual(shown, ['jar:save']); assert.equal(tutor.queued.length, 2, 'queue max 2');
  assert.deepEqual(tutor.queued, ['till:coins', 'enemy:collector'], 'by priority (3,3 stay, stall:any priority 1 is the one dropped), equal priority keeps arrival order');
  tutor.dismiss(); for (let i = 0; i < 20; i++) tutor.update(0.1); assert.equal(shown.length, 2);
  tutor.dismiss(); for (let i = 0; i < 20; i++) tutor.update(0.1); assert.equal(shown.length, 3); assert.equal(new Set(shown).size, 3);
  tutor.destroy();
});

test('tap from far: tap answers within tapR of the thing from ANY hero distance; blocked() = no card, taps included (T2.4)', () => {
  const r = rig(); r.C.register({ id: 'enemy:1', getPos: () => ({ x: 30, z: 30 }), hint: 'enemy:collector', radius: 3.2, tapR: 2.2, ping: true });
  r.run(0.5); assert.equal(r.C.tap({ x: 31, z: 30 }), 'enemy:collector'); assert.equal(r.why().at(-1), 'tap'); assert.equal(r.C.tap({ x: 40, z: 40 }), null, 'empty ground');
  assert.equal(r.C.tap({ x: 31, z: 30 }, { hold: true }), 'enemy:collector'); assert.equal(r.why().at(-1), 'hold');
  r.flags.blocked = true; const n = r.log.length; assert.equal(r.C.tap({ x: 31, z: 30 }), null); assert.equal(r.log.length, n, 'no card during dialogue / modal');
});

test('ping: a NEW thing with ping:true announces itself (not the ones that already existed at the first check); quiet() silences it', () => {
  const r = rig(); let there = false; r.C.register({ id: 'pre', getPos: () => ({ x: 5, z: 5 }), hint: 'enemy:collector', ping: true }); r.run(0.5);
  assert.equal(r.log.filter((e) => e[0] === 'curious:ping').length, 0, 'existing world is silent');
  r.C.register({ id: 'st', getPos: () => (there ? { x: 9, z: 9 } : null), hint: 'npc:stranger', ping: true }); r.run(0.5); there = true; r.run(0.4);
  assert.deepEqual(r.log.filter((e) => e[0] === 'curious:ping').map((e) => e[1].id), ['st']);
  const q = rig({ quiet: true }); let t2 = false; q.C.register({ id: 'x', getPos: () => (t2 ? { x: 1, z: 1 } : null), hint: 'npc:stranger', ping: true }); q.run(0.5); t2 = true; q.run(0.4);
  assert.equal(q.log.length, 0, 'verb chain running → silent');
});

test('born grace: a thing that appears under Pip (he just built it) is marked inside silently; sources rebuild each check and drop what is gone', () => {
  const r = rig(); r.hero.x = 0; r.hero.z = 0; let list = []; r.C.source((add) => { for (const s of list) add(s.id, s.x, s.z, 'stall:any', 2.4, 1.6, false, true); }); r.run(0.5);
  list = [{ id: 'stall:new', x: 0.5, z: 0 }]; r.run(0.6); assert.equal(r.log.length, 0, 'built under his feet → the build cards speak, not the guide');
  assert.equal(r.C.size, 1); list = []; r.run(0.4); assert.equal(r.C.size, 0, 'removed stall leaves the registry');
});

test('hints(): every answer the registry can give; unregister removes', () => {
  const r = rig(); const off = r.C.register({ id: 'a', getPos: () => ({ x: 0, z: 0 }), hint: () => 'sign:price' }); r.run(0.3);
  assert.deepEqual(r.C.hints(), ['sign:price']); off(); assert.equal(r.C.size, 0);
});
