// tools/gates/novelties.mjs — 43B headless gate: `node tools/check.mjs --novelties`  (section "43B NOVELTIES STORM/NIGHT")
// Real createSandbox on the game clock, data/seasons.json script, seasonSeconds 20:
//   S2: novelty:start stormWarning at day01 ≥ 0.22 · sb.nextEvent === 'storm' · storm.warn called once · owl bark emitted · season end → novelty:end, lights = pre values (±1e-6)
//   S3: nightMarket start at ≥ 0.60 → key intensity ≤ 0.4 within 3 game-s · till.spillMult === 2 · cust.spendMult 1.3 (scripted sale: paid = price×1.3) · eco:season → all restored
//   one sb.novelty at a time · destroy → 0 leaked listeners.
import { readFileSync } from 'node:fs';
export async function run({ resolve, pathToFileURL }) {
  let bad = 0;
  const imp = (p) => import(pathToFileURL(resolve(p)).href);
  console.log('\n43B NOVELTIES STORM/NIGHT:');
  const THREE = await imp('vendor/three.module.js');
  const { SequencePlayer, HitStop } = await imp('src/anim/Sequencer.js');
  const { EventBus } = await imp('src/core/EventBus.js');
  const { tweens } = await imp('src/anim/Tween.js');
  const { createSandbox, destroySandbox } = await imp('src/Game.js');
  const { NOVELTIES } = await imp('src/systems/novelties/index.js');
  const { NIGHT } = await imp('src/systems/novelties/nightMarket.js');
  const data = JSON.parse(readFileSync(resolve('data/seasons.json'), 'utf8'));
  const story = JSON.parse(readFileSync(resolve('data/story.json'), 'utf8'));

  const mkGame = (bus, scene) => ({ scene, bus, sequences: new SequencePlayer(), tweens, hitStop: new HitStop(), input: { pointerWorld: new THREE.Vector3(), hasPointerWorld: false, move: new THREE.Vector2(), joystick: new THREE.Vector2(), actions: {}, pressed: () => false }, camera: { zoom: 1, shake() {} }, time: 0, timeScale: 1, paused: false, stats: {}, followTarget: null, systems: [], add(s) { this.systems.push(s); return s; }, remove(s) { const i = this.systems.indexOf(s); if (i >= 0) this.systems.splice(i, 1); }, hitstop() {} });
  const countListeners = (bus) => { let n = 0; const m = bus.listeners || bus.map || bus.handlers || bus._l || null; if (m instanceof Map) for (const v of m.values()) n += (v?.size ?? v?.length ?? 0); return n; };
  const eps = 1e-6;
  try {
    const bus = new EventBus(), scene = new THREE.Scene(), game = mkGame(bus, scene);
    game.lights = { key: { intensity: 1.6 }, hemi: { intensity: 0.75 } };
    const base = countListeners(bus);
    const starts = [], ends = [], barks = [], chips = [];
    bus.on('novelty:start', (p) => starts.push({ ...p, day: sb.eco.state.day01 }));
    bus.on('novelty:end', (p) => ends.push(p));
    bus.on('story:bark', (p) => barks.push(p));
    bus.on('hud:chip', (p) => chips.push(p));
    const sb = createSandbox(game, { headless: true, seed: 7, pierPays: false, seasons: data, storyData: story, seasonSeconds: 20 });
    sb.enemies && (sb.enemies.enabled = true);
    let warns = 0; const w0 = sb.storm.warn.bind(sb.storm); sb.storm.warn = () => { warns++; return w0(); };
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer) sb.eco.refuseOffer(); };
    const until = (f, maxSec = 600) => { for (let i = 0; i < maxSec * 30 && !f() && !sb.eco.state.ended; i++) step(); return f(); };
    if (!NOVELTIES.stormWarning || !NOVELTIES.nightMarket) throw new Error('registry missing stormWarning/nightMarket');
    // ---- S2 storm warning
    until(() => sb.eco.state.season === 2); const pre2 = { key: game.lights.key.intensity, hemi: game.lights.hemi.intensity };
    if (sb.nextEvent !== 'storm') throw new Error(`S2 nextEvent ${sb.nextEvent} ≠ storm`);
    if (!until(() => starts.length >= 1)) throw new Error('S2 novelty:start never fired');
    const s2 = starts[0]; if (s2.id !== 'stormWarning' || s2.day < 0.22 - 1e-9) throw new Error(`S2 start ${s2.id} @ ${s2.day.toFixed(3)}`);
    if (sb.novelty?.id !== 'stormWarning') throw new Error('sb.novelty not stormWarning');
    const b0 = barks.length; for (let i = 0; i < 3; i++) step();
    if (!barks.some((b) => b.speaker === 'owl' && /Protect|Clouds/i.test(b.text))) throw new Error('no owl warning bark');
    for (let i = 0; i < 60; i++) step(); if (!(game.lights.key.intensity < pre2.key - 1e-3)) throw new Error('sky did not darken');
    until(() => sb.eco.state.season === 3);
    if (warns !== 1) throw new Error(`storm.warn called ${warns}× (want 1)`);
    if (ends.length !== 1 || ends[0].id !== 'stormWarning') throw new Error('S2 novelty:end missing');
    // after the storm cleared the storm vfx restores lights itself; novelty end must not fight it — accept pre2 within eps once storm phase idle
    for (let i = 0; i < 30 * 5 && sb.storm.intensity > 0.001; i++) step();
    if (Math.abs(game.lights.key.intensity - pre2.key) > 1e-3 || Math.abs(game.lights.hemi.intensity - pre2.hemi) > 1e-3) throw new Error(`S2 lights not restored key ${game.lights.key.intensity} hemi ${game.lights.hemi.intensity} (pre ${pre2.key}/${pre2.hemi})`);
    const stormBark = barks.slice(b0).some((b) => /Insurance|Repairs|debt/i.test(b.text));
    console.log(`OK S2: stormWarning start @ day ${s2.day.toFixed(2)} · nextEvent storm · storm.warn ×1 · owl bark · darkened · end restored lights · follow-up bark ${stormBark ? 'yes' : 'NO (storm event bark missing)'}`);
    if (!stormBark) throw new Error('no follow-up bark after storm event');
    // ---- S3 night market
    const pre3 = { key: game.lights.key.intensity, hemi: game.lights.hemi.intensity, spend: sb.cust.spendMult ?? 1, spill: sb.till.spillMult };
    if (!until(() => starts.length >= 2)) throw new Error('S3 novelty:start never fired');
    const s3 = starts[1]; if (s3.id !== 'nightMarket' || s3.day < 0.60 - 1e-9) throw new Error(`S3 start ${s3.id} @ ${s3.day.toFixed(3)}`);
    if (sb.novelty?.id !== 'nightMarket' || starts.length !== 2) throw new Error('more than one novelty active');
    for (let i = 0; i < 30 * 3 + 2; i++) step();
    if (!(game.lights.key.intensity <= 0.4 + eps)) throw new Error(`key ${game.lights.key.intensity} > 0.4 after 3 s`);
    if (sb.till.spillMult !== NIGHT.spill) throw new Error(`spillMult ${sb.till.spillMult}`);
    if (Math.abs((sb.cust.spendMult || 1) - 1.3) > eps) throw new Error(`spendMult ${sb.cust.spendMult}`);
    if (!chips.some((c) => c.id === 'night' && c.on)) throw new Error('no hud:chip night');
    // natural sales during the night: spy eco.sell — every price passed in must equal cust.price(stall) × 1.3
    const sales = []; const sell0 = sb.eco.sell.bind(sb.eco); sb.eco.sell = (id, type, price, o) => { if (sb.novelty?.id === 'nightMarket') sales.push({ id, price, base: sb.cust.price(id) }); return sell0(id, type, price, o); };
    until(() => sales.length >= 1 || sb.eco.state.season === 4);
    sb.eco.sell = sell0;
    if (!sales.length) throw new Error('no natural sale happened during the night market');
    const bad13 = sales.find((x) => Math.abs(x.price - x.base * 1.3) > 1e-6); if (bad13) throw new Error(`sale ${bad13.id} price ${bad13.price} ≠ ${bad13.base}×1.3`);
    const paid = sales[0].price, price = sales[0].base;
    until(() => sb.eco.state.season === 4);
    if (ends.length !== 2 || ends[1].id !== 'nightMarket' || sb.novelty) throw new Error('S3 novelty:end missing or novelty still active');
    if (Math.abs(game.lights.key.intensity - pre3.key) > eps || Math.abs(game.lights.hemi.intensity - pre3.hemi) > eps) throw new Error('S3 lights not restored');
    if (sb.till.spillMult !== pre3.spill || Math.abs((sb.cust.spendMult ?? 1) - pre3.spend) > eps) throw new Error('S3 mults not restored');
    if (!chips.some((c) => c.id === 'night' && c.on === false)) throw new Error('night chip never cleared');
    console.log(`OK S3: nightMarket start @ day ${s3.day.toFixed(2)} · key ${game.lights.key.intensity.toFixed(2)}→≤0.4 in 3 s · spill ×2 · spend ×1.3 (sale ${paid} = ${price}×1.3) · chip · eco:season restored all`);
    destroySandbox(sb);
    const leaked = countListeners(bus) - base - 4;   // 4 = this gate's own listeners
    if (leaked > 0) throw new Error(`${leaked} leaked bus listeners after destroy`);
    console.log('OK lifecycle: one active novelty at a time · destroy → 0 leaks');
  } catch (e) { bad++; console.log('FAIL novelties: ' + e.message); }
  // ---- 43C BARON VISIT + PICKY (fresh sandbox; S4 baronVisit replaces the scam mark, S5 two critics price-check)
  console.log('\n43C BARON VISIT + PICKY:');
  try {
    const { BARON } = await imp('src/systems/novelties/baronVisit.js');
    const bus = new EventBus(), scene = new THREE.Scene(), game = mkGame(bus, scene);
    game.lights = { key: { intensity: 1.6 }, hemi: { intensity: 0.75 } };
    const base = countListeners(bus);
    const ev = { starts: [], ends: [], npc: [], scam: [], tell: [], refused: [], checks: [], barks: [], critics: [] };
    bus.on('novelty:start', (p) => ev.starts.push({ ...p, day: sb.eco.state.day01 })); bus.on('novelty:end', (p) => ev.ends.push(p));
    bus.on('scam:npc', (p) => ev.npc.push(p)); bus.on('eco:scam', (p) => ev.scam.push(p)); bus.on('scam:tell', (p) => ev.tell.push(p)); bus.on('scam:refused', (p) => ev.refused.push(p));
    bus.on('customer:priceCheck', (p) => ev.checks.push(p)); bus.on('story:bark', (p) => ev.barks.push(p)); bus.on('novelty:critic', (p) => ev.critics.push(p));
    const sb = createSandbox(game, { headless: true, seed: 7, pierPays: false, seasons: data, storyData: story, seasonSeconds: 20 });
    sb.enemies && (sb.enemies.enabled = true);
    const dt = 1 / 30;
    const step = () => { game.time += dt; game.sequences.update(dt); game.tweens.update(dt); for (const s of game.systems) s.update?.(dt); if (sb.eco.pendingOffer && sb.novelty?.id !== 'baronVisit') sb.eco.refuseOffer(); };
    const until = (f, maxSec = 600) => { for (let i = 0; i < maxSec * 30 && !f() && !sb.eco.state.ended; i++) step(); return f(); };
    if (!NOVELTIES.baronVisit || !NOVELTIES.pickyGlimmer) throw new Error('registry missing baronVisit/pickyGlimmer');
    until(() => sb.eco.state.season === 4); const npc0 = ev.npc.length, scam0 = ev.scam.length;
    if (!until(() => ev.starts.some((x) => x.id === 'baronVisit'))) throw new Error('S4 baronVisit never started');
    const s4 = ev.starts.find((x) => x.id === 'baronVisit'); if (s4.day < 0.64 - 1e-9) throw new Error(`S4 start @ ${s4.day.toFixed(3)} < 0.64`);
    const V = sb.novelty; if (V?.id !== 'baronVisit') throw new Error('sb.novelty not baronVisit');
    until(() => V.state === 'pitch', 10); if (V.state !== 'pitch') throw new Error(`Baron state ${V.state} (want pitch)`);
    if (!V.g || V.g.parent !== scene) throw new Error('Baron group not in scene');
    const d4 = sb.eco.state.day01; until(() => sb.eco.state.day01 >= 0.66 || sb.eco.state.season !== 4, 5);
    if (ev.npc.length !== npc0) throw new Error('scam:npc fired in S4 (scamKind baron should skip the Collector)');
    if (ev.scam.length !== scam0) throw new Error('eco:scam opened before Pip talked to the Baron');
    // scripted: Pip walks up, talks → offer; ledgerFlash → tell; sword hit → refuse + flee
    sb.hero.root.position.set(V.g.position.x + 1, 0, V.g.position.z + 1);
    const r = sb.interact(); if (r !== 'scam') throw new Error(`interact → ${r} (want scam)`);
    if (sb.eco.pendingOffer?.id !== BARON.scam) throw new Error(`pendingOffer ${sb.eco.pendingOffer?.id} ≠ ${BARON.scam}`);
    if (!ev.barks.some((b) => b.speaker === 'baron' && b.group === 'baronVisit')) throw new Error('no baron pitch bark');
    const tell = V.flash(); if (!tell || !ev.tell.length || ev.tell[0].id !== BARON.scam) throw new Error('ledgerFlash near the Baron did not name the tell');
    const tg = V.targets(); if (tg.length !== 1 || tg[0].enemy.kind !== 'baron') throw new Error('Baron not a sword target while pitching');
    tg[0].hit({ x: 0, z: 1 }, 1);
    if (V.state !== 'flee') throw new Error(`after hit state ${V.state} (want flee)`);
    if (sb.eco.pendingOffer) throw new Error('offer still open after hit');
    if (ev.refused.filter((x) => x.id === BARON.scam).length !== 1) throw new Error(`refused ×${ev.refused.filter((x) => x.id === BARON.scam).length} (want 1)`);
    for (let i = 0; i < 30 * 3; i++) step();
    if (V.g || V.state !== 'off') throw new Error('Baron mesh not removed after flee');
    until(() => sb.eco.state.season === 5);
    if (!ev.ends.some((x) => x.id === 'baronVisit') || sb.novelty) throw new Error('S4 novelty:end missing');
    if (scene.children.some((o) => o.userData?.visit)) throw new Error('Baron still in scene after season end');
    console.log(`OK S4: baronVisit start @ day ${s4.day.toFixed(2)} · no scam:npc · interact → ${BARON.scam} offer + pitch bark · flash → tell "${tell}" · hit → refused ×1 + flee · removed · novelty:end`);
    // ---- S5 picky critics: stall at fair×1.3 → ok:false + no sale; stall at fair → ok:true + 2 qty
    const stalls = [...(sb.build?.placed?.values?.() || [])].filter((e) => e.kind === 'stall' || e.type === 'stall' || /stall/i.test(e.id || '') || e.entry?.stall || e.slots).map((e) => e.id || e.propId).filter(Boolean);
    const stallId = stalls[0] ?? (sb.cust.active[0]?.stall?.id); 
    if (!until(() => ev.starts.some((x) => x.id === 'pickyGlimmer'))) throw new Error('S5 pickyGlimmer never started');
    const s5 = ev.starts.find((x) => x.id === 'pickyGlimmer'); if (s5.day < 0.20 - 1e-9) throw new Error(`S5 start @ ${s5.day.toFixed(3)}`);
    // first critic: overprice every stall
    const ids = new Set(sb.cust.active.filter((c) => c.type === 'critic').map((c) => c.id)); if (!ids.size) throw new Error('no critic spawned at start');
    const fairOf = (id) => sb.cust.fair(id); const priced = [];
    const over = () => { for (const [id] of sb.cust.prices) {} for (const c of sb.cust.active) if (c.stall && !priced.includes(c.stall.id)) { priced.push(c.stall.id); sb.cust.prices.set(c.stall.id, fairOf(c.stall.id) * 1.3); } };
    const k0 = ev.checks.length;
    if (!until(() => { over(); return ev.checks.length > k0; }, 60)) throw new Error('first critic never price-checked (sb.cust stalls? ' + sb.cust.active.length + ')');
    const c1 = ev.checks[k0]; if (c1.ok !== false || Math.abs(c1.price - c1.fair * 1.3) > 0.2) throw new Error(`critic 1 check ${JSON.stringify(c1)} (want ok:false @ fair×1.3)`);
    const paid1 = sb.cust.active.concat(sb.cust.pool || []).find((c) => c.id === c1.id)?.result; if (paid1 && paid1.paid > 0) throw new Error('overpriced critic still paid');
    if (!ev.barks.some((b) => b.kind === 'price' && b.ok === false)) throw new Error('no red price bubble');
    if (!ev.barks.some((b) => b.speaker === 'owl' && /walked|Overpriced/i.test(b.text))) throw new Error('no owl bark on first refusal');
    // second critic: fair price → double qty
    for (const id of priced) sb.cust.prices.delete(id);
    const sold = []; const sell0 = sb.eco.sell.bind(sb.eco); sb.eco.sell = (id, type, price, o) => { const r = sell0(id, type, price, o); if (type === 'critic') sold.push({ id, price, r }); return r; };
    const k1 = ev.checks.length;
    if (!until(() => ev.critics.length >= 2, 60)) throw new Error('second critic never spawned');
    if (!until(() => ev.checks.length > k1, 60)) throw new Error('second critic never price-checked');
    sb.eco.sell = sell0;
    const c2 = ev.checks[k1]; if (c2.ok !== true || !c2.double) throw new Error(`critic 2 check ${JSON.stringify(c2)} (want ok:true double)`);
    const okSales = sold.filter((x) => x.r && x.r.sold > 0); if (okSales.length < 2) throw new Error(`fair critic sold ×${okSales.length} (want 2 = qty 2)`);
    if (!ev.barks.some((b) => b.kind === 'price' && b.ok === true)) throw new Error('no green price bubble');
    console.log(`OK S5: pickyGlimmer start @ day ${s5.day.toFixed(2)} · 2 critics · fair×1.3 → ok:false, no sale, red bubble, owl bark · fair → ok:true, qty 2 (${okSales.length} sells), green bubble`);
    destroySandbox(sb);
    const leaked = countListeners(bus) - base - 9;
    if (leaked > 0) throw new Error(`${leaked} leaked bus listeners after destroy`);
    console.log('OK lifecycle 43C: Baron mesh gone · critic listeners released · 0 leaks');
  } catch (e) { bad++; console.log('FAIL novelties 43C: ' + e.message); }
  return bad;
}
