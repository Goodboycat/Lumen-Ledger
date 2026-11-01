# LUMEN — Lumen Ledger · Game Bible S43 (2026-11-01)

Previous: `Game_Bible S42.md` (everything there still applies; this file only lists what S43 changed).
Version strings: `GAME_VERSION = 'S43'` (src/Game.js) · `UI_VERSION = 'S43'` (ui/index.js) → title-menu footer.

## S43 — 16B P1: sword combo + soft lock-on (chat 16B, finished by chat 17)

| ID | Change | Files |
|---|---|---|
| 16B P1 | **`src/combat/Combat.js`** (new) — `createCombat({hero, game, targets, bus})` / `installCombat(sb, game)` → `sb.hero.combat` = `sb.combat`. 3-step combo table `COMBO_STEPS`: slash1 forehand 120/90/260 ms power 1 · slash2 backhand 100/90/240 power 1 · slash3 spin 180/140/420 power 2 (360° cone, range 2.6 u, knockback ×2, hit-stop 90 ms). `BUFFER_MS = 350`: a press during anticipate/strike is queued and fires when recovery starts; a press inside the first 350 ms of recovery cancels into the next step; recovery running out resets the combo to 0. Hit rules: `Hitbox.arc` from Pip's pre-lunge position (16A), point-blank < 0.9 u always hits, each target hit once per step → `t.hit(dir, power)`; enemies take knockback × power and hp −1, Glimmers only wobble → `cust:bonked`. Visuals: hit-stop, camera shake, sparks + 'POW!' pop, in-world slash ribbon — **no ScreenFlash**. Soft lock-on: nearest *enemy* ≤ `LOCK_RANGE = 5 u` and ±70° of the stick (or facing when idle) → `combat.target`; strafe + auto-aim | `src/combat/Combat.js` |
| 16B P1 | `HeroController.doAttack()` routes to `this.combat.attack()` when installed; `update(dt)` ticks `combat.update`; walking with a lock target faces the target (strafe) | `src/entities/HeroController.js` |
| 16B P1 | `installCombat(sb, game)` called in `Game.js` after the hero + enemies exist (targets = enemies ∪ customers) | `src/Game.js` |
| 16B P1 | gate `check.mjs --combat` "COMBAT (16B / S43)": 3 presses → `combat:combo` n = 1,2,3 · blob at 1.2 u hp 3 → down · buffer/cancel windows · ScreenFlash count stays 0 (runtime count + grep of Combat.js) · lock-on geometry (4 u ahead locks, 6 u drops, behind ignored, stick direction wins) · Glimmer only `cust:bonked` · whiff → `combat:miss` · `destroy()` restores the reference swing | `tools/check.mjs` |

### Bus events touched
- new: `combat:hit { id, combo, power }` · `combat:miss { combo }` · `combat:combo { n }` · `combat:lock { id | null }` · `cust:bonked { id }`.
- unchanged: `enemy:hit`, `enemy:defeated` still fire from the enemy's own `hit()`.

### Gates
`node tools/check.mjs --combat --hero --abilities --sandbox --knockback` → OK.
**Known pre-existing FAIL**: `--enemies` → "cannon land N puddles 1" fails on f295b35 (S42) too, i.e. before Combat.js existed. Not caused by S43; not fixed. Next chat that touches enemies: see `src/entities/enemies/*cannon*` land/puddle counting in check.mjs.

### Not done from the 16B prompt (P2/P3 — carried)
- `src/anim/heroAnims.js` clips `slash2` / `slash3` / `parry` (Combat.js drives the arm procedurally via Sequence; no dedicated HERO_MOVES entries yet).
- `ui/touch.js` attack-button hold = combo + dash button · Shift dash.
- `demo_combat.html` (5 TEST_BLOBs, L toggles lock-on, combo overlay).
- `docs/HANDOFF_16B.md` written by chat 17 from the code (this file is the source).

## Next chat
- `bash tools/next.sh` → 17A (Regions.js) once 17A's prompt is in `LUMEN/game/docs/prompts/` (prompts live under `LUMEN_extras/game/docs/prompts/` — next.sh reads `docs/prompts/` relative to `game/`; check which path it resolves on your clone).
- The `--enemies` cannon/puddle FAIL above.
