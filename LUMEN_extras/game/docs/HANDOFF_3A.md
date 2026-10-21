# HANDOFF 3A — Hero moves set 1 (`src/anim/heroAnims.js`, `demo_heromoves.html`)

## Done (9/9 moves, P1 + P2 + P3)
- **P1** hammer (raise 180 outCubic → strike 90 inQuart → impact 40 hit-stop + dust ×8 + sparks + shake 0.15 → recovery 220 outBack) ·
  dash (squash 80 → travel 160 stretch 1.3/0.85 over 3 u clipped to `isLand` + dust trail → settle 180 outBack + dust ring) ·
  celebrate (crouch → jump1 → land1 → jump2 w/ `vfx.confetti?.burst` at apex, fallback sparks + "YAY!" → land2 → pose → recovery, 1350 ms).
- **P2** build (hammer ×3 w/ hit-stop 30 + `onHit(i)` → pop "DONE!" (+ `vfx.levelRing?.show`) → settle) · pickUp (reach → grab → lift, chains into carry) ·
  carry (loop, arms up, walkBob while `input.move`, dust per step, item bobs; `allowMove`, speed ×0.7) · throwCoin (windup → flick → flight parabola → arrive 60 ms w/ sparks + "+1" + `onArrive(target, pos)` → recovery).
- **P3** sad (droop → sigh → recover) · stunned (bonk hit-stop 40 → wobble 900 w/ 3 orbiting gold stars → shake → recover).
- API: `HERO_MOVES` (name → `{ build, phases, loop?, allowMove?, keepsCarry?, after? }`), `makeMove(name, ctx) → Sequence`, `attachMoves(hero)` adds
  `hero.playMove(name, { target?, onHit?, onArrive?, item?, dir?, dashDist?, count? })`, `hero.stopMove()`, `hero.dropCarry()`, `hero.setTool('hammer'|null)`,
  `hero.moveName`, `hero.currentMove`, `hero.carrying`, `hero.props { hammer, crate, stars, coin }`. `hero.state === 'move'` while a move plays. HeroController.js untouched (frozen) — attachMoves wraps `hero.update`.
- Helpers exported for 3B: `REST, POSE, snapPose, lerpPose, facingDir, registerMoves, CARRY_POSE, makeHammer/makeCarryCrate/makeCoin/makeStars`.
- `tools/check.mjs --hero`: builds every move on a real HeroController + mock Game/VFX, runs it headless, asserts phases seen, no NaN, rest pose, props hidden, per-move effects (hit-stop/dust/shake/dist/confetti/carry/coin/stars).

## Missing
- Nothing from the 3A list. (`confetti` and `levelRing` are optional hooks for 9A — fallbacks fire sparks/pop today.)

## Measured
- Rig at rest: 62 dc visible (Pip + sword + outlines); hidden move props add 0 dc at rest: hammer 3m+3o (6 dc when shown), crate 1m+1o, stars 3 (flat, no outline), coin 1 (flat).
- Demo (island + 3 Glimmers + build plot + Pip): 123–142 draw calls, ~31–32 k tris. Headless smoke: **ERRORS: none**, all keys 1–9 ran.
- totalMs: hammer 530 · dash 420 · celebrate 1350 · build 1080 (3 hits) · pickUp 440 · carry 600/loop · throwCoin 930 · sad 1380 · stunned 1420.

## Suspected / notes
- This chat was a FIX pass: heroAnims.js + check.mjs --hero existed (previous 3A chat died before demo/handoff). Fixed: pickUp → carry chain dropping the crate; throwCoin `arrive` 1 ms phase skipped at 60 fps (now 60 ms); carry leaving `hero.vel` non-zero (HeroController kept walking). check.mjs: loop moves get 15 settle frames; rest tolerance ±0.03 (idle breathe is ±0.025).
- carry's `hold` phase is cancellable, so any `playMove()` interrupts carrying; the item is dropped unless the new move has `keepsCarry`.

## Notes for the integrator (10A/10B)
- `attachMoves(hero)` once after constructing HeroController; then `hero.playMove('hammer', { target: stallGroup, onHit })` etc. Coin mesh lives in `game.scene`.
- For a custom carried item pass `item: Object3D` — it is re-parented to `hero.p.torso`; `dropCarry()` returns it to the scene hidden (you re-place it).
- `hero.playMove` returns `null` when blocked (non-cancellable phase in progress) — queue or ignore. Sword attack is still `hero.doAttack()`; both respect each other's cancel windows.
- 3B: call `registerMoves({ coinMagnetDash: { build, phases } })` BEFORE `attachMoves`, or any time (HERO_MOVES is read at playMove).
