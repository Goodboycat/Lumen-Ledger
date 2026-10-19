# HANDOFF 10D — Save/load + tutorial flow (IN PROGRESS 2026-10-19)

Owned: `src/systems/save.js`, save/tutorial section of `src/Game.js` (`installSave`), `ui/index.js` hasSave hook, `index.html`, `check.mjs --save`.

## Plan (= Missing list until each line is ticked)
- [ ] `src/systems/save.js` — pure JS: `SAVE_KEY`, `SAVE_VERSION`, `snapshot(lg)` → plain object {v, at, mode, state, eco, build, story, jars, helpers},
      `save(obj, storage)` / `load(storage)` (version check, bad JSON → null) / `clear()` / `exportText()` / `importText(text)` (base64 JSON for P3), `hasSave()`.
- [ ] `src/Game.js` `installSave(lg)` — autosave on `eco:season` (after the report) and on `review → playing`; `ui:start {mode:'continue'}` → `lg.resume(save)`:
      createSandbox with `starterStalls:false` → `Economy.deserialize` state copied into sb.eco (keep bus) → `build.load` → `StorySystem.deserialize` →
      helpers re-hired from upgrade ids → HUD sync → playing. `clear()` on lose/`ui:title` from a finished run; endless saves too.
- [ ] `ui/index.js` — title `hasSave: () => hasSave()`.
- [ ] Tutorial (P2): 8B already fires 10 toasts from `data/story.json`; 10D adds the first-action gates that 8B has no event for:
      `tut:move` (hero moved > 2 u), `tut:price`/`tut:jars` nudges after N s without action, `tut:endSeason` at day01 > 0.85 → `story.toast(trigger)`.
- [ ] `check.mjs --save` — headless: play to S2, autosave → new lg → `ui:start continue` → season/spark/stalls/story toasts equal, no duplicate toasts; export/import roundtrip.
- [ ] `index.html` — "Reload resumes": hasSave → CONTINUE button; `window.lumenSave = { export, import, clear }` for the Flutter WebView.
- [ ] close: HANDOFF final · README row · commit · push.

## Done
- (nothing yet — this file is the resume point; see `git log --grep "WIP 10D"`)

## Missing
- see Plan.

## Measured
- —

## Notes for the integrator (11A)
- —
