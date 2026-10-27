# LUMEN — Lumen Ledger (Zoud GameLab jam, "Make FinLit Fun", due 2026-11-15)

This folder holds **only the game and the jam documents**.
Dev material (screenshots, demos, chat prompts, handoffs, plans) was moved to `../LUMEN_extras/`
(same relative paths, e.g. `LUMEN_extras/game/tools/check.mjs`, so it can be copied back if you need it).

```
LUMEN/
  game/
    index.html        THE game — serve statically: cd game && python3 -m http.server 3000 → http://localhost:3000/
    src/ ui/ data/ audio/ vendor/   game code, UI (incl. ui/tutorial.js), story, sounds, Three.js r160 (MIT)
    docs/             GDD.md (concept doc) · BUDGET.md (game budget) · ITCH_PAGE.md · SUBMISSION_CHECKLIST.md
                      (dev notes GAME_BIBLE / balance / story_outline / PLAY_BUGS / SUGGESTIONS live in ../LUMEN_extras/game/docs/)
    README.md         how to play, controls, URL flags
```

## Release pass (S38, 2026-10-27) — version shown in the title menu: `S38`
Gathers the S35–S37 work: blade-tracking slash ribbon, cottage remodel, dialogue rewrite (150 Spark / 260 debt), drawn icons and faces,
**drag-to-move bought props** (S36), and **3 customer waves per season** for first-time players (S37). `GAME_VERSION` and `UI_VERSION` are now `S38`.
Web build: `lumen-ledger-web.zip` (`bash game/tools/itch_zip.sh`). Report: `LUMEN_extras/Game_Bible S38.md`.

## Knockback (S32, 2026-10-27) — version shown in the title menu: `S32`
Every sword target now **really moves**. `CreatureAnimator.hit(dir, power)` (`src/assets/creatures/animator.js`) applies a world-space slide to the
creature's root — `KNOCK_SPEED` 8 u/s decaying at `KNOCK_DECAY` 9/s (≈ 0.9 u travelled at power 1), a `KNOCK_STUN` 0.35 s window, an optional
`canStand(x,z)` clamp (land + no stall) and it turns the creature to face the attacker. **Glimmers**: `CustomerSystem` pauses its steering while
`anim.knocked`, re-paths afterwards, and browsing / queueing customers walk back to their slot — sales continue. **Hired helpers** are sword targets
too: they slide (own stall cell allowed — the seat is inside its footprint), flash red, pop an "ouch", emit `helper:hit`, then walk back
(1.6 u/s) to their remembered `seat` and resume work. Enemies keep their own `ENEMY_RULES.knockback`; the Baron never slides.
Headless gate: `node tools/check.mjs --knockback` (`tools/gates/knockback.mjs`) — it caught the first tuning (2.6 u/s ≈ 0.29 u, invisible)
and the helper clamp bug (seat inside own stall → shoves never moved it).

## Stalls & upgrades (S29–S31, 2026-10-26)
**One stall per type.** The old bug: deploying a second Fruit Stand after upgrading the first made the tray/level badge fall back to L1
(and L1 vs L2 looked the same). Now `BuildSystem.owned(id)` / `placeBlocker(id)` deny a duplicate deploy everywhere (tray card, `enter()`,
`place()`, `canPlace()` → ghost red, reason `duplicate`), and `load()` is tolerant: a legacy save with two of a kind keeps the highest level
and refunds the rest. The build tray shows a **level badge** (L1 / L2 / L3 ★) on every stall card; once placed the card reads
**✓ Deployed · Lx** and the button becomes ⬆ Upgrade. **Every stall type has its own L2 and L3 model** (`src/assets/props/stalls.js`
`LEVEL_EXTRAS`): e.g. Bakery L2 adds a clay oven, L3 a pretzel sign + flour sacks; Fish Market L2 an ice barrel, L3 an anchor + buoy;
Tool Smith L2 an anvil, L3 a forge chimney with embers. All 12 stay ≤ 900 tris at L3 (gate: `node tools/check.mjs --props` → STALL LEVELS).
Gallery of all 12 × 3 levels: `LUMEN_extras/game/demo_stall_levels.html`.

## Cinematics (S18, 2026-10-24)
Three short camera pieces (`game/src/vfx/cinematics.js`): the island is built behind the **title** and the camera orbits it; a fresh PLAY
walks Pip from the **pier to the plaza** (letterbox, SKIP / tap / Esc) before the tutorial and the Season-1 lines; on the win the camera
flies to the **lighthouse**, the lamp lights, then it returns to Pip for the finale. Reduce Motion turns each into a cut. `?nocine` disables them.

## Guided tutorial
Opens on the first PLAY (desktop and mobile). A hand 👆 points at the joystick (WASD on desktop), ⚔ Attack, ✋ Interact, 🔨 Build,
🚀 Deploy / ⬆ Upgrade, the 4 jars, the Debt Fog bar, the Season pill and ⏸ Pause. While it is open the game is paused and the
**only** things you can touch are the highlighted spot and the tutorial card. Keys, wheel and focus are locked too. All of it is removed when
the tutorial closes. You can replay it any time from the pause menu (📖 TUTORIAL). `?notutorial` skips it.
