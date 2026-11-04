// 48F CURIOSITY TUTOR — node --test tests/tutor.test.mjs  (run by `node tools/check.mjs --tutor`). domshim + real EventBus + ui/tutor.js + data/tutor.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDomShim } from '../tools/domshim.mjs';
installDomShim();
const { EventBus } = await import('../src/core/EventBus.js');
const { mountTutor } = await import('../ui/tutor.js');
const { installVerbChain } = await import('../src/systems/verbChain.js');
const data = JSON.parse(readFileSync(new URL('../data/tutor.json', import.meta.url), 'utf8'));

function mount(seen = []) {
  const bus = new EventBus(); const log = [];
  for (const n of ['tutor:shown', 'tutor:dismissed']) bus.on(n, (p) => log.push([n, p]));
  const root = document.createElement('div'); document.body.append(root);
  const tutor = mountTutor(root, { bus, data, seen });
  return { bus, log, root, tutor, shown: () => log.filter((e) => e[0] === 'tutor:shown').map((e) => e[1].id) };
}

test('data/tutor.json: ≤ 16 cards, ids unique, text ≤ 60 chars, one sentence-ish, D2 card set present', () => {
  assert.ok(Array.isArray(data.cards) && data.cards.length <= 16, 'card count');
  const ids = new Set();
  for (const c of data.cards) { assert.ok(c.id && !ids.has(c.id), 'id ' + c.id); ids.add(c.id); assert.ok(String(c.text || '').length <= 60, c.id + ' > 60 chars'); assert.ok(c.icon, c.id + ' icon'); }
  for (const must of ['onBuildOpen', 'onDemolish', 'onDecorTab', 'onFirstStall', 'onFirstCoin', 'onJarsTab', 'onFirstDeposit', 'onWave', 'onSeason2', 'onLocked', 'onCuriosityLull', 'verb:move', 'verb:coin', 'verb:bonk', 'verb:stall', 'verb:deposit']) assert.ok(ids.has(must), 'missing ' + must);
});

test('once per profile: ui:build:open ×3 → 1 card; seen has it; a fresh mount with that seen shows nothing', () => {
  const { bus, tutor, shown } = mount();
  bus.emit('ui:build:open', {}); bus.emit('ui:build:open', {}); bus.emit('ui:build:open', {});
  assert.deepEqual(shown(), ['onBuildOpen']); assert.deepEqual(tutor.seen, ['onBuildOpen']); assert.equal(tutor.current, 'onBuildOpen');
  tutor.dismiss();
  bus.emit('ui:build:open', {}); assert.equal(shown().length, 1, 'seen → never again, even after dismiss');
  const again = mount([...tutor.seen]); again.bus.emit('ui:build:open', {}); assert.equal(again.shown().length, 0, 'persisted seen honoured');
  tutor.destroy(); again.tutor.destroy();
});

test('one at a time: a trigger while a card is up is DROPPED (not queued, not marked seen)', () => {
  const { bus, tutor, shown } = mount();
  bus.emit('ui:build:open', {}); bus.emit('jars:deposit', { jar: 'save', amount: 5 });
  assert.deepEqual(shown(), ['onBuildOpen']); assert.equal(tutor.seen.length, 1, 'dropped card is not seen');
  tutor.dismiss();
  bus.emit('jars:deposit', { jar: 'save', amount: 5 }); assert.deepEqual(shown(), ['onBuildOpen', 'onFirstDeposit'], 'it can still show later');
  tutor.destroy();
});

test('dismiss: tap / key (capture, next gesture only) / 8 s ttl → tutor:dismissed {id, ms, why}', () => {
  const { bus, tutor, log } = mount();
  bus.emit('ui:build:open', {});
  window.dispatchEvent(new PointerEvent('pointerdown')); assert.equal(tutor.visible, true, 'same-tick gesture ignored (the tap that opened the tray)');
  for (let i = 0; i < 90; i++) tutor.update(0.1); assert.equal(tutor.visible, false, 'ttl 8 s');
  let d = log.find((e) => e[0] === 'tutor:dismissed')[1]; assert.equal(d.id, 'onBuildOpen'); assert.equal(d.why, 'ttl'); assert.ok(Number.isFinite(d.ms) && d.ms >= 0);
  bus.emit('enemy:wave', { n: 1 }); assert.equal(tutor.current, 'onWave');
  const t0 = Date.now(); while (Date.now() - t0 < 130);   // past the 120 ms same-gesture guard
  window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); assert.equal(tutor.visible, false, 'any key dismisses');
  d = log.filter((e) => e[0] === 'tutor:dismissed').at(-1)[1]; assert.equal(d.why, 'key'); assert.ok(d.ms >= 100);
  tutor.destroy();
});

test('match filters: eco:spark reason tip* / build:placed stall_* / ui:build:tab cat / eco:season 2 only', () => {
  const { bus, tutor, shown } = mount();
  bus.emit('eco:spark', { reason: 'sale', delta: 3 }); assert.equal(shown().length, 0, 'non-tip spark ignored');
  bus.emit('eco:spark', { reason: 'tipCoin', delta: 1 }); assert.equal(tutor.current, 'onFirstCoin'); tutor.dismiss();
  bus.emit('build:placed', { id: 'deco_bench' }); assert.equal(tutor.visible, false, 'decor is not a stall');
  bus.emit('build:placed', { id: 'stall_fruit' }); assert.equal(tutor.current, 'onFirstStall'); tutor.dismiss();
  bus.emit('ui:build:tab', { cat: 'nature' }); assert.equal(tutor.visible, false);
  bus.emit('ui:build:tab', { cat: 'jar' }); assert.equal(tutor.current, 'onJarsTab'); tutor.dismiss();
  bus.emit('ui:build:tab', { cat: 'decor' }); assert.equal(tutor.current, 'onDecorTab'); tutor.dismiss();
  bus.emit('eco:season', { season: 3 }); assert.equal(tutor.visible, false, 'S3 is not S2');
  bus.emit('eco:season', { season: 2 }); assert.equal(tutor.current, 'onSeason2'); tutor.dismiss();
  bus.emit('ui:build', { action: 'select', id: 'stall_fruit' }); assert.equal(tutor.visible, false);
  bus.emit('ui:build', { action: 'demolish' }); assert.equal(tutor.current, 'onDemolish');
  tutor.destroy();
});

test('curiosity lull: 25 s untouched → onCuriosityLull once; touched() true before → never', () => {
  const a = mount(); let touched = false; a.tutor.bind({ touched: () => touched });
  for (let i = 0; i < 240; i++) a.tutor.update(0.1); assert.equal(a.tutor.visible, false, '24 s: not yet');
  for (let i = 0; i < 20; i++) a.tutor.update(0.1); assert.equal(a.tutor.current, 'onCuriosityLull');
  a.tutor.dismiss(); for (let i = 0; i < 300; i++) a.tutor.update(0.1); assert.equal(a.tutor.visible, false, 'never again');
  const b = mount(); let t2 = false; b.tutor.bind({ touched: () => t2 });
  for (let i = 0; i < 100; i++) b.tutor.update(0.1); t2 = true; for (let i = 0; i < 300; i++) b.tutor.update(0.1);
  assert.equal(b.shown().length, 0, 'player found it alone → no lull card');
  a.tutor.destroy(); b.tutor.destroy();
});

test('modal / title: ui:ledger:open dismisses; game:title dismisses + disarms; game:start re-arms', () => {
  const { bus, tutor, log } = mount();
  bus.emit('enemy:wave', {}); bus.emit('ui:ledger:open', {}); assert.equal(tutor.visible, false); assert.equal(log.at(-1)[1].why, 'modal');
  bus.emit('game:title', {}); bus.emit('jars:deposit', {}); assert.equal(tutor.visible, false, 'disarmed on title');
  bus.emit('game:start', {}); bus.emit('jars:deposit', {}); assert.equal(tutor.current, 'onFirstDeposit');
  tutor.destroy();
});

test('verb chain (41B) has no DOM: 5 tutor:hint ids → 5 verb cards once; no #verb-hint / Skip element', () => {
  const { bus, tutor, shown } = mount();
  const hints = []; bus.on('tutor:hint', (p) => hints.push(p.id));
  let day = 0; const sb = { coins: [], hero: { root: { position: { x: 0, z: 0 }, rotation: { y: 0 } } }, eco: { state: { season: 1, day01: 0 }, tick(dt) { day += dt; this.state.day01 = day / 70; } } };
  sb.dropTip = (x, z, value) => { const c = { position: { x, z }, value }; sb.coins.push(c); return c; };
  const lg = { bus, sb, mode: 'story', opts: { verbs: true }, story: { state: {} }, _offs: [], tut: { fired: new Set() } };
  installVerbChain(lg); bus.emit('game:start', {});
  const frame = () => { tutor.dismiss(); lg.verbs.update(0.1); tutor.dismiss(); };   // the player taps each card away (build:placed shows onFirstStall first — drop rule)
  frame(); sb.hero.root.position.x = 3.2; frame(); sb.coins.length = 0; frame(); bus.emit('combat:miss', {}); frame();
  bus.emit('build:placed', { id: 'stall_fruit' }); frame(); bus.emit('ui:jar:apply', { pct: { save: 10 } }); frame();
  assert.deepEqual([...new Set(hints)], ['move', 'coin', 'bonk', 'stall', 'deposit'], 'hints ' + hints.join(','));
  assert.deepEqual(shown().filter((id) => id.startsWith('verb:')), ['verb:move', 'verb:coin', 'verb:bonk', 'verb:stall', 'verb:deposit']);
  const walk = (n, out = []) => { out.push(n); for (const c of n.children || []) walk(c, out); return out; };
  const all = walk(document.body);
  assert.equal(all.some((n) => n.id === 'verb-hint' || /ll-verb/.test(n.className || '')), false, 'no #verb-hint / .ll-verb-* chip or Skip in the DOM');
  lg.verbs.destroy(); tutor.destroy();
});
