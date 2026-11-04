# Chat 48D — Delete the Interact and Build touch buttons
Needs: 48Z      Blocked-by: 48C (icon pipeline exists; not strictly needed — if 48C has no row yet, proceed)
Owned (only these files): game/ui/touch.js · game/ui/touch.css · game/src/Game.js (ONLY the blocks found by the greps below) · game/src/systems/jarsWorld.js (`jars:near` handler only) · game/tools/gates/jarsworld.mjs · docs/HANDOFF_48D.md
Read (max 8 credits): HANDOFF_48Z decision **D1** → this → `grep -n "interact\|build" game/ui/touch.js` (lines 28–45 table + the mount loop ≈ 65–80) → `grep -n "sb.interact\|interact()" game/src/Game.js` (the ONE dispatcher, 42B) ±20 lines → `grep -n "onTap = " game/src/Game.js` (≈ line 559) ±25 lines → `grep -n "jars:near" game/src/systems/jarsWorld.js game/src/Game.js` ±8 lines → `grep -n "K.build\|KeyB" game/src/Game.js` ±3 lines.
Export (API_CONTRACTS §touch, ≤ 4 lines): touch strip = **joystick · Attack · Dash · ability chips** only. New bus event `ui:tap:land {x,z}` (Game.js onTap, when the tap hits land and no stall/NPC/jar) → opens the build tray with the ghost on that cell. `sb.interact()` is also called automatically by proximity (see P1).

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 70 credits.
### P1 — must ship (≈ 30 credits)
- `ui/touch.js`: remove `interact` and `build` from `TOUCH_BUTTONS` and from the default button list the mount loop uses; delete their CSS blocks in touch.css. `grep -rn "'interact'\|'build'" game/ui/touch.js game/index.html` → 0 hits that mount a button. Keep `attack` and `dash`. Replace `'⚔'`/`'💨'` glyphs with `iconize('sword')`/`iconize('dash')` if those defs exist (`grep -n "def('sword'\|def('dash'" game/ui/icons.js`); otherwise leave for 48F.
- **Proximity interact (replaces ✋):** in Game.js where `jars:near {jar|null}` is handled (or add a handler next to `installJarsWorld`): on `jar !== null` → `ui.jars.setCollapsed(false)` + `ui.jars.focus?.(jar)`; on `null` → `setCollapsed(true)` after 1.5 s. Deposit/withdraw stays on **E / tap the jar** (tap → `sb.interact()`), so the tap handler must route a tap on a jar mesh to `sb.interact()`. For the Baron pier / scam NPC: when the hero is within 1.3 u and speed ≈ 0 for 0.6 s → `sb.interact()` once (flag reset when leaving the radius).
- **Tap-on-land opens the tray (replaces 🔨):** in `onTap` (≈ Game.js:559) after the existing stall / demolish / jar branches: if the hit is land and the tray is closed → `bus.emit('ui:build:open')` then, once the tray is open, remember `{x,z}` so `build.enter(id)` starts the ghost on that cell (`grep -n "enter(" game/src/systems/build.js | head -3` for the signature; add an optional `at` arg if there is none). If the tray is already open and the tap is land → it is the placement confirm (existing behaviour).
- Key **B** still toggles the tray on desktop (unchanged). Run `node tools/check.mjs --ui --jarsworld --build --game`.
### P2 — should ship (≈ 12 credits)
- `tools/gates/jarsworld.mjs`: hero walks to 1.0 u of a jar → `jars:near` fired → `ui.jars` not collapsed; walks away → collapsed within 2 s. Touch mount headless → `document.querySelectorAll('#ll-touch button').length` equals attack + dash + ability chips (no interact/build).
- `LUMEN/game/README.md` controls table: remove the ✋ / 🔨 rows, add "tap empty ground = build · walk up to things = use them".
### P3 — nice to have
- Long-press on a placed stall (600 ms) → tray opens on that stall's card (upgrade) — only if `onTap` already receives press duration.

## Demo page: none. Visual check: `cd game && python3 -m http.server 3000` → `http://localhost:3000/?touch=1` (if that flag exists: `grep -n "isTouch\s*=" game/src/core/*.js`).
## check.mjs `--jarsworld` + `--ui` additive asserts in P2. Budgets: 0 new meshes. Content rule: D1; rule 3 (no sentences — the tray opening IS the hint).
## Handoff `docs/HANDOFF_48D.md` ≤ 15 lines + README_pipeline row + strike 48D.
