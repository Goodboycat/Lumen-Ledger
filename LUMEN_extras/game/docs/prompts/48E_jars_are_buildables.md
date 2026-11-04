# Chat 48E — Jars are buildables (no pre-placed jars, no floating jar) — DEEP
Needs: 48D      Blocked-by: 48D (proximity opens the panel; 48E only decides WHICH jars it shows)
Owned (only these files): game/src/Game.js (ONLY `grep -n "JAR_IDS.forEach" game/src/Game.js` line + `installJarsWorld` block) · game/src/systems/economyData.js (add 4 catalog rows) · game/src/systems/build.js (duplicate check: `grep -n "owned(\|placeBlocker(" …`) · game/src/systems/jarsWorld.js (`register` / new `unregister`) · game/ui/jars.js + jars.css (rows hidden until placed; scroll affordance) · game/ui/build.js (one CATEGORY_LABELS entry) · game/src/systems/save.js (v4) · game/tools/gates/jarsworld.mjs · docs/HANDOFF_48E.md
Read (max 10 credits): HANDOFF_48Z decision **D3** + census → this → Game.js line ≈ 187 ±6 (the 4 pre-placed jars, `place(makeProp(id,{fill:.25}), -8+i, 3)` — `-8+i,3` is why one jar hangs over water/air) → `grep -n "W.jars\|sb.world.jars" game/src/Game.js game/src/systems/*.js` (every consumer of the jar array: jarsWorld register, protectBark `jars[3]`, verbChain `jars[1]`, lanterns) → jarsWorld.js lines 28–45 + 110–120 → `grep -n "build:placed\|build:removed" game/src/Game.js` ±6 → ui/jars.js lines 80–100 & 125–140 → economyData.js one `stall_` row + one `decor_` row for the catalog shape → save.js lines 12–20.
Export (API_CONTRACTS §jars, ≤ 6 lines): catalog ids `jar_spend jar_save jar_invest jar_protect` (`kind:'jar'`, cost 0, upkeep 0, footprint 1×1, one each — `owned(id)` denies the second). `build:placed {id:'jar_*'}` → `jarsWorld.register(jarKey, mesh)` + `ui.jars.show(jarKey)`; `build:removed {id:'jar_*'}` → `jarsWorld.unregister(jarKey)` (its balance → pouch) + `ui.jars.hide(jarKey)`. `W.jars` is no longer an array of 4 — consumers use `jarsWorld.get(key)` (may be null).

## Think before you type (the bugs the user predicted)
1. **Place → demolish → place again** must give a fresh jar with 0 balance and the old balance already in the pouch (not lost, not doubled). Do the balance move in ONE place: `unregister`.
2. **Consumers that index `jars[1]` / `jars[3]`** (verbChain Save-jar lantern, protectBark) must tolerate `null` → skip silently, no bark, no toast.
3. **Save v3 → v4**: a v3 save has 4 implicit jars with balances but no placed entries. Migration = synthesize 4 `jar_*` build entries at the old coordinates **but snapped onto land** (`isLand(x,z)` from the world; if false, move +1 z until true, max 6 tries) so no legacy save shows a floating jar. Balances keep.
4. **Deposits before any jar exists**: `jarsWorld.deposit` to an unregistered key → `return 0` (denied, wobble nothing). `economy` auto-split (`ui:jar:auto`) must only split into **registered** jars; unregistered shares stay in the pouch.
5. **Eco/story lines that assume a Protect jar exists** (insurable events): `applyLoss` already handles balance 0; confirm with `grep -n "applyLoss" game/src/systems/economy.js` — do not touch economy.js unless it throws on a missing key.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 35 credits)
- economyData.js: 4 rows `jar_<key>` `{ kind:'jar', cost:0, upkeep:0, text:'<Name> jar', prop:'<same makeProp id the old JAR_IDS used>' }`; build.js: `canPlace`/`place` deny when `owned('jar_<key>')` (same path as `stall_*`); ui/build.js `CATEGORY_LABELS.jar = 'Jars'` **as the FIRST tab** (that IS "the guide to where they are").
- Game.js: delete the `JAR_IDS.forEach(… place …)` line; `W.jars = []` stays but empty. On `build:placed` with `id.startsWith('jar_')` → `sb.jarsWorld.register(key, entry.mesh || group)`; on `build:removed` → `unregister(key)`.
- jarsWorld.js: `J.unregister(key)` → balance → `eco.withdraw(key, all)` into pouch, `jars.delete(key)`, remove its DOM tag, emit `jars:removed {jar:key}`; `J.get(key)`; every helper that iterates `jars` already uses the Map — verify `near()` ignores missing.
- ui/jars.js: rows start `hidden`; `api.show(key)` / `api.hide(key)` toggle; `jars:removed` and `build:placed` (jar) wire them. Empty panel (no jars) = **collapsed + hidden** entirely (no empty frame on screen).
- Consumers: `grep -rn "jars\[[0-9]\]" game/src` → each becomes `sb.jarsWorld?.get('save'|'protect')` with a null-guard.
- `node tools/check.mjs --jarsworld --build --save --game --verbs` green.
### P2 — should ship (≈ 20 credits)
- save.js `SAVE_VERSION = 4`, `SAVE_VERSIONS_OK = [1,2,3,4]`, migration per Think-3; test in `tests/save.test.mjs` (load a v3 fixture → 4 jar build entries on land, balances equal).
- **Mobile scroll affordance** (user ask): `ui/jars.css` on `(max-width: 700px)` the panel body gets `overflow-y:auto; mask-image: linear-gradient(#000 85%, transparent)` (fade at the bottom = "there is more") + a 6 px `::after` chevron that hides once `scrollTop > 0` (JS: one `scroll` listener toggling a class). **No words.**
- gate: place `jar_save` → `get('save')` truthy & row visible; deposit 10; demolish → pouch +10, `get('save') === null`, row hidden; place again → balance 0; second `jar_save` → `canPlace === false`, reason `duplicate`.
### P3 — nice to have
- Jar ghost shows the fill liquid at 0; placed jar plays the existing `setFill` wobble.

## Demo page: none — gate above + `cd game && python3 -m http.server 3000` → build tab "Jars", place, walk away, come back (48D opens the panel).
## check.mjs `--jarsworld` additive block `48E JAR BUILDABLES` = the P2 gate bullets. Budgets: 0 new meshes beyond the 4 existing jar props. Content rule: D3; rule 3.
## Handoff `docs/HANDOFF_48E.md` ≤ 15 lines + README_pipeline row + strike 48E.
