// LUMEN LEDGER — Jars are places (Chat 42B, MASTER_PLAN_V6 §1 "budgeting is a walk, not a slider").
//
//   import { createJarsWorld, DEPOSIT_STEP } from './systems/jarsWorld.js';
//   const J = createJarsWorld({ bus, eco, jars: W.jars, hero, vfx, labels?: domRoot, camera?: () => THREE.Camera });
//   J.near()                 → 'spend'|'save'|'invest'|'protect'|null   (Pip ≤ NEAR_R from a jar; the closest one)
//   J.deposit(jar, amount?)  → amount moved (0 = nothing). DEPOSIT_STEP ✦ per tap, or the whole pouch when it holds < DEPOSIT_STEP.
//   J.withdraw(jar, amount?) → amount moved. Invest refuses mid-season (eco.state.ended falsy → 'locked'); Save/Spend/Protect are free.
//   J.press() / J.release()  → the E key / ✋ button. press = one deposit at once; holding ≥ HOLD_S withdraws instead, then repeats every REPEAT_S.
//   J.spillPouch(frac?)      → 42C: a Collector contact knocks min(SPILL_FRAC·pouch, SPILL_CAP) ✦ onto the ground (onSpill(amount) drops the coins).
//   J.register(id, mesh)     → 43: a 5th jar (e.g. 'festival'); eco must know the id or deposits are denied.
//   J.update(dt)             → hold detection + DOM labels (name + amount, visible ≤ LABEL_R). J.destroy() → 0 listeners, labels removed.
// Bus: jars:deposit {jar, amount} · jars:withdraw {jar, amount} · jars:near {jar|null} (on change) · jars:locked {jar} · jars:spill {amount}
// Truth stays in eco.state.jars (eco.allocate / eco.withdraw); wireEconomy's `eco:jar` listener keeps the 1D setFill in sync, J only
// plays the jarFill Sequence (when a `sequences` player is given) + coinFly. 0 new meshes; DOM tags ≤ 4 by default (one per jar).
import { makeJarFillSequence } from '../assets/props/decor.js';

export const DEPOSIT_STEP = 10;
export const NEAR_R = 1.3;
export const LABEL_R = 4;
export const HOLD_S = 0.6;
export const REPEAT_S = 0.25;
export const SPILL_FRAC = 0.10;
export const SPILL_CAP = 8;
export const JAR_NAMES = { spend: 'Spend', save: 'Save', invest: 'Invest', protect: 'Protect', festival: 'Festival' };
const DEFAULT_IDS = ['spend', 'save', 'invest', 'protect'];

export function createJarsWorld(opts = {}) {
  const { bus, eco, hero, vfx = null, sequences = null, labels = null, camera = null, onSpill = null } = opts;
  if (!bus || !eco) throw new Error('createJarsWorld: bus + eco required');
  const jars = new Map();                                     // id → mesh/group with .position (+ userData.setFill)
  (opts.jars || []).forEach((m, i) => { const id = m?.userData?.jar || m?.userData?.id?.replace?.(/^jar_/, '') || DEFAULT_IDS[i]; if (m && id) jars.set(id, m); });
  const offs = [];
  const J = { jars, lastNear: null, hold: 0, holding: false, heldJar: null, repeatT: 0, withdrew: false, tags: new Map(), destroyed: false };
  const heroPos = () => hero?.root?.position || hero?.position || null;
  const jarPos = (m) => m?.position || m;
  const dist = (m) => { const h = heroPos(), p = jarPos(m); return h && p ? Math.hypot(h.x - p.x, h.z - p.z) : Infinity; };
  const seasonLocked = (jar) => jar === 'invest' && !eco.state.ended;

  J.register = (id, mesh) => { if (id && mesh) jars.set(id, mesh); return J; };
  J.near = () => { let best = null, bd = NEAR_R; for (const [id, m] of jars) { const d = dist(m); if (d <= bd) { bd = d; best = id; } } return best; };
  J.fill01 = (id) => { const j = eco.state.jars; const tot = Math.max(1, Object.values(j).reduce((a, v) => a + v, 0)); return Math.min(1, (j[id] || 0) / tot); };

  const fx = (id, from, to, amount, dir) => {
    const m = jars.get(id); if (!m) return;
    if (sequences && m.userData?.setFill) { try { sequences.play(makeJarFillSequence(m, { from, to })); } catch { /* headless mock */ } }
    const h = heroPos(); if (vfx?.coinFly && h) { const a = h.clone ? h.clone().setY(0.8) : h, b = jarPos(m).clone ? jarPos(m).clone().setY(0.9) : jarPos(m); vfx.coinFly(dir > 0 ? a : b, dir > 0 ? b : a, null, { count: Math.min(6, Math.max(1, Math.round(amount / 4))) }); }
    vfx?.pop?.show?.(jarPos(m).clone ? jarPos(m).clone().setY(1.6) : jarPos(m), `${dir > 0 ? '+' : '−'}${amount}`, { color: dir > 0 ? '#FFD54F' : '#B0BEC5', dur: 0.8 });
  };

  J.deposit = (jar, amount = DEPOSIT_STEP) => {
    if (!jar || !jars.has(jar)) return 0;
    const pouch = Math.max(0, Math.floor(eco.state.spark));
    const a = Math.min(Math.max(0, Math.round(amount)), pouch);
    if (a <= 0) { bus.emit('jars:empty', { jar }); return 0; }       // pouch empty → no eco:denied noise, just a soft signal
    const from = J.fill01(jar);
    if (!eco.allocate({ [jar]: +a })) return 0;
    fx(jar, from, J.fill01(jar), a, +1);
    bus.emit('jars:deposit', { jar, amount: a, spark: eco.state.spark, jars: { ...eco.state.jars } });
    return a;
  };
  J.withdraw = (jar, amount = DEPOSIT_STEP) => {
    if (!jar || !jars.has(jar)) return 0;
    if (seasonLocked(jar)) { bus.emit('jars:locked', { jar, text: 'Locked till the ledger.' }); wobble(jar); return 0; }
    const from = J.fill01(jar);
    const a = eco.withdraw(jar, Math.max(1, Math.round(amount)));
    if (a > 0) { fx(jar, from, J.fill01(jar), a, -1); bus.emit('jars:withdraw', { jar, amount: a, spark: eco.state.spark, jars: { ...eco.state.jars } }); }
    return a;
  };
  function wobble(jar) { const m = jars.get(jar); if (sequences && m?.userData?.setFill) { const f = J.fill01(jar); try { sequences.play(makeJarFillSequence(m, { from: f, to: f })); } catch { /* ok */ } } }

  // ---- E key / ✋: tap = deposit, hold ≥ HOLD_S = withdraw (repeats). Returns 'deposit'|'empty'|null (null = no jar near).
  J.press = () => {
    const jar = J.near(); if (!jar) return null;
    J.holding = true; J.hold = 0; J.heldJar = jar; J.withdrew = false; J.repeatT = 0;
    return J.deposit(jar) > 0 ? 'deposit' : 'empty';
  };
  J.release = () => { J.holding = false; J.hold = 0; J.heldJar = null; J.withdrew = false; };

  J.spillPouch = (frac = SPILL_FRAC) => {
    const pouch = Math.max(0, eco.state.spark);
    const a = Math.min(Math.max(pouch >= 1 ? 1 : 0, Math.floor(pouch * frac)), SPILL_CAP);   // 42C: at least 1 ✦ spills while the pouch has any — a small pouch is not immune
    if (a <= 0) return 0;
    eco._addSpark(-a, 'spill');
    onSpill?.(a); bus.emit('jars:spill', { amount: a, spark: eco.state.spark }); return a;
  };

  // ---- DOM labels (projected like 41A barks). Only when a DOM root + camera getter are given (the headless gate passes neither).
  const camOf = () => (typeof camera === 'function' ? camera() : camera);
  function ensureTag(id) {
    if (!labels || J.tags.has(id)) return J.tags.get(id);
    const el = labels.ownerDocument.createElement('div'); el.className = 'll-jar-tag ' + id; el.setAttribute('aria-hidden', 'true'); labels.appendChild(el); J.tags.set(id, el); return el;
  }
  function placeTags() {
    const cam = camOf(); const W = labels.clientWidth || 360, H = labels.clientHeight || 640; const near = J.near();
    for (const [id, m] of jars) {
      const el = ensureTag(id); if (!el) continue; const d = dist(m);
      if (d > LABEL_R || !cam?.projectionMatrix) { el.style.display = 'none'; continue; }
      const p = jarPos(m); const v = p.clone ? p.clone() : { x: p.x, y: p.y, z: p.z }; if (v.setY) v.setY((p.y || 0) + 1.25);
      if (!v.project) { el.style.display = 'none'; continue; }
      v.project(cam); if (v.z > 1) { el.style.display = 'none'; continue; }
      el.style.display = ''; el.style.left = Math.round((v.x * 0.5 + 0.5) * W) + 'px'; el.style.top = Math.round((-v.y * 0.5 + 0.5) * H) + 'px';
      const amt = Math.round(eco.state.jars[id] || 0);
      const txt = `${JAR_NAMES[id] || id} · ${amt} ✦` + (near === id ? (J.holding && J.withdrew ? '  (take 10)' : `  E · put ${Math.min(DEPOSIT_STEP, Math.max(0, Math.floor(eco.state.spark)))} in`) : '');
      if (el.textContent !== txt) el.textContent = txt; el.classList.toggle('near', near === id);
    }
  }

  J.update = (dt = 0) => {
    if (J.destroyed) return;
    const n = J.near(); if (n !== J.lastNear) { J.lastNear = n; bus.emit('jars:near', { jar: n }); }
    if (J.holding) {
      if (J.near() !== J.heldJar) J.release();
      else { J.hold += dt; if (J.hold >= HOLD_S) { J.repeatT -= dt; if (!J.withdrew || J.repeatT <= 0) { J.withdrew = true; J.repeatT = REPEAT_S; J.withdraw(J.heldJar); } } }
    }
    if (labels) placeTags();
  };
  J.destroy = () => { J.destroyed = true; for (const f of offs) f(); offs.length = 0; for (const el of J.tags.values()) el.remove(); J.tags.clear(); jars.clear(); };
  return J;
}

export default { createJarsWorld, DEPOSIT_STEP, NEAR_R, LABEL_R, HOLD_S, REPEAT_S, SPILL_FRAC, SPILL_CAP };
