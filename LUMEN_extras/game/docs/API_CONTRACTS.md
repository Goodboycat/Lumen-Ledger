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
