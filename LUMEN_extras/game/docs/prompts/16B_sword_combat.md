# Chat 16B — Sword vs enemies: 3-hit combo, lock-on, hit-stop, Spark Dash as combat move
Needs: 16A Enemy/Hitbox · 0 HeroController sword attack · 3A heroAnims (dash) · 3B coinMagnetDash · 15B vitals      Blocked-by: 16A
Owned (only these files): src/entities/HeroController.js (attack block + new combo/lock-on), src/combat/Combat.js (new: hero↔enemy resolver), src/anim/heroAnims.js (additive clips `slash2`, `slash3`, `parry`),
  src/Game.js (`installCombat(lg)` — hero targets = enemies ∪ customers), ui/touch.js (attack button hold = combo, dash button), demo_combat.html, check.mjs (additive)
Read: START_HERE → VISION_V2 §1.2 → this → API_CONTRACTS "Enemy (16A)", "HeroController", "heroAnims (3A)" → HANDOFF_16A Notes.
Export (API_CONTRACTS "Combat (16B)"):
  `createCombat({hero, enemies:()=>Enemy[], vfx, bus, camera}) → { update(dt), attack(), dash(dir), lockOn(), target, combo:0..3 }`
  bus: `combat:hit {id, combo, power}` · `combat:miss` · `combat:combo {n}` · `combat:lock {id|null}`
  HeroController: `attack()` becomes `combat.attack()` when combat is installed (3-hit); `hitStop(ms)` stays; **no screen flash** (15A).

## Build in THIS order. wip.sh after EVERY file.
### P1 — must ship (≈ 25 credits)
- Combat.js: `attack()` → combo step 1/2/3 with input buffering (a press during `recover` queues the next step, window 350 ms) · each step = Sequence (phase table in a
  comment: slash1 anticipate 120 / strike 90 / recover 260 · slash2 100/90/240 · slash3 "spin" 180/140/420, power 1/1/2, knockback 1.6/1.6/3.2) · `Hitbox.arc(heroPos, facing, 1.9 u, 110°)`
  on the strike frame vs every enemy → `enemy.hit(dir, power, 'sword')` once per enemy per step · on hit: `hero.hitStop(60)`, `camera.addTrauma(0.18)`, `vfx.sparkTrail.emit`,
  slash arc mesh (one toon ring segment, additive, 120 ms) — **the only visual is in-world, never DOM**.
- heroAnims.js: `slash2` (horizontal backhand) + `slash3` (spin with sword trail) as HERO_MOVES entries following 3A's format; sword mesh follows the arm.
- HeroController: facing-aware soft lock-on — nearest enemy within 5 u & 70° of stick direction; while locked, movement strafes and the strike auto-aims (`combat:lock`).
- Game.js `installCombat`: targets() = enemies first, then customers (customers still only `anim.hit`, no damage — Glimmers are never hurt by the sword, they just wobble and complain `cust:bonked`).
- `check.mjs --combat` additive `16B`: 3 presses within windows → combo reaches 3 and `combat:combo {3}`; a TEST_BLOB at 1.2 u takes 3 hits → down; no `ScreenFlash.flash` call anywhere in HeroController (grep-assert).
### P2 — should ship (≈ 15 credits)
- Spark Dash in combat: dash (3A) gets 300 ms i-frames via `vitals.invulnerable`, knocks `small` enemies 1 u, `tags.armored` untouched; dash through an attacking enemy's
  anticipate = "perfect dodge" → `game.timeScale 0.35` for 300 ms + `combat:dodge` (slow-mo is allowed, flash is not).
- Touch: attack button hold → auto-combo at the window edge; dash button (7C's `dash`) → `combat.dash(joystickDir)`; both honour `ui.isModal()`.
### P3 — nice to have (≈ 10 credits)
- `parry`: pressing attack during an enemy's last 120 ms of anticipate → enemy `stun(900)` + big hit-stop 90 ms + ring VFX (pack1 levelRing gold). Lesson toast once: "Timing beats force."
- Damage numbers: 3D toon digits (InstancedMesh of 10 glyph quads) popping up, 600 ms — ≤ 1 dc.

## Demo `demo_combat.html`: island + Pip + 5 TEST_BLOBs (one armored); Space/J combo, Shift dash, L toggle lock-on; stats + combo counter overlay.
## check.mjs `16B` under COMBAT. Budgets: slash arc 1 dc, digits 1 dc. 
## Content rules: sword hits make fog puffs + Spark, never blood; Glimmers are never damaged.
## Handoff `docs/HANDOFF_16B.md`: Done / Missing / Measured / Suspected / Notes (tell 16C/16D how to make a def that fights well against the combo).
