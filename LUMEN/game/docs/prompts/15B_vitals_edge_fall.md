# Chat 15B — Vitals: hearts, damage, i-frames, edge fall + Marlow's Fall Ledger
Needs: 15A (win path lines) · 0 HeroController · 1C Island.isLand/landEdge · 7A HUD · 9A/9B VFX      Blocked-by: 15A
Owned (only these files): src/systems/vitals.js (new), src/entities/HeroController.js (movement block ~l.185–200 + new `takeHit`), ui/hud.js + ui/hud.css
  (hearts row only), src/Game.js (new `installVitals(lg)` section), data/story.json (`fallLines` array only, additive), demo_vitals.html, check.mjs (additive)
Read: START_HERE → VISION_V2 §7 → this → API_CONTRACTS "HeroController" + "HUD" → HANDOFF_15A Notes.
Export (API_CONTRACTS "VITALS (15B)"):
  `createVitals({bus, hero, island, vfx, maxHearts:3}) → { hp, max, damage(n, src), heal(n), addMaxHeart(), invulnerable, update(dt), serialize/load }`
  bus: `hero:hurt {hp, src}` · `hero:heal` · `hero:fall {count}` · `hero:down {cause}` · `hero:respawn {at}` · `vitals:maxUp`
  story.json: `fallLines: [12 strings]` (Marlow), `downLines.fall: [3]`

## Build in THIS order. wip.sh after EVERY file.
### P1 — must ship (≈ 25 credits)
- vitals.js (pure-ish; Three only for positions): hearts 3 (half-heart granularity, `hp` in halves) · `damage()` → i-frames 900 ms (hero toon mat blink 8 Hz
  via `hero.setFlashTint` if it exists else mesh `visible` toggle) · knockback 2.2 u opposite to `src` over 220 ms outCubic · `hero:hurt` · hp 0 → `hero:down`.
- **Edge fall**: HeroController's movement clamp currently *blocks* at `!isLand` → change to: step allowed; if `!island.isLand(x,z)` for > 120 ms the hero is
  **falling**: Sequence `edgeFall` = tip 150 ms (lean to velocity) → drop 420 ms (y −3, inQuad, dust→splash `vfx.splash` or `coinBurst` blue fallback) →
  fade 200 ms (`body.ll-fade` DOM black) → teleport to `island.landEdge` nearest pier spawn (`sb.W.pierSpawn`) → fade-in 250 ms → `damage(1,'fall')`
  → `hero:fall {count}` → the HUD toast shows `fallLines[count % 12]` as **Marlow** (speaker exists? else add portrait class `marlow` = tortoise green blob).
- hud.js: hearts row (♥ full/half/empty CSS shapes, pop 180 ms outBack on change, shake on hurt) listening `hero:hurt/heal/vitals:maxUp`.
- Game.js `installVitals(lg)`: creates vitals in `createSandbox`, passes `takeHit` to HeroController deps, pauses vitals in modals.
- `check.mjs --vitals`: damage → hp, i-frames block a 2nd hit, knockback moved root, walk off the edge headless 2 s → `hero:fall` fired + root back on land + hp −2 halves; 12 fallLines exist & unique.
### P2 — should ship (≈ 15 credits)
- `hero:down {cause:'fall'}` **comedy scene** (Sequence 2.6 s, DOM + 3D): black → Marlow's net silhouette (CSS) rises with Pip → `downLines.fall[rand]` →
  Juniper's crayon drawing of the fall (CSS blob doodle) → respawn at the last **campfire/hub cottage** with full hearts, Spark −5 % (`eco.spend` with reason 'fall').
  Non-fall `hero:down` (combat, 16B) → same scene with `downLines.hit`.
- hearts persist: `serialize/load` wired into save.js snapshot (`vitals` key) — additive to 10D's `snapshot`.
### P3 — nice to have (≈ 10 credits)
- Heart Piece item API: `addMaxHeart()` after 4 pieces (`vitals.pieces`); `vitals:maxUp` → HUD row grows with a confetti burst. Biome IDs place the pieces.
- Low-hp heartbeat: HUD hearts pulse + `audio` `heartbeat` id (manifest additive, synth fallback) when hp ≤ 2 halves.

## Demo `demo_vitals.html`: island + Pip; keys 1 hurt · 2 heal · 3 walk off the edge (autopilot) · 4 down scene · 5 heart piece. `window.game` + stats.
## check.mjs section `15B VITALS` (`--vitals`). Budgets: 0 new persistent meshes (net/doodle are DOM). 
## Content rules: falling is funny, never gory; Marlow never insults Pip (dry tortoise humour; "I am *thinking* about charging").
## Handoff `docs/HANDOFF_15B.md`: Done / Missing / Measured / Suspected / Notes (tell 16A how `takeHit(dir,power,src)` is called).
