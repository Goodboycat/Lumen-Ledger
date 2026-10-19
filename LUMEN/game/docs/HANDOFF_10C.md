# HANDOFF 10C — Integrate UI + story + state machine (IN PROGRESS 2026-10-19)

## Plan (= Missing list until each line is ticked)
- [ ] `ui/index.js` — `mountUI(root, { bus, game, eco, catalog, seasonsToWin })` mounts 7A/7B/7C in the right order → `{ hud, jars, build, ledger, dialogue, toast, title, pause, touch, update(dt), destroy }`.
- [ ] `src/Game.js` — `createLumenGame(game, opts)` (P1): state machine `title → playing → ledger → playing … → ending → endless`,
      pause reasons AND-ed (menu ∨ dialogue ∨ ledger ∨ title) → `game.paused`, `ui:start` builds the sandbox via `createSandbox`.
- [ ] Wire UI → systems: `ui:build {select/rotate/confirm/cancel/demolish/upgrade}` → `sb.build.*`, `ui:jar:apply {pct}` → `eco.allocate` from the pouch,
      hero ability keys Q/W/E/R/F/G → `sb.ability`, `eco:tick {day01, season}` emitted per frame for the HUD day bar.
- [ ] Story (P2): `StorySystem(eco, { data })` on the bus · ledger `autoOpen:false`, opened on `story:review` · lesson card from `story:lesson` ·
      `ui:continue {outcome:'season'}` → resume; `eco:win` → ending lines → `story:finale` → Endless · `eco:lose` → title.
- [ ] `index.html` — the game page: Game + mountUI + createLumenGame, `window.game`, stats readout.
- [ ] `tools/check.mjs --game` — headless (domshim + mock game): title → PLAY → season 1 opening → advance → … to season 3 ledger → continue; win → endless; lose → title.
- [ ] P3: pause/settings (`ui:settings quality/outline`), `ui:restart`, `ui:title`, ENDLESS from title (`winRequiresSeasons:false`, no scams).
- [ ] close: HANDOFF final · README row · commit · push.

## Done
- (nothing yet — this file is the resume point; see `git log --grep "WIP 10C"`)

## Missing
- see Plan.

## Measured
- —

## Notes for the integrator (10D)
- —
