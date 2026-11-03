// tools/gates/wants.mjs — 44B headless gate: `node tools/check.mjs --wants`  (section "44B VISIBLE WANTS")
// Real createSandbox (headless, seed 7, starter stalls fruit/bread/tea → bread + tea demolished so only `fruit` stays):
//   S3 spawn `elder` (tea 2.5) → cust:want {want:'tea', found:false} → leaves with result noStall → cust:left {result.noStall, want:'tea'}
//   spawn `saver` (fruit 2) → cust:want {want:'fruit', found:true} → no noStall
//   two elders in one season → exactly 1 Owl bark kind:'wants' (text from barks.wants, {who}/{what} filled) · eco:season → 1 again
//   `regular` (empty PREFS) → no cust:want, no noStall · want bubble = story:bark kind:'want' icon 'stall_<kind>' ok · destroy → 0 leaked listeners
import { readFileSync } from 'node:fs';
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\n44B VISIBLE WANTS:');
  const THREE = await imp('vendor/three.module.js');
  const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
  const { EventBus } = await imp('src/core/EventBus.js');
  const { tweens } = await imp('src/anim/Tween.js');
  const { createSandbox, destroySandbox } = await imp('src/Game.js');
  const { PREFS } = await imp('src/systems/customers.js');
  const story = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
  const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, stats: {}, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, remove(s) { const i = this.systems.indexOf(s); if (i >= 0) this.systems.splice(i, 1); }, hitstop() {} });
  const countListeners = (bus) => { let n = 0; const m = bus.listeners || bus.map || bus.handlers || bus._l || null; if (m instanceof Map) for (const v of m.values()) n += (v?.size ?? v?.length ?? 0); return n; };
  const bus = new EventBus(), scene = new THREE.Scene(), game = mkGame(bus, scene);
  const wants = [], lefts = [], barks = [];
  bus.on('cust:want', (p) => wants.push(p)); bus.on('cust:left', (p) => lefts.push(p)); bus.on('story:bark', (p) => barks.push(p));
  const base = countListeners(bus);
  let sb = null;
  try {
    // data first (cheap)
    const W = story.barks?.wants, WHO = story.barks?.wantsWho;
    if (!Array.isArray(W) || W.length < 3 || !W.every((b) => b.speaker === 'owl' && /\{what\}/.test(b.text) && b.text.length <= 70)) throw new Error('story.json barks.wants needs 3 Owl lines with {what}, ≤ 70 chars');
    if (!W[0].text.includes('{who}')) throw new Error('barks.wants[0] must be the "{who} want {what}" template');
    if (!WHO || Object.keys(WHO).length > 12 || !['elder', 'saver', 'kid'].every((k) => WHO[k])) throw new Error('barks.wantsWho needs ≤ 12 type → plural entries');
    sb = createSandbox(game, { headless: true, seed: 7, pierPays: false, storyData: story, seasonSeconds: 600 });
    if (sb.enemies) sb.enemies.enabled = false;
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };
    const until = (f, maxSec = 90) => { for (let i = 0; i < maxSec * 30 && !f(); i++) step(); return f(); };
    // only a fruit stall
    for (const s of sb.build.stalls()) if (s.id !== 'stall_fruit') { if (!sb.build.demolish(s.entry, { animate: false, refund: false })) throw new Error('could not demolish ' + s.id); }
    for (let i = 0; i < 30; i++) step();
    const ids = sb.build.stalls().map((s) => s.id); if (ids.join() !== 'stall_fruit') throw new Error('stalls after demolish = ' + ids.join());
    sb.cust.spawnWave(3, 0);   // season 3, no wave
    if (!until(() => sb.cust.active.length === 0, 150)) throw new Error('start wave never drained (' + sb.cust.active.length + ' active)');   // the sandbox's own first wave
    wants.length = 0; lefts.length = 0; barks.length = 0; sb.cust.totals.noStall = 0; sb._wantBarked?.clear?.(); sb.cust._wantBarked = new Set();
    // the customer pool reuses ids → only look at events emitted after the spawn (marker = array lengths)
    let mW = 0, mL = 0; const mark = () => { mW = wants.length; mL = lefts.length; };
    const wantOf = (c) => wants.slice(mW).find((w) => w.id === c.id);
    const leftOf = (c) => lefts.slice(mL).find((l) => l.id === c.id);
    // wantOf: pure top-PREFS
    if (sb.cust.wantOf({ type: 'elder' }) !== 'tea' || sb.cust.wantOf({ type: 'kid' }) !== 'toy' || sb.cust.wantOf({ type: 'regular' }) !== null) throw new Error('wantOf elder/kid/regular ≠ tea/toy/null');
    // elder → noStall
    mark(); const e1 = sb.cust.spawnType('elder'); if (!e1) throw new Error('spawnType elder → null');
    if (!until(() => wantOf(e1))) throw new Error('no cust:want for the elder');
    const w = wantOf(e1); if (w.type !== 'elder' || w.want !== 'tea' || w.found !== false || w.id !== e1.id) throw new Error('cust:want ≠ {elder, tea, found:false}: ' + JSON.stringify(w));
    const wb = barks.filter((b) => b.kind === 'want'); if (wb.length !== 1 || wb[0].icon !== 'stall_tea' || wb[0].ok !== false || typeof wb[0].anchor?.x !== 'number' || wb[0].ttl !== 1.2) throw new Error('want bubble ≠ {kind:want, icon:stall_tea, ok:false, ttl:1.2}: ' + JSON.stringify(wb[0]));
    if (!until(() => leftOf(e1))) throw new Error('elder never left');
    const L = leftOf(e1); if (!L.result?.noStall || L.want !== 'tea' || L.noStall !== true) throw new Error('cust:left ≠ noStall tea: ' + JSON.stringify(L));
    if (!(sb.cust.totals.noStall >= 1)) throw new Error('totals.noStall < 1 (' + JSON.stringify(sb.cust.totals) + ')');
    const owl = () => barks.filter((b) => b.kind === 'wants' && b.want === 'tea');
    if (owl().length !== 1 || owl()[0].speaker !== 'owl' || owl()[0].want !== 'tea' || /\{who\}|\{what\}/.test(owl()[0].text) || !owl()[0].text.includes('tea')) throw new Error('Owl wants bark ≠ 1 filled line: ' + JSON.stringify(owl()));
    const owlText = owl()[0].text;
    // 2nd elder same season → still 1 Owl bark
    mark(); const e2 = sb.cust.spawnType('elder'); if (!until(() => leftOf(e2))) throw new Error('2nd elder never left');
    if (owl().length !== 1) throw new Error(`2 elders in one season → ${owl().length} Owl barks ≠ 1`);
    const L2 = leftOf(e2); if (!L2.noStall) throw new Error('2nd elder not noStall: ' + JSON.stringify(L2));
    // saver → found
    mark(); const s1 = sb.cust.spawnType('saver');
    if (!until(() => wantOf(s1))) throw new Error('no cust:want for the saver');
    const ws = wantOf(s1); if (ws.type !== 'saver' || !['fruit', 'bread'].includes(ws.want) || ws.found !== true) throw new Error('saver cust:want ≠ {fruit|bread (tie → rng), found:true}: ' + JSON.stringify(ws));
    if (!until(() => leftOf(s1), 120)) throw new Error('saver never left');
    const Ls = leftOf(s1); if (Ls.noStall || Ls.result?.noStall) throw new Error('saver left noStall although fruit is placed');
    // regular → no want at all
    mark(); const r1 = sb.cust.spawnType('regular');
    if (!until(() => leftOf(r1), 120)) throw new Error('regular never left');
    if (wantOf(r1) || leftOf(r1).noStall) throw new Error('regular emitted cust:want / noStall');
    // next season → Owl once again
    bus.emit('eco:season', { season: 4 }); sb.cust.spawnWave(4, 0);
    mark(); const e3 = sb.cust.spawnType('elder'); if (!until(() => leftOf(e3))) throw new Error('S4 elder never left');
    if (owl().length !== 2) throw new Error(`next season elder → ${owl().length} Owl barks ≠ 2 · season=${sb.cust.season} barked=${[...(sb.cust._wantBarked || [])]} e3=${JSON.stringify(wantOf(e3))} all=${JSON.stringify(barks.filter((b) => b.kind === 'wants').map((b) => b.want))}`);
    // PREFS read site for 44C
    if (!PREFS.elder || PREFS.elder.tea !== 2.5) throw new Error('PREFS export changed');
    const n = wants.length, leaked0 = countListeners(bus);
    destroySandbox(sb); sb = null;
    const leaked = countListeners(bus) - base; if (leaked > 0) throw new Error(`${leaked} leaked listeners after destroy (${leaked0} before)`);
    console.log(`  S3 fruit-only: elder → cust:want tea found:false → want bubble stall_tea ✗ → left noStall · 2 elders → 1 Owl "${owlText}" · saver → fruit found:true buys · regular → no want · S4 → Owl again · ${n} wants · 0 leaks  OK`);
  } catch (err) { bad++; console.log('  wants FAIL →', err.message.split('\n')[0]); try { if (sb) destroySandbox(sb); } catch {} }
  return bad;
}
