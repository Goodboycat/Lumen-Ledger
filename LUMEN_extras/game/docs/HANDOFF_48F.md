# HANDOFF 48F — Curiosity tutorial: blue, once-only, reactive (2026-11-04, CLOSED)

## Done
- [x] P1 `data/tutor.json` 16 cards (11 `on*` + 5 `verb:*` mapped from `tutor:hint`), ≤ 60 chars, `icon` from ui/icons.js, optional `point` selector · `ui/tutor.js` + `tutor.css` (blue glass `--tut-bg/ink/edge`, 14 px radius, blur 6, bottom-centre phone / bottom-left desktop; no `.ll-dlg-*`) — `mountTutor(root,{bus,data,seen})`, once per profile via `seen`, ONE card, new trigger while up = dropped, dismiss on `pointerdown`/`keydown` capture (no preventDefault) or `ttl` 8 s, `match` filters (`*` glob, numbers), `bind({touched})`, `onCuriosityLull` 25 s in `update(dt)`.
- [x] P1 `verbChain.js`: `ui()/hideUI()/V.el/V.skipEl/#verb-hint` deleted → `tutor:hint {id,key,text,pulse}`; step logic + `tut:done` kept. `nudge.js`: bubble + text deleted, hand (48C PNG) stays; hand tap = ⏩ (`ui:speed {cycle}`). `build.js`: `ui:build:tab {cat}` on tab change + `data-cat` on tabs (the ONE new event).
- [x] P1 `ui/index.js` `add('tutor', …)` when `opts.tutorData`; `ui.update` ticks it only while not modal.
- [x] P2 `save.js` v4 field `tutorSeen[]` (tolerant parse → `[]`, migrate < field → `[]`) · `Game.js` `applySnapshot` merges into `ui.tutor.seen`, `tutor.bind({touched})` next to `nudge.bind` · `index.html` fetches `data/tutor.json` (`?notutor` skips) → `mountUI({tutorData, tutorSeen: Save.load()?.tutorSeen})`.
- [x] P3 `point`: hand icon positioned at the selector's bounding box, rAF-recomputed while the card is up (`{x,z}` world points skipped, as planned). `reveal.js` emits `reveal:shown {key}`.
- [x] Gates: `tests/tutor.test.mjs` 8 pass · `check.mjs --tutor` "48F CURIOSITY TUTOR" · `tests/save.test.mjs` 8 pass · `--ui --verbs --save --reveal` ALL OK.

## Missing
- `LUMEN_extras/game/demo_tutor.html` (optional demo page) not written.
- Cards are not yet eyeballed in a real browser (card position vs. the 48E jar tab on ≤ 700 px) — one funnel run in 48H should confirm nothing overlaps the tray.

## Next chat
`bash tools/next.sh` → 48G (Too Good Deals, 3 decisions). PLAY_BUGS 48B-2 (Settings → Title / Restart season) and 48D-1 (flaky sims) still open.
