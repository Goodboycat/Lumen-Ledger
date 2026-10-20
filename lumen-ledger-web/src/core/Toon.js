// Toon shading: 3-step ramp via MeshToonMaterial + gradient map, plus cached materials
// and the official Lumen Ledger palette. Every chat MUST create materials via toonMat().
import * as THREE from '../../vendor/three.module.js';

export const PALETTE = {
  grass: 0x7ed957, grassDark: 0x5fbf45, dirt: 0xc89b63, sand: 0xf3dfa2,
  heroOrange: 0xffa726, heroSkin: 0xffe0b2, heroHair: 0x6d4c41, heroPants: 0x3e6fb0,
  glimmerBlue: 0x4fc3f7, glimmerPink: 0xf48fb1, glimmerGreen: 0xaed581, glimmerYellow: 0xfff176,
  sparkGold: 0xffd54f, sparkGoldDark: 0xf9a825,
  debtFog: 0x7b5ea7, debtFogDark: 0x4a3570,
  wood: 0xa1704a, woodDark: 0x6d4a30, stone: 0x9e9e9e, stoneDark: 0x757575,
  leaf: 0x66bb6a, leafDark: 0x43a047, trunk: 0x8d6e63,
  white: 0xffffff, black: 0x263238, red: 0xef5350, metal: 0xb0bec5, metalDark: 0x78909c,
  sky: 0xbfe8ff, water: 0x4dd0e1,
};

let _ramp = null;
/** 3-step gradient map (dark / mid / light). Shared by all toon materials. */
export function toonRamp() {
  if (_ramp) return _ramp;
  const data = new Uint8Array([90, 170, 255]);
  const tex = new THREE.DataTexture(data, 3, 1, THREE.RedFormat);
  tex.minFilter = tex.magFilter = THREE.NearestFilter;
  tex.needsUpdate = true;
  _ramp = tex;
  return tex;
}

const _cache = new Map();
/**
 * Cached toon material by color (+ optional flags). Reusing materials keeps draw-call
 * batching cheap and memory low. Do NOT mutate returned materials; clone if needed.
 * @param {number} color hex
 * @param {{emissive?:number, flat?:boolean, transparent?:boolean, opacity?:number, side?:number}} opts
 */
export function toonMat(color, opts = {}) {
  const key = color + '|' + (opts.emissive || 0) + '|' + (opts.transparent ? 'T' + (opts.opacity ?? 1) : '') + '|' + (opts.side || 0);
  let m = _cache.get(key);
  if (m) return m;
  m = new THREE.MeshToonMaterial({
    color, gradientMap: toonRamp(),
    emissive: opts.emissive || 0x000000,
    transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    side: opts.side || THREE.FrontSide,
  });
  _cache.set(key, m);
  return m;
}

/** Unlit flat color (for VFX quads, trails, ground decals). */
export function flatMat(color, opts = {}) {
  return new THREE.MeshBasicMaterial({
    color, transparent: !!opts.transparent, opacity: opts.opacity ?? 1,
    blending: opts.additive ? THREE.AdditiveBlending : THREE.NormalBlending,
    depthWrite: opts.depthWrite ?? !opts.transparent, side: opts.side || THREE.DoubleSide,
    toneMapped: false,
  });
}

/**
 * Setup lights for the toon look: one strong key directional (casts shadow), soft
 * hemisphere fill. Returns { key, hemi } and adds to scene.
 */
export function setupToonLights(scene, { shadows = true, shadowSize = 1024, area = 18 } = {}) {
  const hemi = new THREE.HemisphereLight(0xdff3ff, 0x8a6a3a, 0.75);
  scene.add(hemi);
  const key = new THREE.DirectionalLight(0xfff4e0, 1.6);
  key.position.set(8, 14, 6);
  key.castShadow = shadows;
  if (shadows) {
    key.shadow.mapSize.set(shadowSize, shadowSize);
    const c = key.shadow.camera;
    c.left = -area; c.right = area; c.top = area; c.bottom = -area; c.near = 1; c.far = 50;
    key.shadow.bias = -0.0015; key.shadow.normalBias = 0.02;
  }
  scene.add(key); scene.add(key.target);
  return { key, hemi };
}

/** Walk an Object3D and set shadow flags (call once after building a prop). */
export function setShadows(obj, cast = true, receive = true) {
  obj.traverse((o) => { if (o.isMesh) { o.castShadow = cast; o.receiveShadow = receive; } });
  return obj;
}
