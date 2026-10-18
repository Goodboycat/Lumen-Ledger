# Chat 6A — Customer AI
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) incl. 2A + 5
Owned (only these files): game/src/systems/customers.js, game/src/systems/flowfield.js, game/demo_customers.html
Read (API_CONTRACTS): §A · §B Creatures, Build (stalls() slots), Economy (sell) · export §B Customers
Export: exactly §B Customers

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Flow-field BFS on island grid (cached per target). FSM spawn(pier) → pickStall → walk → queue slot → browse 1.5 s → pay (economy.sell, emit cust:paid) → leave → pool. Max 20 active.
### P2 — should ship (≈ 25 credits)
- Mood from price vs fair → happy/sad anim + moodTint, separation steering, type preferences, max 40.
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Give-up timer when queue full (angry → leave), spawn waves per season.

## Demo page `game/demo_customers.html`
3 stalls pre-placed, wave of 10 every 15 s, count on screen.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_customers.html --shots --close`.

## Handoff `docs/HANDOFF_6A.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
