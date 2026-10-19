// Chat 2D — 8 more Glimmer customer variants, built EXACTLY like 2A glimmers.js: Foundation makeGlimmer()
// body → compactGlimmer() (6 dc) → one static accessory kit baked with mergeGroup() into 1 toon mesh (+1 hull)
// (+ optional 1 flat mesh, no outline) parented to `body` so it rides squash/stretch.
//
// NEW in 2D: each kit may also fill a `live` group = the ONE animated accessory (kid propeller, elder cane,
// newbie "?" bubble, impulse sparkles, tourist flash, critic pencil, collector coins). `live` is merged
// separately (1–2 meshes + ≤ 1 hull) and pivoted at `live.position`; `FLOURISH[type](root, t, dt)` moves that
// pivot every frame → call `root.userData.update(dt)` (same convention as 1A stalls). Cost: +2…3 dc.
//
// Budget: ≤ 12 draw calls per variant incl. outlines (measured by tools/check.mjs --creatures, GLIMMERS-2 section).
//
// 2A's BUILD table is module-private, so 2D cannot inject into makeGlimmerVariant() (CHANGE_REQUEST filed).
// Use `makeGlimmerAny(type)` for all 12 types (routes to 2A for its 4, to this file for the 8).
//
// ─────────────────────── FLOURISH TABLE (continuous, delta-time; not phased) ───────────────────────
// kid        propeller spin 14 rad/s (+ 2 Hz wobble ±0.04 on y-scale while hopping handled by body squash)
// elder      cane sway: rotation.z = -0.22 + sin(t·1.6)·0.05  (tip stays planted; pivot at handle)
// impulse    sparkle ring orbit 2.2 rad/s + bob sin(t·5)·0.04 + scale pulse 1±0.12 at 3 Hz
// tourist    camera flash: every 2.6 s the bulb pops to scale 2.4 and decays 220 ms (outCubic-ish 1-e^-)
// critic     pencil scribble: rotation.x = 0.5 + sin(t·9)·0.18 , y offset sin(t·18)·0.015 (writing jitter)
// collector  coins in jar: bob sin(t·3)·0.03 + slow yaw 1.2 rad/s
// newbie     "?" bubble: bob sin(t·2.4)·0.05 + tilt sin(t·1.7)·0.12 (idle wonder)
// haggler    none (static visor + coin pouch)
// ────────────────────────────────────────────────────────────────────────────────────────────────
import * as THREE from '../../../vendor/three.module.js';
import { G, mesh, group, rng, vary } from '../geo.js';
import { PALETTE as P, toonMat, flatMat } from '../../core/Toon.js';
import { addOutline } from '../../core/Outline.js';
import { makeGlimmer } from '../glimmer.js';
import { mergeGroup } from '../props/merge.js';
import { GLIMMER_INFO, GLIMMER_TYPES, GLIMMER_VARIANTS_READY, compactGlimmer, fuseGlimmer, makeGlimmerVariant, registerBuilder } from './glimmers.js';

/** The 8 types this file ships (order = demo order). */
export const GLIMMER_VARIANTS_READY_2 = ['impulse', 'haggler', 'kid', 'elder', 'tourist', 'critic', 'collector', 'newbie'];
/** All 12 (2A's 4 + 2D's 8) — same order as GLIMMER_INFO rows. */
export const ALL_GLIMMER_VARIANTS = [...GLIMMER_VARIANTS_READY, ...GLIMMER_VARIANTS_READY_2];

/** Small helpers for flat (unlit, no-outline) bits: eyes-ish details, glow, sparkles. */
function flat(geo, color, x = 0, y = 0, z = 0) {
  const m = new THREE.Mesh(geo, flatMat(color)); m.position.set(x, y, z); m.userData.noOutline = true; m.castShadow = m.receiveShadow = false; return m;
}
const DARK = 0x37474F;

// ─── accessory builders: (kit, live, r) ; local space = body space, feet at y=0, +Z = front, face at z≈0.36 y≈0.46 ───
// kit.userData.color = the body colour (for arms/limbs that should match the blob).
// Body: shell r0.42 @y0.42 (top ≈ 0.82), peak cone to ≈1.05, eyes at x±0.15.
export const GLIMMER_VARIANTS_2 = {
  impulse(kit, live, r) {
    // spiral eyes: two nested flat rings over each eye (hypno look) + a little sweat/excite drop
    for (const sx of [-1, 1]) {
      const o = flat(G.torus(0.075, 0.012, 4, 10, Math.PI * 1.6), DARK, sx * 0.15, 0.48, 0.405); o.rotation.z = sx * 0.6; kit.add(o);
      const i = flat(G.torus(0.04, 0.011, 4, 8, Math.PI * 1.5), DARK, sx * 0.15 + sx * 0.012, 0.485, 0.41); i.rotation.z = sx * 2.2; kit.add(i);
    }
    const drop = flat(G.sphere(0.035, 6, 5), 0x81D4FA, 0.33, 0.66, 0.22); drop.scale.set(0.8, 1.3, 0.8); kit.add(drop);
    // "SALE!" sticker slapped on the belly + two stubby arms thrown up in excitement (toon parts)
    const tag = mesh(G.box(0.2, 0.12, 0.03), vary(P.red, 0.06, r), -0.2, 0.3, 0.36); tag.rotation.z = 0.35; tag.rotation.x = -0.3; kit.add(tag);
    kit.add(flat(G.box(0.13, 0.025, 0.035), P.white, -0.2, 0.3, 0.365).rotateZ(0.35));
    for (const sx of [-1, 1]) { const arm = mesh(G.capsule(0.05, 0.16, 2, 6), vary(kit.userData.color ?? 0xFF8A65, 0.05, r), sx * 0.44, 0.62, 0.1); arm.rotation.z = -sx * 0.5; kit.add(arm); }
    // sparkle ring (LIVE): 4 tiny gold octahedra orbiting the head
    live.position.set(0, 0.98, 0);
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2; const s = flat(G.ico(0.045, 0), P.sparkGold, Math.cos(a) * 0.48, (i % 2) * 0.06, Math.sin(a) * 0.48); s.rotation.set(a, a * 0.7, 0); live.add(s); }
  },
  haggler(kit, live, r) {
    // dealer's visor: green translucent-looking brim + black head band, coin pouch on the hip with a gold coin
    const green = vary(0x43A047, 0.06, r);
    const band = mesh(G.torus(0.37, 0.035, 5, 14), DARK, 0, 0.74, 0); band.rotation.x = Math.PI / 2; band.scale.set(1, 1, 0.75); kit.add(band);
    // brim = half disc out front (box fan of 3 thin boxes = cheap wedge) + lip
    for (let i = -1; i <= 1; i++) { const b = mesh(G.box(0.3, 0.03, 0.34), green, Math.sin(i * 0.55) * 0.28, 0.76, 0.2 + Math.cos(i * 0.55) * 0.14); b.rotation.y = -i * 0.55; kit.add(b); }
    const brimLip = mesh(G.box(0.5, 0.035, 0.05), 0x2E7D32, 0, 0.76, 0.5); kit.add(brimLip);
    const pouch = mesh(G.sphere(0.13, 8, 6), vary(P.wood, 0.1, r), -0.42, 0.3, 0.1); pouch.scale.set(0.9, 1.1, 0.7); kit.add(pouch);
    const tie = mesh(G.torus(0.05, 0.02, 4, 8), P.woodDark, -0.42, 0.42, 0.1); tie.rotation.x = Math.PI / 2; kit.add(tie);
    const coin = flat(G.cyl(0.055, 0.055, 0.02, 10), P.sparkGold, -0.42, 0.47, 0.1); coin.rotation.x = 0.4; coin.rotation.z = 0.3; kit.add(coin);
    // a "%"-ish price tag dangling from the band (box + hole ring)
    const tag = mesh(G.box(0.12, 0.09, 0.02), 0xFFF8E1, 0.36, 0.64, 0.14); tag.rotation.z = -0.4; kit.add(tag);
    kit.add(flat(G.box(0.05, 0.015, 0.025), P.red, 0.36, 0.645, 0.14));
    kit.add(flat(G.box(0.015, 0.05, 0.025), P.red, 0.36, 0.645, 0.14));
  },
  kid(kit, live, r) {
    // propeller beanie: dome + colour band + button stalk, big lollipop on the side; propeller is LIVE
    const red = vary(P.red, 0.06, r), blue = 0x42A5F5;
    const dome = mesh(G.sphere(0.34, 10, 6), red, 0, 0.72, 0); dome.scale.set(1, 0.62, 1); kit.add(dome);
    // 4 colour wedges = thin boxes draped over the dome
    for (let i = 0; i < 4; i++) { const a = i * Math.PI / 2 + Math.PI / 4; const w = mesh(G.box(0.08, 0.02, 0.3), i % 2 ? blue : P.white, Math.cos(a) * 0.17, 0.9, Math.sin(a) * 0.17); w.rotation.y = -a + Math.PI / 2; w.rotation.x = 0.05; w.lookAt(0, 1.3, 0); kit.add(w); }
    const band = mesh(G.torus(0.33, 0.035, 5, 14), blue, 0, 0.72, 0); band.rotation.x = Math.PI / 2; kit.add(band);
    const stalk = mesh(G.cyl(0.02, 0.025, 0.1, 6), P.sparkGoldDark, 0, 0.98, 0); kit.add(stalk);
    // lollipop held at the right side
    const stick = mesh(G.cyl(0.015, 0.015, 0.3, 5), P.white, 0.5, 0.3, 0.18); stick.rotation.z = -0.35; kit.add(stick);
    const candy = mesh(G.sphere(0.1, 8, 6), 0xFF4081, 0.56, 0.46, 0.18); candy.scale.set(1, 1, 0.5); kit.add(candy);
    kit.add(flat(G.torus(0.05, 0.012, 4, 8, Math.PI * 1.5), P.white, 0.56, 0.46, 0.235));
    // freckles
    for (const sx of [-1, 1]) for (let i = 0; i < 2; i++) kit.add(flat(G.sphere(0.014, 4, 3), 0xD84315, sx * (0.26 + i * 0.05), 0.38 - i * 0.03, 0.33 - i * 0.02));
    // LIVE propeller: two crossed blades + hub, pivot on top of the stalk
    live.position.set(0, 1.04, 0);
    live.add(mesh(G.box(0.46, 0.02, 0.07), P.sparkGold, 0, 0, 0));
    const b2 = mesh(G.box(0.46, 0.02, 0.07), P.sparkGold, 0, 0, 0); b2.rotation.y = Math.PI / 2; live.add(b2);
    live.add(mesh(G.sphere(0.04, 6, 5), red, 0, 0.01, 0));
  },
  elder(kit, live, r) {
    // round spectacles + bridge, flat cap, knitted shawl; the cane is LIVE (sways)
    const frame = 0x5D4037;
    for (const sx of [-1, 1]) { const ring = mesh(G.torus(0.105, 0.016, 5, 12), frame, sx * 0.15, 0.475, 0.41); kit.add(ring); }
    kit.add(mesh(G.box(0.08, 0.016, 0.016), frame, 0, 0.5, 0.41));
    for (const sx of [-1, 1]) { const arm = mesh(G.box(0.016, 0.016, 0.3), frame, sx * 0.4, 0.5, 0.26); arm.rotation.y = sx * 0.35; kit.add(arm); }
    // flat cap (tweed): squashed sphere + a little brim out front
    const cap = mesh(G.sphere(0.36, 10, 6), vary(0x8D6E63, 0.08, r), 0, 0.7, -0.03); cap.scale.set(1.05, 0.5, 1); kit.add(cap);
    const brim = mesh(G.box(0.4, 0.03, 0.22), 0x6D4C41, 0, 0.72, 0.3); brim.rotation.x = 0.12; kit.add(brim);
    // shawl: half torus around the back of the neck + two tassels
    const shawl = mesh(G.torus(0.38, 0.06, 6, 14, Math.PI), vary(0xB0BEC5, 0.06, r), 0, 0.5, -0.02); shawl.rotation.x = Math.PI / 2; kit.add(shawl);
    for (const sx of [-1, 1]) { const t = mesh(G.box(0.07, 0.22, 0.05), 0x90A4AE, sx * 0.37, 0.36, 0.08); t.rotation.z = -sx * 0.25; kit.add(t); }
    // LIVE cane: pivot at the handle (y 0.62) so the tip stays near the ground when swaying
    live.position.set(0.5, 0.62, 0.2); live.rotation.z = -0.22;
    const shaft = mesh(G.cyl(0.022, 0.028, 0.6, 6), P.woodDark, 0, -0.3, 0); live.add(shaft);
    const handle = mesh(G.torus(0.06, 0.022, 5, 10, Math.PI), P.woodDark, 0.06, 0, 0); live.add(handle);
    live.add(mesh(G.cyl(0.03, 0.03, 0.03, 6), P.metal, 0, -0.6, 0));
  },
  tourist(kit, live, r) {
    // straw sun hat + camera on a neck strap + a souvenir flower; LIVE = flash bulb
    const straw = vary(0xF9E7A1, 0.05, r);
    const brim = mesh(G.cyl(0.58, 0.6, 0.035, 12), straw, 0, 0.78, 0); kit.add(brim);
    const crown = mesh(G.cyl(0.27, 0.31, 0.2, 10), straw, 0, 0.89, 0); kit.add(crown);
    const hband = mesh(G.torus(0.29, 0.03, 5, 12), P.red, 0, 0.84, 0); hband.rotation.x = Math.PI / 2; kit.add(hband);
    const strap = mesh(G.torus(0.37, 0.022, 5, 14), DARK, 0, 0.56, 0); strap.rotation.x = Math.PI / 2; strap.scale.set(1, 1, 0.95); kit.add(strap);
    const cam = mesh(G.box(0.26, 0.16, 0.12), DARK, 0, 0.34, 0.44); kit.add(cam);
    kit.add(mesh(G.box(0.26, 0.05, 0.125), P.metal, 0, 0.405, 0.44));
    const lens = mesh(G.cyl(0.06, 0.06, 0.06, 10), P.metal, 0, 0.33, 0.52); lens.rotation.x = Math.PI / 2; kit.add(lens);
    kit.add(flat(G.cyl(0.04, 0.04, 0.02, 10), 0x1E88E5, 0, 0.33, 0.56).rotateX(Math.PI / 2));
    kit.add(mesh(G.cyl(0.02, 0.02, 0.03, 6), P.red, 0.09, 0.44, 0.44));   // shutter button
    // hibiscus pinned to the hat
    const petals = group(); for (let i = 0; i < 5; i++) { const a = i * Math.PI * 2 / 5; const p = mesh(G.sphere(0.045, 6, 5), 0xFF7043, 0.33 + Math.cos(a) * 0.05, 0.9 + Math.sin(a) * 0.05, 0.3); p.scale.set(1, 1, 0.5); petals.add(p); }
    kit.add(petals); kit.add(flat(G.sphere(0.025, 5, 4), P.sparkGold, 0.33, 0.9, 0.325));
    // LIVE flash bulb (flat white sphere) — pops every 2.6 s
    live.position.set(-0.08, 0.44, 0.47);
    live.add(flat(G.sphere(0.03, 6, 5), 0xFFFDE7, 0, 0, 0));
  },
  critic(kit, live, r) {
    // bow tie, monocle, raised brow, notepad in front; LIVE = pencil scribbling
    const grey = vary(0x546E7A, 0.06, r);
    for (const sx of [-1, 1]) { const w = mesh(G.cone(0.07, 0.14, 4), P.red, sx * 0.08, 0.26, 0.4); w.rotation.z = sx * Math.PI / 2; w.scale.set(1, 1, 0.5); kit.add(w); }
    kit.add(mesh(G.box(0.05, 0.05, 0.05), 0xB71C1C, 0, 0.26, 0.41));
    const mono = mesh(G.torus(0.11, 0.015, 5, 12), P.sparkGoldDark, 0.15, 0.475, 0.41); kit.add(mono);
    const chain = mesh(G.box(0.012, 0.22, 0.012), P.sparkGoldDark, 0.3, 0.4, 0.34); chain.rotation.z = -0.5; kit.add(chain);
    const brow = mesh(G.box(0.14, 0.03, 0.03), DARK, -0.15, 0.6, 0.4); brow.rotation.z = -0.35; kit.add(brow);
    // notepad held low at the front-left
    const pad = mesh(G.box(0.22, 0.28, 0.03), P.white, -0.3, 0.32, 0.36); pad.rotation.z = 0.15; pad.rotation.x = -0.35; kit.add(pad);
    for (let i = 0; i < 4; i++) { const l = flat(G.box(0.14, 0.012, 0.005), 0x90A4AE, -0.3 + (i % 2) * 0.01, 0.42 - i * 0.055, 0.375 + (0.42 - i * 0.055 - 0.32) * 0.36); l.rotation.z = 0.15; l.rotation.x = -0.35; kit.add(l); }
    kit.add(mesh(G.box(0.22, 0.03, 0.035), grey, -0.3, 0.465, 0.31).rotateZ(0.15));  // spiral binding bar
    // LIVE pencil: pivot at the eraser end, tip touching the pad
    live.position.set(-0.08, 0.5, 0.47); live.rotation.x = 0.5; live.rotation.z = -0.3;
    live.add(mesh(G.cyl(0.018, 0.018, 0.26, 6), P.sparkGold, 0, -0.13, 0));
    live.add(mesh(G.cone(0.018, 0.05, 6), 0xFFE0B2, 0, -0.285, 0).rotateX(Math.PI));
    live.add(mesh(G.cyl(0.02, 0.02, 0.03, 6), 0xF48FB1, 0, 0.01, 0));
  },
  collector(kit, live, r) {
    // glass jar on the back (lid + label), sash with 3 badges, magnifier on the hip; LIVE = coins inside the jar
    const glass = 0xB2EBF2;
    const jar = mesh(G.cyl(0.2, 0.22, 0.4, 10), glass, 0, 0.42, -0.42); kit.add(jar);
    const lid = mesh(G.cyl(0.21, 0.21, 0.05, 10), P.sparkGoldDark, 0, 0.645, -0.42); kit.add(lid);
    kit.add(mesh(G.cyl(0.04, 0.04, 0.03, 6), P.sparkGoldDark, 0, 0.68, -0.42));
    const label = mesh(G.box(0.16, 0.12, 0.02), 0xFFF8E1, 0, 0.4, -0.64); kit.add(label);
    for (const sx of [-1, 1]) { const strap = mesh(G.box(0.05, 0.3, 0.05), P.woodDark, sx * 0.2, 0.6, -0.2); strap.rotation.x = -0.5; kit.add(strap); }
    // sash across the chest with badges
    const sash = mesh(G.box(0.11, 0.62, 0.04), vary(0x7E57C2, 0.08, r), 0, 0.42, 0.33); sash.rotation.z = 0.55; sash.rotation.x = -0.15; kit.add(sash);
    const badgeCols = [P.sparkGold, 0xEF5350, 0x29B6F6];
    badgeCols.forEach((c, i) => { const t = -0.2 + i * 0.2; const b = flat(G.cyl(0.035, 0.035, 0.02, 8), c, -Math.sin(0.55) * t * 0.95, 0.42 + Math.cos(0.55) * t, 0.37 + 0.03 * i); b.rotation.x = Math.PI / 2 - 0.15; kit.add(b); });
    // magnifier on the right hip
    const mag = mesh(G.torus(0.07, 0.018, 5, 12), P.metalDark, 0.46, 0.34, 0.12); kit.add(mag);
    kit.add(flat(G.cyl(0.055, 0.055, 0.01, 10), 0xE0F7FA, 0.46, 0.34, 0.12).rotateX(Math.PI / 2));
    kit.add(mesh(G.cyl(0.015, 0.015, 0.12, 5), P.woodDark, 0.46, 0.21, 0.12));
    // LIVE: 3 Spark coins inside the jar (flat gold), bob + spin
    live.position.set(0, 0.36, -0.42);
    for (let i = 0; i < 3; i++) { const a = i * 2.1; const c = flat(G.cyl(0.05, 0.05, 0.02, 8), P.sparkGold, Math.cos(a) * 0.09, i * 0.06 - 0.05, Math.sin(a) * 0.09); c.rotation.set(0.6, a, 0.3); live.add(c); }
  },
  newbie(kit, live, r) {
    // name tag + map scroll under the "arm" + oversized wobbly scarf knot; LIVE = "?" thought bubble above the head
    const tag = mesh(G.box(0.2, 0.11, 0.02), P.white, 0.2, 0.52, 0.37); tag.rotation.y = -0.3; tag.rotation.x = -0.2; kit.add(tag);
    kit.add(flat(G.box(0.2, 0.03, 0.025), P.red, 0.2, 0.555, 0.375).rotateY(-0.3));
    for (let i = 0; i < 2; i++) kit.add(flat(G.box(0.12, 0.012, 0.025), 0x90A4AE, 0.2, 0.5 - i * 0.03, 0.375).rotateY(-0.3));
    const map = mesh(G.cyl(0.05, 0.05, 0.3, 8), 0xFFF3C4, -0.45, 0.4, 0.05); map.rotation.x = Math.PI / 2; map.rotation.z = 0.2; kit.add(map);
    kit.add(mesh(G.torus(0.05, 0.012, 4, 8), P.red, -0.45, 0.4, 0.05).rotateX(Math.PI / 2));
    const knot = mesh(G.sphere(0.09, 6, 5), vary(0x66BB6A, 0.1, r), 0.3, 0.6, 0.26); kit.add(knot);
    const sc = mesh(G.torus(0.34, 0.05, 5, 12), vary(0x66BB6A, 0.1, r), 0, 0.6, 0); sc.rotation.x = Math.PI / 2; sc.scale.set(1, 1, 0.85); kit.add(sc);
    // LIVE bubble: white blob + tail + a "?" made from a half torus, a short bar and a dot
    live.position.set(0.3, 1.3, 0.05);
    const bub = flat(G.sphere(0.2, 10, 7), P.white, 0, 0, 0); bub.scale.set(1.15, 1, 0.8); live.add(bub);
    live.add(flat(G.sphere(0.07, 6, 5), P.white, -0.14, -0.2, 0.02));
    live.add(flat(G.sphere(0.04, 6, 5), P.white, -0.23, -0.31, 0.03));
    const q = flat(G.torus(0.06, 0.018, 5, 10, Math.PI * 1.3), DARK, 0, 0.05, 0.17); q.rotation.z = -0.3; live.add(q);
    live.add(flat(G.box(0.03, 0.07, 0.03), DARK, 0.0, -0.05, 0.17));
    live.add(flat(G.sphere(0.022, 5, 4), DARK, 0.0, -0.13, 0.17));
  },
};

// ─── idle flourishes: (root, t, dt) → moves root.userData.parts.live (the pivot group) ───
export const FLOURISH = {
  kid(root, t, dt) { const l = root.userData.parts.live; if (l) l.rotation.y += dt * 14; },
  elder(root, t) { const l = root.userData.parts.live; if (l) l.rotation.z = -0.22 + Math.sin(t * 1.6) * 0.05; },
  impulse(root, t) { const l = root.userData.parts.live; if (!l) return; l.rotation.y = t * 2.2; l.position.y = 0.98 + Math.sin(t * 5) * 0.04; const s = 1 + Math.sin(t * 3 * Math.PI * 2) * 0.12; l.scale.setScalar(s); },
  tourist(root, t) { const l = root.userData.parts.live; if (!l) return; const ph = t % 2.6; const s = ph < 0.22 ? 1 + 1.4 * (1 - ph / 0.22) ** 2 : 1; l.scale.setScalar(s); },
  critic(root, t) { const l = root.userData.parts.live; if (!l) return; l.rotation.x = 0.5 + Math.sin(t * 9) * 0.18; l.position.y = 0.5 + Math.sin(t * 18) * 0.015; },
  collector(root, t) { const l = root.userData.parts.live; if (!l) return; l.position.y = 0.36 + Math.sin(t * 3) * 0.03; l.rotation.y = t * 1.2; },
  newbie(root, t) { const l = root.userData.parts.live; if (!l) return; l.position.y = 1.3 + Math.sin(t * 2.4) * 0.05; l.rotation.z = Math.sin(t * 1.7) * 0.12; },
};

/**
 * Build one of the 8 2D Glimmer variants. Same return shape as 2A makeGlimmerVariant():
 * Group (feet pivot) with Foundation part names + `parts.kit` (merged static kit), `parts.live` (animated pivot
 * group or null), `userData.type`, `userData.info`, `userData.update(dt)` (idle flourish — call it every frame).
 * @param {string} type ∈ GLIMMER_VARIANTS_READY_2
 * @param {{ seed?:number, color?:number, size?:number, outline?:boolean, compact?:boolean }} opts
 */
export function makeGlimmerVariant2(type = 'newbie', opts = {}) {
  const build = GLIMMER_VARIANTS_2[type];
  if (!build) return makeGlimmerVariant(type, opts);                 // not ours → 2A (or its regular fallback)
  const info = GLIMMER_INFO[type] || GLIMMER_INFO.regular;
  const r = rng(opts.seed ?? 1);
  const root = makeGlimmer({ color: opts.color ?? info.color, size: opts.size ?? info.size });
  root.name = 'glimmer_' + type;
  const body = root.userData.parts.body;
  if (opts.compact !== false) compactGlimmer(root);                   // 13 dc → 6 dc for the bare body
  const raw = new THREE.Group(); raw.name = 'kit_raw'; raw.userData.color = opts.color ?? info.color;
  const liveRaw = new THREE.Group(); liveRaw.name = 'live_raw';
  build(raw, liveRaw, r);
  // static kit → 1 toon mesh (+hull) + ≤ 1 flat mesh (no hull, no tint)
  body.add(raw);
  const kit = mergeGroup(raw); kit.name = 'kit';
  body.remove(raw); body.add(kit);
  for (const m of kit.children) if (m.name === 'merged_flat') { m.userData.noOutline = true; m.castShadow = false; }
  if (opts.outline !== false) addOutline(kit);
  // live kit → merged in its own pivot space, re-parented at the pivot transform
  let live = null;
  if (liveRaw.children.length) {
    const pos = liveRaw.position.clone(), rot = liveRaw.rotation.clone();
    liveRaw.position.set(0, 0, 0); liveRaw.rotation.set(0, 0, 0);
    body.add(liveRaw);
    live = mergeGroup(liveRaw); live.name = 'live';
    body.remove(liveRaw);
    live.position.copy(pos); live.rotation.copy(rot);
    body.add(live);
    for (const m of live.children) if (m.name === 'merged_flat') { m.userData.noOutline = true; m.castShadow = false; }
    if (opts.outline !== false) addOutline(live);
  }
  root.userData.parts.kit = kit;
  root.userData.parts.live = live;
  root.userData.type = type;
  root.userData.info = info;
  if (opts.fuse !== false && opts.compact !== false) fuseGlimmer(root, opts);   // 11A: body+kit+core → 1 toon + 1 hull + 1 flat
  const fl = FLOURISH[type];
  let t = r() * 10;
  root.userData.update = fl ? (dt) => { t += dt; fl(root, t, dt); } : () => {};
  return root;
}

/** Any of the 12 types: 2A's four via makeGlimmerVariant, 2D's eight via makeGlimmerVariant2. Always has userData.update. */
export function makeGlimmerAny(type = 'regular', opts = {}) {
  const g = GLIMMER_VARIANTS_2[type] ? makeGlimmerVariant2(type, opts) : makeGlimmerVariant(type, opts);
  if (typeof g.userData.update !== 'function') g.userData.update = () => {};
  if (!('live' in g.userData.parts)) g.userData.parts.live = null;
  return g;
}

/**
 * Register the 8 builders into a builder map (e.g. 2A's BUILD once it is exported — see CHANGE_REQUESTS) and
 * make sure every 2D type is listed in GLIMMER_TYPES. Returns the number of builders added.
 * `target` builders get the 2A signature (kit, r); the live group is dropped there (static-only fallback).
 */
export function registerVariants(target) {
  let n = 0;
  if (target && typeof target === 'object') {
    for (const [type, build] of Object.entries(GLIMMER_VARIANTS_2)) { if (!target[type]) { target[type] = (kit, r) => build(kit, new THREE.Group(), r); n++; } }
  } else {
    // 10A: CHANGE_REQUEST [2D] applied — 2A now exports registerBuilder(). Static-only fallback (live group dropped);
    // makeGlimmerAny() still routes to makeGlimmerVariant2 for the full kit + flourish.
    for (const [type, build] of Object.entries(GLIMMER_VARIANTS_2)) { if (registerBuilder(type, (kit, r) => build(kit, new THREE.Group(), r))) n++; }
  }
  for (const type of GLIMMER_VARIANTS_READY_2) if (!GLIMMER_TYPES.includes(type)) GLIMMER_TYPES.push(type);
  return n;
}
// Register at import time so plain makeGlimmerVariant('kid') from any module gets the 2D kit (CHANGE_REQUEST [2D] closed).
export const GLIMMER_BUILDERS_REGISTERED = registerVariants();
