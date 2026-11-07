// S59-H — node --test tests/jarRemind.test.mjs : jar reminder timing (pure) + the jar:add tutor card.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDomShim } from '../tools/domshim.mjs';
installDomShim();
const { EventBus } = await import('../src/core/EventBus.js');
const { createJarRemind, remindText } = await import('../src/systems/jarRemind.js');
const { mountTutor } = await import('../ui/tutor.js');
const tutorData = JSON.parse(readFileSync(new URL('../data/tutor.json', import.meta.url), 'utf8'));

function rig(over = {}) {
  const bus = new EventBus(); const pings = []; bus.on('curious:ping', (p) => pings.push(p));
  const st = { unlocked: ['spend'], placed: ['spend'], season: 1, blocked: false, quiet: false };
  const R = createJarRemind({ bus, unlocked: () => st.unlocked, placed: () => st.placed, season: () => st.season, blocked: () => st.blocked, quiet: () => st.quiet, delay: 20, nextDelay: 3, ...over });
  const run = (s) => { for (let i = 0; i < s * 10; i++) R.update(0.1); };
  return { bus, pings, st, R, run };
}

test('remindText: names the missing jars, ≤ 60 chars, one/many', () => {
  assert.match(remindText(['save']), /Save jar:/);
  assert.match(remindText(['invest', 'save']), /Save \+ Invest jars/);
  assert.match(remindText(['save', 'protect', 'invest']), /^Add /);
  for (const c of [['save'], ['save', 'protect'], ['spend', 'save', 'protect', 'invest']]) assert.ok(remindText(c).length <= 60, remindText(c));
  assert.equal(remindText([]), '');
});

test('unlock → nothing for 20 s → ONE reminder naming the jar; then silence in the same season', () => {
  const { bus, pings, st, run } = rig();
  st.unlocked = ['spend', 'save']; bus.emit('jars:unlocked', { jar: 'save', how: 'rule' });
  run(19); assert.equal(pings.length, 0);
  run(2); assert.equal(pings.length, 1);
  assert.equal(pings[0].hint, 'jar:add'); assert.match(pings[0].text, /Save/); assert.deepEqual(pings[0].missing, ['save']);
  run(120); assert.equal(pings.length, 1, 'once per season');
});

test('placing the jar before the timer ends → no reminder', () => {
  const { bus, pings, st, run } = rig();
  st.unlocked = ['spend', 'save']; bus.emit('jars:unlocked', { jar: 'save', how: 'rule' });
  run(5); st.placed = ['spend', 'save']; bus.emit('build:placed', { id: 'jar_save' });
  run(60); assert.equal(pings.length, 0);
});

test('ignored → reminded again at the NEXT season (3 s after CONTINUE), not before', () => {
  const { bus, pings, st, run } = rig();
  st.unlocked = ['spend', 'save']; bus.emit('jars:unlocked', { jar: 'save', how: 'rule' }); run(21);
  assert.equal(pings.length, 1);
  st.season = 2; bus.emit('ui:continue', { outcome: 'season' });
  run(2); assert.equal(pings.length, 1); run(2); assert.equal(pings.length, 2); assert.equal(pings[1].season, 2);
  run(60); assert.equal(pings.length, 2);
});

test('next season but everything is placed → silent', () => {
  const { bus, pings, st, run } = rig();
  st.unlocked = ['spend', 'save']; st.placed = ['spend', 'save'];
  st.season = 2; bus.emit('ui:continue', { outcome: 'season' }); run(30); assert.equal(pings.length, 0);
});

test('blocked (dialogue/cinematic) or quiet (verb chain) → waits, fires on the first free tick', () => {
  const { bus, pings, st, run } = rig();
  st.unlocked = ['spend', 'save']; bus.emit('jars:unlocked', { jar: 'save', how: 'rule' });
  st.blocked = true; run(40); assert.equal(pings.length, 0);
  st.blocked = false; st.quiet = true; run(10); assert.equal(pings.length, 0);
  st.quiet = false; run(2); assert.equal(pings.length, 1);
});

test('restore / start unlocks never arm the timer; destroy stops everything', () => {
  const { bus, pings, st, R, run } = rig();
  st.unlocked = ['spend', 'save'];
  bus.emit('jars:unlocked', { jar: 'save', how: 'restore' }); bus.emit('jars:unlocked', { jar: 'spend', how: 'start' }); run(60); assert.equal(pings.length, 0);
  bus.emit('jars:unlocked', { jar: 'save', how: 'rule' }); R.destroy(); run(60); assert.equal(pings.length, 0);
});

test('tutor: curious:ping jar:add shows the card with the one-off text (≤ 60 chars) and the placing follows it away', () => {
  const bus = new EventBus(); const root = document.createElement('div'); document.body.append(root);
  const tutor = mountTutor(root, { bus, data: tutorData, seen: [] }); bus.emit('game:start', {});
  assert.ok(tutor.has('jar:add'));
  bus.emit('curious:ping', { id: 'jar:add', hint: 'jar:add', text: 'Add your Save jar: Build, Jars tab.' });
  assert.equal(tutor.current, 'jar:add');
  bus.emit('build:placed', { id: 'jar_save' }); assert.equal(tutor.current, null, 'placing a jar follows the card');
  // next season: the card may come back (maxShows 12, repeatGap 12 s of play)
  tutor.update(0.1); for (let i = 0; i < 130; i++) tutor.update(0.1);
  bus.emit('curious:ping', { id: 'jar:add', hint: 'jar:add', text: 'Add your Invest jar: Build, Jars tab.' });
  assert.equal(tutor.current, 'jar:add');
  tutor.destroy();   // the hand's rAF loop keeps node alive otherwise
});
