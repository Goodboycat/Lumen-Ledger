# Chat 10D — Save/load + tutorial flow
Needs: 10C master
Owned (only these files): game/src/systems/save.js, tutorial lines in game/src/Game.js
Read (API_CONTRACTS): Economy.serialize, Story state
Export: versioned localStorage save; Continue on title; season-1 tutorial toasts

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- save.js: save(state) / load() / clear(), version field, autosave at endSeason.
### P2 — should ship (≈ 25 credits)
- Tutorial: 8 toasts gated on first actions (move, build, set price, jars, end season).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Export/import save as text (for the Flutter WebView if storage is cleared).

## Demo page `game/index.html`
Reload resumes.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs index.html --shots --close`.

## Handoff `docs/HANDOFF_10D.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
