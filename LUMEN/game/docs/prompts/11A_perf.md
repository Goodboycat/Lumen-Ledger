# Chat 11A — Performance pass
Needs: 10D master
Owned (only these files): any file, perf-only edits; docs/PERF.md
Read (API_CONTRACTS): tools/smoke.mjs numbers
Export: ≤ 100 draw calls typical, ≤ 150 peak, 60 fps on 4× CPU throttle desktop

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Measure per-system draw calls; merge/instance the worst offenders; pool checks.
### P2 — should ship (≈ 25 credits)
- LOD: hide accessories/outlines beyond 18 u; pixelRatio auto-drop when fps < 45 for 3 s.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Memory: dispose on level swap/despawn; verify no growth over 10 min.

## Demo page `game/index.html`
Before/after table in PERF.md.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs index.html --shots --close`.

## Handoff `docs/HANDOFF_11A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
