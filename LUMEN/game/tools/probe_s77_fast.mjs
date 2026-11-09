// S77-A fast probe: virtual-time customers (cust.update(dt) loop), per stall kind: picks, paid, and WHY customers left unpaid.  node tools/probe_s77_fast.mjs [waves=10] [season=6] [seed]
import { launch, startStory } from './rig76.mjs';
const WAVES = +process.argv[2] || 10, SEASON = +process.argv[3] || 6; const ONLY = (process.argv[4] || '').split(',').filter(Boolean);   // 4th arg e.g. fruit,bread,tea,flower = keep only those stalls
const { p, b, errs } = await launch(844, 390); await startStory(p);
const r = await p.evaluate(({ WAVES, SEASON, ONLY }) => {
  const sb = lg.sb, B = sb.build, C = sb.cust; sb.eco.earn(99999, 'probe');
  const kinds = ['fruit','bread','lantern','fish','flower','tool','cloth','pottery','toy','tea','book','sparkExchange'].filter((k) => !ONLY.length || ONLY.includes(k));
  const spots = []; for (let x = -9; x <= 9; x += 3) for (let z = -9; z <= 9; z += 3) spots.push([x, z]);
  for (const k of kinds) { const id = 'stall_' + k; if (B.owned?.(id)) continue; for (const [x, z] of spots) { if (B.canPlace(id, x, z, 0)) { if (B.place(id, x, z, 0, { animate: false, pay: false, silent: true })) break; } } }
  if (ONLY.length) for (const e of [...B.placed.values()]) if (e.category === 'stall' && !ONLY.includes(e.id.replace(/^stall_/, ''))) B.remove?.(e);
  if (sb.eco?.state) sb.eco.state.season = SEASON; C.season = SEASON;
  const S = {}; const k = (id) => String(id).replace(/^stall_/, ''); const row = (x) => (S[x] = S[x] || { pick: 0, paid: 0, why: {} });
  const orig = C.pickStall.bind(C); C.pickStall = (c) => { const s = orig(c); if (s) row(k(s.id)).pick++; return s; };
  lg.bus.on('cust:paid', (q) => row(k(q.stallId)).paid++);
  const origR = C._react.bind(C); C._react = (c, reaction, why) => { const kk = c.stall ? k(c.stall.id) : '(none)'; const w = row(kk).why; w[why] = (w[why] || 0) + 1; return origR(c, reaction, why); };
  const dt = 0.1; let t = 0;
  for (let w = 0; w < WAVES; w++) { C.spawnWave(SEASON); for (let i = 0; i < 1500; i++) { C.update(dt); t += dt; if (!C.active.length && !C.pendingSpawns.length) break; } }
  return { S, totals: C.totals, simT: Math.round(t) };
}, { WAVES, SEASON, ONLY });
console.log('totals', JSON.stringify(r.totals), 'simT', r.simT);
for (const [kk, v] of Object.entries(r.S)) console.log(kk.padEnd(14), 'pick', String(v.pick).padStart(3), 'paid', String(v.paid).padStart(3), JSON.stringify(v.why));
console.log('errs', errs.slice(0, 3)); await b.close();
