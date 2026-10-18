# HANDOFF 9A — VFX pack 1 (closed 2026-10-18 by the chain chat that also did 9B)

## Done
- `src/vfx/pack1.js` — `installPack1(vfx)` adds 5 InstancedMesh pools (coins 64 · confetti 120 · rings 6 · trail 96 · sparkle 48 = 334 instances, **5 draw calls total**, all `userData.noOutline`, zero per-frame allocation, hidden = zero-scale matrix, pools skip the matrix upload when nothing is alive).
- Contract fns on `vfx`: `coinFly(from, to, onArrive, {count, spread, dur, stagger})` · `coinBurst(pos, n)` · `confetti(pos, n)` · `levelRing(pos, {color, radius, dur})` · `sparkTrail(pos)` + `.emit/.stream(pos, dt, rate)/.burst` · `savingSparkle(pos, n)`.
  Every fn also carries method aliases (`.burst`, `.show`, `.emit`, `.fly`) because 3A/3B call `vfx.levelRing.show(...)`, `vfx.confetti.burst(...)` etc. via `hook()`; 6A calls `vfx.coinFly(from, to)` directly. Both styles tested.
- `installPack1` chains into `vfx.update` (hit-stop aware), is idempotent, registers `vfx.pools['pack1.*']`, returns `vfx.pack1 = { pools, list, alive, capacity, clear(), dispose() }`.
- `demo_vfx1.html` — keys 1–6 fire each effect at Pip / jar / stall, 0 = all, S = stress (fills all 334 instances and prints avg pack-update ms/frame over 60 frames → `window.stressResult`), T = slow-mo, tap = coins fly to the tap. `window.game`, `window.vfx`, `window.pack` set; stats show fps · calls · alive/capacity.
- `tools/check.mjs --vfx` — headless: installs on a mock VFX, both call styles, coinFly onArrive fires exactly once per coin (first @ 0.67 s = 0.55 flight + 0.12 squash), 3 s step with no NaN matrices, confetti never below y 0.02, all pools drain to 0 and hide, overflow ask (500 coins) is graceful, clear/dispose restore the scene.

## Fixed from the axed chat's partial file
- **Bug:** `InstancedPool.take()` did not increment `alive`, so `update()` early-returned forever → no effect ever moved or died (onArrive never fired). Fixed (`alive++` in `take()`).
- Pool capacity comment said 328; real is 334.

## Missing
- Nothing from P1–P3. No browser smoke run yet for this page (done once at the end of the 9B chat, see HANDOFF_9B).

## Measured
- Geometry: coin cyl 10 seg (40 tris) · confetti plane (2) · ring torus 6×28 (336) · trail sphere 6×4 (48) · sparkle ico (20). Worst case all alive ≈ 64·40 + 120·2 + 6·336 + 96·48 + 48·20 ≈ 10.4 k tris, 5 draw calls.
- Headless step of all pools at peak 112 alive: well under 0.2 ms in Node.

## Notes for the integrator (10B/10C)
- `installPack1(vfx)` right after `game.add(new VFX(game))`. Nothing else to wire: 3A celebrate → confetti, 3A build → levelRing, 3B abilities → coinBurst/savingSparkle/sparkTrail/levelRing all pick it up automatically.
- 6A `customers.js` already calls `vfx.coinFly(worldPos, game.followTarget)` on each sale; pass `onArrive` there if you want the HUD Spark count-up to start on landing.
- Pool sizes: `installPack1(vfx, { sizes: { coins: 96 } })`. Lower them on `quality: 'low'` if needed.
- `vfx.pack1.clear()` on season reset / title.
