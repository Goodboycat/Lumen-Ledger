// S80-A2: why do fruit/tea get many picks but few resolutions?  node tools/probe_s80_fruit.mjs [waves=10] [season=6]
import { launch, startStory } from './rig76.mjs';
const WAVES = +process.argv[2] || 10, SEASON = +process.argv[3] || 6;
const { p, b, errs } = await launch(844, 390); await startStory(p);
const r = await p.evaluate(({ WAVES, SEASON }) => {
  const sb = lg.sb, B = sb.build, C = sb.cust; sb.eco.earn(99999, 'probe');
  const kinds = ['fruit','bread','lantern','fish','flower','tool','cloth','pottery','toy','tea','book','sparkExchange'];
  const spots = []; for (let x = -9; x <= 9; x += 3) for (let z = -9; z <= 9; z += 3) spots.push([x, z]);
  for (const k of kinds) { const id = 'stall_' + k; if (B.owned?.(id)) continue; for (const [x, z] of spots) { if (B.canPlace(id, x, z, 0)) { if (B.place(id, x, z, 0, { animate: false, pay: false, silent: true })) break; } } }
  C.reroute();   // S80: silent placement emits no build:placed -> flow field + _usableSlots caches were stale (the real cause of the fruit 'stuck' picks)
  if (sb.eco?.state) sb.eco.state.season = SEASON; C.season = SEASON;
  const k = (id) => String(id).replace(/^stall_/, ''); const S = {}; const row = (x) => (S[x] = S[x] || { first: 0, re: 0, resolved: 0, why: {}, blockedAfterPick: 0, unresolvedEnd: 0 });
  const oSp = C.spawnOne.bind(C); C.spawnOne = (t) => { const c = oSp(t); if (c) { c._picked = false; c._lastK = null; } return c; };
  const oSet = C._set.bind(C); C._set = (c, st) => { if (st === 'pickStall' && c.state === 'walk' && c._lastK) row(c._lastK).stuckRepick = (row(c._lastK).stuckRepick || 0) + 1; return oSet(c, st); };
  const oJoin = C._join.bind(C); C._join = (c, s) => { c._lastK = k(s.id); return oJoin(c, s); };
  const orig = C.pickStall.bind(C); C.pickStall = (c) => { const s = orig(c); if (s) { const r = row(k(s.id)); if (c._picked) r.re++; else r.first++; c._picked = true; } return s; };
  const origR = C._react.bind(C); C._react = (c, reaction, why) => { const kk = c.stall ? k(c.stall.id) : '(none)'; const w = row(kk).why; w[why] = (w[why] || 0) + 1; if (c.stall) row(kk).resolved++; return origR(c, reaction, why); };
  const dt = 0.1; let t = 0; const endActive = []; const stalls = C._stallList().map((s) => k(s.id) + '@' + s.group.position.x.toFixed(0) + ',' + s.group.position.z.toFixed(0) + ' usable=' + C._usableSlots(s).length);
  for (let w = 0; w < WAVES; w++) { C.spawnWave(SEASON); let i = 0; for (; i < 6000; i++) { C.update(dt); t += dt; if (!C.active.length && !C.pendingSpawns.length) break; } endActive.push([i, C.active.length]); for (const c of C.active) { const kk = c.stall ? k(c.stall.id) : '(nostall)'; row(kk).unresolvedEnd++; (globalThis.__dump ??= []).push({ w, state: c.state, kind: kk, stuck: c.stuck, sc: c.stuckCount, x: +c.root.position.x.toFixed(1), z: +c.root.position.z.toFixed(1), tx: c.target.x, tz: c.target.z, waited: +c.waited.toFixed(1), slot: c.slot }); } }
  return { dump: globalThis.__dump, S, endActive, stalls, totals: C.totals };
}, { WAVES, SEASON });
console.log('totals', JSON.stringify(r.totals)); console.log('stalls', r.stalls.join(' | ')); console.log('waves[steps,active]', JSON.stringify(r.endActive));
for (const [kk, v] of Object.entries(r.S)) console.log(kk.padEnd(14), 'first', String(v.first).padStart(3), 're', String(v.re).padStart(3), 'resolved', String(v.resolved).padStart(3), 'unresEnd', v.unresolvedEnd, 'stuckRepick', v.stuckRepick|0, JSON.stringify(v.why));
console.log('stuck dump', JSON.stringify(r.dump)); console.log('errs', errs.slice(0, 3)); await b.close();
