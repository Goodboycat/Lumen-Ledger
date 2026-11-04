// 41B VERBS — node --test tests/verbs.test.mjs  (run by `node tools/check.mjs --verbs`). Fake lg/sb, real EventBus + verbChain.
import test from 'node:test';
import assert from 'node:assert/strict';
import { EventBus } from '../src/core/EventBus.js';
import { installVerbChain, VERB_STEPS } from '../src/systems/verbChain.js';

function makeLg() {
  const bus = new EventBus(); const log = [];
  for (const n of ['tut:step', 'tut:done', 'tut:skip', 'story:toast', 'ui:pause']) bus.on(n, (p) => log.push([n, p]));
  let day = 0;
  const sb = { coins: [], hero: { root: { position: { x: 0, z: 0 }, rotation: { y: 0 } } },
    eco: { state: { season: 1, day01: 0 }, tick(dt) { day += dt; this.state.day01 = day / 70; } } };
  sb.dropTip = (x, z, value) => { const c = { position: { x, z }, value }; sb.coins.push(c); return c; };
  const lg = { bus, sb, mode: 'story', opts: { verbs: true }, story: { state: {} }, _offs: [], tut: { fired: new Set() } };
  return { lg, bus, sb, log, frame: (dt = 0.1) => { lg.verbs.update(dt); sb.eco.tick(dt); } };
}
const steps = (log) => log.filter((e) => e[0] === 'tut:step').map((e) => e[1].id);

test('scripted chain: move → coin → bonk → stall → deposit → done, eco frozen until done', () => {
  const { lg, bus, sb, log, frame } = makeLg();
  installVerbChain(lg); bus.emit('game:start', {});
  assert.deepEqual(steps(log), ['move']);
  for (let i = 0; i < 50; i++) frame(); assert.equal(sb.eco.state.day01, 0, 'eco paused during chain (5 s)');
  sb.hero.root.position.x = 3.2; frame(); assert.equal(steps(log).at(-1), 'coin');
  assert.ok(sb.coins.length === 1 && Math.hypot(sb.coins[0].position.x - 3.2, sb.coins[0].position.z - 0) <= 2.5, 'coin ≤ 2.5 u ahead');
  sb.coins.length = 0; frame(); assert.equal(steps(log).at(-1), 'bonk');
  bus.emit('combat:miss', {}); frame(); assert.equal(steps(log).at(-1), 'stall'); assert.equal(sb.coins.length, 3, 'sword pays 3 coins');
  bus.emit('build:placed', { id: 'deco_bench' }); frame(); assert.equal(steps(log).at(-1), 'stall', 'decor does not count');
  bus.emit('build:placed', { id: 'stall_fruit' }); frame(); assert.equal(steps(log).at(-1), 'deposit');
  bus.emit('ui:jar:apply', { pct: { save: 10 } }); frame();
  const done = log.find((e) => e[0] === 'tut:done'); assert.ok(done && done[1].seconds <= 60 && !done[1].skipped);
  assert.equal(lg.verbs.step, -1); assert.equal(lg.story.state.verbStep, -1);
  frame(); assert.ok(sb.eco.state.day01 > 0, 'eco clock advances after done');
  assert.deepEqual(steps(log), VERB_STEPS);
  assert.equal(log.filter((e) => e[0] === 'ui:pause').length, 0);
});

test('idle path: every step auto-completes after 25 s with "Later, then."', () => {
  const { lg, bus, log, frame } = makeLg();
  installVerbChain(lg); bus.emit('game:start', {});
  for (let i = 0; i < 5 * 252; i++) frame();
  assert.equal(log.filter((e) => e[0] === 'story:toast' && e[1].text === 'Later, then.').length, 5);
  assert.ok(log.some((e) => e[0] === 'tut:done')); assert.equal(lg.verbs.step, -1);
});

test('skip, resume mid-chain, done-save never replays, destroy → 0 listeners', () => {
  const a = makeLg(); installVerbChain(a.lg); a.bus.emit('game:start', {}); a.lg.verbs.skip();
  assert.ok(a.log.some((e) => e[0] === 'tut:skip')); assert.equal(a.log.find((e) => e[0] === 'tut:done')[1].skipped, true);
  a.bus.emit('game:start', {}); assert.equal(steps(a.log).length, 1, 'done save → chain not shown again');
  const b = makeLg(); b.lg.story.state.verbStep = 3; b.lg._resuming = true; installVerbChain(b.lg);
  b.bus.emit('game:start', {}); b.bus.emit('game:resumed', {}); assert.deepEqual(steps(b.log), ['stall']);
  b.lg.verbs.destroy(); const after = [...b.bus.map.values()].reduce((n, s) => n + s.size, 0);
  assert.equal(after, 5, 'only the 5 test log listeners remain → chain left 0 listeners');
});

test('46A: chain waits for the opening dialogue (PLAY_BUGS 45B-1) and does not count time under one', () => {
  const { lg, bus, log, frame } = makeLg();
  const dlg = { isOpen: true }; lg.ui = { dialogue: dlg };
  installVerbChain(lg); bus.emit('game:start', {});
  assert.deepEqual(steps(log), [], 'no step while the S1 opening is up'); assert.equal(lg.verbs.step, -1); assert.equal(lg.verbs.pending, 0);
  for (let i = 0; i < 300; i++) frame();                                   // 30 s of reading → no "Later, then."
  assert.equal(log.filter((e) => e[0] === 'story:toast').length, 0);
  dlg.isOpen = false; bus.emit('ui:dialogue:close', {});
  assert.deepEqual(steps(log), ['move']); assert.equal(lg.verbs.pending, null);
  dlg.isOpen = true; for (let i = 0; i < 300; i++) frame(); assert.equal(lg.verbs.t, 0, 'timer frozen under a mid-chain dialogue');
  dlg.isOpen = false; for (let i = 0; i < 252; i++) frame(); assert.equal(steps(log).at(-1), 'coin', 'auto-advance resumes once the box closes');
  bus.emit('game:title', {}); assert.equal(lg.verbs.pending, null);
});
