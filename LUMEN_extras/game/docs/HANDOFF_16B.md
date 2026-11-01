# HANDOFF 16B — sword combo + lock-on (S43, 2026-11-01)
Closed by chat 17 (16B's own chat was axed after task 2; S42 label covered only 16A + readability).

## Done
- [x] `src/combat/Combat.js` — 3-hit combo (slash1/2/3, power 1/1/2), input buffering + recovery cancel (`BUFFER_MS` 350), soft lock-on (`LOCK_RANGE` 5 u, ±70°), bus `combat:*`, `cust:bonked`, no ScreenFlash
- [x] `HeroController.doAttack → combat.attack`, strafe while locked; `installCombat(sb, game)` in Game.js
- [x] `check.mjs --combat` (16B block)
- [x] versions S43, README section, `LUMEN_extras/Game_Bible S43.md`

## Missing (P2/P3 of the prompt)
- heroAnims `slash2` / `slash3` / `parry` HERO_MOVES clips (procedural arm only today)
- `ui/touch.js` attack hold = combo, dash button; keyboard Shift dash
- `demo_combat.html`

## Measured
- `--combat` gate: 3 presses → `combat:combo` 1,2,3; hp-3 blob down after the chain; whiff → `combat:miss`.
- `--enemies` "cannon land N puddles 1" FAIL is pre-existing (f295b35), unrelated.

## Notes for 16C/16D (enemy defs that fight the combo well)
- The combo's weak point is recovery of slash3 (420 ms, not cancellable after 350 ms): an enemy with a 400–500 ms telegraph that steps in after slash3 punishes spam.
- Lock-on only picks targets in a ±70° half-plane in front of the stick: flankers that circle behind Pip are never auto-aimed — good for an "ambusher" def.
- `t.hit(dir, power)`: `power` 2 only on slash3. Give armored defs `hp` 3 with `armor` ignoring power-1 hits to force the full chain.
- Glimmers never take damage; any def that hides among Glimmers (16D "mimic") gets free hits-avoidance by design — mark it with a tell.
