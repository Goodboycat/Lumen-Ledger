// LUMEN LEDGER — T2 curiosity wiring (FUN_PASS §7.A). Connects the pure registry (curiosity.js) to the live sandbox: ONE function, no DOM, no Three.
//
//   import { installCuriosity, GUIDE_HINTS } from './curiosityWire.js';
//   installCuriosity(lg)   → lg.curiosity (registry) · called from installRunWires (every new run builds a fresh one, destroyed with the run)
//
// What registers (id → card hint in data/tutor.json):
//   jar:<k>       → jar:<k>  (linger with ✦ inside → jar:withdraw)          tap acts (deposit) so the card shows only until maxShows
//   stall:<id>    → stall:any  (linger → stall:upgrade)                      tap acts (opens the tray on it)
//   sign:<id>     → sign:price  (the hanging sign of each stall)
//   till:<id>     → till:coins  (only while the till holds coins)
//   enemy:<n>     → enemy:collector | enemy:baron                            ping "?" when it lands; tap from ANY distance (tapR 2.2)
//   pier          → enemy:baron  (Baron waiting at the pier)                 ping
//   stranger      → npc:stranger  (the pitching Collector / scam NPC)        ping
//   crew:<type>   → crew:<type>  (each hired helper)
// Silence: blocked() = no card of any kind (dialogue, ledger, pause, title, a deal on the table, a cinematic) — taps included.
//          quiet()   = the S1 verb chain is running → approach / linger / ping stay silent (the chain's own cards speak); taps still answer.
// A new card for a new thing = ONE entry in the sources below + ONE card in data/tutor.json (tools gate `--curiosity` fails otherwise: T2.8).
import { createCuriosity } from './curiosity.js';

/** Every hint id this file can answer. The coverage gate (tools/gates/curiosity.mjs, T2.8) checks each has a card in data/tutor.json. */
export const GUIDE_HINTS = ['jar:save', 'jar:protect', 'jar:invest', 'jar:withdraw', 'stall:any', 'stall:upgrade', 'sign:price', 'till:coins', 'enemy:collector', 'enemy:baron', 'npc:stranger',
  'crew:tallyOwl', 'crew:packMole', 'crew:sparkBee', 'crew:guardTortoise', 'crew:scoutFox', 'crew:gardenerSnail'];
/** HUD things a tap can ask about (ui/hud.js puts data-guide on them). */
export const HUD_GUIDES = ['hud:pouch', 'hud:debt', 'hud:season', 'hud:rep', 'hud:focus'];

export function installCuriosity(lg) {
  const { sb, ui, bus } = lg; const offs = lg._runOffs || (lg._runOffs = []);
  const game = lg.game;
  const posOf = (o) => { const p = o && (o.position || o.root?.position || o.g?.position); return p && Number.isFinite(p.x) && Number.isFinite(p.z) ? p : null; };
  const blocked = () => {
    if (!lg.sb || game.paused) return true;
    if (lg.state !== 'playing' && lg.state !== 'endless') return true;
    if (ui?.isModal?.()) return true;
    if (sb.eco?.pendingOffer || sb.modalOpen?.()) return true;
    const ca = lg.cine?.active; return !!(ca && ca !== 'title');
  };
  lg.guideBlocked = blocked;
  const quiet = () => !!(lg.verbs && lg.verbs.step >= 0);
  const C = lg.curiosity = createCuriosity({ bus, hero: () => sb.hero?.root?.position || null, blocked, quiet });
  const _xz = { x: 0, z: 0 };   // scratch for worldXZ (no Three import, no per-check allocation)

  C.source((add) => {
    // jars (1.3 u is "near" for the E key; the card starts a little earlier so it is read before the deposit)
    const J = sb.jarsWorld;
    if (J?.ids) for (const id of J.ids()) {
      const p = posOf(J.meshOf?.(id)); if (!p) continue;
      // approach → the jar's own card; linger → 'jar:withdraw' only when the jar holds ✦ (Spend IS the pouch, nothing to take back), else no second card
      add('jar:' + id, p.x, p.z, 'jar:' + id, 2.2, 1.3, false, true, () => ((id !== 'spend' && id !== 'invest' && (sb.eco?.state?.jars?.[id] || 0) > 0) ? 'jar:withdraw' : null));   // S76: Invest is locked mid-season (nothing to take back) - never point at an arrow for it
    }
    // stalls + their price signs
    const stalls = sb.build?.stalls?.() || [];
    for (const s of stalls) {
      const p = s.group?.position; if (!p) continue;
      add('stall:' + s.id, p.x, p.z, 'stall:any', 2.4, 1.6, false, true, () => ((sb.eco?.state?.season || 1) >= 2 && (s.level || 1) < 3 ? 'stall:upgrade' : null));   // linger → the upgrade card only from Season 2 and while an upgrade exists (S1: nothing to upgrade with yet)
      const sg = s.slots?.sign; if (sg && worldXZ(sg, _xz)) add('sign:' + s.id, _xz.x, _xz.z, 'sign:price', 1.6, 1.0, false, false);
    }
    // tills with coins
    const T = sb.till?.all?.() || [];
    for (const t of T) if (t.amount > 0 && t.pos) add('till:' + t.stallId, t.pos.x, t.pos.z, 'till:coins', 1.9, 1.2, false, false);
    // enemies: Collectors + the Baron boss (tap from anywhere — a far Collector answers too)
    for (const e of sb.enemies?.list || []) {
      if (!e || e.state === 'flee' || e.state === 'dead') continue; const p = posOf(e.g || e.root); if (!p) continue;
      add('enemy:' + (e.id ?? e.kind), p.x, p.z, e.kind === 'baron' ? 'enemy:baron' : 'enemy:collector', 3.2, 2.2, true, false);
    }
    // the Baron waiting at the pier · the pitching stranger
    const B = sb.pier; if (B?.active && B.g) { const p = posOf(B.g); if (p) add('pier', p.x, p.z, 'enemy:baron', 3.2, 2.2, true, true); }
    const S = sb.scamNpc; if (S?.active && S.g && (S.state === 'pitch' || S.state === 'offered')) { const p = posOf(S.g); if (p) add('stranger', p.x, p.z, 'npc:stranger', 3.2, 2.2, true, true); }
    // crew
    for (const h of sb.helpers || []) { const p = posOf(h.g); if (p && h.type) add('crew:' + h.type, p.x, p.z, 'crew:' + h.type, 1.8, 1.4, false, false); }
  });

  offs.push(() => { C.destroy(); if (lg.curiosity === C) lg.curiosity = null; if (lg.guideBlocked === blocked) lg.guideBlocked = null; });
  return C;
}
/** World x/z of an Object3D-like thing from its matrixWorld (no Vector3 target needed). Returns false when it has no usable matrix. */
function worldXZ(o, out) {
  if (typeof o.updateWorldMatrix === 'function') o.updateWorldMatrix(true, false);
  const e = o.matrixWorld && o.matrixWorld.elements; if (!e || !Number.isFinite(e[12]) || !Number.isFinite(e[14])) return false;
  out.x = e[12]; out.z = e[14]; return true;
}
export default installCuriosity;
