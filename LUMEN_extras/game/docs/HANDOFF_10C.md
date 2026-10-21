# HANDOFF 10C — Integrate UI + story + state machine (CLOSED 2026-10-19)

Owned: `src/Game.js` (createLumenGame section, below the 10B createSandbox), `ui/index.js`, `index.html`, `check.mjs --game`.

## Done
- **`ui/index.js` `mountUI(root, { bus, stats, input, catalog, seasonsToWin })`** — mounts 7A (hud, jars, build), 7B (ledger `autoOpen:false`,
  dialogue, toast), 7C (title `showOnLose:false`, pause, touch) in order on ONE update(dt) clock → `{ hud, jars, build, ledger, dialogue, toast,
  title, pause, touch, panels, isModal(), update(dt), destroy() }`. 7A's non-modal B hotkey is disabled and re-owned here, gated by `isModal()`;
  Esc with the build tray open closes the tray only (capture-phase owner flag; pause `canOpen` honours it). `destroy()` removes both key hooks.
- **`src/Game.js` `createLumenGame(game, { ui, data, seasonsToWin, seasonSeconds, headless })`** — P1 state machine
  `title → playing → review → playing … → ending → endless | title` (`GAME_STATES`, `lg.setState`, `game:state` event). Pause reasons OR-ed
  (title ∨ dialogue ∨ ledger ∨ pause menu) → `game.paused`. `eco:tick {day01, season}` at 10 Hz for the HUD day bar.
  - `installStart`: `ui:start {mode}` → `createSandbox` (endless: `winRequiresSeasons:false`, scams auto-refused via `wrapNoScam`) + `StorySystem`
    + `hud.sync` + `title.hide` → playing. `teardown`/`destroySandbox` (hero world props, pooled customers, helpers, coins) for restart.
  - `installRunWires`: `ui:build select/cancel/rotate/confirm/demolish/upgrade` → `BuildSystem`; `ui:jar:apply {pct}` → `eco.allocate` from the
    pouch; ability keys Q/W/E/R/F/G (`ABILITY_KEYS` = 3B FINLIT keys) → `sb.ability`, refused while `ui.isModal()`; touch build button, demolish tap.
  - `installSeasonLoop` (P2): `eco:season` → `story:review` → ledger opens (review, paused) → `ui:continue {outcome:'season'}` → next opening →
    playing · `eco:win` → ending lines → `story:finale` → ledger "Lighthouse is lit" → ENDLESS MODE → endless · `eco:lose` → ending lines →
    ledger "Fogged out" → TRY AGAIN → title.
  - `installMenu` (P3): `ui:restart` → teardown + start(same mode) · `ui:title` → toTitle (0 meshes left) · `ui:settings quality` → pixel-ratio
    fallback (11A presets later) · `reduceMotion` flag.
- **`index.html`** — THE game page: Game + mountUI + createLumenGame, `window.game`, `#debug-stats` (fps · calls · tris · state · S# · spark · fog,
  toggled by body.show-debug), boot-error box.
- **`check.mjs --game`** — headless (domshim + mock VFX) full run: §1 title → PLAY → S1 opening (9 lines) → playing · §2 S1→S3 by the clock
  (mid lines, review ledger, CONTINUE ×3, 51 lines) · §3 build/jars/Esc-pause gating · §4 forced win → 13 ending lines → endless (gate off,
  scams refused) · §5 ui:title teardown → lose → TRY AGAIN → title → ui:restart; 3070 frames, destroy clean. **ALL OK** with the full suite.

## Missing
- Nothing from the prompt. Browser smoke for `index.html` was not run in the closing chat (Playwright tool failed once → skipped per rule 3);
  the previous chat's smoke drove the B-hotkey / Esc fixes above, so the page is known to boot.

## Measured
- Headless: 246 meshes at start, 493 after a 10-season win run (endless keeps them). Browser draw calls are 10B's numbers (169–253 dc,
  ≤ 150 target → 11A). `--game` runs in ~2 s.

## Suspected
- `ui:settings quality` only changes pixel ratio until 11A ships real presets (outline thickness / shadow toggles are wired but coarse).
- Ending/lose line counts depend on `data/story.json`; a story edit that removes the finale block would leave `ending` waiting on `story:finale`.

## Notes for the integrator (10D save/load + tutorial)
- Serialize: `lg.state`, `lg.mode`, `sb.eco.serialize()` (4B), `sb.build.placed` (id, type, level, cell, rot), `story.serialize()` (8B: tutorial
  toasts shown once), jar pcts from `ui.jars`. Rebuild via `ui:start {mode}` then re-place stalls through `sb.build` and `eco.load`.
- All transitions go through `lg.setState` and emit `game:state {from, to}` on `game.bus` — hook autosave on `review → playing`.
- Tutorial toasts already come from 8B (`story:toast`, once per run) → `ui.toast`; 10D adds the first-run guided steps on top.
