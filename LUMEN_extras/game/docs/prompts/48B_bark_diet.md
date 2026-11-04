# Chat 48B — Bark diet + the bubble over Pip's head
Needs: 48A      Blocked-by: 48A
Owned (only these files): game/ui/bark.js · game/src/Game.js (ONLY the line found by `grep -n "jars:locked" game/src/Game.js`) · game/data/story.json (ONLY `"barks"` → `"walkIn"`) · game/src/systems/story.js (`bark()` method only) · game/tools/checks/barks.mjs · docs/HANDOFF_48B.md
Read (max 6 credits): HANDOFF_48Z census rows 2–3 + decision D4 → this → `game/ui/bark.js` header (lines 1–15) and its anchor-resolution function (`grep -n "hero\|fallback" game/ui/bark.js`) → `grep -n "bark(line\|_lastBark\|barksPlayed" game/src/systems/story.js` ±12 lines. Nothing else.
Export (API_CONTRACTS §bark, 3 lines): `story:bark` with `anchor:'hero'` is **dropped**; an anchor that cannot be resolved is **dropped** (no fallback bubble); `mountBarks(root, { max: 1, gapS: 6 })` — one bubble on screen, next word-bark waits ≥ 6 s; glyph barks (`kind: 'want'|'price'`) are exempt from gap and max.

## Why (the bug the user sees): `ui/bark.js` falls back to the **hero** when an anchor is missing/unbound and when `anchor:'hero'` is asked for. `Game.js` barks "Locked till the ledger." at `'hero'` on every E press at a locked jar; story.js fires 7 walk-in lines in 24 s. Result: a sentence that keeps respawning over Pip. Fix = delete the fallback, delete the hero anchor, cut the lines.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 60 credits.
### P1 — must ship (≈ 25 credits)
- `ui/bark.js`: (a) if `anchor === 'hero'` → `return` (drop). (b) unresolved anchor (no owl yet, no baron, undefined object) → drop, never the hero, never the fixed bottom bubble — delete that branch. (c) `max` default 1 for word barks; `kind: 'want'|'price'` glyph barks keep their own small pool of 2. (d) word-bark gap: keep `lastWordAt`; a word bark arriving < `gapS` (6) seconds after the previous is **dropped** (not queued — queues are how text piles up).
- `src/Game.js`: delete the whole `bus.on('jars:locked', …story:bark…)` line (the jar wobble in jarsWorld.js is the feedback).
- `data/story.json` `barks.walkIn`: keep the first and the last line only (7 → 2); delete the 5 middle entries. Keep JSON valid (`node -e "JSON.parse(require('fs').readFileSync('game/data/story.json'))"`).
- `src/systems/story.js` `bark()`: every **word** bark id (group+index) plays **once per run** (`this.state.barksPlayed` already exists for one-shots — extend it to all groups except `pricing/wants/demand` which stay once-per-season as 44A set).
### P2 — should ship (≈ 10 credits)
- `tools/checks/barks.mjs`: emit `story:bark {anchor:'hero'}` → 0 bubbles; emit with `anchor:'owl'` before any bind → 0 bubbles; two word-barks 1 s apart → 1 bubble; `walkIn.length === 2`.
### P3 — nice to have
- Novelties (`src/systems/novelties/*.js`, 5 files, 1 bark each) and `scamNpc.js`/`baronPier.js`: confirm their anchors are `'owl'`/`'baron'`/`{x,y,z}` with `grep -n "story:bark" …`. Fix anchors only; do not rewrite lines.

## Demo page: none — `node tools/check.mjs --barks --story --quiet`.
## check.mjs `--barks` (additive block `48B BARK DIET`): the 4 asserts in P2.
## Budgets: ≤ 1 word bubble + ≤ 2 glyph bubbles on screen. Content rule: D4 — glyphs are not text.
## Handoff `docs/HANDOFF_48B.md` ≤ 15 lines + README_pipeline row + strike 48B.
