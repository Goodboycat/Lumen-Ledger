# LUMEN — Lumen Ledger · Game Bible S44 (2026-11-01)

Previous: `Game_Bible S43.md` (everything there still applies; this file only lists what S44 changed).
Version strings: `GAME_VERSION = 'S44'` (src/Game.js) · `UI_VERSION = 'S44'` (ui/index.js) → title-menu footer.

## S44 — BUGFIX: characters stretch tall + sideways at speed ×2/×3, worst in Spark Storm (chat S44)

| ID | Change | Files |
|---|---|---|
| S44 | **Root cause**: `JellySpring.update(dt)` (semi-implicit Euler, stiffness 220–260) was sub-stepped only ×2 when dt > 1/30. Stability needs `h·√k < 2` → h < ~0.12 s. At speed ×3 (`game.timeScale = 3`, `maxDt = 0.1`) dt reaches 0.3 s → h = 0.15 s → the spring **diverges** (value 7e89 after 60 frames in the repro). Every `setSquash(body, 1 + value)` / `lerpPose(..., jelly)` / `p.body.scale.y += s` then wrote a huge scaleY and (volume-preserving) a huge scaleX/Z → "stretched up and sideways". Spark Storm is worst because every storm hit/flinch/pay calls `spring.kick()`, re-feeding the divergence. Low fps (phones, storm particles) made dt even larger. | — |
| S44 | **Fix 1** `JellySpring.update`: fixed sub-step `SPRING_H = 1/120 s` (`steps = ceil(dt/h)`), `dt` capped at 0.5 s, non-finite state reset, `|value| ≤ 1.2`. Feel at 60 fps ×1 is numerically identical (same integrator, finer step). | `src/anim/SquashStretch.js` |
| S44 | **Fix 2** `setSquash`: amount clamped to `[0.3, 2.5]` (was lower bound 0.05 only) and NaN → 1. Belt + braces for any other caller. | `src/anim/SquashStretch.js` |
| S44 | **Fix 3** attack follow/recovery settle `p.body.scale.y += s*0.6` → clamped to `[0.3, 2.5]`. | `src/entities/HeroController.js` |
| S44 | `tests/spring.test.mjs` (node --test, 5 pass): ×3 @10 fps bounded + settles · 600 storm kicks ≤ clamp · 60 fps ×1 feel unchanged (squash −0.03…−0.1, overshoot 0.005…0.05) · dt 0/NaN/100 survive · setSquash clamp + volume. Gate `node tools/check.mjs --spring` "SPRING (S44)". | `tests/spring.test.mjs`, `tools/check.mjs` |

### Frozen-file note
`src/anim/SquashStretch.js` is Foundation (frozen per GAME_BIBLE §6). This was a user-reported shipping bug in the frozen file itself, so it was edited directly rather than via CHANGE_REQUESTS — the public API (`setSquash`, `JellySpring`, `breathe`, `walkBob`, `relaxScale`, `setStretchAlong`) is unchanged.

### Gates
`node tools/check.mjs --spring` → OK · `node tools/check.mjs` → ALL OK.
