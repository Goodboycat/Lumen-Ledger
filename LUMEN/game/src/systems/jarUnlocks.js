// src/systems/jarUnlocks.js — T1-A (FUN_PASS §4 T1): jars unlock ONE BY ONE instead of all four sitting in the tray from minute 1.
//   createJarUnlocks({ bus, data, unlocked }) → { isUnlocked(k), unlocked() → array, serialize() → array, restore(arr), unlockNow(k), hiddenIds(), destroy() }
//   data = parsed data/jars.json ({ spend: { unlock: 'start' }, save: { unlock: 'till:collect' }, protect: { unlock: 'novelty:start', match: { id: 'stormWarning' } },
//   invest: { unlock: 'eco:season', match: { season: 2 } } }). Each rule = one bus listener that fires ONCE (then is removed); `match` fields must equal the payload's.
//   On unlock: bus 'jars:unlocked' { jar, how: 'rule' | 'debug' | 'restore' | 'start' }. restore() is silent for already-known keys (save load, legacy migration).
//   No DOM, no Three — the tray (ui/build.js setHidden) and the HUD react to the bus event in Game.js. Zero per-frame work.
export const JAR_KEYS = ['spend', 'save', 'invest', 'protect'];
export const DEFAULT_JAR_RULES = {
  spend: { unlock: 'start' },
  save: { unlock: 'till:collect' },
  protect: { unlock: 'novelty:start', match: { id: 'stormWarning' } },
  invest: { unlock: 'eco:season', match: { season: 2 } },
};

const matches = (payload, match) => { if (!match) return true; if (!payload || typeof payload !== 'object') return false; for (const [k, v] of Object.entries(match)) if (payload[k] !== v) return false; return true; };

export function createJarUnlocks({ bus, data = null, unlocked = null } = {}) {
  const rules = {}; for (const k of JAR_KEYS) { const r = (data && data[k] && typeof data[k] === 'object') ? data[k] : DEFAULT_JAR_RULES[k]; rules[k] = { unlock: String(r.unlock || 'start'), match: r.match && typeof r.match === 'object' ? r.match : null }; }
  const set = new Set(); const offs = new Map();   // key → unsubscribe for its pending rule
  const api = {
    rules,
    isUnlocked: (k) => set.has(k),
    unlocked: () => JAR_KEYS.filter((k) => set.has(k)),
    serialize: () => JAR_KEYS.filter((k) => set.has(k)),
    /** ids the tray must hide right now (jar_<key> for every locked key). */
    hiddenIds: () => JAR_KEYS.filter((k) => !set.has(k)).map((k) => 'jar_' + k),
    /** unlock k now (debug / verb chain / rule). Returns true when it was locked before. Emits jars:unlocked once. */
    unlockNow(k, how = 'debug') {
      if (!JAR_KEYS.includes(k)) return false; const off = offs.get(k); if (off) { off(); offs.delete(k); }
      if (set.has(k)) return false; set.add(k); bus?.emit?.('jars:unlocked', { jar: k, how, unlocked: api.unlocked() }); return true;
    },
    /** silent restore from a save (array of keys); unknown keys ignored; pending rules for restored keys are dropped. */
    restore(arr) { for (const k of Array.isArray(arr) ? arr : []) { if (!JAR_KEYS.includes(k)) continue; const off = offs.get(k); if (off) { off(); offs.delete(k); } set.add(k); } return api.unlocked(); },
    destroy() { for (const off of offs.values()) off(); offs.clear(); },
  };
  // arm the rules: 'start' = unlocked immediately (silent — nothing to reveal at minute 1); anything else = one-shot listener
  for (const k of JAR_KEYS) {
    if (rules[k].unlock === 'start') { set.add(k); continue; }
    if (bus?.on) { const off = bus.on(rules[k].unlock, (p) => { if (!matches(p, rules[k].match)) return; api.unlockNow(k, 'rule'); }); offs.set(k, off); }
  }
  if (unlocked) api.restore(unlocked);
  return api;
}
