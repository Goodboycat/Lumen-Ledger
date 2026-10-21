# Chat 16A — Combat core: Enemy base class, EnemyAnimator, hitbox + loot
Needs: 2A CreatureAnimator (pattern) · 15B vitals (`takeHit`) · 15C cull · 9A coinBurst      Blocked-by: 15D
Owned (only these files): src/combat/Enemy.js, src/combat/EnemyAnimator.js, src/combat/Hitbox.js, src/combat/index.js (barrel), demo_enemy.html, check.mjs (additive), API_CONTRACTS "Enemy (16A)" (fill the RESERVED stub)
Read: START_HERE → VISION_V2 §1.2 + §7 → this → API_CONTRACTS "CreatureAnimator (2A)", "VITALS (15B)", "CULL (15C)" → HANDOFF_15B Notes.
Export (API_CONTRACTS "Enemy (16A)"):
  `createEnemy(def, ctx) → { root, def, hp, maxHp, state:'idle'|'alert'|'attack'|'hurt'|'stun'|'down', update(dt), hit(dir, power, src), stun(ms), despawn(), anim }`
  `def = { id, name, kit:()=>Group (toon, ≤ 12 dc), hp, speed, sightR, attackR, attackMs:{anticipate,strike,recover}, damage(halves), loot:{spark:[min,max], drop?}, tags:['small'|'armored'|'flying'|'aquatic'] }`
  `ctx = { hero:{pos, takeHit(dir,power,src)}, island, vfx, bus, rng }` · `Hitbox.sphere(center, r)` / `Hitbox.arc(origin, dir, r, deg)` overlap tests (no physics lib)
  bus: `enemy:spawn` · `enemy:hurt {id, hp}` · `enemy:down {id, loot}` · `enemy:attack {id}`

## Build in THIS order. wip.sh after EVERY file. Smallest end-to-end first: ONE placeholder enemy that chases, bites, takes a hit, pops.
### P1 — must ship (≈ 25 credits)
- Enemy.js FSM (delta-time Sequences, phase tables in comments): idle (wander 1.5 u radius) → alert (hero within sightR; "!" pop 180 ms) → approach (speed, `island.isLand`
  respected, separation from other enemies) → attack (anticipate 260 ms lean back → strike 120 ms lunge, `Hitbox.arc` vs hero → `hero.takeHit` → recover 400 ms) → hurt
  (knockback 1.6 u, `anim.hit`, 0 i-frames but 220 ms no-act) → stun (wobble) → down (squash 120 ms → **fog puff** `vfx.fogPuff` or pack2 `fogPuffPool` → coin burst `loot.spark`
  as 9A `coinBurst` + `bus enemy:down` → root removed after 600 ms).
- EnemyAnimator.js: extends/wraps CreatureAnimator pattern (JellySpring body, 2 legs or hover bob by tag `flying`), clips `idle walk alert attack hurt stun down`, purple-vein tint
  pulse on `alert` (fog mutation signature, Bible §2 comic not gory).
- Hitbox.js: pure math overlap (sphere–sphere, arc–sphere), zero alloc, exported for 16B.
- Placeholder def `TEST_BLOB` (fused Glimmer kit tinted purple, 1 horn) in demo + check.
- `check.mjs --combat`: spawn 1 enemy 4 u from a fake hero → within 3 s state hit `attack` and `hero.takeHit` called ≥ 1; `hit()` ×hp → `enemy:down` fired, loot in range, root detached; 20 enemies ≤ 240 meshes.
### P2 — should ship (≈ 15 credits)
- Tags: `armored` (first hit from the front bounces: `hit()` returns false, 'clang' bus `enemy:block` — Heat Stomp/Orb bypass in later phases), `flying` (hover y 1.2, ignores isLand),
  `aquatic` (only moves where `!isLand`, attacks from water edge). `stun(ms)` used by Electric Orb later.
- Spawner helper `createSpawner({defs, points, max, respawnMs:null})` — finite by default (VISION §1.7): a spawner with `respawnMs:null` never respawns; `serialize()` remembers cleared points.
### P3 — nice to have (≈ 10 credits)
- Cull integration: enemies register with `cull` kind 'creature' (onHide → FSM freezes, onShow → resumes); `despawn()` on region unload (15C `onUnload`).
- Enemy HP pips: 3 tiny toon cubes above the head (1 InstancedMesh for all enemies), visible 2 s after a hit.

## Demo `demo_enemy.html`: island + Pip (HeroController with takeHit stub) + 3 TEST_BLOBs; keys 1 spawn · 2 hit nearest · 3 stun · 4 toggle armored. Stats + state labels.
## check.mjs `16A COMBAT` (`--combat`). Budgets: enemy ≤ 12 dc incl. outline, FSM ≤ 0.05 ms/enemy/frame. 
## Content rules: enemies are mutated animals / fog blobs; they "pop into fog", never bleed; no skeletons, no undead.
## Handoff `docs/HANDOFF_16A.md`: Done / Missing / Measured / Suspected / Notes (give 16B the exact `hit(dir,power,src)` + Hitbox call).
