# Chat 17C — Puzzle base: Switch, Door, Pylon, Anchor, Mirror, Platform
Needs: 0 Sequencer/Tween (anim) · 1A props format · 16A Hitbox (sword hits a Switch) · 17A Regions (puzzles live in a region group)      Blocked-by: 17A
Owned (only these files): src/puzzles/PuzzleSystem.js (new), src/puzzles/pieces.js (new: the 6 piece classes), src/puzzles/index.js (barrel, new), tests/puzzles.test.mjs (new), check.mjs (additive `--puzzles`)
Read (max 8 credits): START_HERE.md → VISION_V2.md §1.4 + §2 "Closed paths" → this → API_CONTRACTS "anim/Sequencer.js", "Enemy (16A)" (Hitbox only) → HANDOFF_17A Notes
Export (API_CONTRACTS "Puzzles (17C)", ≤ 6 lines):
  `createPuzzles({ scene, bus, vfx, isLand }) → PZ` · `PZ.add(piece) → piece` · `PZ.link(fromId, toId)` (source `on` → target `activate()`) · `PZ.update(dt, heroPos)` · `PZ.hitTest(arcFn)` (sword strike → Switch) · `PZ.platformAt(x,z) → Platform|null` (moving ground; isLand union) · `PZ.destroy()`
  pieces (each `{ id, group, pos, on:bool, activate(src), deactivate(), update(dt) }`): `Switch{ kind:'hit'|'step'|'orb'|'tether'|'beam'|'heat' }` · `Door{ open }` · `Pylon{ charge 0..1, decay }` · `Anchor{ radius }` · `Mirror{ angle, reflect(dirIn)→dirOut }` · `Platform{ path:[Vector3], speed, crumble? }`
  bus: `puzzle:switch {id, kind, on}` · `puzzle:door {id, open}` · `puzzle:pylon {id, charge}` · `puzzle:platform {id, phase:'move'|'crumble'|'respawn'}` · `puzzle:solved {groupId}` (all pieces tagged `solveGroup` are on)
  Powers 18D–22D only call `PZ.activateKind(kind, pos, radius)` — e.g. Orb landing → `activateKind('orb', p, 1.2)`; Lantern beam → `activateKind('beam', hitPos, 0.5)`. No power edits pieces.js.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `pieces.js`: six toon pieces, PALETTE only. Switch = pedestal + crystal (gold when on, purple when off; `kind:'hit'` toggles on sword arc; `'step'` toggles while hero within 0.7 u). Door = two stone leaves that slide apart
  (Sequence 500 ms outCubic, `userData.blocksLand` cells become walkable → `isLand` override list). Pylon = pole + coil ring; `charge` decays 0.15/s unless `latched`; `on = charge ≥ 1`. Anchor = ring on a post (Tether target,
  no logic beyond `on=true` when 18D latches it). Mirror = angled disc, `reflect(dir)` = 2D reflection about its facing. Platform = slab that lerps along `path` (ping-pong) and carries the hero (`PZ.platformAt` returns it → caller adds `platform.delta` to heroPos).
- `PuzzleSystem.js`: add/link graph, `update` runs pieces + propagates `on` edges (a Door opens when ALL linked sources are on; closes when any drops unless `latch`), `hitTest(arcFn)` → arcFn(piece.pos) true → `Switch(kind:'hit').toggle()`, `activateKind`, `solveGroup` tracking → one `puzzle:solved` per group, `destroy`.
- `tests/puzzles.test.mjs` (node:test): hit switch toggles → door opens → `puzzle:door open`; 2-source door needs both; pylon decays from 0.9 → off in ≤ 7 s, latched holds; mirror reflect (1,0)→(0,1) at 45°; platform ping-pongs and `platformAt` hits only on the slab; `puzzle:solved` fires once.
- `check.mjs --puzzles` additive `17C PUZZLES` (see below).
### P2 — should ship (≈ 15 credits)
- Crumble platform: `crumble:{ delay:0.8, respawn:3 }` — standing on it starts a wobble (SquashStretch), then it drops (`phase:'crumble'`, not land), respawns at the start with a 200 ms scale-in.
- Timed switch: `Switch{ timer: 6 }` → turns itself off after `timer` s with a ticking lamp (blink rate rises in the last 2 s; `vfx.pop` "tick"? NO — in-world only: lamp blink + optional `sfx:play {id:'tick'}` bus).
### P3 — nice to have (≈ 10 credits, only if P1+P2 are written to disk)
- `PZ.serialize()/restore(data)` — `{id → on/open/charge}` for Save v2 (29C); pure, tested with 1 round trip.

## Demo page `game/demo_puzzles.html`: flat ground + Pip (HeroController) + one of each piece; Space/J swings (hits the Switch), walking onto the step-switch opens Door B, the Platform ferries Pip across a water strip, keys 1–6 force-toggle pieces; `window.game` set; stats + a "solved ✓" banner is in-world (vfx.pop).

## check.mjs section `--puzzles` (additive; name it `17C PUZZLES`)
- build the 6 pieces → each ≤ 8 dc (countDrawCalls) · link hit-switch → door → `hitTest` with an arc that contains the switch → door `open`, 1 `puzzle:door` · a second arc (miss) → unchanged.
- pylon: `activateKind('orb', pylonPos, 1.2)` → charge 1 → on; run 8 s → off (`puzzle:pylon` charge 0 seen) · platform: 4 s of update → position moved along path and came back within 0.1 u of start at period.
- solveGroup of 2 switches → exactly one `puzzle:solved` · `destroy()` → 0 listeners · run ≤ 1.5 s.

## Budgets (per item, draw calls incl. outline): piece ≤ 8 · all six in the demo ≤ 48 · whole demo ≤ 180.
## Content rules that bite here: puzzle feedback is in-world (lamps, dust, pops) — never a DOM flash (15A). A wrong move never costs Spark; it only resets the piece (VISION §1.4 "guide the player").
## Handoff `docs/HANDOFF_17C.md`: Done / Missing / Measured / Suspected / Notes for the integrator (≤ 15 lines; tell 18D–22D the exact `activateKind` kinds and the `isLand` override hook that 17E must union into Regions.isLand).
