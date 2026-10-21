# HANDOFF — Chat 1C: Landmarks & Island v2  ✅ DONE (2026-10-17)

Verified: `node tools/check.mjs --props` ALL OK (43 catalog entries) · `demo_landmarks.html` smoke test 0 console errors.
Screenshots: `docs/screenshots/1C_landmarks/`.

## Delivered
### `src/world/Island.js` (Island v2 — every v1 export/field kept: `group, tiles, isLand, update, grass, tuftMesh, sea, foam, makeTree, makeRock`)
- 4 zones: `start` (r 11, same shape as v1 for seed 7) + lobes `far` (0,−20, lighthouse), `west` (−17,12), `east` (17,12),
  separated by a 2-tile water channel. `island.zones = [{ id, index, center:{x,z}, radius, unlocked, group, cells, bridge, bridgeCells }]`.
- Ground per zone = ONE merged vertex-colored toon mesh (grass tops + cliff sides on edge cells + sand path decals) + 1 outline hull,
  + 1 instanced tufts + 1 instanced flowers (instanceColor) + 1 instanced foam. **5–7 draw calls per zone.**
- `isLand(x,z)` honors zones (locked lobes are water). `gridCells()` → unlocked cells. `zoneAt(x,z)`, `nextLockedZone()`, `unlockAll()`,
  `pathCells` (Set "x,z"), `landEdge(dx,dz)`.
- `unlockZone(i, { game, vfx })` → Sequence: **anticipation 200 ms inQuad (dip −0.4, shake 0.2, shore dust ring) → rise 500 ms outBack
  (from y −3.4 to 0, dust burst, shake 0.35) → settle 150 ms outCubic (scaleY 1.04→1, dust ring, "New land!" pop, 40 ms hit-stop).**
  Without `game` it unlocks instantly. Bridges to each lobe are built automatically (`opts.bridges`), bridge cells become walkable on unlock.
- opts: `{ radius, tile, seed, lobes=3, lobeRadius=6, channel=2, zonesUnlocked=1, starterProps=true, bridges=true }`.
### `src/assets/props/landmarks.js` (`LANDMARK_PROPS`, 7 ids, category `landmark`, registered in props.js)
| id | tris | draw calls (mesh+outline) | live parts |
|---|---|---|---|
| lighthouse | 1252 | 8 | `setState('dark'|'flicker'|'lit')`, lamp pop 260 ms outBack, additive rotating double beam (0.6 rad/s), pulsing halo; `userData.lampPos` |
| cottage | 504 | 6 | 3 pooled chimney smoke puffs, `setLit(bool)` window glow |
| pier | 820 | 6 | lantern + bobbing boat; spans +x from pivot (shore end), `length` tiles |
| bridge | 528 | 2 | static, spans +x centered, `length` tiles (used by Island v2) |
| fog_tower | 419 | 7 | 5 pooled Debt-Fog puffs, `setActive(bool)` (zone cleansed), seed = lean/height |
| cliff_wall | 132 | 2 | static, `length` tiles |
| waterfall | 228 | 11 | 5 scrolling water stripes + 4 foam blobs (noOutline) |
`updateLandmarks(dt)` drives every live landmark in one call (or call `g.userData.update(dt)` per prop).

## Measured — draw calls BEFORE / AFTER (same 1280×720 viewport, far camera)
- Foundation Island v1 (`index.html`): **379 draw calls** total (island alone ≈ 200).
- Island v2 start zone + cottage + pier + Pip: **105 draw calls** at load; whole island with all 4 zones + 7 landmarks visible: **115**;
  close-ups 26–33. Scene tris 18–39 k.

## Missing / Suspected
- Lobes get no path-to-bridge alignment guarantee for odd angles (west/east bridges land on the lobe shore but the lobe's own sand spoke
  may be 1 tile off). Cosmetic; Chat 10A can tweak `_addZone` spoke angle if it bothers.
- No LOD; at 2018-phone target the merged ground is already the cheapest possible (1 mesh). 11A can drop zone outlines on `low` quality.
- Island v1 "starter props" are still the placeholder tree/rock (now merged → 2 dc each). 10A replaces them with 1B nature props.

## Notes for integrator (10A / 5 / 6)
- Place stalls only on `island.isLand(x,z) && !island.pathCells.has(`${x},${z}`)`. Bridge cells are land but 1 tile wide.
- `island.zones[1]` (far) is the lighthouse zone → story end: `lighthouse.userData.setState('lit')`.
- Add landmarks as children of `zone.group` so they rise with the unlock animation (see demo).
