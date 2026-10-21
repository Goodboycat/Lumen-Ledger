# HANDOFF 10D — Save/load + tutorial flow (DONE 2026-10-19)

Owned: `src/systems/save.js`, 10D section of `src/Game.js` (`installSave`, `applySnapshot`, `installTutorialGates`, `TUTORIAL_GATES/LINES`),
`index.html` save wiring, `check.mjs --save`.

## Done
- **P1 `src/systems/save.js`** (pure JS, injected `storage`, falls back to `localStorage`, null-safe in sandboxed iframes):
  `SAVE_KEY='lumen.save'`, `SAVE_VERSION=1`, `snapshot(lg)` → `{v, at, mode, state, eco (Economy.serialize), build (build.serialize),
  story (StorySystem.serialize), jars, helpers, hero:{x,z}}`, `save/load/clear/hasSave`, `parseSnapshot` (bad JSON / wrong major → null),
  `describe(snap)` → "Season 2 · 66 Spark · 4 stalls".
- **P1 `Game.js installSave(lg)`**: autosave on `eco:season` (after the report), on `review → playing|endless`, on `game:endless`; **never per frame**.
  `lg.save = { snapshot, write, read, has, clear, exportText, importText, describe }`, emits `game:saved {season, at}`.
  `ui:start {mode:'continue'}` → `lg.resume(snap)` → `start(mode)` with `_resuming` set (no starter stalls, no S1 opening) → `applySnapshot`:
  eco state copied into the live `sb.eco` (keeps 10B bus wires), `build.load`, story state restored **before** `title.hide` (no toast/opening replay),
  helpers re-hired for free from upgrade ids, hero position, jar pcts → HUD sync → `game:resumed`. `eco:lose` / `game:title {why:'lose'}` → `clear()`.
  Title `setHasSave` refreshed on every `game:start`.
- **P2 tutorial gates `installTutorialGates(lg)`** — first-action nudges 8B has no event for, once per run, `story.toast(trigger)` with
  `TUTORIAL_LINES` fallback when `data/story.json` lacks the id: `tut:move` (hero > 2 u from spawn) · `tut:build` (12 s into S1, nothing placed) ·
  `tut:jars` (15 s after first sale, no APPLY) · `tut:endSeason` (S1 day01 > 0.85) · `tut:upgrade` (S2, 10 s, spark ≥ 60, no upgrade).
  Together with 8B's 10 bus-triggered toasts that is 13 toasts in a fresh run, 0 duplicates, and `fired` is part of the story snapshot so
  nothing replays after CONTINUE.
- **P3 export/import**: `exportText(snap)` → `LUMEN1:<base64 JSON>`, `importText(text)` (trims, prefix + version checked, garbage → null).
  `index.html`: `hasSave: () => Save.hasSave()` (reload → CONTINUE on the title), `window.lumenSave = {export, import, clear, has, describe}`
  and `?import=LUMEN1:…` for the Flutter WebView (14) when its storage is wiped.
- **`check.mjs --save`** (headless, 4 sections): run A PLAY → S1 → ledger → CONTINUE → build/jars/11 s → 5 gates + 13 toasts no dupes;
  run B same storage → title shows CONTINUE → resume S2 (spark/stalls/hero/toasts equal, clock runs, no replay); export → clear → bad text ×2
  refused → import roundtrip; forced fog loss → save cleared → TRY AGAIN → title without CONTINUE, destroy leaves 0 meshes. **ALL OK.**

## Missing
- `tut:price` — there is no per-stall price UI in 7A (prices come from the demand curve + haggle ability), so the prompt's "set price" toast has
  no action to gate on. Dropped; 5 gates + 8B's 10 toasts cover the prompt's 8.
- Customers in flight are not saved (they re-spawn from the pier on resume — by design, 6A pool).
- Mid-season progress is not saved: resume lands at the **start** of the saved season with the post-ledger spark (simple, cheat-proof).

## Measured
- Snapshot ≈ 1.6 KB JSON (2451 chars as LUMEN1 base64) at S2 with 4 stalls; `save()` ≈ 0.2 ms; no per-frame cost (gates tick in `eco:tick` 10 Hz).
- Draw calls unchanged from 10C (169–253 in play) — target ≤ 150 belongs to 11A.

## Notes for the integrator (11A / 11B / 14)
- 11A: nothing here touches render. If you change `Economy.serialize` fields, bump `SAVE_VERSION` major only when old snapshots cannot be applied.
- 11B: test "Reload resumes" on a phone = play to the S1 ledger, CONTINUE, kill the tab, reopen → title shows CONTINUE with the describe line.
- 14 (Flutter): before clearing WebView storage call `window.lumenSave.export()`; after reload either `window.lumenSave.import(text)` or open
  `index.html?import=<encodeURIComponent(text)>`.
