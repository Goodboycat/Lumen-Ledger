# Chat 17B — Hub region: Glowmarket wraps Island v2, 6 gate posts
Needs: 17A Regions (register shape, gates) · 1A/1B props (makeProp, bake) · 10B createSandbox      Blocked-by: 17A
Owned (only these files): src/world/regions/hub.js (new), src/assets/props/gate.js (new: `makeGatePost`, `makeGateArch`), src/assets/props.js (+1 catalog line `gate_post`), src/world/regions/index.js (+1 barrel line), check.mjs (additive, inside `--regions` as `17B HUB`)
Read (max 8 credits): START_HERE.md → VISION_V2.md §2 table row 1 + §7 → this → API_CONTRACTS "Regions (17A)", "Props (1A/1B/1C)" → HANDOFF_17A Notes
Export (API_CONTRACTS "Hub region (17B)", ≤ 6 lines):
  `installHubRegion(R, { island, scene, vfx }) → hub` · `hub.gates: {gateId → {post:Group, arch:Group|null, lamp:Mesh}}` · `hub.anchors = { enter:(0,0,1), pier:(0,0,10.5), campfire:(−2,0,−1), meadow:(6,0,4) }`
  `hub.update(dt)` — gate lamps breathe; a gate whose `R.canOpen()` just became true plays `openGate(gateId)` (Sequence 700 ms: lamp gold, arch rises outBack, dust ring) and emits `region:gate {state:'open'}` via R
  `makeGatePost(r) → Group` (≤ 6 dc: 2 posts, crossbar, lamp, 2 rope loops) · `makeGateArch(r) → Group` (≤ 4 dc) — toon, PALETTE only
  bus: none new (uses 17A's `region:gate`); listens `eco:upgrade` zone unlocks only to re-place posts if the island rim grew

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 25 credits)
- `props/gate.js`: `makeGatePost` (two wooden posts, a crossbar with a hanging sign plate, one Lumen lamp sphere `emissive`, rope loops — chunky toon like 1A stalls) + `makeGateArch`
  (a low stone arch that sits BEHIND the posts and is `visible=false` until the gate is open: open = arch visible + lamp gold). Register `gate_post` in `props.js` catalog (cost 0, `buildable:false`).
- `hub.js`: `installHubRegion` → `R.register('hub', { group: island.group, isLand: island.isLand, anchors, returnPath:null })`; for each gate with `from==='hub'` place a post at
  `gate.pos` on the island rim (use `island.landEdge(dx,dz)` to find the shore cell), facing the target region; lamp colour = locked purple `P.fog` / open gold `P.gold`.
  Posts go in a `hub.gatesGroup` added to `scene` (NOT island.group — they must stay visible when the hub unloads, as the "way home" beacons).
- `openGate(gateId)` Sequence (anticipate 150 inQuad lamp flicker · rise 400 outBack arch y −1.5→0 · settle 150 outCubic + `vfx.dust.ring`) — call once per gate when `R.canOpen` flips; idempotent.
- check.mjs `17B HUB` inside `--regions`: 6 posts built (≤ 6 dc each, countDrawCalls helper already in check.mjs) · all lamps purple with empty flags · set `powers.add('sparkTether')` → update 1 s → crags arch visible, lamp gold, exactly one `region:gate open` · posts are NOT children of `island.group`.
### P2 — should ship (≈ 15 credits)
- Sign plate text: each post gets a `vfx.pop`-style 3D label with `R.hintFor(gate)` (17A P3) or the region name; shown when the hero is within 3 u (`hub.update` checks `heroPos`), hidden otherwise (one quad, ≤ 1 dc, reuse pop pool).
- `hub.anchors.campfire` gets a placeholder campfire (3 logs + flame cone, ≤ 4 dc) — 26B replaces it; mark with `userData.placeholder = 'campfire'`.
### P3 — nice to have (≈ 10 credits, only if P1+P2 are written to disk)
- Locked-gate bump: hero walking into a locked post → `hero.hitStop(30)` + tiny knockback 0.3 u + lamp flicker + bus `region:gate locked` (17A's `tryEnter`). Vitals untouched.

## Demo page: none — 17E's `demo_world3.html` shows the hub with gates. (Optional: add a `?gates` query to `demo_world.html` only if it costs ≤ 2 credits.)

## check.mjs section: additive `17B HUB` block inside `--regions` (3–6 asserts above), ≤ 1 s.
## Budgets (per item, draw calls incl. outline): gate post ≤ 6 · arch ≤ 4 · campfire placeholder ≤ 4 · all 6 gates ≤ 60 dc total.
## Content rules that bite here: the sign never shows a price. Locked gates glow Debt-Fog purple, open gates Spark gold — the colour IS the lesson (VISION §1.5).
## Handoff `docs/HANDOFF_17B.md`: Done / Missing / Measured (dc per post, total) / Suspected / Notes for the integrator (tell 18A where the rootwood post stands and which anchor the vine-drop return path should land on).
