# HANDOFF 7A — UI: HUD + Build menu + Jars (DOM/CSS only) (2026-10-17)
(started by an axed chat; closed + verified by the next chat — files were complete, only HANDOFF/README/commit were missing)

## Done
- `ui/hud.js` + `ui/hud.css` — `mountHUD(root, { bus, stats, seasonsToWin, selfDrive })` → `{ el, state, setSpark, setDebt, setSeason, setDay, setFog, setReputation, sync(ecoState), update(dt), destroy }`.
  Spark pouch with exp-damp count-up (k=9, ≈350 ms), "+N/−N" float 900 ms, pulse 320 ms outBack on gain / shake 360 ms on loss or `eco:denied`, debt chip,
  Season chip "Season n / 10" (→ "Endless · Sn") with day progress bar, DEBT FOG purple bar (600 ms outExpo, drift stripes, `is-danger` ≥ 70 %, `is-clear` at 0),
  5 reputation stars, fps · draw-calls readout (hidden when no `stats` fn). Listens `eco:spark/season/fog/loan/denied/tick/win/lose`. Emits nothing.
- `ui/jars.js` + `ui/jars.css` — `mountJars(root, { bus, pct })` → `{ el, pct, setPct, setPreset, setBalances, lock, apply, setCollapsed, destroy }`;
  pure `rebalance(pct, key, value, locked)` (others shrink/grow proportionally, integer remainder deterministic, locked jars untouched), `sumPct`, `JAR_ORDER`, `JAR_INFO`, `JAR_PRESETS` (balanced/saver/grower).
  4 range sliders summing to 100 %, jar icon liquid (350 ms outExpo) + slosh 450 ms outBack, collapsible head, Preset ⟳ + APPLY buttons.
  Emits `ui:jar {pct, changed, source}` on every change + `ui:jar:apply {pct}`; listens `eco:jar`, `eco:season` → balances.
- `ui/build.js` + `ui/build.css` — `mountBuildMenu(root, { bus, catalog, spark, categories, locked, icon, hide, showAll, noHotkey })` → `{ el, state, cards, isOpen, open, close, toggle,
  select, cancel, setPlacing, setGhostOk, setSpark, setLocked, setUnlocked, lockAllExcept, setCounts, setCategory, destroy }`. Bottom tray: category tabs (Stalls/Decor/Nature[/Landmarks]),
  card grid (emoji icon via `ICONS`, name, cost, footprint, placed-count badge, `poor`/`locked`/`selected` states), placing banner (⟳ R · ✓ place / ✕ blocked · ✕ cancel), upgrade + demolish foot buttons.
  Hotkeys B (toggle) / Esc (cancel placing, then close). Free landmarks hidden unless `showAll`.
  Emits `ui:build {action:'select', id, cost, footprint}` · `{action:'cancel'|'rotate'|'confirm'|'demolish'|'upgrade'|'denied'}` · `ui:build:open/close`.
  Listens `eco:spark/season` (affordability), `build:enter/exit/ghost/placed/removed/denied`, `ui:unlock {ids}`.
- `demo_ui_hud.html` — no Three; fake economy driven by keys 1–6 + auto events every 2 s, fake BuildSystem round-trip (select → build:enter → ghost → confirm → placed), APPLY moves Spark into jars. `window.game` + stats (scene stub for smoke.mjs).
- `tools/check.mjs --ui` + `tools/domshim.mjs` (tiny DOM shim, ~100 lines): 3 headless checks (hud / jars / build) — ALL OK.
- P3: bounce-in keyframes, safe-area insets, portrait + ≤ 640 px layouts in all three CSS files.

## Missing
- Nothing from P1–P3. SVG icons (10A may pass `opts.icon(id, entry)`), sound hooks (12 maps `ui:*` events).

## Measured
- DOM only: 0 draw calls, 0 tris. smoke `demo_ui_hud.html` --keys 1,2,3,b,4,6: **ERRORS: none**, fps 60. Screenshot: tools/shots/demo_ui_hud_4.png (HUD + jars + open build tray).

## Suspected
- `hud` listens `eco:season` with `report.season` = the season that just ended and shows `season + 1`; if 4A's report already carries the *new* season number, 10C should pass `seasonsToWin`/adjust via `hud.setSeason` instead.
- Range-slider thumb scale on `:active` is WebKit-only (Firefox gets the static thumb). Cosmetic.

## Notes for the integrator (10C)
- Mount order: `mountHUD(root, { bus: game.bus, stats: () => game.stats })` → `hud.sync(eco.state)`; `mountJars(root, { bus, pct })`; `mountBuildMenu(root, { bus, catalog: PROP_CATALOG, spark: () => eco.state.spark })`.
- Wire: `ui:build select` → `build.enter(id)` · `rotate` → `build.rotate()` · `confirm` → `build.confirm()` · `cancel` → `build.exit()` · `demolish` → demolish mode · `upgrade` → `build.upgrade(nearest)`.
  `ui:jar:apply {pct}` → `economy.allocate(...)` from the pouch by pct. Build emits `build:enter/ghost/placed/removed/denied` which the menu already consumes.
- Call `hud.update(dt)` from the game loop with `selfDrive: false`, or leave the default rAF self-drive.
- 7B owns `ui/ledger.*`, `ui/dialogue.*`; 7C owns `ui/title.*`, `ui/touch.*`. All share `ui/base.css` vars (`--ink --gold --paper --fog --radius --shadow`) and the `.ll-*` prefix.
