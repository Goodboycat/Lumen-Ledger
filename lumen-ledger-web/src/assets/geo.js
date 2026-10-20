// Shared low-poly geometry helpers. Geometries are cached by params so hundreds of props
// share buffers. All helpers return THREE.Mesh with toon material, pivot at BASE (y=0)
// unless noted. Use these in every Factory chat.
import * as THREE from '../../vendor/three.module.js';
import { toonMat } from '../core/Toon.js';

const _geo = new Map();
function cached(key, make) { let g = _geo.get(key); if (!g) { g = make(); _geo.set(key, g); } return g; }

export const G = {
  box: (w, h, d) => cached(`box${w},${h},${d}`, () => new THREE.BoxGeometry(w, h, d)),
  /** sphere: low segments for faceted toy look */
  sphere: (r, ws = 10, hs = 7) => cached(`sph${r},${ws},${hs}`, () => new THREE.SphereGeometry(r, ws, hs)),
  cyl: (rt, rb, h, seg = 8) => cached(`cyl${rt},${rb},${h},${seg}`, () => new THREE.CylinderGeometry(rt, rb, h, seg)),
  cone: (r, h, seg = 8) => cached(`cone${r},${h},${seg}`, () => new THREE.ConeGeometry(r, h, seg)),
  capsule: (r, len, cs = 3, rs = 8) => cached(`cap${r},${len},${cs},${rs}`, () => new THREE.CapsuleGeometry(r, len, cs, rs)),
  torus: (r, t, rs = 6, ts = 10) => cached(`tor${r},${t},${rs},${ts}`, () => new THREE.TorusGeometry(r, t, rs, ts)),
  plane: (w, h) => cached(`pl${w},${h}`, () => new THREE.PlaneGeometry(w, h)),
  /** Rounded box via extruded shape (chunky toy edges). */
  rbox: (w, h, d, r = 0.08) => cached(`rbox${w},${h},${d},${r}`, () => roundedBox(w, h, d, r)),
  dodeca: (r) => cached(`dod${r}`, () => new THREE.DodecahedronGeometry(r, 0)),
  ico: (r, det = 0) => cached(`ico${r},${det}`, () => new THREE.IcosahedronGeometry(r, det)),
};

function roundedBox(w, h, d, r) {
  const s = new THREE.Shape();
  const x = -w / 2, y = -h / 2;
  s.moveTo(x + r, y); s.lineTo(x + w - r, y); s.quadraticCurveTo(x + w, y, x + w, y + r);
  s.lineTo(x + w, y + h - r); s.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
  s.lineTo(x + r, y + h); s.quadraticCurveTo(x, y + h, x, y + h - r);
  s.lineTo(x, y + r); s.quadraticCurveTo(x, y, x + r, y);
  const g = new THREE.ExtrudeGeometry(s, { depth: d, bevelEnabled: true, bevelThickness: r, bevelSize: r, bevelSegments: 2, curveSegments: 3 });
  g.translate(0, 0, -d / 2); g.computeVertexNormals();
  return g;
}

/** Mesh helper: mesh(geometry, color, x,y,z) → casts & receives shadows. */
export function mesh(geometry, color, x = 0, y = 0, z = 0, opts) {
  const m = new THREE.Mesh(geometry, typeof color === 'number' ? toonMat(color, opts) : color);
  m.position.set(x, y, z); m.castShadow = true; m.receiveShadow = true;
  return m;
}
/** Box with pivot at base. */
export function block(w, h, d, color, x = 0, y = 0, z = 0) { return mesh(G.box(w, h, d), color, x, y + h / 2, z); }
export function group(...children) { const g = new THREE.Group(); for (const c of children) if (c) g.add(c); return g; }

/** Deterministic PRNG for repeatable prop variation (seeded). */
export function rng(seed = 1) {
  let s = seed >>> 0 || 1;
  return () => { s = (s * 1664525 + 1013904223) >>> 0; return s / 4294967296; };
}
export function pick(arr, r = Math.random) { return arr[Math.floor(r() * arr.length)]; }

/** Slightly vary a hex color (for toy-like non-uniform props). */
export function vary(hex, amt = 0.06, r = Math.random) {
  const c = new THREE.Color(hex); const hsl = {}; c.getHSL(hsl);
  c.setHSL(hsl.h, Math.min(1, hsl.s), Math.min(1, Math.max(0, hsl.l + (r() - 0.5) * amt * 2)));
  return c.getHex();
}
