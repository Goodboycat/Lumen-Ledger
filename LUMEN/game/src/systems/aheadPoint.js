// S61-B: the Move step's "go there" marker, as a pure function so it can be unit-tested (tests/tutor.test.mjs).
// "Up the screen" = the camera's forward vector projected on the ground (lookAt - position, y dropped). The fixed ¾ rig looks down -z, so with no
// usable camera we fall back to (0,-1). Tries straight up, the two diagonals, the sides, then behind; each candidate must be LAND and clear of buildings.
// Returns {x, z, y} or null when there is no hero.
export function aheadPoint({ hero, camPos, camLook, isLand, occupied, dist = 6 } = {}) {
  if (!hero || !Number.isFinite(hero.x) || !Number.isFinite(hero.z)) return null;
  let ux = 0, uz = -1;
  if (camPos && camLook && Number.isFinite(camPos.x) && Number.isFinite(camLook.x) && Number.isFinite(camPos.z) && Number.isFinite(camLook.z)) {
    const fx = camLook.x - camPos.x, fz = camLook.z - camPos.z, fl = Math.hypot(fx, fz);
    if (fl > 1e-3) { ux = fx / fl; uz = fz / fl; }
  }
  const rot = (k) => [ux * Math.cos(k) - uz * Math.sin(k), ux * Math.sin(k) + uz * Math.cos(k)];
  for (const k of [0, 0.64, -0.64, Math.PI / 2, -Math.PI / 2, Math.PI]) {
    const [dx, dz] = rot(k), x = hero.x + dx * dist, z = hero.z + dz * dist;
    if ((!isLand || isLand(x, z)) && !(occupied && occupied(x, z))) return { x, z, y: 0.2 };
  }
  const d = Math.hypot(hero.x, hero.z) || 1;   // nothing free around Pip: head for the plaza centre
  return { x: hero.x - hero.x / d * Math.min(dist, d), z: hero.z - hero.z / d * Math.min(dist, d), y: 0.2 };
}
