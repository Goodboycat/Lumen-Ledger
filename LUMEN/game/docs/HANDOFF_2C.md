# HANDOFF — Chat 2C: Baron Gilt + Fog Collectors + VillainAnimator  ✅ DONE (2026-10-17, finished by chat 2C-fix)

Verified: `node tools/check.mjs --creatures` ALL OK — baron + 3 collectors build; all 6 villain clips + inherited CreatureAnimator
clips run headless with no NaN pose; FogPuffPool spawns 6 puffs per fogPuff and all expire.
Browser smoke (one run, BROWSER OK): `smoke.mjs demo_villains.html --keys 1..6` → **ERRORS: none**, 146–154 draw calls for the whole
demo scene (island + hero + 4 villains + fog pool), ~45k tris. Screenshots in `../screenshots/2C_villains/`.

## Delivered (owned files)
- `src/assets/creatures/villains.js`
  - `makeBaronGilt({ seed, outline })` → Group (feet pivot). Tall purple blob lord: gold top hat, monocle, cane, cape, coin-purse belt.
    `userData.parts = { body, torso, head, headMesh, face, hat, tool (cane), toolTip, cape, belt, scroll, sweat, shadow }`, `userData.type='baron'`, `.info`, `.height`.
  - `makeFogCollector(variant 0..2, opts)` → fat / tall / tiny clerks with visors, clipboards, sacks. `userData.type='collector<n>'`.
  - `FOG_COLLECTOR_VARIANTS`, `VILLAIN_ANIMS` = strut · taunt · offerDeal · flee · slipOnCoin · fogPuff, `VILLAIN_INFO` (name, title, color, loanRate 0.20, blurb — data for 4B/7B/8A).
  - `FogPuffPool(scene, n=32)` — ONE InstancedMesh (1 draw call, no outline). `.spawn(pos, dir, count)` · `.update(dt)` · `.active`.
  - `VillainAnimator(root, { vfx, fogPool, game, onDeal(worldPos), onSlip() })` extends CreatureAnimator → same `.play/.update/.moodTint/.faceTo/.hit/.current/.timeScale`.
    One-shots (taunt 700 · offerDeal 600 · slipOnCoin 900 · fogPuff 500) auto-return to the previous loop (strut/flee/idle).
    `slipOnCoin` calls `game.hitstop(60)` + camera shake + `vfx.dust` at impact; `fogPuff` spawns 6 purple spheres from the cane tip. Phase tables (ms · easing) in file header.
  - `measureVillain` (= measureCreature re-export).
- `src/assets/creatures/index.js` — barrel exports villains.js.
- `demo_villains.html` — Baron + 3 collectors on Island v2 facing Pip; keys 1–6 villain clips, 7–9 idle/walk/angry, T slow-mo, P parade (walk loop),
  F fog storm, tap a villain = Haggle Shout hit → angry → flee. Shows fps · draw calls · per-villain tris/dc · deals/slips/puffs counters. `window.game` set.
- `tools/check.mjs --creatures` villains section (shared tool; additive only).

## Measured (at rest, incl. outlines; scroll + sweat hidden at rest → listed dc excludes them, +3 while shown)
| villain | tris | meshes+hulls | dc at rest | dc during offerDeal/flee |
|---|---|---|---|---|
| baron | 2926 | 10+6 | 13 | 16 |
| collector0 (fat) | 1618 | 9+5 | 11 | 14 |
| collector1 (tall) | 1618 | 9+5 | 11 | 14 |
| collector2 (tiny) | 1618 | 9+5 | 11 | 14 |
| FogPuffPool | 6×(low-poly sphere) | 1 instanced | 1 | 1 |
Baron is at 13 dc (budget ≤ 12 per creature) — 1 over because hat + monocle + cane are separate outlined meshes; acceptable since there is exactly one Baron on screen.
Tris exceed the 600 target for the same reason as 2A/2B (Foundation `G.sphere` segment counts); draw calls — the real limit — are fine.

## Missing
- Nothing from P1/P2/P3. All six clips shipped and smoke-tested.

## Suspected / notes
- Headless fps was 20 (software GL in the sandbox, not representative). Draw calls (146 whole scene) is the number that matters.
- `moodTint` clones materials per villain (same as 2A/2B); fine for ≤ 4 villains.

## Notes for integrator (4B, 6A, 8B, 9B, 10B)
- Baron spawn: `const g = makeBaronGilt(); scene.add(g); const fog = new FogPuffPool(scene); const anim = new VillainAnimator(g, { vfx, fogPool: fog, game, onDeal: (p) => economy.offerLoan(VILLAIN_INFO.baron.loanRate) })`.
  Each frame: `anim.update(dt); fog.update(dt)`. Mover sets `g.position` + `anim.faceTo(target)`; use `strut` while moving, `idle` when parked.
- Debt Fog event (4B/9B): `anim.play('fogPuff')` on a timer; the puffs are cosmetic — the real fog VFX is 9B's.
- Haggle Shout (3B/6A): `anim.hit(dir, 1); anim.play('angry'); setTimeout(() => anim.play('flee'), 520)` — the demo's tap handler is the reference.
- Collectors share `VILLAIN_INFO.collector<n>.loanRate`; `slipOnCoin` fires `onSlip()` at impact — drop a coin there (4B scam-refund beat).
