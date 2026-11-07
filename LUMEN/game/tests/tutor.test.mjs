// 48F CURIOSITY TUTOR — node --test tests/tutor.test.mjs  (run by `node tools/check.mjs --tutor`). domshim + real EventBus + ui/tutor.js + data/tutor.json.
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { installDomShim } from '../tools/domshim.mjs';
installDomShim();
const { EventBus } = await import('../src/core/EventBus.js');
const { mountTutor } = await import('../ui/tutor.js');
const { installVerbChain } = await import('../src/systems/verbChain.js');
const { aheadPoint } = await import('../src/systems/aheadPoint.js');
const data = JSON.parse(readFileSync(new URL('../data/tutor.json', import.meta.url), 'utf8'));

function mount(seen = []) {
  const bus = new EventBus(); const log = [];
  for (const n of ['tutor:shown', 'tutor:dismissed']) bus.on(n, (p) => log.push([n, p]));
  const root = document.createElement('div'); document.body.append(root);
  const tutor = mountTutor(root, { bus, data, seen });
  return { bus, log, root, tutor, shown: () => log.filter((e) => e[0] === 'tutor:shown').map((e) => e[1].id) };
}

test('data/tutor.json: ids unique, text ≤ 60 chars, every card has an icon + group, D2 card set present (T2: 47 cards)', () => {
  assert.ok(Array.isArray(data.cards) && data.cards.length >= 16, 'card count');
  const ids = new Set();
  for (const c of data.cards) { assert.ok(c.id && !ids.has(c.id), 'id ' + c.id); ids.add(c.id); assert.ok(String(c.text || '').length <= 60, c.id + ' > 60 chars'); assert.ok(c.icon, c.id + ' icon'); assert.ok(c.group, c.id + ' group'); }
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

test('S59 persistent cards: moving / taps / keys NEVER dismiss; followed → closes; info cards fade after 8 s STANDING STILL; ✕ closes; hard cap', () => {
  const { bus, tutor, log, root } = mount();
  const hero = { x: 0, z: 0 }; tutor.bind({ locate: (k) => (k === 'hero' ? { x: hero.x, z: hero.z } : null) });
  const why = () => log.filter((e) => e[0] === 'tutor:dismissed').map((e) => e[1].why);
  const sleep = (ms) => { const t0 = Date.now(); while (Date.now() - t0 < ms); };
  // 1. a followable card (onBuildOpen has follow: ui:build:tab …) survives taps, keys and 20 s of standing
  bus.emit('ui:build:open', {}); sleep(130);
  window.dispatchEvent(new PointerEvent('pointerdown')); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'a' })); window.dispatchEvent(new KeyboardEvent('keydown', { key: 'ArrowLeft' }));
  assert.equal(tutor.visible, true, 'tap / keys do not close it');
  for (let i = 0; i < 200; i++) tutor.update(0.1); assert.equal(tutor.visible, true, 'a followable card does not time out at 8 s');
  bus.emit('ui:build:tab', { cat: 'stalls' }); assert.equal(tutor.visible, false, 'FOLLOWED (opened a tab) → closes');
  assert.deepEqual(why(), ['followed']);
  // 2. an info card (no follow / doneOn) — the clock only runs while Pip stands still
  bus.emit('onFirstDepositForce', {}); tutor.dismiss('x'); log.length = 0;
  bus.emit('jars:deposit', { jar: 'save', amount: 10 }); assert.equal(tutor.current, 'onFirstDeposit');
  for (let i = 0; i < 200; i++) { hero.x += 0.05; tutor.update(0.1); }     // Pip walks for 20 s (0.5 u/s > moveSpeed; info-card hard cap is 30 s)
  assert.equal(tutor.visible, true, 'walking pauses the reading clock — the text is still there when he stops');
  for (let i = 0; i < 90; i++) tutor.update(0.1);                          // …stands still for 9 s
  assert.equal(tutor.visible, false, 'standing still 8 s → it fades'); assert.equal(why().at(-1), 'ttl');
  // 3. the ✕ / check button closes it
  log.length = 0; bus.emit('enemy:wave', { n: 1 }); assert.equal(tutor.current, 'onWave');
  const xb = root.querySelector('.ll-tutor-x'); assert.ok(xb, 'got-it button exists'); xb.click ? xb.click() : xb.dispatchEvent(new Event('click'));
  assert.equal(tutor.visible, false, '✓ closes'); assert.equal(why().at(-1), 'tap');
  // 4. hard cap: a followable card nobody follows still leaves (45 s of play)
  log.length = 0; bus.emit('ui:build:open', {}); tutor.dismiss('x'); log.length = 0; tutor.ask('verb:move'); assert.equal(tutor.current, 'verb:move');
  for (let i = 0; i < 700; i++) tutor.update(0.1); assert.equal(tutor.visible, false, 'cap'); assert.equal(why().at(-1), 'cap');
  tutor.destroy();
});

test('S59 verb cards: the next verb step (tut:step) / tut:done / tut:skip FOLLOWS the card; a HUD tap does not knock a verb card off', () => {
  const { bus, tutor, log } = mount();
  bus.emit('tutor:hint', { id: 'move' }); assert.equal(tutor.current, 'verb:move', 'tutor:hint {id:move} → the verb:move card');
  assert.equal(tutor.ask('hud:pouch'), false, 'a HUD tap waits while a verb card is up'); assert.equal(tutor.current, 'verb:move');
  bus.emit('tut:step', { id: 'coin', index: 1 }); assert.equal(tutor.visible, false, 'step 2 started → step 1 card followed');
  tutor.show('verb:coin'); tutor.show('verb:bonk'); assert.equal(tutor.current, 'verb:bonk', 'verb replaces the previous verb card');
  bus.emit('tut:skip', {}); assert.equal(tutor.visible, false);
  assert.ok(log.filter((e) => e[0] === 'tutor:dismissed').every((e) => e[1].why === 'followed'));
  tutor.destroy();
});

test('S60-B the hand follows a MOVING thing LIVE (never the stale x,z snapshot) and the card closes when it is gone', async () => {
  const { bus, tutor, root } = mount(); const hand = root.querySelector('.ll-tutor-hand');
  const pos = { x: 2, z: 2 }; let gone = false;
  tutor.bind({ project: (p) => ({ x: 100 + p.x * 50, y: 200 + p.z * 10, behind: false }), locate: (k) => (k === 'stranger' && !gone ? { x: pos.x, z: pos.z } : null) });
  tutor.ask('npc:stranger', { x: 9, z: 9 });                                  // snapshot far away on purpose (x=9 → left 550); the stranger really stands at x=2 → left 200
  assert.equal(tutor.current, 'npc:stranger'); assert.ok(hand.classList.contains('show'), 'hand shown at the live position');
  assert.equal(hand.style.left, '200px', 'live x (2 → 200 px), NOT the stale snapshot (9 → 550 px)');
  pos.x = 4; await new Promise((r) => setTimeout(r, 60)); assert.equal(hand.style.left, '300px', 'the stranger strolled → the hand moved with them');
  gone = true; await new Promise((r) => setTimeout(r, 60)); assert.equal(hand.classList.contains('show'), false, 'stranger gone → the hand hides at once (never points at an empty spot)');
  assert.equal(tutor.visible, true, 'card still up inside the grace window');
  await new Promise((r) => setTimeout(r, 1400)); assert.equal(tutor.visible, false, 'gone for > 1.2 s → the card closes');
  // a STATIC thing (jar) may still use the snapshot as its last resort
  tutor.bind({ project: (p) => ({ x: p.x, y: p.z, behind: false }), locate: () => null }); bus.emit('curious', { hint: 'jar:save', why: 'tap', x: 40, z: 60 });
  assert.equal(hand.style.left, '40px', 'static targets keep the snapshot fallback');
  tutor.destroy();
});

test('S60-A Move card: touch → drawn JOYSTICK demo + "Drag the stick" text (no world hand); desktop → WASD keys + the hand far ahead', () => {
  const card = data.cards.find((c) => c.id === 'verb:move'); assert.equal(card.demo, 'move'); assert.ok(String(card.textTouch).length <= 60 && card.textTouch.length > 0);
  // desktop first
  document.body.classList.remove('is-touch');
  let m = mount(); const txtOf = (m) => m.root.querySelector('.ll-tutor-txt');
  m.tutor.bind({ project: (p) => ({ x: 400 + p.x * 10, y: 300 + p.z * 10, behind: false }), locate: (k) => (k === 'ahead' ? { x: 0, z: -6 } : null) });
  m.bus.emit('tutor:hint', { id: 'move' }); const joy = m.root.querySelector('.ll-tutor-joy'), hand = m.root.querySelector('.ll-tutor-hand');
  assert.ok(joy, 'demo element exists'); assert.ok(joy.classList.contains('show') && joy.classList.contains('keys') && !joy.classList.contains('touch'), 'desktop: keycaps');
  assert.ok(hand.classList.contains('show'), 'desktop: the hand points far ahead'); assert.match(String(txtOf(m).innerHTML), /WASD/);
  m.tutor.dismiss('followed'); assert.equal(joy.classList.contains('show'), false, 'demo hides with the card'); m.tutor.destroy();
  // touch
  document.body.classList.add('is-touch');
  m = mount(); m.tutor.bind({ project: (p) => ({ x: 400 + p.x, y: 300 + p.z, behind: false }), locate: () => ({ x: 0, z: -6 }) });
  m.bus.emit('tutor:hint', { id: 'move' }); const j2 = m.root.querySelector('.ll-tutor-joy'), h2 = m.root.querySelector('.ll-tutor-hand');
  assert.ok(j2.classList.contains('show') && j2.classList.contains('touch'), 'touch: drawn stick + knob + hand'); assert.equal(h2.classList.contains('show'), false, 'touch: no hand over the world (it lives on the stick)');
  assert.match(String(txtOf(m).innerHTML), /stick/); assert.ok(document.body.classList.contains('tj-on'), 'plain "drag to move" label yields to the drawn stick');
  m.tutor.dismiss('followed'); assert.equal(document.body.classList.contains('tj-on'), false); m.tutor.destroy();
  document.body.classList.remove('is-touch');
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

test('S61-B aheadPoint: marker is 6 u up the SCREEN for any camera yaw, stays on land and clear of buildings', () => {
  const hero = { x: 1, z: 2 }, close = (a, b) => Math.abs(a - b) < 1e-6;
  // fixed ¾ rig: camera sits at +z looking toward -z -> up the screen = -z
  let p = aheadPoint({ hero, camPos: { x: 1, z: 12 }, camLook: { x: 1, z: 2 } }); assert.ok(close(p.x, 1) && close(p.z, -4), 'default rig: 6 u toward -z');
  // no camera at all -> same fallback
  p = aheadPoint({ hero }); assert.ok(close(p.x, 1) && close(p.z, -4), 'no camera: -z');
  // camera rotated 90°, 180°, 270° around Pip: the marker follows the camera's forward direction
  for (const [ox, oz] of [[10, 0], [0, -10], [-10, 0]]) {
    p = aheadPoint({ hero, camPos: { x: hero.x + ox, z: hero.z + oz }, camLook: hero });
    const dx = p.x - hero.x, dz = p.z - hero.z; assert.ok(close(Math.hypot(dx, dz), 6), '6 u away'); assert.ok(close(dx, -ox * 0.6) && close(dz, -oz * 0.6), `forward for cam offset (${ox},${oz})`);
  }
  // water straight ahead -> falls to the next candidate on land; occupied tiles are skipped too
  const land = (x, z) => z > -3; p = aheadPoint({ hero, camPos: { x: 1, z: 12 }, camLook: hero, isLand: land }); assert.ok(land(p.x, p.z), 'on land'); assert.ok(p.z > -3);
  p = aheadPoint({ hero, camPos: { x: 1, z: 12 }, camLook: hero, occupied: (x, z) => z < -3 && Math.abs(x - 1) < 1 }); assert.ok(!(p.z < -3 && Math.abs(p.x - 1) < 1), 'skips the building');
  // nothing free -> heads for the plaza centre, still finite
  p = aheadPoint({ hero, isLand: () => false }); assert.ok(Number.isFinite(p.x) && Number.isFinite(p.z)); assert.equal(aheadPoint({}), null, 'no hero -> null');
  // degenerate camera (lookAt == position on the ground) -> default direction
  p = aheadPoint({ hero, camPos: { x: 5, z: 5 }, camLook: { x: 5, z: 5 } }); assert.ok(close(p.z, -4));
});
