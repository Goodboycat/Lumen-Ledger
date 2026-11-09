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

**Jars unlock (S53):** a new game lists only the Spend jar in the build tray; Save appears at the first till sweep, Protect at the storm warning, Invest after the Season-2 Ledger (`data/jars.json`, `src/systems/jarUnlocks.js`; each reveal = NEW tag + tab pulse). Tap a jar from afar and Pip walks over and puts 10 ✦ in (`sb.startAutoWalk`, 6 s timeout, any stick input cancels). Save field `jarsUnlocked` (additive, SAVE_VERSION stays 4); legacy saves count every placed jar as unlocked. Gate: `node tools/check.mjs --jars1`.

**Guide (S54):** the blue card answers curiosity — walk up to / linger at a thing, **tap** it (any distance) or **hold** it ≥ 350 ms (card only, no action); HUD items (pouch, debt, season, rep) answer a tap too; pause → **GUIDE** lists every card met (grey = not yet). Cards live in `data/tutor.json` (`target/radius/maxShows/doneOn`). Gate `node tools/check.mjs --curiosity`. T4: `--strangers`.

Useful URL flags: `?autoplay` skip the title · `?endless` start in Endless · `?season=30` 30‑second seasons (testing) · `?debug` fps / draw calls / dpr overlay · `?debug=1` (S52) the **debug panel** (S53: `unlock jar` is live) — ▣ tab top‑right: grant ✦, jump season/day, speed ×1–4, summon a stranger / Collector wave / event, hire crew, clear tutor cards, reset save, `state()`/`dump()` JSON (`window.LUMEN_DEBUG`; nothing is loaded without the flag) · `?nocine` no cinematics (title orbit / arrival walk-in / victory lighthouse) · `?cinelog` console trace of the cinematic bus events · `?mute` · `?nohistory` (disable the Android back‑button sentinel).

**Controls** — WASD/arrows move · Space/J/Enter hammer/confirm · E/F interact · **B** build menu · Q W E R F G abilities (**tap** W = Bubble Shield, **hold** W = walk; R rotates the ghost while placing) · jars panel: ↩ withdraws half a jar, **PAY BARON** repays debt from the pouch · **T** (or the ⏩ button in the Season pill) cycles time speed 1× → 2× → 3× (resets to 1× on pause, dialogue, season end) · Esc/P pause · Enter/click advances dialogue, 1–4 picks a choice. Touch: left virtual joystick, Attack + Dash buttons, ability chips, ⏸ in the HUD — **tap empty ground = build** (the tray opens with the ghost on that cell) · **walk up to things = use them** (jars un-collapse the panel; the Baron / a pitching Collector talk when you stand still 0.6 s; tap a jar to deposit). Full table in `docs/GDD.md §6`.

## S75 player fixes (2026-11-09) - version shown in the title menu: `S75 · jam build`
Ground taps never open the Build tray (Build button / tapping your own stall only) · Focus regen 2/s -> 2/3 per s · no owl card after a fair deal (scam + spotted cards stay) · no lock glyph on unaffordable stalls ("need N more") · the Ledger closes on a tap anywhere (after the count-up) · a tap deposits into the jar under the finger (screen-space pick, `lg.pickJar`), not the jar nearest Pip. Rig `tools/shot_s75.mjs W H`, handoff `docs/HANDOFF_S75.md`.

## Tap grace + hand on the jars (S64, 2026-11-07) — version shown in the title menu: `S64 · jam build`
**S64-A** on phones the joystick zone forwards a quick tap as a ground tap, so the player's extra tap after the last dialogue line opened the Build tray by itself: `lg.tapGrace()` now swallows world taps for 0.7 s after any modal closes (dialogue / title / ledger / season / pause / cine), and a ground tap never opens the tray while the verb chain is on steps 0-2 (Move / Coin / Sword); the Build button and the step-3 card still open it. **S64-B** the Cloud hand now points at the Build button, the Jars tab, the first-coin card, the jar in the world and the withdraw arrow (`.ll-jar.has-bal .ll-jar-wd`, rig `tools/play_s64b.mjs`: dx 0, shown true); `data/tutor.json` jar:withdraw has a touch wording; unbuilt jar rows are hidden; the jars panel un-collapses when the withdraw card shows. **S64-C** SFX list for Ludo.ai in `docs/SFX_LUDO_S64.md` (38 ids, not wired yet; synth fallbacks stay until the files land). Browser rigs: Chrome from `kaleido_get_chrome` + a `--headless=new` shim works when the Playwright CDN is blocked (see HANDOFF S64).

## Cloud tutor 3 (S61, 2026-11-07) — version shown in the title menu: `S61 · jam build`
Small-screen + robustness pass on the S60 Move step. **S61-A** on very small phones (<= 360 px tall: 640x360, 568x320, 480x270, 360x240) the joystick demo shrinks to 72 px and pins to the left margin, so it never touches the tutor card (checked by `tools/play_s61.mjs W H`, boxes + screenshots `tools/shots/s61_*`); on <= 300 px screens the Cloud avatar becomes a small badge on the card corner instead of sitting on the BUILD label. **S61-B** `locate('ahead')` now reads *screen-up from the camera* (`src/systems/aheadPoint.js`, pure + unit-tested; falls back to -z); verified with the camera rotated 0/40/90/180/270 deg. **S61-E (partial)** every left offset of the demo and the card width respect `env(safe-area-inset-left/right)` (notch); a real-device check is still a human step.

## Cloud tutor 2 (S60, 2026-11-07) — version shown in the title menu: `S60 · jam build`
Three beginner fixes on top of S59. **S60-A** the first Cloud hand no longer points at Pip's legs: on a phone the Move card draws a **simulated joystick** (base ring + gold knob, same look as the real stick) and the cloud hand presses it and drags it up-right and back, so the player *sees* there is a stick and where to put the thumb (it steps aside the moment the real stick is touched; the plain "drag to move" label yields while it plays); on desktop it shows four **WASD keycaps** (W pulses) and the hand points ~6 u ahead (`locate('ahead')`: land + free cell). New drawn icon `joystick` (procedural -> side-by-side screenshot -> sliced PNG). **S60-B** the hand no longer points at an *invisible Stranger*: moving things (stranger, Collectors, Baron, Pip) are located **live every frame** (`deps.locate`); the x,z snapshot a card carried is only a fallback for static things (jars, stalls); `locate('stranger')` returns null unless they stand in the world (arrive/pitch), so the hand hides and the card closes after 1.2 s. **S60-C** the Owl's opening is two short bubbles (opening = 4 lines: Owl, Owl, Pip, Cloud). Tests: `tests/tutor.test.mjs` 11/11 (+2), `tests/story.test.mjs` 63. Rigs: `tools/play_s60.mjs [desk]`, `play_s60c.mjs`, `probe_s60b.mjs`. Handoff `docs/HANDOFF_S59.md` (top section = S60 IDs).

## Cloud tutor (S59, 2026-11-07)
The blue tutor cards are now **persistent** (moving / tapping never closes them; they retire on their `doneOn` event) and a drawn **Cloud hand** points at the real thing (tabs, tray cards, Deploy, jars, world targets; flips below when near the screen edge). The Cloud says hello after the Pip/Owl opening; tutorial cards wait while a dialogue or cinematic runs; the Build tray and Jars panel close while a dialogue is open. Jar reminder (`src/systems/jarRemind.js`): 20 s after a jar unlocks, and again at the next season, the Cloud says to add the other jars. Storm warning shows the drawn `stormmark` chip. Tutorial text uses drawn icons (`iconizeText`), cinematic SKIP uses the drawn `skip` icon. Debug text (fps / draw calls) shows only with `?debug`. Gate: `node tools/check.mjs`. Rigs: `tools/play_s59c.mjs`, `play_s59d.mjs`, `play_s59e.mjs`. Handoff `docs/HANDOFF_S59.md`.

## Strangers (T4, S57)
A **friendly stranger** (own species `makeStranger`: round, smiling, sun hat, satchel — not Collector-shaped) walks in from the pier, strolls the plaza for 25–40 s and waits for Pip. Some carry a Too-Good Deal (a scam), some a genuinely **fair** deal (`FAIRS` in `economyData.js`, `eco.offerFair`); from outside they look and sound the same. Schedule = `strangers: [{at, kind}]` in `data/seasons.json` (S1 one fair, S2 one scam, then 1–2 per season, ≥ 1 in 3 fair; every scam id is met before any repeats). A **sword never resolves them**: a swing whiffs, they hop back and the Owl says "Not an enemy. Talk to them.". Timeout = they leave, no penalty, no reward. Finding them: a golden **bell** bobs over their head (`ui/stranger.js`), or an **edge arrow with metres** when they are off-screen (safe zones keep it clear of the HUD row and the Build / ability buttons). Debug: `?debug=1` → *spawn stranger* / *fair stranger*. Gate: `node tools/check.mjs --strangers` (T4.1–T4.5). Real-browser rig: `node tools/play_t4.mjs [phone|desk]` (phone = 844×390 landscape). New drawn icons `bell`, `stranger`, `chat`, `face_stranger[_mood]`; `node tools/icons_shot.mjs <names…>` = side-by-side screenshot → sliced PNGs.

## Sword combo + lock-on (S43)
**16B P1** — `src/combat/Combat.js` is the new hero ↔ enemy resolver. Pressing attack three times chains **slash1** (forehand, 120/90/260 ms) →
**slash2** (backhand, 100/90/240) → **slash3** (360° spin, 180/140/420, power 2, double knockback, bigger hit‑stop). A press during the swing is
**buffered** and fires when recovery starts; a press in the first 350 ms of recovery **cancels** into the next step; letting recovery run out resets
the combo. Soft **lock‑on**: the nearest enemy within 5 u and ±70° of the stick (or Pip's facing) becomes the target — Pip strafes while walking and
every strike auto‑aims at it. Hits: `t.hit(dir, power)` once per step, in‑world sparks + 'POW!' + slash ribbon, **no ScreenFlash**; Glimmers only
wobble (`cust:bonked`), never take damage. Bus: `combat:hit / miss / combo / lock`. `installCombat(sb, game)` in `Game.js`; `HeroController.doAttack`
routes to it. Gate: `node tools/check.mjs --combat`.

## Readability pass 2 + sword fix (S42)
From the second phone playtest: **16A** a Collector hugging Pip (< 0.9 u) is hit by the sword regardless of angle (the cone is measured from Pip's
pre‑lunge position, no NaN lunge on a zero‑distance target) · **16B** the HUD **Debt‑Fog bar is gone** — the purple fog on the island itself is the
meter (tutorial step became a centred card about the island fog; `ui/reveal.js` no longer stages a `fog` widget) and the season lesson tag + ⓘ are
removed from the Season pill · **16B** a cartoon hand with a **"Touch here!"** bubble appears under the ⏩ button after 7 s of nothing happening
(1×, no Collectors chasing, no Glimmers on the island, no deal open, not building — `lg.isBored`), at most 3 times per game with a 45 s cooldown;
tapping the bubble cycles the speed (`ui/nudge.js`). Gate: `node tools/check.mjs --ui` (nudge section).

## Playtest readability pass (S41)
From the Oct-31 phone playtest (new player, 25 min): **15‑0** the fps·calls pill is gone from the HUD (only `?debug` / F3) · **15A** progressive HUD —
jars start collapsed on a new game and the widgets reveal in stages (jars → fog → rep → speed → powers) silently (48A: no toasts), so tutorial skippers still
meet them (`ui/reveal.js`) · **15B** one text channel (48A: top toasts deleted entirely — the island, the ledger and the Owl's dialogue are the only text) · phones show one line at a
time, dialogue is tap‑to‑complete then tap‑to‑continue · **15C** build cards that you cannot afford say so before the tap (🔒 + "need N more" on the
cost pill, greyed card) · **15D** Collector waves get a red ribbon banner and edge arrows that point at off‑screen enemies (`ui/wave.js`) · **15E**
stalls, decor and scenery are solid for Pip (wall‑slide, no walking through props) · **15F** debt clarity — the season interest shows in the ledger (48A: its toast is gone)
("Debt grew +40 ✦ (20 % interest) → 240 ✦") with a tappable **Pay** action, and a new story game explains the inherited debt once.

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
    Game.js             createSandbox (world + systems on one loop) · createLumenGame (state machine, UI + story wiring, save, verb-chain tutorial, perf)
  ui/                   pure HTML/CSS/JS: hud, jars, build tray, ledger, dialogue, title, pause/settings, touch pad, index.js (mountUI)
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
node tools/check.mjs --props --creatures --hero --abilities --economy --build --customers --ui --story --vfx --world --sandbox --game --save --audio --enemies --storm --cinematics --knockback --debug --jars1
                                           # full headless suite ~5 s: builds every prop/creature, runs the economy sim, walks the whole game S1→win→endless→lose
node tests/economy.sim.mjs --sweep         # balance: sensible wins S10 17/20 seeds, borrow-everything loses S3–S5
bash tools/setup_browser.sh && node tools/smoke.mjs index.html --shots --close   # optional browser smoke (errors, fps, draw calls, PNGs → tools/shots/)
```

## Numbers that matter
Target device: a 2018 Android phone at 60 fps. In play the game draws **110–135 draw calls** (budget ≤ 150; see `docs/PERF.md`), with creature LOD, blob shadows in one InstancedMesh and baked static props (S40: the pixel‑ratio governor / low‑fps quality demotion was removed — Quality is locked to the Settings preset). 10 seasons ≈ 25 minutes. Zipped web build ≈ 9.6 MB (12 MB unzipped, 305 files — ~6 MB of it is OGG music; measured S39).

## Credits & licence
Design, code, art and writing: **[team name]**, built with the LUMEN chat pipeline (Genspark) — ~40 documented 100‑credit sessions, each owning a folder and gated by `tools/check.mjs` (`docs/MASTER_PLAN.md`). Engine: Three.js r160, MIT. Audio: in‑engine procedural synth; optional generated SFX/music per `docs/audio_prompts.md`. Reference look: XP Hero (Supercent) — colours and camera only, no assets.
Game code and content © 2026 the Lumen Ledger team; see the repository for the licence. Family‑friendly content rules: `LUMEN_extras/game/docs/GAME_BIBLE.md §2`.
