# LUMEN LEDGER — GAME BIBLE (every chat reads this from the LUMEN folder after docs/START_HERE.md)

## 1. Pitch (jam theme: "Make FinLit Fun")
Lumen Ledger is a cozy, XP-Hero-styled 3D tycoon. You are **Pip**, a young *Channeler* who inherits
a bankrupt island **Glowmarket**. Cute blob customers called **Glimmers** wander in. You build stalls,
set prices, hire helper creatures, and route **Spark** (currency) between four jars:
**Spend / Save / Invest / Protect**. The villain is **Baron Gilt, Lord of the Debt Fog** — a purple fog
that creeps over the island whenever you overspend or borrow carelessly. Each in-game **Season** ends
with a one-tap **Ledger Review**. You win when the Debt Fog is pushed off the island and the
**Lighthouse** is relit (10 Seasons ≈ 25-min story run, then Endless mode).

FinLit lessons (one per Season): budgeting · needs vs wants · emergency fund · good interest (savings 5%/season)
vs bad interest (Baron loan 20%/season compounding) · scams ("Too-Good Deals") · compound growth ·
insurance (Protect jar) · diversification · delayed gratification · planning for a goal.

## 2. World & content rules (hard rules — the jam is 16+ family friendly, UAE partner)
- NO magic words: use *energy, Spark, channel, channeler, glow, lumen*. No magic circles, no runes.
- NO demonic/undead/dark-fantasy creatures: no skeletons, witches, dragons, demons, mummies, zombies,
  werewolves, ghosts. No demonic names.
- Enemies are not monsters: Baron Gilt's **Fog Collectors** are pompous, bumbling tax-collector blobs.
- Powers are Mario/Smash/Pokémon-style "abilities": Coin-Magnet Dash, Bubble Shield (Emergency Fund),
  Growth Stomp, Ledger Flash, Haggle Shout, Fog Sweep.
- Tone: cozy, snappy, toy-like, optimistic. Humor allowed. No gambling mechanics (no loot boxes).

## 3. Visual bible
- Toon shader: 3-step ramp (`toonMat`) + inverted-hull outline (`addOutline`). Flat colors only, no textures.
- Toy-like low-poly: everything is procedural Three.js geometry (boxes, rounded boxes, spheres, cones).
  No external model files. Pivot at base (y=0 is the ground). Budget: ≤ 10 draw calls per prop incl. outline (bake with props/merge.js), ≤ 900 tris per stall / ≤ 150 per small prop / ≤ 600 per creature.
- Palette (from `core/Toon.js` PALETTE): grass #7ED957 · hero orange #FFA726 · Glimmer blue #4FC3F7 ·
  Spark gold #FFD54F · Debt Fog purple #7B5EA7 · wood #A1704A · stone #9E9E9E · sky #BFE8FF.
- Camera: top-down ¾ perspective (fov 38, offset (0,13,10)), follows hero, trauma-based shake.
- Motion: squash-and-stretch on EVERYTHING (JellySpring), dust puffs on stop/land, additive trails,
  60 ms hit-stop on impacts, tiny camera shake. Anticipation slow → action instant → settle with overshoot.

## 4. Animation discipline (every chat)
All animations are keyframed procedural **Sequences** (`anim/Sequencer.js`) driven by delta time —
never a single tween, never frame-count based. Phases have explicit ms durations and easings.
Reference: the sword attack in `entities/HeroController.js` (anticipation 200 / wind-up 100 / strike 100 /
follow-through 200 / recovery 300). Every new move must specify its phase table in a comment.
Phase fns set the pose ABSOLUTELY from values snapshotted in `onEnter` so it is frame-rate independent.

## 5. Tech bible (hard rules)
- Vanilla ES modules. Three.js r160 vendored at `game/vendor/three.module.js`.
  Import with the correct relative path, e.g. `import * as THREE from '../../vendor/three.module.js'`.
- NO build step, NO bundler, NO npm at runtime, NO CDN. The folder opens from `index.html`
  (itch.io HTML5 upload, and Flutter WebView). Test by serving the folder statically.
- Pure HTML/CSS for UI (`game/ui/`), communicating via `core/EventBus.js` (`bus.emit / bus.on`).
- Game logic that has no rendering (economy, story data, save) must be **pure JS with no Three import**
  so it can be tested headless in Node.
- Performance budget: 60 fps on a 2018 Android phone → ≤ 100 draw calls, `InstancedMesh` for grass/
  flowers/Glimmer crowds/coins, shadow map ≤ 1024, pixelRatio ≤ 1.5 (already capped in `core/Game.js`).
  **Who owns the global budget (added 2026-10-19):** only **11A (perf)**. Content and integration IDs own *per-item*
  budgets (prop ≤ 10 m, creature ≤ 15 m incl. outline) and must *record* the global total, never chase it.
  Measured 10A reality: 22 creatures = 251 meshes, whole world 434 worst-case (`check.mjs --world`). 11A levers, in
  payoff order: one outline hull per creature · bake eyes/accessories into kit · LOD outlines off > 18 u · lantern/jar
  bodies baked. A `check.mjs` assertion on a global number that an ID cannot move is a bug in the assertion, not the ID.
- Portrait AND landscape must work (Game.resize already zooms out in portrait).
- Audio: do NOT generate audio. `core/Audio.js` (Chat 12) loads files from `game/audio/`.

## 6. Folder ownership (never touch a folder you don't own)
```
game/
  index.html            Chat 10 (integration)      game/src/systems/    Chats 4,5,6,8
  vendor/three.module.js  frozen                   game/src/vfx/        Chats 0, 9A, 9B
  src/core/             Chat 0 (frozen)            game/ui/             Chats 7A, 7B, 7C
  src/anim/             Chat 0 (frozen) + 3A/3B    game/data/           Chat 8A
  src/assets/           Chats 1A,1B,1C,2A,2B,2C    game/docs/           Chat 0B, 13
  src/entities/         Chats 0, 6A, 6B            game/audio/          user drops Ludo.ai files
  src/world/            Chat 0, 1C
```
Each chat writes ONLY its owned files into /home/user/webapp/LUMEN/game/ + a `demo_<name>.html` at `game/` root that
visually proves the deliverable using the Foundation kit.
