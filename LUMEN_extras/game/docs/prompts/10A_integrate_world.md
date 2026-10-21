# Chat 10A — Integrate world (content chats)
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) (already contains the work of 1A,1B,1C,1D,2A,2B,2C,2D,3A,3B,9A,9B)
Owned (only these files): game/src/assets/props.js (registration lines), game/src/assets/creatures/index.js, game/demo_world.html, docs/CHANGE_REQUESTS.md (apply)
Read (API_CONTRACTS): all HANDOFF_*.md first
Export: `demo_world.html` with everything on Island v2 at ≤ 150 draw calls

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Copy folders in, fix import paths and API mismatches ONLY (no features). Run `node tools/smoke.mjs` on every demo_*.html; list failures; fix.
### P2 — should ship (≈ 25 credits)
- demo_world.html: island v2 + 6 stalls + nature + decor + 12 Glimmers animating + helpers + Baron + hero moves on keys.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Apply CHANGE_REQUESTS.md to Foundation (now allowed).

## Demo page `game/demo_world.html`
Everything visible; stats ≤ 150 draw calls.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_world.html --shots --close`.

## Handoff `docs/HANDOFF_10A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
