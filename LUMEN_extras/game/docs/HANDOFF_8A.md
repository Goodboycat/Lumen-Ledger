# HANDOFF 8A — Story data (JSON only) (2026-10-18)

## Done
- `data/story.json` (35.7 KB, 207 lines of dialogue) — pure data, no code. Top-level keys:
  - `meta` — shapes documented inline (`lineShape`, `lessonShape`, `toastShape`, `ledgerVariants`).
  - `speakers` — pip / owl / baron / collector / glimmer / narrator (= `ui/dialogue.js` SPEAKERS keys). Moods ⊂ {happy, sad, angry, shout} (= dialogue.css `mood-*`).
  - `lessons` — 10 cards `{ id, season, title, lesson (2 sentences), tip }` keyed by `BALANCE.lessons` ids (budgeting … planningForAGoal). Emit as `story:lesson` → `ui/ledger.js` renders it.
  - `seasons[10]` — `{ season, title, lesson, opening[6–9 lines], mid[2], ledger: { default[2], low[2], high[2] } }`. Lesson order == `BALANCE.lessons`. P3 done: low (0–1 ★) / high (3 ★) variants for every season.
  - `scams` — all 6 of 4B's `SCAMS` ids: `{ id, lesson, season, pitch[] (last line has choices accept/refuse), accept[], refuse[], tell }`. `tell` + `lesson` are byte-identical to `economyData.js`.
  - `events` — 1–2 lines for every one of 4B's 10 `EVENTS` ids.
  - `ending` — `win[9]` (Lighthouse relit, Baron offered a Save jar), `endlessUnlock[2]`, `lose[3]`.
  - `tutorial[10]` — `{ id, trigger (bus event), icon, text }` toasts for `story:toast` (ui/toast.js adds the 🦉 default icon).
- `docs/story_outline.md` — cast, season beat table, scam/event/ending/tutorial map, rules for 8B.
- `tools/check.mjs --story` (additive): parses, 10 seasons in BALANCE order with all 5 line groups, lesson cards complete, every SCAMS/EVENTS id covered, scam pitch ends in accept/refuse choices + tell == 4B, ending groups, 10 unique toasts with `x:y` trigger names, every line has a known speaker/mood, Bible §2 banned-word regex → **OK**.

## Missing
- Nothing from P1–P3. Not in scope: per-Glimmer-type barks (6B), helper hiring lines (10B can reuse `events`/`mid` style), localisation.

## Measured
- 0 draw calls / 0 tris (data). `node tools/check.mjs --story` → OK, ALL OK ✅. No browser needed, none used.

## Suspected
- `tutorial[0].trigger = 'ui:start'` fires while the title is still on screen (title.hide() is manual) — 8B/10C may prefer to fire it on `ui:title:close` instead; both toasts exist, pick one.
- Scam `season` hints (5/5/5/7/2/8) are flavour only; 4B's `offerScam()` decides when offers actually appear. 8B should key on the offer id, not the season.

## Notes for the integrator (8B / 10C)
- Load: `const story = await (await fetch('data/story.json')).json()` in the browser; `JSON.parse(readFileSync(...))` in Node tests. No import assertion needed (keeps it a plain static file for itch.io / WebView).
- Season start → emit each `seasons[n-1].opening[i]` as `story:line`; mid-season (day01 ≥ 0.5) → `mid`; on `eco:season` report → `story:lesson lessons[report.lessonId]` then the `ledger[variant]` lines (variant from `report.stars`), then let the Ledger open (`mountLedger(root,{autoOpen:false})` + `ledger.show(report)` on `ui:dialogue:close`).
- `eco:scam offer` → `scams[offer.id].pitch` as lines; the last line carries `choices` → `ui:choice {index}` → index 0 = accept (`economy.acceptOffer(offer)`), 1 = refuse; then play `accept`/`refuse` lines and `story:lesson { id: offer.lesson, title: 'Too-Good Deals', lesson: tell, tip }`.
- `eco:event {event}` → `events[event.id]`. `eco:win` → `ending.win` then `endlessUnlock`; `eco:lose` → `ending.lose` (title re-shows itself on eco:lose).
- Tutorial: keep a `Set` of fired ids; on each `trigger` event emit `story:toast { text, icon }` once. Save the Set in 10D's save file.
