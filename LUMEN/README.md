# LUMEN — Lumen Ledger (Zoud GameLab jam, "Make FinLit Fun", due 2026-11-15)

This folder holds **only the game and the jam documents**.
Dev material (screenshots, QA shots, demos, tests, tools, chat prompts, handoffs, plans) was moved to `../LUMEN_extras/`
(same relative paths, e.g. `LUMEN_extras/game/tools/check.mjs`, so it can be copied back if you need it).

```
LUMEN/
  game/
    index.html        THE game — serve statically: cd game && python3 -m http.server 3000 → http://localhost:3000/
    src/ ui/ data/ audio/ vendor/   game code, UI (incl. ui/tutorial.js), story, sounds, Three.js r160 (MIT)
    docs/             GDD.md (concept doc) · BUDGET.md (game budget) · ITCH_PAGE.md · SUBMISSION_CHECKLIST.md
                      GAME_BIBLE.md · balance.md · story_outline.md
    README.md         how to play, controls, URL flags
```

## Cinematics (S18, 2026-10-24)
Three short camera pieces (`game/src/vfx/cinematics.js`): the island is built behind the **title** and the camera orbits it; a fresh PLAY
walks Pip from the **pier to the plaza** (letterbox, SKIP / tap / Esc) before the tutorial and the Season-1 lines; on the win the camera
flies to the **lighthouse**, the lamp lights, then it returns to Pip for the finale. Reduce Motion turns each into a cut. `?nocine` disables them.

## Guided tutorial
Opens on the first PLAY (desktop and mobile). A hand 👆 points at the joystick (WASD on desktop), ⚔ Attack, ✋ Interact, 🔨 Build,
🚀 Deploy / ⬆ Upgrade, the 4 jars, the Debt Fog bar, the Season pill and ⏸ Pause. While it is open the game is paused and the
**only** things you can touch are the highlighted spot and the tutorial card. Keys, wheel and focus are locked too. All of it is removed when
the tutorial closes. You can replay it any time from the pause menu (📖 TUTORIAL). `?notutorial` skips it.
