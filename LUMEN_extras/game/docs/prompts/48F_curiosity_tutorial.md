# Chat 48F — Curiosity tutorial: blue, once-only, reacts to the player — DEEP
Needs: 48A 48B 48D      Blocked-by: 48A (toasts gone) · 48D (buttons gone — the cards must not point at deleted buttons)
Owned (only these files): game/ui/tutor.js (NEW) · game/ui/tutor.css (NEW) · game/ui/index.js (one `add('tutor', …)` line) · game/data/tutor.json (NEW, ≤ 14 cards) · game/src/systems/verbChain.js (delete its DOM: `ui()` / `hideUI()` / Skip, keep the step logic + `tut:done`) · game/ui/nudge.js (delete the bubble, keep the hand) · game/ui/reveal.js (no toasts — 48A did that; here: emit `reveal:shown {key}` only) · game/src/systems/save.js (persist `tutorSeen[]`, same v4 as 48E or v5 if 48E closed first) · game/tests/tutor.test.mjs · docs/HANDOFF_48F.md
Read (max 10 credits): HANDOFF_48Z decision **D2** + census rows 4,7 → this → verbChain.js lines 1–40 + 60–95 (steps, `enter`, `AUTO_S`) → `grep -n "tut:done\|verbStep" game/src/Game.js game/src/systems/story.js` ±5 → ui/nudge.js 30–60 → ui/index.js 40–80 (how panels mount & `ui.update(dt)`) → `grep -n "ui:build:open\|action: 'demolish'\|st.cat = c" game/ui/build.js` (the events the cards react to) → dialogue.css lines 1–20 only (to make tutor.css NOT look like it).
Export (API_CONTRACTS §tutor, ≤ 6 lines): `mountTutor(root, { bus, data, seen:[] })` → `{ show(id), dismiss(), seen, update(dt), destroy() }`. Bus in: any event named in `tutor.json cards[].on`. Bus out: `tutor:shown {id}` · `tutor:dismissed {id, ms}`. Each card id shows **once per profile** (persisted); only **one** card on screen; a new trigger while a card is up is **dropped** (not queued).

## Design (D2, decided — do not re-debate)
- **Reactive, not scripted.** The card appears *after* the player does something, names the next step, and dies on tap/any key/8 s. Cards (`data/tutor.json`, text ≤ 60 chars, blue UI, one `icon` from ui/icons.js, optional `point` = CSS selector or `{x,z}` to draw the hand icon beside):
  `onBuildOpen` (`ui:build:open`, first time) "Tap a stall, then Deploy." point `.ll-build-tab` ·
  `onDemolish` (`ui:build {action:'demolish'}`) "Careful — demolish sells for half." ·
  `onDecorTab` (`st.cat` change → emit `ui:build:tab {cat}` from build.js — the ONE new event) "Decor lifts the mood. Mood lifts sales." ·
  `onFirstStall` (`build:placed stall_*`) "Walk up to your stall to see the price." ·
  `onFirstCoin` (`eco:spark reason:'tip*'`) "Coins go in the pouch. Jars keep them safe." point `.ll-build-tab[data-cat=jar]` (48E) ·
  `onJarsTab` (`ui:build:tab {cat:'jar'}`) "One of each. Place them where you walk." ·
  `onFirstDeposit` (`jars:deposit`) "Saved Spark earns. Pouch Spark gets spilled." ·
  `onWave` (`enemy:wave`, first) "Collectors chase coins. Hit them or outrun." ·
  `onIdle` (nudge predicate true 10 s, first) → no text; the hand icon beside ⏩ IS the card (nudge.js keeps the hand, loses the bubble) ·
  `onSeason2` (`eco:season {season:2}`) "Each season: one HOT and one COLD good." ·
  `onLocked` (`jars:locked`, first) "Invest unlocks at the Ledger." (replaces the deleted hero bark, once) ·
  `onCuriosityLull` — the user's "after some time the player has finished his curiosity": 25 s of play with **no** build open, no deposit, no stall → ONE card "Tap empty ground to build." Then never again.
- **Never**: pause, block input, dim the screen, stack, queue, Skip buttons, more than one sentence, an arrow that follows Pip.
- **Theme** (`tutor.css`): `--tut-bg: rgba(28,72,120,.88); --tut-ink:#E6F4FF; --tut-edge:#7FD3FF`; glass card, 1 px edge glow, 14 px radius, bottom-centre on phones / bottom-left on desktop, `backdrop-filter: blur(6px)`. Must not reuse `.ll-dlg-*` / paper textures.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 35 credits)
- `data/tutor.json` (cards above) → `ui/tutor.js` + `tutor.css` (mount, once-only via `seen`, one-at-a-time, dismiss on `pointerdown`/`keydown` capture **without** `preventDefault`, 8 s ttl) → `ui/index.js` mounts it with `seen` from the save → `tests/tutor.test.mjs` (domshim: trigger twice → one show; second trigger while up → dropped; dismiss emits with ms).
- verbChain.js: delete `ui()`, `hideUI()`, `V.el`, `V.skipEl`; where it called `ui(hints[id]…)` emit `tutor:hint {id}` instead and let tutor.json map `verb:move/coin/bonk/stall/deposit` to 5 cards (so the S1 chain still teaches, once). `check.mjs --verbs` must stay green (it may assert the chip — change the assert to the bus event).
- nudge.js: delete `bubble` and its text; keep `hand` (48C's PNG) bobbing beside ⏩; tapping the hand = tapping ⏩.
### P2 — should ship (≈ 20 credits)
- save.js: `tutorSeen` persisted/migrated; `ui:start {mode:'continue'}` restores it.
- build.js: emit `ui:build:tab {cat}` on tab change (one line) — the cards `onDecorTab`/`onJarsTab` need it.
- `onCuriosityLull` timer lives in tutor.js `update(dt)` with a bound predicate `{ touched: () => boolean }` set from Game.js in ONE line next to `nudge.bind`.
### P3 — nice to have
- `point` support: hand icon absolutely positioned at the selector's bounding box (recompute on resize). Skip for `{x,z}` world points.

## Demo page `LUMEN_extras/game/demo_tutor.html` (optional): buttons that emit each trigger; shows `seen`.
## check.mjs section `--tutor` (name `48F CURIOSITY TUTOR`): mount → emit `ui:build:open` ×3 → 1 card ever; emit `jars:deposit` while card up → still 1; `seen.length === 1`; verbChain run emits 5 `tutor:hint`; no `#verb-hint` element exists.
## Budgets: ≤ 1 card DOM subtree. Content rules: D2; rule 3 — tutor cards are the ONLY allowed sentences in Phase 48; ≤ 60 chars each.
## Handoff `docs/HANDOFF_48F.md` ≤ 15 lines + README_pipeline row + strike 48F.
