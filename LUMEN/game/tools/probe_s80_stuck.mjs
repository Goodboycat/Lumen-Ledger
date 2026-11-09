// S80-A2: dump geometry where customers get stuck.  node tools/probe_s80_stuck.mjs [waves=4]
import { launch, startStory } from './rig76.mjs';
const WAVES = +process.argv[2] || 4, SEASON = 6;
const { p, b, errs } = await launch(844, 390); await startStory(p);
const r = await p.evaluate(({ WAVES, SEASON }) => {
  const sb = lg.sb, B = sb.build, C = sb.cust; sb.eco.earn(99999, 'probe');
  const kinds = ['fruit','bread','lantern','fish','flower','tool','cloth','pottery','toy','tea','book','sparkExchange'];
  const spots = []; for (let x = -9; x <= 9; x += 3) for (let z = -9; z <= 9; z += 3) spots.push([x, z]);
  for (const k of kinds) { const id = 'stall_' + k; for (const [x, z] of spots) { if (B.canPlace(id, x, z, 0)) { if (B.place(id, x, z, 0, { animate: false, pay: false, silent: true })) break; } } }
  C.reroute(); C.season = SEASON; const F = C.flow; const ev = [];
  const oSet = C._set.bind(C);
  C._set = (c, st) => { if (c.state === 'walk' && st === 'pickStall' && c.stall) { const f = c.field; ev.push({ ev: 'repick', id: c.type, kind: c.stall.id, pos: [+c.root.position.x.toFixed(2), +c.root.position.z.toFixed(2)], target: [c.target.x, c.target.z], cellWalkable: F.walkable(c.root.position.x, c.root.position.z), distHere: f ? F.distance(f, c.root.position.x, c.root.position.z) : 'nofield', slot: c.slot }); } return oSet(c, st); };
  const oR = C._react.bind(C); C._react = (c, a, why) => { if (why === 'blocked') ev.push({ ev: 'blocked', pos: [+c.root.position.x.toFixed(2), +c.root.position.z.toFixed(2)], cellWalkable: F.walkable(c.root.position.x, c.root.position.z), kind: c.stall?.id }); return oR(c, a, why); };
  for (let w = 0; w < WAVES; w++) { C.spawnWave(SEASON); for (let i = 0; i < 1500; i++) { C.update(0.1); if (!C.active.length && !C.pendingSpawns.length) break; } }
  // map of walkable cells
  let map = []; for (let z = -12; z <= 12; z++) { let row = ''; for (let x = -12; x <= 12; x++) row += F.walkable(x, z) ? '.' : (F.isLand(x, z) ? '#' : '~'); map.push(String(z).padStart(3) + ' ' + row); }
  const stalls = C._stallList().map((s) => ({ id: s.id, g: [s.group.position.x, s.group.position.z], counter: [+s.slots.counter.x.toFixed(1), +s.slots.counter.z.toFixed(1)], usable: C._usableSlots(s).map((q) => [+q.x.toFixed(1), +q.z.toFixed(1)]) }));
  return { ev, map, stalls, spawn: C.spawn, active: C.active.map((c) => ({ st: c.state, x: c.root.position.x, z: c.root.position.z })) };
}, { WAVES, SEASON });
console.log('spawn', JSON.stringify(r.spawn)); console.log('x:-12..12'); console.log(r.map.join('\n'));
for (const s of r.stalls) console.log(JSON.stringify(s));
for (const e of r.ev) console.log(JSON.stringify(e));
console.log('active', JSON.stringify(r.active)); console.log('errs', errs.slice(0, 3)); await b.close();
