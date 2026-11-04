# HANDOFF 48D — Delete the Interact and Build touch buttons (2026-11-04, CLOSED)

## Done
- [x] P1 `ui/touch.js`/`touch.css`: `interact` + `build` rows deleted from `TOUCH_BUTTONS` and the mount loop filters them out (`opts.buttons` can never mount them); attack/dash use drawn `icon('swords')`/`icon('dash')` (no emoji). CSS blocks for the two buttons removed.
- [x] P1 `src/Game.js` `lg.landTap(world, ev)` (called first in `onTap`): tap a jar mesh (`jarsWorld.ids()/meshOf()`) or an NPC → `sb.interact()`; tap empty land with the tray closed → `bus.emit('ui:tap:land',{x,z})` + `ui:build:open`, `lg.tapCell` remembered so the next `build.enter(id)` starts its ghost on that cell; tray already open → existing placement confirm.
- [x] P1 `src/Game.js` `lg.proxTick(dt)` (runs from the tick when playing): hero ≤ 1.3 u from the Baron pier / scam NPC with speed ≈ 0 for 0.6 s → `sb.interact()` once, re-armed on leaving the radius. `jars:near {jar}` → `ui.jars.setCollapsed(false)` + `focus(jar)`; `null` → collapsed after 1.5 s. Deposit stays E / tap (a deposit must be a choice). Key **B** unchanged.
- [x] P1 `src/systems/jarsWorld.js`: `ids()` / `meshOf(id)` exported for the tap router (+0 meshes).
- [x] P2 `tools/gates/jarsworld.mjs`: `48D ids()/meshOf()` asserts; `tools/check.mjs` touch block asserts exactly 2 drawn buttons (attack + dash) + 6 ability chips, no interact/build.
- [x] P2 `LUMEN/game/README.md` controls line: Interact/Build button rows gone → "tap empty ground = build · walk up to things = use them".

## Missing
- P3 long-press on a placed stall → tray on its upgrade card: not done (`onTap` has no press duration; would need `ui/touch.js` to pass one). Hand to 48E/48F if wanted.
- `node tools/check.mjs --ui --jarsworld --build --game` → ALL OK ✅ (verified by the closing chat).

## Next chat
`bash tools/next.sh` → 48E (jars are buildables, DEEP). PLAY_BUGS 48B-2 (Settings → Title / Restart season) still open.
