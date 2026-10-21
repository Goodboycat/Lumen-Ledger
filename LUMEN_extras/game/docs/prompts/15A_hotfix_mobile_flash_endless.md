# Chat 15A — Hotfix: mobile touch bugs · no hit flash · delete Endless
Needs: 7C touch · 10C state machine · 11B mobile QA      Blocked-by: none (first v2 ID)
Owned (only these files): ui/touch.js, ui/touch.css, ui/title.js, ui/title.css, ui/ledger.js, src/Game.js (10C/10D sections only), index.html,
  src/entities/HeroController.js (line ~158 flash call only), src/systems/save.js (mode field), tools/qa_mobile.mjs (additive asserts), check.mjs (additive)
Read (max 8 credits): START_HERE.md → VISION_V2.md §8 → this → `grep -n` the lines named below. Do NOT read whole files.
Export: bus `ui:start {mode:'story'|'continue'}` only · `GAME_STATES` loses 'endless' · touch pad DOM contract unchanged (names attack/interact/build/dash)

## The user's bug reports (verbatim intent)
1. **Mobile: the joystick zone blocks the buttons on the LEFT.** `.ll-joy-zone` is `left:0; top:96px; bottom:0; width:55%` with `pointer-events:auto`,
   so anything underneath it on the left (build tray cards, jar sliders, ability tray, pause ⏸ when it wraps, toasts) cannot be tapped.
2. **Mobile: the right-corner button pad blocks what is behind it.** `.ll-touch-pad` is a 2×2 grid box with `pointer-events:auto` on the whole
   grid, so the empty cell and the gaps swallow taps meant for the tray / HUD beneath.
3. **The white screen flash on every sword hit** (`v.flash.flash('#fff6c8', 80, 0.18)` in HeroController) must go. Hit-stop + shake stay.
4. **Endless mode is boring → delete it** everywhere (title button, ledger "ENDLESS MODE ▸", `?endless`, `lg.mode==='endless'`, `game:endless`,
   `winRequiresSeasons:false` path, save `mode`, story finale `{endless:true}` → `{}`); win now goes review → **title with a "✓ CLEARED" badge**
   until phase 23 replaces it with the Citadel ending. Keep `createSandbox` balance options intact (phase 23 reuses them).

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- touch.css/js: joystick zone becomes **pass-through**: `pointer-events:none` on `.ll-joy-zone`; instead listen `pointerdown` on `document`
  (capture) and start the joystick ONLY if `e.clientX < 55 % width`, `e.clientY > hudBottom`, and `e.target.closest('button, input, .ll-card, .ll-jars, .ll-build, .ll-hud, .ll-toast, .ll-dlg')` is null.
  Keep the base-under-finger behaviour. Add `data-joy-ignore` support so any later UI can opt out.
- touch.css: `.ll-touch-pad { pointer-events:none }` and `.ll-touch-btn { pointer-events:auto }` (only the round buttons catch taps); remove the
  negative margins on `.attack` (they overlap the interact button's hit area) — use `transform: scale(1.15)` instead.
- HeroController: delete the flash line (keep `hitStop` + `camera.addTrauma`). Add a comment `// v2: no screen flash on hits (user rule 15A)`.
- `check.mjs --touch`: domshim mount → synthetic pointerdown on a fake `<button>` inside the left zone → joystick NOT started and button got the event;
  pointerdown on empty left area → joystick started; pad grid gap pointerdown → passes through (target below receives it).
### P2 — should ship (≈ 15 credits)
- Delete Endless: title.js (remove the `endless` entry + key E), ledger.js (`'win' → 'MAIN MENU ▸'`), index.html (`?endless` removed; `?autoplay` stays),
  Game.js (every `endless` branch; `GAME_STATES = ['title','playing','review','ending']`; win → `ending` → `story:finale` → `lg.setState('title')`
  + `bus.emit('game:cleared')`; title shows the badge on `game:cleared`), save.js (`mode` always 'story'; bump `SAVE_VERSION` 2 with a 1→2 migrate).
  `grep -rn endless src ui index.html` must return only comments that say "removed 15A".
- `check.mjs --game`: update the walk (S1→S3→win→**title**, no endless) — ALL OK.
### P3 — nice to have (≈ 10 credits)
- `tools/qa_mobile.mjs`: add a "tap-through" audit — for each visible button, `elementFromPoint(center)` must be the button itself; FAIL lists offenders.
- Title: "✓ CLEARED" badge CSS (gold chip under the logo) + a one-line stat (seasons, Spark).

## Demo page: none new — `index.html?autoplay` + `demo_ui_title.html` (remove its ENDLESS mention).
## check.mjs sections: `15A TOUCH` (new `--touch`) + updated `GAME (10C)` walk. Run `--ui --game --save` → ALL OK before the README row.
## Budgets: 0 new meshes. ## Content rules: none. 
## Handoff `docs/HANDOFF_15A.md`: Done / Missing / Measured / Suspected / Notes (tell 15B which Game.js lines are the win path now).
