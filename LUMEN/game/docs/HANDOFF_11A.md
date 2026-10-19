# HANDOFF 11A — Performance pass (IN PROGRESS — resume file)

Owned: perf-only edits anywhere · `docs/PERF.md` · `src/systems/perf.js` (new) · `check.mjs --world` budget lines.
Start point (10D master): `check.mjs --world` worst-case 434 visible meshes; browser smoke index.html 162, in play 169–253 (10B/10D).

## Plan = Missing list (tick as they land; each item = one wip.sh commit)
- [ ] P1.0 measurement fix: `meshCount` in check.mjs counts meshes under invisible parents (helper `held` crate = 3 m × 6 never drawn). Count like the renderer does.
- [ ] P1.1 Lever 1 glimmers: body + static kit → ONE toon mesh + ONE hull; core + kit flat bits → ONE flat mesh (−2…3 dc × 12).
- [ ] P1.2 Lever 1 villains/helpers: merge rigid sub-parts (hat→head, scroll→tool) where the animator never moves them apart.
- [ ] P1.3 Lever 3 blob shadows: every creature shadow disc → one shared InstancedMesh (`BlobShadows` in src/systems/perf.js) (−1 dc per creature on screen, up to −30 in play).
- [ ] P1.4 Lever 2 lantern/jar bodies baked into the zone batch, only glass/glow live (−18).
- [ ] P1.5 tighten `WORLD_BUDGET` after each lever to measured + 10 %; record before/after in docs/PERF.md.
- [ ] P2.1 LOD: hide accessory hulls beyond 18 u, all creature hulls + tiny flat bits beyond 26 u (hysteresis 1 u).
- [ ] P2.2 pixelRatio governor: fps < 45 for 3 s → drop one step (1.5 → 1.25 → 1.0 → 0.85), fps > 58 for 10 s → raise one step.
- [ ] P3 dispose on despawn / level swap; 10-min memory check headless (geometry count stable).

## Done
(nothing yet)

## Measured
(see docs/PERF.md once it exists)

## Notes for the integrator
(filled at close)
