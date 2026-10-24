# Lumen Ledger — the game folder

**A cozy 3D market tycoon where every coin needs a jar — or the Debt Fog rolls in.**
Entry for the Zoud GameLab jam, theme *"Make FinLit Fun"* (Oct 15 – Nov 15 2026). Plays in any modern browser, nothing to install.
Source: https://github.com/Goodboycat/Lumen-Ledger · design doc: `docs/GDD.md` · itch page copy: `docs/ITCH_PAGE.md` · budget: `docs/BUDGET.md`.
Dev material (demos, tests, tools, screenshots, handoffs) lives in `../../LUMEN_extras/`.

## Play it
| Where | How |
|---|---|
| **Browser (this folder)** | serve the folder statically and open `index.html` — ES modules need `http://`, not `file://`: `python3 -m http.server 3000` → http://localhost:3000/ (or `npx serve .`, VS Code Live Server, any static host) |
| **itch.io** | upload `lumen-ledger-web.zip` built by the recipe in `docs/ITCH_PAGE.md §6` (index.html at the zip root, viewport 1280 × 720, "click to launch") |
| **Android** | Flutter WebView APK (Chat 14) loads this same folder from assets; `?import=LUMEN1:<base64>` restores a save exported from the web build |

Useful URL flags: `?autoplay` skip the title · `?endless` start in Endless · `?season=30` 30‑second seasons (QA) · `?debug` fps / draw calls / dpr overlay · `?nocine` no cinematics (title orbit / arrival walk-in / victory lighthouse) · `?cinelog` console trace of the cinematic bus events · `?mute` · `?nohistory` (disable the Android back‑button sentinel).

**Controls** — WASD/arrows move · Space/J/Enter hammer/confirm · E/F interact · **B** build menu · Q W E R F G abilities (**tap** W = Bubble Shield, **hold** W = walk; R rotates the ghost while placing) · jars panel: ↩ withdraws half a jar, **PAY BARON** repays debt from the pouch · Esc/P pause · Enter/click advances dialogue, 1–4 picks a choice. Touch: left virtual joystick, A / B / 🔨 buttons, ⏸ in the HUD. Full table in `docs/GDD.md §6`.

## What's in the box
```
game/
  index.html            THE game (title → 10 seasons → lighthouse → endless). Everything below is loaded from here.
  demo_*.html           20 standalone demos, one per content chat (stalls, nature, creatures, hero moves, VFX, UI, sandbox, world, audio…)
  src/
    core/               Game loop, Toon material + Outline, Camera, Input, EventBus, Audio (WebAudio + synth fallback)   [frozen foundation]
    anim/               Easing, Tween, Sequencer, SquashStretch · heroAnims (9 moves) · heroAbilities (6 FinLit abilities)
    assets/             geo.js primitives · hero.js (Pip) · props/ (12 stalls × 3 levels, nature, landmarks, decor, merge + bake) · creatures/ (12 Glimmers, 6 helpers, Baron + 3 Collectors)
    systems/            economy.js + economyData.js (pure JS, 4 jars, loans, events, scams) · build.js · customers.js + flowfield.js · story.js · save.js · perf.js
    vfx/                VFX.js base · pack1 (coins, confetti, rings, trails) · pack2 (Debt Fog ring, vignette, lighthouse beam, fogRecede) · storm.js · cinematics.js (S18: title orbit, arrival walk-in, victory lighthouse)
    world/Island.js     three-lobe island, zones, grid, isLand, pier edge
    Game.js             createSandbox (world + systems on one loop) · createLumenGame (state machine, UI + story wiring, save, tutorial, perf)
  ui/                   pure HTML/CSS/JS: hud, jars, build tray, ledger, dialogue, toast, title, pause/settings, touch pad, index.js (mountUI)
  data/story.json       207 lines of dialogue, 10 lesson cards, 6 scam scripts, 10 events, endings, tutorial toasts
  audio/manifest.json   33 SFX + 6 music ids with synth sketches (ships silent-proof; drop .ogg files in and set fetchFiles:true)
  vendor/three.module.js  Three.js r160 (MIT) — the only dependency
  tests/                economy.test.mjs (80 asserts) · economy.sim.mjs (3 strategies × 20 seeds) · story.test.mjs (58 asserts)
  tools/                check.mjs (headless suite) · smoke.mjs + setup_browser.sh (Playwright) · qa_mobile.mjs · next.sh / wip.sh / github.sh / pack.sh (pipeline)
  docs/                 START_HERE, GAME_BIBLE, API_CONTRACTS, MASTER_PLAN, GDD, balance, story_outline, PERF, QA_MOBILE, audio_prompts, ITCH_PAGE, BUDGET, SUBMISSION_CHECKLIST, prompts/, HANDOFF_<ID>.md
```
No build step, no npm, no bundler, no CDN: vanilla ES modules + one vendored library. All 3D is procedural (boxes, spheres, cones with a 3‑step toon ramp and an inverted‑hull outline); there are no model or texture files.

## Test
```bash
cd LUMEN/game
node tools/check.mjs                       # imports every src/**/*.js — ~1 s, no browser
node tools/check.mjs --props --creatures --hero --abilities --economy --build --customers --ui --story --vfx --world --sandbox --game --save --audio --enemies --storm --cinematics
                                           # full headless suite ~5 s: builds every prop/creature, runs the economy sim, walks the whole game S1→win→endless→lose
node tests/economy.sim.mjs --sweep         # balance: sensible wins S10 17/20 seeds, borrow-everything loses S3–S5
bash tools/setup_browser.sh && node tools/smoke.mjs index.html --shots --close   # optional browser smoke (errors, fps, draw calls, PNGs → tools/shots/)
node tools/qa_mobile.mjs                   # 360×800 touch · 800×360 touch · 1280×720 — overflow/overlap/tap-size audit
```

## Numbers that matter
Target device: a 2018 Android phone at 60 fps. In play the game draws **110–135 draw calls** (budget ≤ 150; see `docs/PERF.md`), with creature LOD, blob shadows in one InstancedMesh, baked static props and a pixel‑ratio governor. 10 seasons ≈ 25 minutes. Zipped web build ≈ 0.54 MB.

## Credits & licence
Design, code, art and writing: **[team name]**, built with the LUMEN chat pipeline (Genspark) — ~40 documented 100‑credit sessions, each owning a folder and gated by `tools/check.mjs` (`docs/MASTER_PLAN.md`). Engine: Three.js r160, MIT. Audio: in‑engine procedural synth; optional generated SFX/music per `docs/audio_prompts.md`. Reference look: XP Hero (Supercent) — colours and camera only, no assets.
Game code and content © 2026 the Lumen Ledger team; see the repository for the licence. Family‑friendly content rules: `docs/GAME_BIBLE.md §2`.
