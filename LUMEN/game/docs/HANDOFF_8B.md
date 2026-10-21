# HANDOFF 8B — Story system (pure JS) + GDD (2026-10-18)
*Closed by a follow-up chat: the original 8B chat was axed after writing `story.js` + `story.test.mjs` (55/57 asserts). This chat fixed the 2 test asserts (test-side bugs, not system bugs), added the check.mjs gate and wrote GDD.md.*

## Done
- **P1** `src/systems/story.js` (15.8 KB, pure JS, no Three/DOM) — `StorySystem(economy, { data, bus, autoplay, autoAdvance, lineGap, midAt, ledgerLinesBeforeReview, tutorial })`.
  - Contract §B: `.onSeasonStart(n) .onSeasonEnd(report) .next() .choose(i)` + `.onMid() .onEvent(id) .onScam(offer) .onWin() .onLose(reason) .update(dt) .skipGroup() .clear() .destroy() .serialize()` / `StorySystem.deserialize(json, economy, opts)`. Exports `pickLedgerVariant(stars)`, `linesFor(data, kind, key, variant)`, `loadStory(url)`, `LEDGER_VARIANTS`, `SCAM_LESSON_TITLE`, `SCAM_TIP`.
  - Emits `story:line {speaker,text,mood?,choices?,group,index,total,season}` one at a time → waits for `ui:advance` (7B dialogue) · `story:begin` / `story:groupEnd` per group · `story:end {group}` **only when nothing is queued** (dialogue box closes once) · `story:lesson {id,title,lesson,tip}` immediately at season end (and the scam `tell` as lesson "Too-Good Deals") · `story:review {report,season,variant}` after the ledger lines (10C opens the Ledger here) · `story:choice {index,choice,offer,outcome}` · `story:finale {endless,outcome,reason}` · `story:toast {id,text,icon,kind,trigger}` once per run per tutorial trigger.
  - Listens (autoplay): `ui:start` → S1 opening · `eco:season` → lesson + `ledger[variant]` (low 0–1★ / default 2★ / high 3★) · `ui:continue {outcome:'season'}` → next opening · `eco:event {id}` · `eco:scam offer` → pitch; last line has `choices` → `ui:choice {index}` → `economy.acceptOffer()` / `refuseOffer()` → accept/refuse lines (queued to the FRONT, no story:end in between) · `eco:win` → ending.win + endlessUnlock + lesson planningForAGoal · `eco:lose` → ending.lose · `ui:advance` · all 10 tutorial trigger names. `update(dt)` fires `mid` once per season at day01 ≥ 0.5. Unknown scam id → synthesized 2-line pitch so the choice still happens.
- `tests/story.test.mjs` — 58 asserts with the REAL 4B economy (`makeEconomy`) on a private bus: openings, mid, season end + variants, scam accept/refuse + economy side effects, queueing/story:end once, tutorial toasts + serialize, win/lose finales, autoAdvance demo mode, 10-season walk. `node tests/story.test.mjs` → 58 passed.
- `tools/check.mjs --story` (additive) — new **STORY SYSTEM (8B)** section: runs the test file as a child + a bus-driven 10-season walk (autoSeason economy, `ui:start` → … → `story:review` → `ui:continue` → next opening, scam refuse via `ui:choice`, 118 lines, lessons in BALANCE order, `eco:win` → `story:finale`, serialize round-trip) → OK.
- **P2** `docs/GDD.md` (13.5 KB, ~3 pages): pitch, pillars, core loop diagram + economy table, **FinLit mapping table** (10 lessons × mechanic × story beat + ability↔lesson), systems/ownership, controls (keyboard + touch), art direction, cast, scope/schedule/perf budget, accessibility, credits placeholder, glossary. Numbers cross-checked against `economy.js`/`economyData.js`; event/scam/stall ids are the real ones.

## Missing
- **P3** branching on stars beyond the 3 ledger variants (data has low/default/high only; `pickLedgerVariant` is the single switch point) · Endless-mode season text (after `story:finale {endless:true}` the system goes quiet; 10C can keep calling `onSeasonStart(n)` — `linesFor` returns [] for n > 10 so nothing plays, no throw).
- No demo HTML (the prompt names `tests/story.test.mjs` as the demo; pure-logic chat → no browser per START_HERE). Browser QA skipped (not needed, 0 draw calls).

## Measured
- 0 draw calls / 0 tris (pure logic). `node tools/check.mjs --story` 0.6 s → OK · full gate `--props --creatures --hero --abilities --economy --build --customers --ui --story` → ALL OK ✅.

## Suspected
- `tutorial[0].trigger = 'ui:start'` fires while the title is still on screen (7C `title.hide()` is manual). 10C: if it looks early, swap the trigger in `data/story.json` to `ui:title:close` (t_build already uses it) — one data edit, no code.
- `ui:continue` listener only starts the next opening when `outcome === 'season'`; 7B emits `outcome: 'win' | 'lose' | 'season'` — verify 7B's exact string when 10C wires it (test uses 'season').

## Notes for the integrator (10C)
```js
import { StorySystem, loadStory } from './src/systems/story.js';
const data = await loadStory('data/story.json');
const story = new StorySystem(economy, { data });          // bus defaults to economy.bus (= core/EventBus bus)
// per frame: story.update(dt)   — drives mid-season lines; everything else is bus-driven
mountLedger(root, { autoOpen: false }); bus.on('story:review', ({ report }) => ledger.show(report));
// save: story.serialize() → into 10D's save file; load: StorySystem.deserialize(json, economy, { data })
```
- Dialogue flow already matches 7B: `story:line` → dialogue `queue()`; dialogue `advance` → `ui:advance` → next line; choices → `ui:choice {index}`; `story:end` → `hide()`. `ui:pause` is handled by 7B.
- Pause the economy clock while `story.isPlaying` (openings are 6–9 lines) or Glimmers keep paying during dialogue — integrator's choice; the system does not touch `economy.tick`.
- `opts.autoAdvance:true, lineGap:0.12` = trailer/demo mode (13B) — lines advance themselves.
