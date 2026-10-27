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

Useful URL flags: `?autoplay` skip the title · `?endless` start in Endless · `?season=30` 30‑second seasons (testing) · `?debug` fps / draw calls / dpr overlay · `?nocine` no cinematics (title orbit / arrival walk-in / victory lighthouse) · `?cinelog` console trace of the cinematic bus events · `?mute` · `?nohistory` (disable the Android back‑button sentinel).

**Controls** — WASD/arrows move · Space/J/Enter hammer/confirm · E/F interact · **B** build menu · Q W E R F G abilities (**tap** W = Bubble Shield, **hold** W = walk; R rotates the ghost while placing) · jars panel: ↩ withdraws half a jar, **PAY BARON** repays debt from the pouch · **T** (or the ⏩ button in the Season pill) cycles time speed 1× → 2× → 3× (resets to 1× on pause, dialogue, season end) · Esc/P pause · Enter/click advances dialogue, 1–4 picks a choice. Touch: left virtual joystick, A / B / 🔨 buttons, ⏸ in the HUD. Full table in `docs/GDD.md §6`.

## Knockback (S32)
Swinging the sword at anything now **shoves it**: Glimmers slide ≈ 0.9 u away, stop steering for 0.35 s, turn to look at Pip, then re-path and
walk back to their browse / queue slot (sales never break). **Hired helpers** are targets too — they slide off their stool, flash red, grumble
"ouch" and walk back to their seat to resume work. Enemies keep their own knockback rules; Baron Gilt never slides.
Headless gate: `node tools/check.mjs --knockback`.

## Stalls & upgrades (S29–S31)
Only **one stall of each type** can stand on the island — deploy it once, then ⬆ Upgrade it (L1 → L2 → L3). The build tray shows the level
badge on every stall card and marks a placed stall **✓ Deployed · Lx**; trying to deploy a second one is refused (ghost turns red, card shakes).
Each type has its own L2 / L3 look (oven for the Bakery, anvil + forge for the Tool Smith, lamp post for the Lantern Shop, …), all ≤ 900 tris.

## Enemies (S16–S20)
From day 0.7 of each season (right after the Baron's Too-Good Deal), **Debt Collectors** (wave = season, max 5) land at spread shore points and chase Pip: a touch takes 1 ✦ from the pouch (never from jars, never below 0); two sword hits make one flee and drop 1 ✦. Bubble Shield (W) blocks. At season end they walk back to the shore and leave.
From **Season 6, Baron Gilt** comes himself: a **very slow chaser** (1.1 u/s — you can always walk away) who stops every 2–4 s to attack, always with a **0.8 s red ring warning** first: **Debt-Fog Cannon** (S6, 1 ✦ if you stay in the ring, leaves a slowing puddle — longer from S7) · **Big Stomp** (S8, he leaps to where you *were* — 2 ✦ and a shove inside the big ring, then he is dazed 2.5 s: hit him) · **Fog Minigun** (S9, 2 s of pellets whose aim lags behind you) · **Umbrella Dash** (S10, sidestep the line — he ends paralysed 4 s). A Baron hit at 0 ✦ is billed as debt. Six hits defeat him for 3 ✦ and end the wave. Headless gate: `node tools/check.mjs --enemies`.

## What's in the box
```
game/
  index.html            THE game (title → 10 seasons → lighthouse → endless). Everything below is loaded from here.
  demo_*.html           20 standalone demos, one per content chat (stalls, nature, creatures, hero moves, VFX, UI, sandbox, world, audio…)
  src/
    core/               Game loop, Toon material + Outline, Camera, Input, EventBus, Audio (WebAudio + synth fallback)   [frozen foundation]
    anim/               Easing, Tween, Sequencer, SquashStretch · heroAnims (9 moves) · heroAbilities (6 FinLit abilities)
    assets/             geo.js primitives · hero.js (Pip) · props/ (12 stalls × 3 levels, nature, landmarks, decor, merge + bake) · creatures/ (12 Glimmers, 6 helpers, Baron + 3 Collectors)
    systems/            economy.js + economyData.js (pure JS, 4 jars, loans, events, scams) · build.js · customers.js + flowfield.js · story.js · save.js · perf.js · enemies.js (S16–S20: Debt Collectors + Baron Gilt boss)
    vfx/                VFX.js base · pack1 (coins, confetti, rings, trails) · pack2 (Debt Fog ring, vignette, lighthouse beam, fogRecede) · storm.js · cinematics.js (S18: title orbit, arrival walk-in, victory lighthouse)
    world/Island.js     three-lobe island, zones, grid, isLand, pier edge
    Game.js             createSandbox (world + systems on one loop) · createLumenGame (state machine, UI + story wiring, save, tutorial, perf)
  ui/                   pure HTML/CSS/JS: hud, jars, build tray, ledger, dialogue, toast, title, pause/settings, touch pad, index.js (mountUI)
  data/story.json       207 lines of dialogue, 10 lesson cards, 6 scam scripts, 10 events, endings, tutorial toasts
  audio/manifest.json   33 SFX + 6 music ids with synth sketches (ships silent-proof; drop .ogg files in and set fetchFiles:true)
  vendor/three.module.js  Three.js r160 (MIT) — the only dependency
  tests/                economy.test.mjs (80 asserts) · economy.sim.mjs (3 strategies × 20 seeds) · story.test.mjs (58 asserts)
  tools/                check.mjs (headless suite) · smoke.mjs + setup_browser.sh (Playwright) · next.sh / wip.sh / github.sh / pack.sh (pipeline)
  docs/                 GDD, BUDGET, ITCH_PAGE, SUBMISSION_CHECKLIST (dev notes: ../../LUMEN_extras/game/docs/)
```
No build step, no npm, no bundler, no CDN: vanilla ES modules + one vendored library. All 3D is procedural (boxes, spheres, cones with a 3‑step toon ramp and an inverted‑hull outline); there are no model or texture files.

## Test
```bash
cd LUMEN/game
node tools/check.mjs                       # imports every src/**/*.js — ~1 s, no browser
node tools/check.mjs --props --creatures --hero --abilities --economy --build --customers --ui --story --vfx --world --sandbox --game --save --audio --enemies --storm --cinematics --knockback
                                           # full headless suite ~5 s: builds every prop/creature, runs the economy sim, walks the whole game S1→win→endless→lose
node tests/economy.sim.mjs --sweep         # balance: sensible wins S10 17/20 seeds, borrow-everything loses S3–S5
bash tools/setup_browser.sh && node tools/smoke.mjs index.html --shots --close   # optional browser smoke (errors, fps, draw calls, PNGs → tools/shots/)
```

## Numbers that matter
Target device: a 2018 Android phone at 60 fps. In play the game draws **110–135 draw calls** (budget ≤ 150; see `docs/PERF.md`), with creature LOD, blob shadows in one InstancedMesh, baked static props and a pixel‑ratio governor. 10 seasons ≈ 25 minutes. Zipped web build ≈ 0.54 MB.

## Credits & licence
Design, code, art and writing: **[team name]**, built with the LUMEN chat pipeline (Genspark) — ~40 documented 100‑credit sessions, each owning a folder and gated by `tools/check.mjs` (`docs/MASTER_PLAN.md`). Engine: Three.js r160, MIT. Audio: in‑engine procedural synth; optional generated SFX/music per `docs/audio_prompts.md`. Reference look: XP Hero (Supercent) — colours and camera only, no assets.
Game code and content © 2026 the Lumen Ledger team; see the repository for the licence. Family‑friendly content rules: `LUMEN_extras/game/docs/GAME_BIBLE.md §2`.
