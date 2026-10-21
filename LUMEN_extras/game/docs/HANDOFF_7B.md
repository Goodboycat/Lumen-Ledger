# HANDOFF 7B — UI: Ledger Review + Dialogue + Toasts (DOM/CSS only) (2026-10-17)
(started by an axed chat; closed + verified by the next chat — ui/*.js|css + demo were complete, the check.mjs section / HANDOFF / README row / commit were missing)

## Done
- `ui/ledger.js` + `ui/ledger.css` — `mountLedger(root, { bus, lessons, seasonsToWin, autoOpen, selfDrive })` → `{ el, state, rows, isOpen, show(report, {lesson, outcome}), skip, hide, continue, setLesson, update(dt), destroy }`.
  Modal sheet (backdrop 220 ms · drop-in 420 ms outBack): title "Season n Ledger" + sub "k seasons to the Lighthouse", 5 rows (`LEDGER_ROWS`: income, Save interest, Invest return, Expenses, Loan interest 20 %) + Net row,
  stagger 90 ms × i, count-up 650 ms outCubic per row (`update(dt)`), value pop at settle; chips Fog % (±delta, bad/good) · Debt · Net worth; 0–3 stars pop 380 ms outBack 220 ms apart + star text;
  lesson card (`LESSONS` 10 fallback cards keyed by Economy `lessonId`, `story:lesson {id,title,lesson,tip}` overrides — pending if it arrives before the report); CONTINUE bounce-in, disabled until the timeline ends.
  Tap on sheet / Enter while animating → `skip()`; Enter / Space / CONTINUE → `ui:continue {season, stars, lessonId, outcome:'season'|'win'|'lose'}` then hide. `eco:win` → "✦ The Lighthouse is lit!" + ENDLESS MODE; `eco:lose {reason}` → "Fogged out…" + TRY AGAIN.
  Listens `eco:season` (auto-opens unless `autoOpen:false`), `story:lesson`, `eco:win`, `eco:lose`. Emits `ui:ledger:open/close`, `ui:continue`.
- `ui/dialogue.js` + `ui/dialogue.css` — `mountDialogue(root, { bus, cps, pauseGame, selfDrive })` → `{ el, state, isOpen, isTyping, line, say, queue, skip, advance, choose, hide, clearQueue, update(dt), destroy }`.
  Box slide-up 320 ms outBack, portrait pop 380 ms, typewriter `cps` (default 45; `.!?` pause ×6, `,;:—` ×3), portrait talk-bob while typing, caret, ▼ bounce when done, choices stagger 70 ms × i.
  Tap / Enter / Space: typing → skip · done → next queued line or `ui:advance` + hide · with choices → must pick (click or keys 1–4) → `ui:choice {index, text, choice, line}`.
  `SPEAKERS` pip / baron / owl (tallyOwl) / glimmer / collector / narrator (no portrait, no name); unknown speaker → generic blob with initial. `line.portrait` (HTMLElement | html string) replaces the blob.
  `pauseGame:true` → `ui:pause {on:true|false, by:'dialogue'}` on open/close. Listens `story:line`, `story:end`. Emits `ui:dialogue:open/close`, `ui:advance`, `ui:choice`, `ui:pause`.
- `ui/toast.js` + `ui/toast.css` — `mountToast(root, { bus, max:3, duration:2800, listen:true })` → `{ el, count, items, push(text|{text,kind,icon,duration,id}) → {el, close}, clear, destroy }`.
  Top-centre stack, newest on top, slide-in 320 ms outBack, progress bar = duration, exit 200 ms, click to dismiss, `max` drops the oldest; same `id` or same text while visible → coalesce "×N" + bump + timer restart.
  Kinds ok/info/warn/bad/gold. Built-in listeners (`listen:false` to opt out): `ui:toast`, `story:toast` (🦉), `eco:event`, `eco:scam`, `build:placed/upgraded/denied`, `eco:denied`, `eco:loan`, `cust:angry` (coalesced), `island:unlock`, `eco:win`, `eco:lose`. Emits nothing.
- P3: CSS-blob portraits per speaker (Pip orange + scarf, Baron purple + top hat, Tally-Owl brown big eyes, Glimmer blue, Collector grey) with `mood-*` modifiers; portrait + safe-area + ≤ 640 px layouts in all three CSS files.
- `demo_ui_ledger.html` — no Three; keys/buttons 1–7: ledger ★ / ★★★ (+ `story:lesson` override) / lose · dialogue ×3 · Baron's deal (choices → toast) · toasts ×6 (coalesce) · WIN. `window.game` + stats stub for smoke.mjs.
- `tools/check.mjs --ui` **UI (7B)** section (additive): ledger (open/title/sub/chips/lesson/count-up/net/skip/stars/continue/story:lesson/win/lose/Enter/autoOpen/destroy), dialogue (queue/pause/speaker/typewriter partial→done/advance/skip/Enter/choices/keys/narrator/generic/story:end/destroy), toast (push/coalesce/max/order/clear/click/8 bus listeners/listen:false/auto-dismiss/destroy) — ALL OK.

## Missing
- Nothing from P1–P3. Real portraits (if 10C wants 3D renders, pass `line.portrait`), sound hooks (12 maps `ui:*` events).

## Measured
- DOM only: 0 draw calls, 0 tris. `node tools/check.mjs --ui` → UI (7A) 3/3 OK, UI (7B) 3/3 OK, ALL OK ✅. Browser QA skipped by this chat (cheap Node checks cover the whole API; the demo page imports only Foundation EventBus + 7A hud).

## Suspected
- `ledger` sub-line uses `seasonsToWin - report.season`; if 4A's `eco:season` report carries the *new* season number instead of the one that just ended, pass `seasonsToWin + 1` or open via `ledger.show()` with `autoOpen:false`.
- `toast` coalesces on identical text even without an `id` — two different stalls with the same display name would merge. Pass unique `id`s from 10C if that matters.
- `dialogue` keys 1–4 pick choices while a line with choices is shown — the demo pages (7A/7B) use 1–7 as demo hotkeys, so 10C should route hotkeys through `dlg.isOpen` (the demo does).

## Notes for the integrator (10C)
- Mount order after 7A: `mountLedger(root, { bus, seasonsToWin: BALANCE.seasonsToWin })` · `mountDialogue(root, { bus, pauseGame: true })` · `mountToast(root, { bus })`.
- `ui:pause {on}` → pause the Game loop / customers (dialogue is modal). `ui:continue {outcome}` → `'season'`: resume + next season · `'win'`: endless mode · `'lose'`: reset/title.
- If 8B wants the story line BEFORE the ledger: `mountLedger(root, { bus, autoOpen: false })`, then on `eco:season` queue `story:line`s and on `ui:dialogue:close` call `ledger.show(report)`.
- 8B emits `story:lesson` right before/after `eco:season` — both orders work (pendingLesson). Lesson text in `LESSONS` is a fallback; 8A owns the real copy.
- All three use `ui/base.css` vars and the `.ll-*` prefix; z-order: ledger (40, modal) > dialogue (35) > toasts (30) > build tray / HUD. A toast under an open ledger is hidden by the backdrop — 10C may `toast.clear()` on `ui:ledger:open`.
