// Outline via inverted hull: a BackSide copy of each mesh extruded along normals.
// No post-processing → works on old phones, costs 1 extra draw call per mesh
// (or per InstancedMesh). Thickness is in world units and scaled with camera distance
// by the shader so lines stay visually constant.
import * as THREE from '../../vendor/three.module.js';

const vert = /* glsl */`
  uniform float uThickness;
  void main() {
    vec3 n = normalize(normalMatrix * normal);
    vec4 mv = modelViewMatrix * vec4(position, 1.0);
    // constant screen-space-ish thickness: scale by distance
    float d = -mv.z;
    mv.xyz += n * uThickness * (0.35 + d * 0.045);
    gl_Position = projectionMatrix * mv;
  }`;
const frag = /* glsl */`
  uniform vec3 uColor;
  void main() { gl_FragColor = vec4(uColor, 1.0); }`;

let _mat = null;
export function outlineMaterial(color = 0x263238) {
  if (_mat) return _mat;
  _mat = new THREE.ShaderMaterial({
    uniforms: { uThickness: { value: 0.035 }, uColor: { value: new THREE.Color(color) } },
    vertexShader: vert, fragmentShader: frag,
    side: THREE.BackSide, depthWrite: true,
  });
  return _mat;
}

/** Global thickness control (0.02 thin … 0.06 chunky). */
export function setOutlineThickness(v) { outlineMaterial().uniforms.uThickness.value = v; }

/**
 * Add outlines to every Mesh under `root`. Skips meshes flagged `userData.noOutline`.
 * Works with InstancedMesh (shares instanceMatrix). Returns root.
 */
export function addOutline(root) {
  const mat = outlineMaterial();
  const toAdd = [];
  root.traverse((o) => {
    if (!o.isMesh || o.userData.noOutline || o.userData.isOutline) return;
    let hull;
    if (o.isInstancedMesh) {
      hull = new THREE.InstancedMesh(o.geometry, mat, o.count);
      hull.instanceMatrix = o.instanceMatrix; // shared buffer
    } else {
      hull = new THREE.Mesh(o.geometry, mat);
    }
    hull.userData.isOutline = true;
    hull.castShadow = false; hull.receiveShadow = false;
    hull.frustumCulled = o.frustumCulled;
    toAdd.push([o, hull]);
  });
  for (const [o, hull] of toAdd) o.add(hull); // child → inherits transforms & squash
  return root;
}

/** Remove outlines (e.g. when swapping a stall's level mesh). */
export function removeOutline(root) {
  const rm = [];
  root.traverse((o) => { if (o.userData.isOutline) rm.push(o); });
  rm.forEach((o) => o.parent && o.parent.remove(o));
}
