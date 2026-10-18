# HANDOFF 7C — UI: Title · Pause/Settings · Touch controls (DOM/CSS only) (2026-10-18)
(started by an axed chat; closed + verified by the next chat — ui/{title,pause,touch}.{js,css} + demo + check.mjs UI (7C) section were complete, the HANDOFF / README row / commit were missing)

## Done
- `ui/touch.js` + `ui/touch.css` — `mountTouch(root, input, { bus, force, side:'left', buttons:['attack','interact','build'], deadzone:0.12 })` → `{ el, show, hide, visible, setEnabled(name,bool), setBadge(name,text), destroy }`.
  P1: virtual joystick — the left 55 % of the screen is the zone (base appears under the finger, knob clamped to 56 px = Input.joystick radius), writes `input.joystick.{active,vec}` directly (Input.update() → `input.move`) and calls `input.onJoystick` if set. Pure `joyVector(dx,dy,radius,deadzone)` exported.
  3 chunky buttons (≥ 64 px, right/bottom): ⚔ attack (hold repeats every 220 ms) · ✋ interact · 🔨 build → `input.press(name)` + `input.actions[name]` while held. `TOUCH_BUTTONS` also has `dash`. Portrait + landscape + safe-area layouts.
  Auto-shows on `input.isTouch`, `opts.force` or `?touch=1`. Hides itself on `ui:title:open` / `ui:ledger:open` / `ui:dialogue:open` (modal), back on close; `build:enter` disables attack. Emits `ui:touch {action}`.
- `ui/title.js` + `ui/title.css` — `mountTitle(root, { bus, hasSave, version, autoShow:true, hideOnStart:false, showOnLose:true })` → `{ el, show, hide, isOpen, setHasSave, setBusy, destroy }`.
  P2: sky panel, 11-letter logo pop (60 ms stagger outBack), lantern swing, tagline "Make FinLit Fun", ▶ PLAY · ⟳ CONTINUE (only with save) · ∞ ENDLESS → `ui:start {mode:'story'|'continue'|'endless'}` (title stays open until 10C calls `hide()` unless `hideOnStart`). Keys Enter/Space/E/C, ↑↓ focus. `eco:lose` / `ui:continue{outcome:'lose'}` → re-show with "The Fog won this time…". Emits `ui:title:open/close`.
- `ui/pause.js` + `ui/pause.css` — `mountPause(root, { bus, settings, storageKey:'lumen.settings', hotkey:true, onOutline })` → `{ el, open, close, toggle, isOpen, settings, setSetting, destroy }`.
  P2: Esc / `input.press('menu')` / `ui:pause:request` → `ui:pause {on, by:'menu'}`; ▶ RESUME · ⚙ SETTINGS · ⟳ RESTART SEASON · ⌂ TITLE (double-tap "Sure?" within 2.5 s → `ui:restart` / `ui:title`). Force-closes on `ui:title:open`, `eco:win`, `eco:lose`.
  P3: Settings — quality low/medium/high · outline 0.02–0.06 (→ `opts.onOutline(v)`) · SFX · music · reduce motion (body.ll-reduce-motion). Each change → `ui:settings {key,value,settings}` + localStorage. Pure `normalizeSettings / loadSettings / saveSettings` exported (clamp, broken JSON → defaults). No emit on unchanged value.
- `demo_ui_title.html` — Foundation Game + Island + hero + 7A HUD; buttons/keys 1–5: title / pause / touch pad / eco:lose / build badge. `window.game` + stats shown.
- `tools/check.mjs --ui` **UI (7C)** section: touch (joyVector, simulate → vec + onJoystick ×4, release spring, press → input.press + ui:touch, hold repeats, setEnabled, badge, modal hide, build:enter, force, destroy) · title (autoShow, 11 letters, tagline, CONTINUE hidden/shown, ui:start, keys, hide, busy, eco:lose, autoShow:false + hideOnStart, destroy) · pause (pure settings fns, Esc, RESUME, SETTINGS, quality → ui:settings + localStorage, outline → onOutline, reduce motion, no-emit unchanged, RESTART/TITLE double-tap, ui:title:open force-close, ui:pause:request, destroy) — ALL OK.

## Missing
- Nothing from P1–P3. Real phone QA is 11B's job (joystick zone vs. HUD ribbon overlap on very short landscape phones should be looked at there).

## Measured
- DOM only: 0 draw calls, 0 tris added. `node tools/check.mjs --ui` → UI (7A) 3/3 · UI (7B) 3/3 · UI (7C) 3/3 OK, ALL OK ✅. Browser QA skipped by the closing chat (Node checks cover the full API).

## Suspected
- Foundation `Input` already runs its own canvas joystick on the left half; the touch overlay sits above the canvas so only one fires — but if 10C mounts the overlay with `pointer-events:none` on the root, both will run. Keep `#game-root` overlay pointer-events as in `ui/base.css`.
- `pause` ignores `ui:pause` from other sources (dialogue) by design; 10C must AND the pause reasons (menu ∨ dialogue ∨ ledger) into `game.paused`.

## Notes for the integrator (10C)
- Mount order: `mountTitle(root, { bus, hasSave })` first (owns the screen) → `mountPause(root, { bus, onOutline: setOutlineThickness })` → `mountTouch(root, game.input, { bus })` last (auto-hides under title/modals).
- On `ui:start {mode}`: build the world, then `title.hide()`. `'continue'` → load `lumen.save` (10D). `'endless'` → economy with `story:false` / no Baron events.
- On `ui:settings {key:'quality'}` → 11A's quality presets (shadow map size, pixel ratio, instanced counts). `outline` is already wired through `onOutline`.
- `ui:restart` → reset the current season (10D save point) · `ui:title` → `title.show()` (pause force-closes itself on `ui:title:open`).
