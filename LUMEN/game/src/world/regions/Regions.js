// src/world/regions/Regions.js — 17A (World v3 skeleton): 7 regions, 6 gates, load/unload, return paths. Pure logic, 0 meshes.
//
//   createRegions({ scene, island, bus, flags: () => Object, data? }) → R
//   R.list: Region[]            · R.current (id | null) · R.at(x,z) → id | null · R.isLand(x,z)  (hub island ∪ loaded region grounds)
//   R.register(id, { group, isLand(x,z), anchors:{enter, pier, campfire}, returnPath:{from, to, unlocked?} })  — biome IDs call this (hub = 17B)
//   R.gates: Gate[]  ({ id:'hub>crags', from, to, need, pos:{x,z}, open })  · R.canOpen(gate) · R.tryEnter(gateId) → 'open' | 'locked' | 'noregion'
//   R.update(dt, heroPos)      — tracks the hero's region (1-frame debounce), swaps group.visible, pauses/resumes userData.animators, fires events
//   R.useReturn(id, heroPos)   — teleports heroPos to the hub-side point when the region is current and its returnPath is unlocked → region:return
//   R.nearestPier(x,z)         — pier anchor of the current region (hub pier default) for 15B edge falls
//   R.hintFor(gate) → string   — human text for the need, always the ACTION (power / mission / keys / rep), never a Spark price (Bible §2)
//   hasFlag(flags, need) pure  — need = { power?, mission?, keys?, rep? } → every present key must hold
//   bus: region:enter {id, from} · region:gate {id, state:'locked'|'open', need} · region:load {id} · region:unload {id} · region:return {id}
//
// Load/unload = `group.visible` + animators paused (15C cull pattern). Nothing is disposed between regions. Unregistered regions are
// "sealed": at() still returns their id (so the map can show them) but tryEnter → 'noregion' and isLand() → false there.
// The unlock TRUTH lives in sb.flags ({ powers:Set, missions:Set, keys:number, rep:number }); 18D+ / 24E only set flags, never edit this file.

export const POWER_NAMES = {
  sparkTether: 'Spark Tether', electricOrb: 'Electric Orb', bubbleWalk: 'Bubble Walk', lumenLantern: 'Lumen Lantern', heatStomp: 'Heat Stomp',
};
export const FLAG_POWERS = Object.keys(POWER_NAMES);
export const HUB_ID = 'hub';
export const HUB_PIER = { x: 0, y: 0, z: 10 };     // Island v2 pier (south rim); 17B overrides via register('hub', { anchors:{ pier } })

export function hasFlag(flags, need) {
  if (!need) return true;
  const f = flags || {};
  const has = (set, k) => !!set && (typeof set.has === 'function' ? set.has(k) : Array.isArray(set) ? set.includes(k) : !!set[k]);
  if (need.power !== undefined && !has(f.powers, need.power)) return false;
  if (need.mission !== undefined && !has(f.missions, need.mission)) return false;
  if (need.keys !== undefined && !((f.keys || 0) >= need.keys)) return false;
  if (need.rep !== undefined && !((f.rep || 0) >= need.rep)) return false;
  return true;
}

export function emptyFlags() { return { powers: new Set(), missions: new Set(), keys: 0, rep: 0 }; }

export function hintFor(need) {
  if (!need) return 'Open';
  const parts = [];
  if (need.power) parts.push(`Needs ${POWER_NAMES[need.power] || need.power}`);
  if (need.mission) parts.push(`Finish quest ${need.mission}`);
  if (need.keys) parts.push(`Needs ${need.keys} Ledger Key${need.keys > 1 ? 's' : ''}`);
  if (need.rep) parts.push(`Needs reputation ${need.rep}`);
  return parts.join(' · ');
}

const setPaused = (group, paused) => {
  if (!group) return;
  const list = group.userData?.animators;
  if (Array.isArray(list)) for (const a of list) if (a) a.paused = paused;
  // 15C pattern: also walk children that carry their own animators (creatures / props)
  if (typeof group.traverse === 'function') group.traverse((o) => { const l = o.userData?.animators; if (o !== group && Array.isArray(l)) for (const a of l) if (a) a.paused = paused; });
};

export function createRegions({ scene = null, island = null, bus = null, flags = () => emptyFlags(), data = null } = {}) {
  const rows = (data && data.regions) || [];
  if (!rows.length) throw new Error('createRegions: pass data = parsed data/regions.json');
  const emit = (n, p) => { if (bus && typeof bus.emit === 'function') bus.emit(n, p); };
  const offs = [];

  const byId = new Map();
  const list = rows.map((r) => {
    const reg = {
      id: r.id, name: r.name, num: r.num, center: { x: r.center[0], z: r.center[1] }, radius: r.radius, atmosphere: r.atmosphere,
      gateFrom: r.gateFrom, need: r.need || null, enemies: r.enemies || [], boss: r.boss || null, reward: r.reward || null,
      returnPath: r.returnPath ? { from: { x: r.returnPath[0][0], y: 0, z: r.returnPath[0][1] }, to: { x: r.returnPath[1][0], y: 0, z: r.returnPath[1][1] }, unlocked: false } : null,
      group: null, isLand: null, anchors: null, registered: false, loaded: false,
    };
    byId.set(reg.id, reg); return reg;
  });
  if (!byId.has(HUB_ID)) throw new Error('createRegions: no hub row');

  // Gates: one per region with a gateFrom; pos = point on the `from` rim toward `to`
  const gates = list.filter((r) => r.gateFrom).map((r) => {
    const a = byId.get(r.gateFrom); if (!a) throw new Error(`gate ${r.id}: unknown from '${r.gateFrom}'`);
    const dx = r.center.x - a.center.x, dz = r.center.z - a.center.z, d = Math.hypot(dx, dz) || 1;
    return { id: `${a.id}>${r.id}`, from: a.id, to: r.id, need: r.need || null, pos: { x: a.center.x + dx / d * a.radius, z: a.center.z + dz / d * a.radius }, open: false };
  });
  const gateById = new Map(gates.map((g) => [g.id, g]));

  const R = {
    list, gates, current: null, HUB_ID,
    get(id) { return byId.get(id) || null; },
    gate(id) { return gateById.get(id) || null; },
    at(x, z) {
      let best = null, bestD = Infinity;
      for (const r of list) {
        const d = Math.hypot(x - r.center.x, z - r.center.z);
        if (d <= r.radius && (d < bestD - 1e-9 || (Math.abs(d - bestD) <= 1e-9 && r.id === HUB_ID))) { best = r; bestD = d; }
      }
      if (best) return best.id;
      // hub tie-break: inside the hub island polygon but outside its nominal radius
      if (island && typeof island.isLand === 'function' && island.isLand(x, z)) return HUB_ID;
      return null;
    },
    isLand(x, z) {
      if (island && typeof island.isLand === 'function' && island.isLand(x, z)) return true;
      for (const r of list) if (r.id !== HUB_ID && r.registered && typeof r.isLand === 'function' && r.isLand(x, z)) return true;
      return false;
    },
    register(id, def = {}) {
      const r = byId.get(id); if (!r) throw new Error(`register: unknown region '${id}'`);
      r.group = def.group || null; r.isLand = def.isLand || null; r.anchors = def.anchors || null; r.registered = true;
      if (def.returnPath) r.returnPath = { from: def.returnPath.from, to: def.returnPath.to, unlocked: !!def.returnPath.unlocked };
      if (r.group && scene && typeof scene.add === 'function' && r.group.parent !== scene) scene.add(r.group);
      // freshly registered regions start unloaded unless they are the current one
      const wantLoaded = R.current === id || (R.current === null && id === HUB_ID);
      setLoaded(r, wantLoaded, false);
      return r;
    },
    canOpen(gate) { const g = typeof gate === 'string' ? gateById.get(gate) : gate; return !!g && hasFlag(flags(), g.need); },
    tryEnter(gateId) {
      const g = typeof gateId === 'string' ? gateById.get(gateId) : gateId; if (!g) return 'noregion';
      const target = byId.get(g.to);
      if (!target || !target.registered) { emit('region:gate', { id: g.id, state: 'locked', need: g.need, sealed: true }); return 'noregion'; }
      if (!R.canOpen(g)) { g.open = false; emit('region:gate', { id: g.id, state: 'locked', need: g.need }); return 'locked'; }
      if (!g.open) { g.open = true; emit('region:gate', { id: g.id, state: 'open', need: g.need }); }
      return 'open';
    },
    hintFor(gate) { const g = typeof gate === 'string' ? gateById.get(gate) : gate; return g ? hintFor(g.need) : ''; },
    unlockReturn(id, on = true) { const r = byId.get(id); if (r?.returnPath) r.returnPath.unlocked = !!on; return !!r?.returnPath; },
    useReturn(id, heroPos) {
      const r = byId.get(id);
      if (!r || !r.returnPath || !r.returnPath.unlocked || R.current !== id) return false;
      const to = r.returnPath.to;
      if (heroPos) { heroPos.x = to.x; if ('y' in heroPos) heroPos.y = to.y ?? heroPos.y; heroPos.z = to.z; }
      emit('region:return', { id, to: { ...to } });
      return true;
    },
    nearestPier(x, z) {
      const r = byId.get(R.current || HUB_ID);
      const p = r?.anchors?.pier || byId.get(HUB_ID)?.anchors?.pier || HUB_PIER;
      return { x: p.x, y: p.y ?? 0, z: p.z };
    },
    update(dt, heroPos) {
      if (!heroPos) return;
      const id = R.at(heroPos.x, heroPos.z);
      if (id === null) { pending = null; pendingN = 0; return; }           // mid-air / off every region: keep the last region
      if (id === R.current) { pending = null; pendingN = 0; return; }
      if (pending !== id) { pending = id; pendingN = 1; return; }          // 1-frame debounce: the same new id must hold for 2 updates
      pendingN++;
      if (pendingN < 2) return;
      enter(id);
    },
    setCurrent(id) { enter(id); },
    destroy() { for (const off of offs) off(); offs.length = 0; for (const r of list) { r.group = null; r.registered = false; r.loaded = false; } R.current = null; },
  };

  let pending = null, pendingN = 0;
  function setLoaded(r, on, announce = true) {
    if (r.loaded === on && (r.group ? r.group.visible === on : true)) return;
    r.loaded = on;
    if (r.group) { r.group.visible = on; setPaused(r.group, !on); }
    if (announce) emit(on ? 'region:load' : 'region:unload', { id: r.id });
  }
  function enter(id) {
    const from = R.current; const r = byId.get(id); if (!r) return;
    pending = null; pendingN = 0;
    if (from && from !== id) { const prev = byId.get(from); if (prev) setLoaded(prev, false); }
    R.current = id;
    setLoaded(r, true);
    emit('region:enter', { id, from });
  }
  return R;
}

// Browser helper (Node passes the parsed object instead): await loadRegions('data/regions.json')
export async function loadRegions(url = 'data/regions.json') {
  const res = await fetch(url); if (!res.ok) throw new Error(`loadRegions: ${res.status} ${url}`); return res.json();
}
