# HANDOFF S44 — BUGFIX stretched characters at speed ×2/×3 / Spark Storm (2026-11-01, chat S44)

## Done
- [x] Root cause found: `JellySpring` semi-implicit Euler unstable for dt ≥ ~0.12 s; speed ×3 × maxDt 0.1 = 0.3 s/frame → spring diverged → `setSquash` stretched bodies tall + wide. Storm = many `kick()`s + low fps → worst case.
- [x] `src/anim/SquashStretch.js`: `JellySpring.update` fixed sub-step 1/120 s, dt cap 0.5 s, NaN reset, |value| ≤ 1.2 · `setSquash` clamped [0.3, 2.5] + NaN guard.
- [x] `src/entities/HeroController.js`: attack settle `scale.y +=` clamped.
- [x] `tests/spring.test.mjs` (5 pass) · `check.mjs --spring` gate · versions S44 · `LUMEN_extras/Game_Bible S44.md`.

## Missing
- Browser smoke at ×3 during Spark Storm not run (credits). Node repro proves divergence → bounded; feel at 60 fps ×1 verified numerically unchanged.

## Measured
- old integrator, dt 0.3 s, 60 frames: |value| = 7.1e89 · new: 0.010 and settled. ×3 @60 fps (dt 0.05): worst 0.029.

## Suspected (not touched)
- `src/vfx/storm.js` / `customers.js` steering use `damp()` (exp-based, unconditionally stable) — fine. Any *future* `x += v*dt` spring written by hand must sub-step like JellySpring.

## Notes for the integrator
- No API change. Anyone layering `jelly` on scale can rely on `|spring.value| ≤ 1.2`.
