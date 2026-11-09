// S77-A probe: build all 12 stall types, run N customer waves, count picks / sales / walk-aways per stall type.  node tools/probe_s77_visits.mjs [waves=8] [season=6]
import { launch, startStory } from './rig76.mjs';
const WAVES = +process.argv[2] || 8, SEASON = +process.argv[3] || 6;
const { p, b, errs } = await launch(844, 390, 'season=30'); await startStory(p);
const info = await p.evaluate(({ SEASON }) => {
  const sb = lg.sb, B = sb.build; const kinds = ['fruit','bread','lantern','fish','flower','tool','cloth','pottery','toy','tea','book','sparkExchange'];
  sb.eco.earn(99999, 'probe');
  for (const e of [...B.placed.values()]) if (e.category === 'stall') { try { B.remove?.(e); } catch {} }
  const placed = [], failed = [];
  const spots = []; for (let x = -9; x <= 9; x += 3) for (let z = -9; z <= 9; z += 3) spots.push([x, z]);
  for (const k of kinds) {
    const id = 'stall_' + k; let ok = null;
    if (B.owned?.(id)) { placed.push(k + '(had)'); continue; }
    for (const [x, z] of spots) { if (B.canPlace(id, x, z, 0)) { ok = B.place(id, x, z, 0, { animate: false, pay: false, silent: true }); if (ok) break; } }
    (ok ? placed : failed).push(k);
  }
  const C = sb.cust; window.__pick = {}; window.__paid = {}; window.__left = { noStall: 0, other: 0 }; window.__want = {};
  const orig = C.pickStall.bind(C); C.pickStall = (c) => { const s = orig(c); if (s) { const k = String(s.id).replace(/^stall_/, ''); window.__pick[k] = (window.__pick[k] || 0) + 1; } return s; };
  lg.bus.on('cust:paid', (q) => { const k = String(q.stallId).replace(/^stall_/, ''); window.__paid[k] = (window.__paid[k] || 0) + 1; });
  lg.bus.on('cust:left', (q) => { q.noStall ? window.__left.noStall++ : window.__left.other++; });
  C.season = SEASON; if (sb.eco?.state) sb.eco.state.season = SEASON;
  return { placed, failed, stalls: B.stalls().map((s) => s.id + '@' + s.group.position.x.toFixed(1) + ',' + s.group.position.z.toFixed(1)) };
}, { SEASON });
console.log(JSON.stringify(info));
for (let w = 0; w < WAVES; w++) {
  await p.evaluate((S) => { lg.sb.cust.spawnWave(S); }, SEASON);
  for (let i = 0; i < 40; i++) { await p.waitForTimeout(500); if (await p.evaluate(() => ui.dialogue.isOpen)) await p.evaluate(() => { ui.dialogue.skip?.(); ui.dialogue.advance?.(); }); if (await p.evaluate(() => lg.sb.cust.active.length === 0 && lg.sb.cust.pendingSpawns.length === 0)) break; }
}
const r = await p.evaluate(() => ({ pick: window.__pick, paid: window.__paid, left: window.__left, totals: lg.sb.cust.totals }));
console.log(JSON.stringify(r));
const kinds = ['fruit','bread','lantern','fish','flower','tool','cloth','pottery','toy','tea','book','sparkExchange'];
console.log('KIND'.padEnd(14), 'picks', 'paid'); for (const k of kinds) console.log(k.padEnd(14), String(r.pick[k] || 0).padStart(5), String(r.paid[k] || 0).padStart(5), (r.pick[k] || 0) === 0 ? '  <-- NEVER PICKED' : ((r.paid[k] || 0) === 0 ? '  <-- picked but never paid' : ''));
console.log('errs', errs.slice(0, 5)); await b.close();
