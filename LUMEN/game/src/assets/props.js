// Props catalog index (Chat 1A owns this file; 1B/1C add their maps via registerProps()).
// Contract (API_CONTRACTS §B "Props"):
//   PROP_CATALOG[id] = { make(opts) → Group, footprint:[w,d], category, cost, tris, name }
//   makeProp(id, opts) → THREE.Group  (pivot at base, toon + outlined, userData.footprint set)
import { STALL_PROPS, countTris } from './props/stalls.js';
import { NATURE_PROPS } from './props/nature.js'; // Chat 1B (allowed by 1A: "1B/1C register your maps ... or import in props.js")
import { LANDMARK_PROPS } from './props/landmarks.js'; // Chat 1C
import { DECOR_PROPS } from './props/decor.js'; // Chat 1D

export const PROP_CATALOG = {};

/** Merge a map of catalog entries (used by 1B NATURE_PROPS / DECOR_PROPS, 1C LANDMARK_PROPS). */
export function registerProps(map) {
  for (const [id, entry] of Object.entries(map)) {
    if (PROP_CATALOG[id]) console.warn(`[props] duplicate id "${id}" — overriding`);
    PROP_CATALOG[id] = entry;
  }
  return PROP_CATALOG;
}

/** Build a prop by id. Throws on unknown id. */
export function makeProp(id, opts = {}) {
  const entry = PROP_CATALOG[id];
  if (!entry) throw new Error(`[props] unknown prop id "${id}"`);
  const g = entry.make(opts);
  g.userData.propId = id;
  g.userData.footprint = g.userData.footprint || entry.footprint || [1, 1];
  g.userData.category = g.userData.category || entry.category || 'prop';
  return g;
}

/** All ids in a category, e.g. propsByCategory('stall'). */
export function propsByCategory(cat) {
  return Object.keys(PROP_CATALOG).filter((id) => PROP_CATALOG[id].category === cat);
}

/** Fill `tris` for every entry by building one instance (debug/QA; cheap, call once). */
export function measureCatalog(level = 1) {
  const out = {};
  for (const id of Object.keys(PROP_CATALOG)) {
    const g = PROP_CATALOG[id].make({ level, outline: false });
    PROP_CATALOG[id].tris = countTris(g);
    out[id] = PROP_CATALOG[id].tris;
  }
  return out;
}

registerProps(STALL_PROPS);
registerProps(NATURE_PROPS);
registerProps(LANDMARK_PROPS);
registerProps(DECOR_PROPS);

export { countTris };
export * from './props/stalls.js';
export * from './props/nature.js';
export * from './props/landmarks.js';
export * from './props/decor.js';
