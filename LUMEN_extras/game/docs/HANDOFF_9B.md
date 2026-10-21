# HANDOFF 9B — VFX pack 2: Debt Fog (closed 2026-10-18 by the chain chat; the axed 9A/9B chat had written pack2.js but no demo/check/row)

## Done (P1 + P2 + P3 — all tiers)
- `src/vfx/pack2.js` — `installPack2(vfx, { island | radius, core, fogCount ≤ 60, seed, lighthouse, rainCount })`, idempotent, chains into `vfx.update` (fog/beam/rain scaled dt, DOM pulse real dt), registers `vfx.pools['pack2.*']`, returns `vfx.pack2 = { fog, beam, pulse, vignette, rain, alive, clear(), dispose() }`.
  - **P1 `vfx.fog` (DebtFog)** — ONE `InstancedMesh` of 48 translucent toon blobs (opacity 0.72, `noOutline`, 1 draw call) on a ring at `edge = island.radius + 1.5`. `setCoverage(fog01, {immediate, ms})` animates **outCubic 600 ms**; each blob's inward reach = `fog01·(edge−core)·depth_i` (depth 0.7–1.3, seeded, no Math.random at runtime), scale grows 0.9 → 2.2 as the ring closes, bob 1.1 Hz ±0.12, angle drift ±0.03 rad @ 0.4 Hz. Hidden (zero-scale + `visible=false`) at coverage ≤ 0.002. `push(origin, dir, strength)` (3B **fogSweep** hook, also aliased as `vfx.fogShader.push`) shoves blobs within 5.5 u / ±60° outward 1.6·strength u: 150 ms inQuad out → 750 ms outElastic back, with squash.
  - **P2 `vfx.debtPulse(strength)` / `.pulse(pos, strength)`** — red radial DOM vignette, 80 ms inQuad in → 520 ms outCubic out, stacking keeps the max. `vfx.vignette.set(a, {color})` — persistent purple vignette, driven automatically from fog coverage (`max(0, fog−0.15)·0.8`); DOM-less in Node.
  - **P2 `vfx.coinRain(pos, n, {radius, height})` / `.burst`** — reuses **pack1's CoinPool** when installed (coins fall from `height` 4 u, bounce once at y 0.03, shrink out), else its own 48-instance `CoinRainPool` (1 dc).
  - **P3 `vfx.lighthouseBeam`** — one additive `MeshBasicMaterial` cone (1 dc, `noOutline`), `.show(lampPos | lighthouseGroup)` (uses `userData.lampPos`), fade 400 ms, sweeps 0.6 rad/s, `.hide()`, `.sweep(ms)` auto-off.
  - **P3 `vfx.fogRecede({ lighthouse, onDone })` → Sequence 1900 ms** — anticipation 300 inOutCubic (fog inhales +0.08, blobs rise) → recede 1200 outCubic (coverage → 0, blobs sink & flatten) → relight 400 outBack (beam on + confetti ×40 + coinRain ×10 at the lamp). Also exported as `makeFogRecedeSequence(vfx, opts)`.
- `demo_vfx2.html` — slider + keys 0–9/F set coverage, P pulse, R coinRain, L beam, V vignette toggle, Space = Fog Sweep push from Pip, W-button = WIN recede (Shift+W key), T slow-mo, tap = coinRain there. Island v2 all 3 zones + real 1C lighthouse. `window.game/vfx/pack/hero/lighthouse` set; stats show fps · calls · tris · fog %.
- `tools/check.mjs --vfx` **VFX PACK 2 (9B)** section (additive): coverage curve (0.53 @ 300 ms → 0.60), reach 6.0, all blob radii ⊂ [core, edge], vignette 0.36, push shoves & settles, pulse peak/decay/stacking, coinRain via pack1 (16 coins, bounce, drain), beam fade/speed/hide/sweep, fogRecede 1900 ms end state, standalone install (own rain pool, overflow 500 → 38, count clamp 60), clear/dispose restore scene + `vfx.update`.

## Fixed along the way
- `demo_vfx1.html` (9A) and the new demo were missing `game.start()` → frozen first frame, fps 0. Added to both.

## Missing
- Nothing from the prompt. Not done: a fog **shader** (the contract name `fogShader` is honoured as an alias of the blob ring — 3B only calls `.push`).

## Measured (browser smoke, demo_vfx2.html, 1280×720 swiftshader)
- ERRORS: none. Draw calls 132 at fog 70 % (Island v2 ×3 zones + lighthouse + Pip ≈ 131, **fog ring = 1 dc**), 140 with beam on (+ outline-less cone + coins), 116 zoomed in. tris 72 k (fog 48 × sphere(0.7, 9, 6) ≈ 48 × 96 = 4.6 k).
- Headless: pack2 update at 48 blobs + 16 coins ≪ 0.1 ms/frame in Node.
- Screenshot: `../screenshots/9B_vfx_fog/`.

## Suspected / notes
- Fog ring is centred on the world origin with `edge = island.radius + 1.5 = 12.5`. With Island v2's side lobes unlocked, the ring passes *over* parts of the side lobes rather than hugging their outer coast. Integrator: pass `radius` ≈ 15–16 (or per-zone rings later) once zones unlock; `core: 2.5` keeps Pip's cottage area clear until fog01 ≈ 1.

## Notes for the integrator (10B/10C)
- `installPack1(vfx); installPack2(vfx, { island, lighthouse })` right after `game.add(new VFX(game))`. Then: `bus.on('eco:fog', ({fog01}) => vfx.fog.setCoverage(fog01))`, `bus.on('eco:event'/'eco:loan', () => vfx.debtPulse(0.5))`, `bus.on('eco:win', () => vfx.fogRecede({ lighthouse, onDone: () => lighthouse.userData.setState('lit') }))`.
- 3B abilities already call `vfx.fogShader.push` (fogSweep), `vfx.debtPulse.pulse` (bubbleShield / ledgerFlash) and `vfx.coinRain.burst` (growthStomp) through `hook()` — nothing to wire.
- `vfx.pack2.clear()` on restart/title. On `quality: 'low'` pass `fogCount: 32`.
