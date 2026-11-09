// S77-A: where do Glimmers get stuck on the way to a stall?  node tools/probe_s77_stuck.mjs [season=6] [kinds=all]
import { launch, startStory } from './rig76.mjs';
const SEASON = +process.argv[2] || 6;
const { p, b, errs } = await launch(844, 390); await startStory(p);
const r = await p.evaluate((SEASON) => {
  const sb = lg.sb, B = sb.build, C = sb.cust; sb.eco.earn(99999, 'probe');
  const kinds = ['fruit','bread','lantern','fish','flower','tool','cloth','pottery','toy','tea','book','sparkExchange'];
  const spots = []; for (let x = -9; x <= 9; x += 3) for (let z = -9; z <= 9; z += 3) spots.push([x, z]);
  for (const k of kinds) { const id = 'stall_' + k; if (B.owned?.(id)) continue; for (const [x, z] of spots) { if (B.canPlace(id, x, z, 0)) { if (B.place(id, x, z, 0, { animate: false, pay: false, silent: true })) break; } } }
  C.season = SEASON; if (sb.eco?.state) sb.eco.state.season = SEASON;
  const stuck = {}; const k = (id) => String(id).replace(/^stall_/, '');
  const ev = [];
  const origSet = C._set.bind(C);
  C._set = (c, st) => { if (st === 'pickStall' && c.state === 'walk' && c.stall) { const kk = k(c.stall.id); stuck[kk] = (stuck[kk] || 0) + 1; if (ev.length < 6) ev.push({ kind: kk, at: [+c.root.position.x.toFixed(1), +c.root.position.z.toFixed(1)], target: [+c.target.x.toFixed(1), +c.target.z.toFixed(1)], slot: c.slot, fieldDist: C.flow.distance(C.flow.get(c.target.x, c.target.z), c.root.position.x, c.root.position.z) }); } return origSet(c, st); };
  for (let w = 0; w < 6; w++) { C.spawnWave(SEASON); for (let i = 0; i < 1500; i++) { C.update(0.1); if (!C.active.length && !C.pendingSpawns.length) break; } }
  const fr = B.stalls().find((s) => s.id === 'stall_fruit');
  const cell = (x, z) => C.flow.walkable(x, z) ? '.' : '#';
  const grid = []; if (fr) { const cx = Math.round(fr.group.position.x), cz = Math.round(fr.group.position.z); for (let z = cz - 4; z <= cz + 4; z++) { let row = ''; for (let x = cx - 5; x <= cx + 5; x++) { let ch = cell(x, z); for (const q of fr.slots.queue) if (Math.round(q.x) === x && Math.round(q.z) === z) ch = 'q'; if (Math.round(fr.slots.counter.x) === x && Math.round(fr.slots.counter.z) === z) ch = 'C'; row += ch; } grid.push(row); } }
  return { stuck, ev, grid, fruit: fr && { pos: [fr.group.position.x, fr.group.position.z], rot: fr.entry.rot, counter: [fr.slots.counter.x, fr.slots.counter.z], queue: fr.slots.queue.map((q) => [q.x, q.z]) }, totals: C.totals };
}, SEASON);
console.log(JSON.stringify(r.stuck)); for (const e of r.ev) console.log(JSON.stringify(e)); console.log(JSON.stringify(r.fruit)); console.log(r.grid.join('\n')); console.log(JSON.stringify(r.totals)); console.log('errs', errs.slice(0, 3)); await b.close();
