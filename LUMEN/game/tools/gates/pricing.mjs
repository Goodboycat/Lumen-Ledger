// tools/gates/pricing.mjs — 44A headless gate: `node tools/check.mjs --pricing`  (section "44A READABLE PRICING")
// Real createSandbox (headless, seed 7, starter stalls):
//   S2 wave, every stall at fair×0.8 → first settle emits cust:react glyph:'love' and (every 2nd non-critic) a bark kind:'price' whose text starts "♥"
//   every stall at fair×1.5 → cust:react glyph:'bad', bark text starts "✗", sign tint 'red'; 3× cust:angry at one stall → exactly 1 Owl barks.pricing bark, a 4th → still 1; eco:season resets
//   S1 wave → 0 price barks · ui:price +1 ×3 → cust.price +3 and sign tint 'amber' once ratio > 1.1 · sb.signNear/interact/interactRelease → ui:price ±1 · destroy → 0 leaked listeners.
import { readFileSync } from 'node:fs';
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\n44A READABLE PRICING:');
  const THREE = await imp('vendor/three.module.js');
  const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
  const { EventBus } = await imp('src/core/EventBus.js');
  const { tweens } = await imp('src/anim/Tween.js');
  const { createSandbox, destroySandbox } = await imp('src/Game.js');
  const story = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));
  const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, stats: {}, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, remove(s) { const i = this.systems.indexOf(s); if (i >= 0) this.systems.splice(i, 1); }, hitstop() {} });
  const countListeners = (bus) => { let n = 0; const m = bus.listeners || bus.map || bus.handlers || bus._l || null; if (m instanceof Map) for (const v of m.values()) n += (v?.size ?? v?.length ?? 0); return n; };
  const mk = () => {
    const bus = new EventBus(), scene = new THREE.Scene(), game = mkGame(bus, scene);
    const reacts = [], barks = [], prices = [];
    bus.on('cust:react', (p) => reacts.push(p)); bus.on('story:bark', (p) => barks.push(p)); bus.on('cust:price', (p) => prices.push(p));
    const base = countListeners(bus);   // after the gate's own 3 spies
    const sb = createSandbox(game, { headless: true, seed: 7, pierPays: false, storyData: story, seasonSeconds: 600 });
    if (sb.enemies) sb.enemies.enabled = false;
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };
    const until = (f, maxSec = 120) => { for (let i = 0; i < maxSec * 30 && !f() && !sb.eco.state.ended; i++) step(); return f(); };
    const stalls = () => sb.build.stalls().map((s) => s.id);
    const setAll = (mult) => { for (const id of stalls()) sb.cust.setPrice(id, Math.max(1, Math.round(sb.cust.fair(id) * mult))); };
    return { bus, game, sb, base, reacts, barks, prices, step, until, stalls, setAll };
  };
  const priceBarks = (barks) => barks.filter((b) => b.kind === 'price' && b.speaker !== 'critic');
  const owlBarks = (barks) => barks.filter((b) => b.kind === 'pricing');
  // ---- S2 love
  let T = mk();
  try {
    const { sb, reacts, barks, until, stalls, setAll } = T;
    if (!stalls().length) throw new Error('no starter stalls');
    setAll(0.8); sb.cust.spawnWave(2, 8);
    if (!until(() => reacts.length >= 2)) throw new Error('no cust:react in S2 at ×0.8');
    if (!reacts.every((r) => r.glyph === 'love' && r.ratio <= 0.9 && r.id && r.stallId)) throw new Error('cust:react glyph ≠ love @ ×0.8: ' + JSON.stringify(reacts.slice(0, 2)));
    const pb = priceBarks(barks); if (pb.length < 1) throw new Error('no price bubble in S2 (every 2nd non-critic)');
    if (!pb.every((b) => b.glyph === 'love' && b.text.startsWith('♥') && b.anchor && typeof b.anchor.x === 'number')) throw new Error('bubble text ≠ "♥ N": ' + JSON.stringify(pb[0]));
    if (pb.length > Math.ceil(reacts.length / 2)) throw new Error(`rate limit broken: ${pb.length} bubbles for ${reacts.length} reacts`);
    for (const id of stalls()) { const t = sb.signTint(id); if (!t || t.tint !== 'green') throw new Error(`sign tint @ ×0.8 ${id} = ${t && t.tint} ≠ green`); if (sb.build.owned(id).group.userData.slots.sign.userData.priceTint !== 'green') throw new Error('sign.userData.priceTint not set'); }
    console.log(`  S2 ×0.8: ${reacts.length} cust:react glyph love · ${pb.length} "${pb[0].text}" bubbles (≤ 1 per 2) · signs green  OK`);
    // ---- ×1.5 bad + 3-angry Owl bark
    const r0 = reacts.length, b0 = priceBarks(barks).length;
    setAll(1.5); sb.cust.spawnWave(2, 8);
    if (!until(() => reacts.length >= r0 + 2)) throw new Error('no settle at ×1.5');
    const late = reacts.slice(r0); if (!late.every((r) => r.glyph === 'bad')) throw new Error('glyph ≠ bad @ ×1.5: ' + JSON.stringify(late.slice(0, 2)));
    const pb2 = priceBarks(barks).slice(b0); if (!pb2.length || !pb2.every((b) => b.glyph === 'bad' && b.text.startsWith('✗'))) throw new Error('✗ bubble missing @ ×1.5: ' + JSON.stringify(pb2[0]));
    const sid = stalls()[0]; if (sb.signTint(sid).tint !== 'red') throw new Error('sign tint @ ×1.5 ≠ red');
    const ob0 = owlBarks(barks).length; sb._angryAt.clear();
    for (let i = 0; i < 2; i++) T.bus.emit('cust:angry', { id: 'x' + i, type: 'regular', why: 'paid', stallId: sid });
    if (owlBarks(barks).length !== ob0) throw new Error('Owl barked before the 3rd angry');
    T.bus.emit('cust:angry', { id: 'x2', type: 'regular', why: 'paid', stallId: sid });
    const ob = owlBarks(barks); if (ob.length !== ob0 + 1) throw new Error(`3 angry → ${ob.length - ob0} Owl barks ≠ 1`);
    if (ob[ob.length - 1].speaker !== 'owl' || ob[ob.length - 1].text !== story.barks.pricing[0].text) throw new Error('Owl bark text ≠ barks.pricing[0]');
    T.bus.emit('cust:angry', { id: 'x3', type: 'regular', why: 'paid', stallId: sid });
    if (owlBarks(barks).length !== ob0 + 1) throw new Error('4th angry → a 2nd Owl bark (must be once per stall per season)');
    T.bus.emit('eco:season', { season: 3 }); if (sb._angryAt.size !== 0) throw new Error('eco:season did not reset the angry count');
    if (!story.barks.pricing || story.barks.pricing.length < 3 || !story.barks.pricing.every((b) => (b.text || b).length <= 60)) throw new Error('story.json barks.pricing needs 3 lines ≤ 60 chars');
    console.log(`  S2 ×1.5: glyph bad · "${pb2[0].text}" · sign red · 3 angry → 1 Owl bark, 4th → still 1, eco:season resets · 3 pricing lines  OK`);
  } catch (err) { bad++; console.log('  pricing S2 FAIL →', err.message.split('\n')[0]); }
  // ---- S1 silence + ui:price / E on sign + leaks
  try {
    destroySandbox(T.sb); T = mk();
    const { sb, bus, game, reacts, barks, prices, until, stalls, step } = T;
    sb.cust.spawnWave(1, 8);
    if (!until(() => reacts.length >= 3)) throw new Error('no settle in S1');
    if (priceBarks(barks).length !== 0) throw new Error(`S1 → ${priceBarks(barks).length} price barks ≠ 0`);
    const id = stalls()[0], fair = sb.cust.fair(id); sb.cust.setPrice(id, Math.round(fair)); sb.signTint(id);
    const p0 = sb.cust.price(id); for (let i = 0; i < 3; i++) bus.emit('ui:price', { id, delta: +1 });
    if (sb.cust.price(id) !== p0 + 3) throw new Error(`ui:price +1 ×3 → ${sb.cust.price(id)} ≠ ${p0 + 3}`);
    if (prices.length !== 3) throw new Error(`cust:price emitted ${prices.length} ≠ 3`);
    const tint = sb.build.owned(id).group.userData.slots.sign.userData.priceTint, ratio = sb.cust.price(id) / fair;
    if (ratio > 1.1 && ratio <= 1.4 && tint !== 'amber') throw new Error(`ratio ${ratio.toFixed(2)} → tint ${tint} ≠ amber`);
    if (ratio > 1.4 && tint !== 'red') throw new Error(`ratio ${ratio.toFixed(2)} → tint ${tint} ≠ red`);
    // E at the sign: stand under it → interact → release quickly = +1 · hold 0.5 s = −1
    const sign = sb.build.owned(id).group.userData.slots.sign, wp = new THREE.Vector3(); sign.getWorldPosition(wp);
    sb.hero.root.position.set(wp.x + 0.3, 0, wp.z); sb.hero.root.updateMatrixWorld?.(true);
    if (sb.signNear() !== id) throw new Error(`signNear at the sign → ${sb.signNear()} ≠ ${id}`);
    const pA = sb.cust.price(id); const r1 = sb.interact(); if (r1 !== 'sign') throw new Error(`interact at sign → ${r1} ≠ 'sign'`);
    sb.interactRelease(); if (sb.cust.price(id) !== pA + 1) throw new Error('tap E at sign → price did not +1');
    sb.interact(); for (let i = 0; i < 18; i++) step(); sb.interactRelease();
    if (sb.cust.price(id) !== pA) throw new Error(`hold E 0.6 s at sign → ${sb.cust.price(id)} ≠ ${pA} (−1)`);
    sb.hero.root.position.set(wp.x + 4, 0, wp.z + 4); if (sb.signNear() !== null) throw new Error('signNear 5.6 u away ≠ null');
    const drawBefore = game.scene.children.length; sb.signTint(id); if (game.scene.children.length !== drawBefore) throw new Error('signTint added scene objects');
    destroySandbox(sb); const leaked = countListeners(bus) - T.base;
    if (leaked > 0) throw new Error(`${leaked} leaked listeners after destroy`);
    console.log(`  S1: 0 price barks · ui:price +1 ×3 → ${p0}→${p0 + 3} (ratio ${ratio.toFixed(2)} tint ${tint}) · E at sign tap +1 / hold −1 · signNear null far away · 0 new scene objects · 0 leaks  OK`);
  } catch (err) { bad++; console.log('  pricing S1/ui FAIL →', err.message.split('\n')[0]); try { destroySandbox(T.sb); } catch {} }
  return bad;
}
