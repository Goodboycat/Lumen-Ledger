# HANDOFF 10B — Integrate systems (IN PROGRESS — resume file; a chat that finds this reads it FIRST)

## Why the two previous 10B chats delivered nothing (autopsy, 2026-10-19)
1. They had no GitHub origin for most of the chat → nothing pushed; sandbox gone = work gone.
2. They tried to write `src/Game.js` (≈ 400–600 lines: the whole demo_world.html port + 3 systems) in ONE `Write` call.
   A Write larger than the output-token limit is truncated and discarded → file never existed on disk → "can't commit".
3. They re-read demo_world.html + check.mjs + 5 HANDOFFs in full (≈ 2500 lines) before writing a byte → context/credits burnt.
4. The "finish the island" scope creep: 10B does NOT re-place the island scenery; `demo_world.html` already does and
   `check.mjs --world` already asserts it. 10B = Economy + Build + Customers + hero abilities wired, nothing more.
Fixes: START_HERE rule 10 (checkpoint 25 %) + rule 11 (skeleton → Edit → wip.sh per method; HANDOFF first).

## Plan = Missing list (tick items off as they land; each item = one commit + push)
- [ ] `src/Game.js` skeleton: `createSandbox(container, opts)` → island + VFX + hero + economy/build/customers constructed, update loop
- [ ] world scenery: port the "place/free/take" helpers + landmarks + stall spots from demo_world (only what Build/Customers need)
- [ ] debug keys: **B** build mode (enter current pick) · **1–9** pick stall type · **E** end season → LedgerReport to console
- [ ] `demo_sandbox.html`: window.game, game.stats (fps · dc), help panel, 2 seasons without errors
- [ ] `check.mjs --sandbox`: headless createSandbox (mock renderer) → place 3 stalls → wave → run 2 seasons (150 s accelerated) → 2 reports, no NaN
- [ ] P2: abilities → economy via bus: haggleShout → price boost on queued customers · coinMagnetDash → collect pending coins (earn)
      · growthStomp → stall baseMul pulse · bubbleShield → absorbs next event (protect) · fogSweep → eco.pushFog · ledgerFlash → reveal scam
- [ ] P3: **H** hires next helper (eco.buyUpgrade helper_*) → HelperAnimator work loop at the nearest owned stall
- [ ] close: check ALL OK → this file Done/Measured → README row → remove 10B from Next → commit + push

## Done
(nothing yet — see trail: `git log --oneline --grep="WIP 10B"`)

## Measured
—

## Suspected
—

## Notes for the integrator (10C)
- `createSandbox()` returns `{ game, island, eco, build, cust, hero, vfx, world }`; 10C mounts the UI on `game.bus` events only.
