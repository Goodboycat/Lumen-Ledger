# API CONTRACTS — Foundation kit (Chat 0, DONE) and what every later chat must consume / export

Paste the relevant sections into each chat. Foundation files are **frozen**: consume, never edit.
If you need a change in a frozen file, write it in `docs/CHANGE_REQUESTS.md` and work around it.

---------------------------------------------------------------------------------------------------
## A. FOUNDATION (exists, tested — `game/src/core`, `game/src/anim`, `game/src/assets/{geo,hero,glimmer}.js`, `game/src/vfx/VFX.js`, `game/src/world/Island.js`, `game/src/entities/HeroController.js`)

### core/Game.js
```js
import { Game, QUALITY, autoQuality } from './core/Game.js';
const game = new Game(containerEl, { quality?: 'low'|'medium'|'high' });
game.scene, game.renderer, game.camera (GameCamera), game.input (Input)
game.tweens (TweenManager), game.sequences (SequencePlayer), game.hitStop, game.bus (EventBus)
game.add(system)      // system = { init?(game), update?(dt, game, dtReal), lateUpdate?(dt), resize?(w,h) } → returns system
game.remove(system)
game.hitstop(ms)      // freezes sequences+tweens+game.timeScale for ms real-time
game.timeScale = 1    // slow-mo
game.paused = false
game.followTarget = someVector3   // camera follows
game.time, game.realTime, game.stats { fps, drawCalls, triangles }
game.start(); game.stop();
```
### core/Camera.js — `GameCamera`
```js
cam.three            // THREE.PerspectiveCamera
cam.zoom = 1         // 0.6 close … 1.8 far
cam.offset           // Vector3(0,13,10)
cam.shake(amount01)  // adds trauma; shake = trauma²
cam.snapTo(vec3)
cam.update(followPos, dt)   // called by Game
```
### core/Input.js — `Input`
Actions: `move`(up/down/left/right → WASD/arrows/joystick), `attack`(Space/J), `interact`(E/K), `build`(B), `menu`(Escape).
```js
input.move           // THREE.Vector2 normalized (x right, y forward)
input.actions[name]  // held
input.pressed(name)  // just pressed this frame
input.press(name)    // inject (used by touch buttons)
input.pointerWorld   // THREE.Vector3 on ground plane y=0 (valid when input.hasPointerWorld)
input.isTouch
input.onTap = (worldPos, ev) => {}
input.onJoystick = (active, originX, originY, dx, dy) => {}
input.onWheel = (dir) => {}
input.onAction = (name) => {}
```
### core/Toon.js
```js
PALETTE  // { grass, grassDark, dirt, sand, heroOrange, heroSkin, heroHair, heroPants, glimmerBlue, glimmerPink,
         //   glimmerGreen, glimmerYellow, sparkGold, sparkGoldDark, debtFog, debtFogDark, wood, woodDark,
         //   stone, stoneDark, leaf, leafDark, trunk, white, black, red, metal, metalDark, sky, water }
toonMat(colorHex, opts?)   // MeshToonMaterial with shared 3-step ramp (cached per color)
flatMat(colorHex, opts?)   // MeshBasicMaterial (emissive-looking: coins, trails, UI-in-world)
setupToonLights(scene, { shadows, shadowSize, area })
setShadows(obj, cast, receive)
```
### core/Outline.js
```js
addOutline(root)      // adds inverted-hull outline meshes to every Mesh under root (skips userData.noOutline)
removeOutline(root)
setOutlineThickness(v) // 0.02 thin … 0.06 thick
```
### core/EventBus.js
```js
import { bus } from './core/EventBus.js';
bus.on(evt, fn) → off fn;  bus.once(evt, fn);  bus.off(evt, fn);  bus.emit(evt, payload)
```
### anim/Easing.js
`Easing.{linear,inQuad,outQuad,inOutQuad,inCubic,outCubic,inOutCubic,inQuart,outQuart,inOutQuart,inExpo,outExpo,outBack,inBack,inOutBack,outElastic,outBounce,strike}`
helpers: `lerp, clamp, clamp01, remap, damp(current,target,k,dt), smoothstep`
### anim/Tween.js
```js
new Tween(target, { prop: end }, ms, ease).setDelay(ms).onUpdate=fn .onComplete=fn .yoyo .repeat
game.tweens.add(tween) / .kill(tween) / .killTarget(obj)
```
### anim/Sequencer.js  (THE animation standard)
```js
const seq = new Sequence('name')
  .phase('anticipation', 200, Easing.outCubic, (e, ctx, t, phase) => { /* set pose absolutely */ },
         { onEnter: (ctx, phase) => { phase.state.start = ... }, onExit, cancellable: false })
  .phase(...)
  .setLoop(false).then(onComplete);
game.sequences.play(seq, ctx);   // or seq.play(ctx); seq.update(dt)
seq.stop(); seq.playing; seq.currentName; seq.progress; seq.canCancel; seq.timeScale; seq.totalMs
```
### anim/SquashStretch.js
```js
setSquash(obj, amount, axis='y')            // volume-preserving scale
setStretchAlong(wrapper, dirVec3, along, across)
new JellySpring(stiffness=260, damping=12)  → .kick(v) .update(dt) .value
breathe(time, speed, amp) → scale offset ;  walkBob(phase, hop) → { y, tilt }
relaxScale(obj, k, dt)
```
### assets/geo.js
```js
G.box(w,h,d) G.rbox(w,h,d,r) G.sphere(r,seg) G.cyl(rt,rb,h,seg) G.cone(r,h,seg) G.capsule(r,len) G.torus(r,t) G.plane(w,h) G.dodeca(r) G.ico(r,det)   // cached geometries
mesh(geometry, colorHex, x, y, z, opts?)   // toon mesh, shadows on
block(w,h,d,color,x,y,z)                   // box with base pivot
group(...children) ; rng(seed) → fn ; pick(arr, r) ; vary(hex, amt, r)
```
### assets/hero.js / assets/glimmer.js
```js
makeHero({ colors? }) → Group; root.userData.parts = { body, hips, legL, legR, torso, chest, head, armL, armR, weaponSlot }
makeSword() → Group (pivot at grip)
makeGlimmer({ color, size }) → Group; parts = { body, eyeL, eyeR, ... }
new GlimmerController(root) → .update(dt) .hit(dirVec3, power) .hopping .root
```
### vfx/VFX.js
```js
const vfx = game.add(new VFX(game));
vfx.dust.burst(pos, count, { size, speed, dur, dir, up })
vfx.slash.fire(pos, dirVec3, { dur: 0.12, scale, color })
vfx.sparks.burst(pos, count, speed)
vfx.pop.show(pos, text, { color, dur, size })      // world-space floating text
vfx.flash.flash(cssColor, ms, maxAlpha)            // full-screen flash
```
### world/Island.js
```js
const island = new Island({ radius: 11, seed: 7, tile: 1 });
island.group (add to scene) ; island.isLand(x, z) ; island.tiles (Map "x,z" → height) ; island.update(dt)
makeTree(r), makeRock(r)
```
### entities/HeroController.js
```js
const hero = new HeroController(game, { vfx, targets: () => controllers[], isLand: (x,z)=>bool });
hero.root, hero.p (parts), hero.state 'idle'|'walk'|'attack', hero.speed, hero.facing, hero.doAttack(), hero.update(dt)
```

---------------------------------------------------------------------------------------------------
## B. CONTRACTS FOR LATER CHATS (export exactly these)

### Props (Chats 1A/1B/1C) — `src/assets/props/*.js`, index `src/assets/props.js`
```js
export const PROP_CATALOG = { stall_fruit: { make: makeStallFruit, footprint: [2,2], category: 'stall', tris: 240 }, ... }
export function makeProp(id, opts = {}) → THREE.Group   // pivot at base, already toon+outlined, userData.footprint
export function registerProps(map); propsByCategory(cat); countTris(root); measureCatalog()
// Stall groups (DONE, 1A) expose: group.userData.slots = { counter: Vector3, queue: [Vector3 x4], sign: Object3D } (LOCAL coords)
// group.userData.setLevel(1|2|3, { animate?, game?, sequences?, vfx? }) → Sequence|null ; group.userData.update(dt) ; .level .stallType .name
// Stalls face +Z; customers queue along +Z. Budget per stall: ≤ 900 tris, ≤ 10 draw calls (mesh+outline).
// 1B/1C: register your maps with registerProps(NATURE_PROPS) etc. from props.js (or import in props.js — 1A owns that line).
// USE `src/assets/props/merge.js` → mergeGroup(group, { keep }) to bake a multi-mesh prop into 1–2 meshes (3–5 draw calls incl. outline).
```
### Creatures (Chats 2A/2B/2C) — `src/assets/creatures/*.js`
```js
export function makeGlimmerVariant(type, opts) → Group   // type ∈ GLIMMER_TYPES
export const GLIMMER_TYPES = ['saver','spender','impulse','haggler','vip','kid','elder','tourist','critic','collector','newbie','regular']
export class CreatureAnimator { constructor(root); play('idle'|'walk'|'happy'|'sad'|'pay'|'browse'|'wait'|'angry'); update(dt); moodTint(t) }
export function makeHelper(type) ; HELPER_TYPES = ['tallyOwl','packMole','sparkBee','guardTortoise','scoutFox','gardenerSnail']
export function makeBaronGilt(); makeFogCollector(variant)
```
### Hero anims (Chats 3A/3B) — `src/anim/heroAnims.js`
```js
export const HERO_MOVES = { build, hammer, pickUp, carry, throwCoin, dash, celebrate, sad, stunned, coinMagnetDash, bubbleShield, growthStomp, ledgerFlash, haggleShout, fogSweep }
export function makeMove(name, ctx) → Sequence   // ctx = { hero: HeroController, vfx, game, target? }
// Each move exports a phase table comment. HeroController.state gains 'move'.
```
### Economy (Chat 4A/4B) — `src/systems/economy.js` PURE JS
```js
export class Economy {
  constructor(config = BALANCE); state: { spark, jars:{spend,save,invest,protect}, debt, fog01, season, day01, reputation }
  tick(dtSeconds); sell(stallId, glimmerType, price) → { paid, mood }; allocate(jarDeltas); takeLoan(amount); repay(amount)
  endSeason() → LedgerReport { income, expenses, interestEarned, interestPaid, fogDelta, lessonId, stars 0..3 }
  canAfford(cost); spend(cost, reason); applyEvent(eventId); offerScam() → offer; acceptOffer(offer)
  isWin(); isLose(); serialize(); static deserialize(json)
}
export const BALANCE = {...}; export const EVENTS = {...}; export const UPGRADES = {...}
// emits on bus: 'eco:spark', 'eco:jar', 'eco:fog', 'eco:season', 'eco:event', 'eco:scam', 'eco:win', 'eco:lose'
```
### Build (Chat 5) — `src/systems/build.js`
```js
new BuildSystem(game, { island, economy, catalog: PROP_CATALOG }) → .enter(propId) .exit() .rotate() .confirm() .demolish(at) .update(dt)
.placed: Map<"x,z", { id, group, level }> ; .occupied(x,z) ; .stalls() → [{ id, group, slots, level }]
// emits 'build:placed', 'build:removed', 'build:upgraded', 'build:denied'
```
### Customers (Chats 6A/6B) — `src/systems/customers.js`
```js
new CustomerSystem(game, { island, build, economy, creatures, vfx }) → .spawnWave(season) .update(dt) .count
// Glimmer FSM: spawn → wander → pickStall → queue → browse → pay (coin flies to hero) → happy/sad → leave
// emits 'cust:paid', 'cust:left', 'cust:angry'
```
### UI (Chats 7A/7B/7C) — `ui/*.css`, `ui/*.js` (DOM only)
```js
// listens to eco:* / build:* / cust:* / story:* ; emits 'ui:build', 'ui:jar', 'ui:pause', 'ui:continue', 'ui:choice'
export function mountHUD(root); mountBuildMenu(root); mountJars(root); mountLedger(root); mountDialogue(root); mountTouch(root); mountTitle(root)
```
### Story (Chat 8A/8B) — `data/story.json` + `src/systems/story.js` PURE JS
```js
new StorySystem(economy) → .onSeasonStart(n) .onSeasonEnd(report) .next() .choose(i) ; emits 'story:line', 'story:lesson', 'story:end'
```
### VFX pack (Chats 9A/9B) — `src/vfx/*.js` added to VFX class via `vfx.register(name, pool)`
coinBurst, coinFly(from,to,onArrive), confetti, sparkTrail, fogShader(fog01), savingSparkle, debtPulse, levelRing, coinRain, screenFlash (exists)
### Audio (Chat 12) — `src/core/Audio.js`
`Audio.load(manifest)`, `Audio.play(id,{vol,pitch})`, `Audio.music(id)`, listens to bus events and maps them to SFX.
### Save (Chat 10) — `src/systems/save.js` localStorage, versioned.

### Telemetry (40A) — `src/systems/telemetry.js` PURE JS (storage injected, network OFF by default)
- `createTelemetry({ bus, storage?, now?:()=>ms, endpoint?, enabled?, isModal?, version?, touch?, w?, h? }) → T` · `T.session = { id, startedAt, steps:{play, firstStall, firstSale, firstCoinInHand, s2, s3}, quit:{state, season, day01, reason, t}|null, seasonsPlayed, sparkHandled, sparkTotal, modalSeconds, touch, w, h }` (times in s from PLAY)
- `T.mark(step, data?)` idempotent per session · `T.end(reason, {state,season,day01}?)` once · `T.flush()` → ring buffer `storage['lumen.telemetry']` (max 50) + `sendBeacon(endpoint)` if set · `T.export()` → JSON string · `T.summary()` → `{reachedS2, reachedS3, tFirstStall, tFirstSale, tFirstCoin, modalSeconds, handledRatio, quit}` · `T.clear()` · `T.destroy()` → 0 listeners
- bus in: `ui:start` → play (new session after a quit) · `build:placed {id:'stall_*'}` (not `entry.scenery` / `starter`) → firstStall · `eco:sale` → firstSale · `eco:spark {delta>0}` → sparkTotal; reason `tip:*` | `till:*` → sparkHandled + firstCoinInHand · `eco:season {season}` → s2/s3 · `eco:tick` → modalSeconds (first 90 s, via `isModal`) · `ui:title` / `eco:lose` / `eco:win` → quit
- bus out: `telemetry:mark {step, t}` · Game.js `installTelemetry(lg)` → `lg.telemetry`, `opts.telemetryEndpoint`, `opts.telemetry:false` to skip, pagehide/visibility hidden → `end('pagehide')` · index.html `?telemetry=<url>`, `window.lumenTelemetry.{export,summary,clear}`
- **42A contract:** every coin that reaches the pouch through Pip's hands must be `eco.earn(v, 'till:<how>')` or `'tip:<how>'` — that is the PLAN §5 "Spark through Pip's hands" metric.

### Funnel (40B) — `tools/funnel.mjs` PURE NODE (reads 40A export)
- `node tools/funnel.mjs <sessions.json|-> [--md]` → n sessions · % reaching play→firstStall→firstSale→firstCoinInHand→s2→s3 + median t · quit histogram (season × day01 decile × reason) · mean sparkHandled/sparkTotal · mean modalSeconds (0–90 s); `resumed:true` sessions excluded, missing steps "n/a".
- `--synthetic N [--season S=150] [--out f] [--quiet]` → N headless average-player sessions on a game-time clock (`createLumenGame(..., { telemetryNow: () => ms })`) · `--compare a.json b.json [--md]` → Δ columns. Exports `analyze(sessions)`, `render(R,{md})`, `renderCompare`, `synthetic(N,opts)`.
- Baseline file: `docs/FUNNEL_BASELINE.md` + `tools/shots/funnel_synthetic_2026-11-02.json` (41A–41D / 45 compare against it). `check.mjs --telemetry` smokes `--synthetic 3 --season 20` + `tests/fixtures/funnel.json`.

### Regions (17A) — `src/world/regions/Regions.js` PURE JS (0 meshes) · data `data/regions.json`
- `createRegions({ scene, island, bus, flags:()=>Object, data }) → R` · `R.list: Region[]` · `R.current` (id|null) · `R.at(x,z) → id|null` · `R.isLand(x,z)` (hub island ∪ registered region grounds)
- `R.register(id, { group, isLand(x,z), anchors:{enter, pier, campfire}, returnPath:{from, to, unlocked} })` — biome IDs call this; hub = 17B. Unregistered = sealed (`tryEnter` → 'noregion', `isLand` false).
- `R.gates: Gate[]` ({id:'from>to', from, to, need, pos:{x,z}, open}) · `R.canOpen(gate) = hasFlag(flags(), need)` · `R.tryEnter(gateId) → 'open'|'locked'|'noregion'` · `R.hintFor(gate) → string`
- `R.update(dt, heroPos)` — 1-frame debounce, swaps `group.visible`, sets `userData.animators[].paused`, fires events · `R.useReturn(id, heroPos)` / `R.unlockReturn(id)` · `R.nearestPier(x,z)` · `R.destroy()`
- bus: `region:enter {id, from}` · `region:gate {id, state:'locked'|'open', need}` · `region:load {id}` · `region:unload {id}` · `region:return {id, to}`
- `hasFlag(flags, need)` pure: need = `{power?, mission?, keys?, rep?}` — every present key must hold (flags = `{powers:Set, missions:Set, keys, rep}`; powers: sparkTether electricOrb bubbleWalk lumenLantern heatStomp)

## Season length (41C)
- `BALANCE.seasonCurve = [70, 90, 110, 130, 150]` (S ≥ 5 → 150); `economy.seasonSecondsFor(season)` pure; `config.seasonSeconds` kept as fallback, `opts.seasonSeconds` → `config.seasonSecondsOverride` wins (tests).
- `eco:season` payload gains `seasonSeconds` (next season's length); `game:start` carries the first. `hud.setSeasonSeconds(sec)` scales the day bar + S1-only "70 s" chip.
- Scheduler marks stay day01 fractions in ONE table `SCHEDULER_MARKS` (Game.js): waves 0/0.34/0.67, warn 0.30, event 0.45, scam 0.70, Collectors 0.70 — **S1 Collector at 0.55** (one, hp 1, drops 2 ✦).

## Unlocks (41D)
- `src/systems/unlocks.js`: `ABILITY_START = ['coinMagnetDash','bubbleShield']` · `ABILITY_UNLOCKS = [{id:'growthStomp',stars:3},{id:'ledgerFlash',stars:6},{id:'haggleShout',stars:9},{id:'fogSweep',stars:12}]` (cumulative ★, max one unlock per season) · `installUnlocks(sb, bus, {all})`.
- `sb.abilities: Set<string>` · `sb.ability(name)` → `'locked'` + bus `ability:locked {name,stars,have}` when not unlocked (no cooldown, no vfx) · bus `ability:unlock {id,stars,key,title,lesson}` · `eco.state.starsTotal` mirrors `sb.unlocks.starsTotal` · `eco:win` → all six.
- Game.js emits `ui:abilities {abilities,starsTotal}` on `game:state` / `ability:unlock` (HUD chips + touch strip sync). Save v2: `{abilities:[], starsTotal}`; v1 → starters + 0.
- Story: `barks.abilityUnlock[id]` fired on the `ui:continue` after an unlock. Ledger shows one "NEW ABILITY" card per unlock.


## Tills (42A)
- `src/systems/till.js`: `createTills({ bus, eco, build, vfx, coinLayer, stats }) → T` · `T.get(stallId) → { stallId, amount, pos:{x,z}, counterY, cap }` · `T.pay(stallId, amount, meta)` (customers call this; `economy.sell(..., {toTill:true})` still computes price/demand/mood and counts `ledger.sales/units` but does NOT touch the pouch; `eco:sale` carries `toTill:true`).
- `T.collect(stallId, how:'walk'|'magnet'|'helper'|'sweep') → amount` → `eco.earn(amount, 'till:'+how)` (40A counts it as "through Pip's hands") · `T.spill(stallId, n)` → n ground tips via `sb.dropTip` · `T.sweep(tax=SWEEP_TAX)` at season end (ledger row "Left on counters") · `T.tickHelpers(dt, helpers)` every `HELPER_EVERY` 12 s · `T.remove(stallId)`.
- `TILL_CAP = 40` ✦ at level 1 (`tillCap(level)` = +20/level); above cap new sales spill `SPILL_PCT` 50 % of the overflow to the ground · bus `till:change {stallId, amount, cap}` · `till:collect {stallId, amount, how}` · `till:full {stallId}`.
- Visual: ≤ `COINS_PER_STACK` 8 instances per till in the shared `sb.coins` InstancedMesh (ground coins first, stacks after); 9th+ coin grows the stack scale. HUD chip "on counters N" (hidden at 0, `.hot` ≥ 60 % cap). `sb.stats.tillCollected`.

## Jars world (42B)
- `src/systems/jarsWorld.js`: `createJarsWorld({ bus, eco, jars:W.jars, hero, vfx, sequences?, labels?, camera?, onSpill? }) → J` · `J.near() → 'spend'|'save'|'invest'|'protect'|null` (≤ `NEAR_R` 1.3 u) · `J.deposit(jar, amount?)` → `eco.allocate({[jar]:+a})` + `jarFill` Sequence + `coinFly` (returns the amount moved) · `J.withdraw(jar, amount?)` (Invest refuses mid-season → `jars:locked`; Save/Spend/Protect free).
- `J.press()` / `J.release()` = the E key / ✋ button: tap deposits `DEPOSIT_STEP` 10 ✦ (or the whole pouch if < 10); holding ≥ `HOLD_S` 0.6 s withdraws and repeats every `REPEAT_S` 0.25 s; walking off the jar releases. `J.spillPouch(frac=0.10)` → `min(10 %, SPILL_CAP 8)` ✦ to the ground via `onSpill(amount)` (42C calls it on Collector contact; jars are never touched). `J.register(id, mesh)` adds a 5th jar (43 Festival — eco must know the id). `J.update(dt)`, `J.destroy()`.
- Bus: `jars:deposit {jar, amount, spark, jars}` · `jars:withdraw {…}` · `jars:near {jar|null}` (on change) · `jars:locked {jar}` · `jars:empty {jar}` · `jars:spill {amount, spark}`.
- `Game.js`: `installJarsWorld(sb)` after `wireEconomy` (eco:jar → setFill stays the fill truth) sets `sb.jarsWorld = J` and **`sb.interact()`** — the one interact dispatcher, order jar > till > Baron (42D) > scam NPC (42D) > `null` (key handler / ✋ fall through only on null); `sb.interactRelease()` on keyup.
- `ui/jars.js` defaults to **summary mode** (read-only bars + split %, presets are hint chips, no APPLY, no pause); `?sliders=1` / `mountJars(..., {summary:false})` keeps the legacy slider + `ui:jar:apply` path. DOM jar tags `.ll-jar-tag.<id>` (≤ 4) in the labels root, visible ≤ `LABEL_R` 4 u.

## Raids (42C)
- Collector FSM (`src/systems/enemies.js`, `ENEMY_RULES.raid`): `seek` (richest non-shielded till ≤ `range` 14 u, re-evaluated every `retarget` 2 s, sidesteps a blocking stall) → `raid` (counter, `telegraph` 1.2 s: fogPuff + sign shake) → `T.steal` takes `min(till, takeBase 6 + season)` → `carry` (coin stack over the head, speed × `carryMul` 0.8, walks to the pier) → off-island = `raid:escaped` + ledger `raided`. No till with money → old `chase`.
- Sword hit while `carry` → `_dropCarry`: everything to ≤ `dropCoins` 4 ground tips (`sb.dropTip`) + stun `dropStun` 0.6 s; hit while `raid` → `_cancelRaid` + `T.refund`. `bubbleShield` armed with Pip ≤ `shieldRadius` 2 u of a till → that till is immune (`isShielded` dep) → raider cancels + re-targets. Contact with Pip → `J.spillPouch(pouchSpill 0.1)` (never a direct pouch subtraction).
- `till.js`: `T.steal(stallId, n) → taken` (emits `raid:take`, `till:change {how:'raid'}`) · `T.refund(stallId, n)` (`how:'refund'`).
- Bus: `raid:start {enemyId, stallId, name, telegraph}` · `raid:take {stallId, amount}` · `raid:cancel {enemyId, stallId, why}` · `raid:drop {amount, x, z}` · `raid:escaped {amount}` · `raid:threat {enemyId, stallId, name, state, amount, screen:{x,y,behind}}` (5 Hz while raid/carry — HUD chip + screen-edge arrow) · `raid:end {enemyId, why}` · `enemy:talk {id, enemyId, stallId}` (P2: `E.talkable(r=3)` / `E.talk(r)` — a `seek` Collector ≤ 3 u; `sb.interact()` order is jar > talk > 42D till/Baron).
- Ledger: `eco.ledger.raided` / `recovered`; `ui/ledger.js` rows "Raided −N" / "Recovered +N" (hidden at 0, `LEDGER_ROWS` = 8). `sb.stats`: raids, raided, raidDrops, recovered, escaped, raidsCancelled, spilled.
- Gate: `node tools/check.mjs --raid` ("42C RAIDS", `tools/gates/raid.mjs`, 8 sections). 43: per-season raid counts/takes belong in the season script, not `ENEMY_RULES`.

## Pier + scam NPCs (42D)
- `economy.js`: `pierPays` option (`makeEconomy({pierPays:true})`, on in the real game, off headless unless opted in) → season end parks `state.interestOwed` (`interestDue()` pure) and emits `eco:interest`; `settleInterest({fromPouch})` charges it. `src/systems/baronPier.js createBaronPier` — `begin()` on `eco:season` → `pier:due {interest, debt, pos, season, waitCap}` → arrive 2.5 s → wait (`pier:tick {left,cap}` ≤ 1 Hz, `PIER.waitCap` 20 s → auto-settle `timeout`) → `B.interact()` near 2.6 u = `'paid'` / `'short'` then repay taps (`DEPOSIT_STEP` 20, `pier:repaid {amount,debt,total}`), `release()`/walk-away → `pier:done {why}`; nothing owed + debt 0 → `pier:skip`.
- `Game.js`: `installPier` + `sb.holdClock('pier', on)` (eco clock + scheduler frozen while he waits, `eco:clock {held, by}`), `GAME_STATES` has `'pier'` (S1 end → pier → review; save during pier resumes there). `sb.interact()` order: jar > till > Baron > scam NPC > enemy talk. Barks from `data/story.json pier {paid, short, repaid} × {t1,t2,t3}` (FALLBACK in baronPier.js); `createSandbox(opts.storyData)`.
- `src/systems/scamNpc.js createScamNpc` (`sb.scamNpc`, `opts.scamNpcs` default `!headless`): the odd-season day-0.70 scam mark spawns a pitching Collector (`scam:npc`) instead of `eco.offerScam()`; **no offer until Pip talks** (`S.interact()` → `eco.offerScam(id)` → 8B dialogue). Sword hit → `refuseOffer` once + flee (`scam:refused {why:'hit'}`), `ledgerFlash` ≤ 3 u → `scam:tell {id, tell}`, `SCAM.timeout` 25 s → `why:'timeout'`, season end clears. `S.targets()` feeds the hero's sword targets.
- HUD (`ui/hud.js`): `.ll-pier-chip` — "⚓ BARON AT THE PIER — N ✦ due · 20 s" countdown, green after paid/short with the repay hint, hidden on `pier:done`.
- Gate: `node tools/check.mjs --pier` ("42D PIER + SCAM NPC", `tools/gates/pier.mjs`, 6 sections incl. value-equality with the auto path and the full-game pier → review flow).

## Season scripts (43A)
- `data/seasons.json` = `{ version:1, seasons:{ "1":{ len, trickle:[], warn, event, forceEvent?, scam, scamKind:'npc'|'baron'|null, wave, novelty:{id,at}|null }, …"10", "endless":{ rotate:["6","7","8","9","10"] } } }`. Marks are `day01`.
- `src/systems/seasonScript.js createSeasonScript(data|null) → SS` · `SS.for(season)` (S > 10 rotates endless rows; `null` data → legacy rows = old `SCHEDULER_MARKS`) · `SS.marks(season) → sorted [{kind, at, payload}]` (kinds trickle|warn|event|scam|wave|novelty) · `SS.len(season)` · `SS.validate() → [errors]` (in (0,1), trickle ascending, no mark kind within 0.02 of the previous season's same mark — PLAN §6 is an error).
- `Game.js createSandbox(opts.seasons)` → `sb.seasons`; `eco.config.seasonCurve` = `row.len` per season unless `opts.seasonSeconds`/`balance.seasonCurve` override. `index.html` fetches `./data/seasons.json` and passes it via `createLumenGame`.
- `installScheduler` iterates `SS.marks(season)` (one `fired` Set per season, old guards kept); `forceEvent` → `sb.nextEvent`; `scamKind 'baron'` → no NPC/offer (43C). Bus: `season:mark {season, kind, at, payload}` · `season:novelty {season, id, at}` (43B+ listen). `sb.log` gets `S3 mark trickle@0.25` headless/debugKeys.
- Gate: `node tools/check.mjs --seasons` ("43A SEASON SCRIPTS", `tools/gates/seasons.mjs`) · `tests/seasons.test.mjs` (node --test).

## Novelties (43B)
- Interface `{ id, start(sb, season), update(sb, dt), end(sb), dispose() }` · `src/systems/novelties/index.js` `NOVELTIES[id] = factory` · `createNoveltyRegistry(sb) → { start(id, season), end(), update(dt), dispose() }` · `sb.novelties` = registry, `sb.novelty` = active instance or null (one at a time; `start` ends the previous).
- `Game.js installNovelties`: bus `season:novelty {id, season}` → `start` · `eco:season` → `end` · `destroySandbox` → `dispose`. `sb.update` calls `sb.novelties.update(dt)` inside the `clockHold` branch (pauses with `holdClock`). Bus out: `novelty:start {id, season}` · `novelty:end {id}`.
- `stormWarning` (S2 @0.22): key/hemi ×0.75 over 2 s (skipped while `storm.intensity > 0.05` — storm.js owns lights), `storm.warn()` once (scheduler `warn` mark skips if `storm.phase === 'warn'`), Owl bark `barks.seasonNovelty.stormWarning[0]`, `jarsWorld.highlight('protect', true)`; on `eco:event {id:'storm'}` → bark [1] if `effect.absorbed > 0` else [2] with `{cost}`. `end()` restores lights unless `storm.phase === 'storm'`.
- `nightMarket` (S3 @0.60): key → 0.35 / hemi → min(hemi, 0.35) over 3 s · `sb.cust.spendMult = 1.3` (customers.js `_settle` scales price AND fair → mood unchanged) · `sb.till.setSpillMult(2)` (till.js `T.spillMult`, spill capped at the overflow) · `hud:chip {id:'night', text, on}` (listener not yet in index.html — 43C/43D) · stall sign materials emissive gold (≤ 4, restored). `end()` restores all.
- Gate: `node tools/check.mjs --novelties` ("43B NOVELTIES STORM/NIGHT", `tools/gates/novelties.mjs`): spies `storm.warn` and `eco.sell`, checks restore ±1e-6, 0 leaks.

## Novelties (43C)
- `baronVisit` (S4 @0.64, `scamKind:'baron'`): `createBaronVisit() → { id, start, update, end, dispose, near(), interact() → 'scam'|null, flash() → tell|null, targets() → [{root, enemy:{kind:'baron', scam:true}, hit(dir, power)}], state, g }` · `BARON = { walkSec 2.5, timeout 25, tauntEvery 4.2, near 3, flashNear 3, scam:'zeroInterestLoan', spot }` · model via `sb.creatures.makeBaronGilt/VillainAnimator` (42D), `{}` headless.
- Bus out: `story:bark {speaker:'baron'}` · `scam:tell {id, tell, baron:true}` · `scam:refused {id, why, baron:true}` (hit | timeout | end) · reuses `eco:scam` / `eco:scamResult`. `Game.js sb.interact()` → `sb.novelty.near()` → `interact()`; ledgerFlash → `sb.novelty.flash?.()`; sword → `sb.novelty.targets?.()`.
- `pickyGlimmer` (S5 @0.20): `PICKY = { second: 0.30, count: 2 }` · `cust.spawnType('critic')` ×2 · `novelty:critic {n, day}` · Owl bark once on first `customer:priceCheck`.
- `customers.js`: `spawnType(type) → customer|null` (queues `pendingSpawns` when pooled) · critic `_settle` → `customer:priceCheck {id, stallId, price, fair, ok, double}` + `story:bark {kind:'price', ok, text}`; refuses `> fair×1.1`, qty 2 (two `eco.sell`) at `≤ fair`.
- `ui/hud.js`: `hud:chip {id, text, on}` → `.ll-chips > .ll-chip[data-id]` (on:false removes). `ui/bark.js` `kind:'price'` → `.ll-bark.price.ok|.bad`.
- Gate: `check.mjs --novelties` "43C BARON VISIT + PICKY" (`tools/gates/novelties.mjs`): scripted interact/flash/hit on the Baron, `sb.cust.prices` fair×1.3 vs fair for the critics, 0 leaks.

## Novelties (43D)
- `raidDouble` (S6 @0.64, wave @0.66): `createRaidDouble()` only ARMS `sb.enemies.nextWaveOpts = { raiders: 2, distinct: true, stagger: 2 }`; `enemies.spawnWave(season, opts)` spawns N Collectors (no Baron) whose `raidTargets` exclude already-claimed tills (`_claimed[]`), raider #k is `stun = k*stagger` s so the 1.2 s telegraphs never overlap. Owl barks: start / both stalls named on 2nd `raid:start` / one down on `raid:end`. Bus: `novelty:raidDouble {season, armed}` · `enemy:wave {raiders}`.
- Rotation: `seasons.json` S7–S10 reuse nightMarket/baronVisit/pickyGlimmer/stormWarning; `endless.rotate = ["6".."10"]`; `SS.for(s ≥ 11)` → `rotate[(s-6) % 5]`, `len 150`; consecutive-mark gap rule holds across 10→11 (S6 row re-tuned: trickle .36/.58, warn .24, novelty .62).
- `story.js onNovelty(p)` on `novelty:start {id,label}` → once per id per run: `state.noveltiesSeen.push(id)` + `hud:new {id,text}` (`barks.seasonNew[0].text` = "NEW: {label}"); `hud.newChip(text, ms=4000)` → `.ll-chips > .ll-chip.ll-chip-new`, DOM only, non-modal.
- Save v3: `{ …v2, v:3, novelty: id|null, noveltiesSeen[] }`; `validate` migrates v1/v2 → `novelty:null, noveltiesSeen:[]`; `applySnapshot` mid-season with `novelty` set → `novelties.start(id, season)` again (re-entrant; raidDouble does not re-arm when `E.waveSeason === season`).
- Gate: `check.mjs --novelties` "43D RAID DOUBLE + ROTATION" (`tools/gates/novelties43D.mjs`): 2 Collectors in `raid` with different `targetStallId`, bonk → drop/recovered, `SS.for(7).novelty.id === SS.for(12).novelty.id`, lens 150 for 11..15, NEW chip once across S3+S7, save/load mid-S3 re-starts and keeps `noveltiesSeen`.
