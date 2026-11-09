// S77-A diagnostic: per stall, usable queue slots, counter walkability, flow reachability from the spawn, season demand.  node tools/probe_s77_slots.mjs [season=6]
import { launch, startStory } from './rig76.mjs';
const SEASON = +process.argv[2] || 6;
const { p, b, errs } = await launch(844, 390); await startStory(p);
const out = await p.evaluate((SEASON) => {
  const sb = lg.sb, B = sb.build, C = sb.cust; sb.eco.earn(99999, 'probe');
  const kinds = ['lantern','fish','flower','tool','cloth','pottery','toy','book','sparkExchange'];
  const spots = []; for (let x = -9; x <= 9; x += 3) for (let z = -9; z <= 9; z += 3) spots.push([x, z]);
  for (const k of kinds) { const id = 'stall_' + k; if (B.owned?.(id)) continue; for (const [x, z] of spots) { if (B.canPlace(id, x, z, 0)) { if (B.place(id, x, z, 0, { animate: false, pay: false, silent: true })) break; } } }
  if (sb.eco?.state) sb.eco.state.season = SEASON; C.season = SEASON;
  const spawn = C.spawn; const flow = C.flow;
  return B.stalls().map((s) => {
    const kind = String(s.id).replace(/^stall_/, ''); const us = C._usableSlots(s);
    const cnt = s.slots.counter; const qs = s.slots.queue.map((q) => [+q.x.toFixed(1), +q.z.toFixed(1), flow.walkable(q.x, q.z)]);
    const f = flow.get(Math.round(us[0].x), Math.round(us[0].z)); let reach = null; try { const d = f && (f.dist ? f.dist(spawn.x, spawn.z) : null); reach = d; } catch {}
    return { kind, at: [+s.group.position.x.toFixed(1), +s.group.position.z.toFixed(1)], rot: s.entry.rot, counterWalk: flow.walkable(cnt.x, cnt.z), usable: us.length, slotsWalk: qs.map((q) => q[2] ? 1 : 0).join(''), demand: +(sb.eco.demandOf ? sb.eco.demandOf(kind) : 1).toFixed(2), reach };
  });
}, SEASON);
for (const r of out) console.log(JSON.stringify(r));
console.log('errs', errs.slice(0, 3)); await b.close();
