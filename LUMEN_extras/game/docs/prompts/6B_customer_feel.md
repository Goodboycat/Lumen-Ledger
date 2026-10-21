# Chat 6B — Customer feel & crowd perf
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) incl. 6A + 9A
Owned (only these files): game/src/systems/customers.js (v2), game/demo_customers.html
Read (API_CONTRACTS): 6A code, §B VFX pack (coinFly)
Export: same §B Customers interface

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- coin flies to hero on pay (vfx.coinFly), pop text "+N", VIP/impulse behaviours.
### P2 — should ship (≈ 25 credits)
- Crowd instancing: Glimmer bodies as InstancedMesh when > 20 active (accessories hidden at distance); ≥ 60 Glimmers at 60 fps desktop.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Reactions to price changes mid-queue, chatter bubbles (DOM).

## Demo page `game/demo_customers.html`
Stress key S spawns 60.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_customers.html --shots --close`.

## Handoff `docs/HANDOFF_6B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
