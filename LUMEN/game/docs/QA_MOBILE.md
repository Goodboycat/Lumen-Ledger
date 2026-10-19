# QA_MOBILE — Lumen Ledger on phones, tablets and the itch.io embed (Chat 11B, 2026-10-19)

Harness: `NODE_PATH=tools/node_modules node tools/qa_mobile.mjs` (Playwright Chromium, swiftshader GL, from `game/`).
It loads `index.html?autoplay&debug[&touch=1]`, drains the Season-1 opening dialogue, then audits the live DOM:
**overflow** (any visible UI rect leaving the viewport by > 2 px) · **overlap** (hud / jars / build tray / touch pad / dialogue /
toasts intersecting by > 4 px) · **taps** (buttons / sliders < 44×44 css px — Apple HIG; warning only) · **scroll**
(`scrollWidth/Height` > viewport → scrollbars inside the itch.io iframe) · **stats** from `window.game`. Exit 1 on any FAIL line.
Screenshots: `tools/shots/qa_<vp>_{0_title,1_play,2_build}.png` (copies of the play shots in `../screenshots/11B_mobile/`).

## Result after the 11B fixes — 3 / 3 viewports OK ✅ (run 2026-10-19)

| Viewport | Mode | Overflow | Overlap (play) | Overlap (build tray open) | Scroll | Taps < 44 px | Errors | dc | meshes | dpr |
|---|---|---|---|---|---|---|---|---|---|---|
| 360×800 portrait | touch, Pixel 5 UA, dpr 2 | none | none | none | none | **0** | none | 110 | 187 | 2 |
| 800×360 landscape | touch, Pixel 5 UA, dpr 2 | none | none | none | none | **0** | none | 135 | 187 | 2 |
| 1280×720 desktop / itch.io | mouse, dpr 1 | none | none | none | none | 8 (desktop keeps the compact look — intentional) | none | 133 | 187 | 1 |

fps reads 20 in every column — that is swiftshader (software GL in the headless container), not the game; 11A measured 60 fps
on a real GPU and the PixelRatioGovernor (`perf.js`) drops dpr 1.5 → 0.85 on phones that fall under 45 fps for 3 s.

Panel rects in play (x,y w×h): 
- 360×800: hud 12,10 336×74 · jars 166,485 184×53 (folded) · dialogue 12,552 336×66 · build toggle 12,740 220×44
- 800×360: hud 12,10 776×56 · jars 560,74 228×57 (folded) · dialogue 90,206 620×84 · build toggle 12,300 420×44
- 1280×720: hud 12,10 1256×56 · jars 1040,74 228×282 · dialogue 330,566 620×84 · build toggle 360,675 560×33

## What was broken before 11B and the (smallest) fix for each

| # | Bug (first run of the harness) | Fix | File |
|---|---|---|---|
| 1 | Jars panel sat on top of the dialogue box: portrait 182×66 px, landscape 150×84 px overlap | while a dialogue is open (`body.ll-dlg-open`, set/cleared by `dialogue.js` `say()/hide()`) the panel folds to its header on ≤ 900 px; portrait also lifts it 250 px above the touch pad | `ui/jars.css`, `ui/dialogue.js` |
| 2 | Title layer stayed `display:flex` at `opacity:0` after PLAY → a full-screen invisible element reported as overflow and swallowed nothing but confused the audit | `.ll-title.hide.gone { display:none }` set 340 ms after `hide()` (after the fade), cleared on `show()` | `ui/title.css`, `ui/title.js` |
| 3 | Tap targets 18–33 px high on touch devices (jar sliders, APPLY/RESET, build toggle, dialogue ▼) | `body.is-touch` only: buttons `min-height:44px`, range `height:32px` + 24 px thumb, dialogue next 44×44 grid | `ui/base.css` |
| 4 | `#debug-stats` (dev readout) pinned bottom-right under the touch pad on phones | moved bottom-left with `env(safe-area-inset-*)`, `max-width:46vw`, still hidden unless `?debug` | `index.html` |

## Touch controls (7C) verified
- Virtual joystick bottom-left, 3 hold-able buttons bottom-right, auto-hidden under the title and under modals (ledger / pause).
- The build toggle is a 44 px pill above the pad; tapping it opens the tray, tapping a card enters placing mode, tapping the island
  places (confirm pill), back = Esc button on the pad.
- Dialogue advances by tapping the box; choices are 44 px rows.

## itch.io embed (1280×720)
`html, body { overflow:hidden }` + `#game-root { position:fixed; inset:0 }` → `scrollWidth = 1280`, `scrollHeight = 720`: **no
scrollbars** in the iframe. Upload the `game/` folder as the zip root (index.html at the top level), tick "Mobile friendly" and
"Fullscreen button"; set the viewport to 1280 × 720. Everything is relative-path (`./src`, `./ui`, `./vendor`) so it also runs from an
itch.io CDN sub-folder and from a Flutter WebView `assets/` directory (see HANDOFF_11B Notes).

## Not covered by the harness (manual, real devices)
- Real-GPU fps, thermal throttling, iOS Safari address-bar collapse (handled by `100dvh` fallback — see P2), audio unlock (P2 stub;
  12 audio hooks `input:first`).
