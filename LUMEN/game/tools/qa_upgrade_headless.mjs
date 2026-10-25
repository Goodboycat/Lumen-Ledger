// Headless (no browser) probe for the upgrade bugs reported 2026-10-24:
//   (a) upgrading a stall "has no effect"   (b) building a 2nd stall of the same type "resets the upgrade to L1".
// Run from game/:   node tools/qa_upgrade_headless.mjs
import { resolve } from 'node:path';
import { pathToFileURL } from 'node:url';
globalThis.window ??= globalThis; globalThis.self ??= globalThis;
globalThis.document ??= { createElement: () => ({ style: {}, getContext: () => null, addEventListener() {} }), body: { appendChild() {} }, addEventListener() {} };
globalThis.navigator ??= { userAgent: 'node', maxTouchPoints: 0 };
globalThis.requestAnimationFrame ??= (f) => setTimeout(() => f(performance.now()), 16);
globalThis.devicePixelRatio ??= 1;

const THREE = await import(pathToFileURL(resolve('vendor/three.module.js')).href);
const { SequencePlayer, HitStop } = await import(pathToFileURL(resolve('src/anim/Sequencer.js')).href);
const { EventBus } = await import(pathToFileURL(resolve('src/core/EventBus.js')).href);
const { tweens } = await import(pathToFileURL(resolve('src/anim/Tween.js')).href);
const { createSandbox } = await import(pathToFileURL(resolve('src/Game.js')).href);

const bus = new EventBus(); const log = [];
for (const n of ['build:upgraded', 'build:denied', 'eco:denied', 'build:placed', 'build:upgraded:done']) bus.on(n, (p) => log.push([n, p && { id: p.id, level: p.level, why: p.why, cost: p.cost }]));
const game = { scene: new THREE.Scene(), bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, hitstop() {} };
const sb = createSandbox(game, { headless: true, seasonSeconds: 150, seed: 3 });
const dt = 1 / 30; const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); };
const run = (sec) => { for (let i = 0; i < sec * 30; i++) step(); };
const stalls = () => [...sb.build.placed.values()].filter((e) => e.id.startsWith('stall_')).map((e) => ({ id: e.id, lvl: e.level, ud: e.group.userData.level, cost: e.cost, cx: e.cx, cz: e.cz }));
sb.eco.state.spark = 2000;
console.log('start', stalls());
const fruit = [...sb.build.placed.values()].find((e) => e.id === 'stall_fruit');
const r = sb.build.upgrade(fruit); run(1);
console.log('upgrade →', !!r, stalls().filter((s) => s.id === 'stall_fruit'));
// sales multiplier check
const l1 = []; const l2 = []; for (let i = 0; i < 200; i++) { l1.push(sb.eco.sell('stall_fruit', 'regular', undefined, { level: 1 }).sold); l2.push(sb.eco.sell('stall_fruit', 'regular', undefined, { level: 2 }).sold); }
const avg = (a) => (a.reduce((x, y) => x + y, 0) / a.length).toFixed(2);
console.log('avg units sold L1', avg(l1), 'L2', avg(l2), 'levelMul(2)=', sb.eco.levelMul(2));
// what level does the customer system see?
console.log('cust sees', sb.build.stalls().map((s) => s.id + ':L' + s.level + '/entry' + (s.entry && s.entry.level)));
// place a 2nd fruit stall
let ok = null; for (let x = -6; x <= 6 && !ok; x++) for (let z = -6; z <= 6 && !ok; z++) if (sb.build.canPlace('stall_fruit', x, z, 0)) ok = sb.build.place('stall_fruit', x, z, 0, { animate: false });
run(1);
console.log('after 2nd fruit', stalls().filter((s) => s.id === 'stall_fruit'));
// serialize / restore round trip (save + continue)
const snap = sb.build.serialize(); console.log('serialize', snap.filter((s) => s.id === 'stall_fruit'));
console.log('events', log.map((x) => x[0] + ' ' + JSON.stringify(x[1])).join('\n  '));
