# HANDOFF 3B — Hero abilities set 2, the six FinLit powers (`src/anim/heroAbilities.js`, `demo_abilities.html`)

## Done (6/6 abilities, P1 + P2 + P3)
- **P1** coinMagnetDash (charge 140 outCubic → dash 260 over 4 u clipped to `isLand`, 8 orbiting coins spiral in (1 InstancedMesh), `ctx.coins` within `ctx.radius‖2.2` → `onCollect(coin, pos)` + sparks → gather 160 outBack "+N" pop → settle 180) ·
  bubbleShield (brace 160 → inflate 220 outBack translucent toon sphere + rim 0→1, "SAFE!" → hold 460 shimmer → absorb 120 hit-stop 40 + shake, `onAbsorb(event)` + event-name pop → burst 140 "ABSORBED!" → settle 200) ·
  growthStomp (crouch 140 → leap 220 h 1.4 → hang 60 → slam 110 inQuart → impact 50 hit-stop 50 + shake 0.22 + dust ×10 → pulse 480: 3 ground rings r 1.4 / 2.1 / 3.1 (×1.5 compounding) with "+5% / +10% / +16%" pops + `onPulse(i, r, pct)` → settle 220).
- **P2** ledgerFlash (draw 180 ledger card in the LEFT hand → flash 90: screen flash white 160 ms (`vfx.screenFlash ‖ vfx.flash`) + hit-stop 40 → reveal 520 "TRUE COST: N" pop (red) + struck-out "deal" price, `onReveal(cost, trueCost)` → lower 220) ·
  haggleShout (inhale 200 megaphone in weaponSlot + chest puff → shout 420: 0.2 u lunge, 3 vertical sound rings fly forward at 0/120/240 ms, `ctx.text ‖ "−20%!"` pop, `onShout(target_i, i)` per ring (targets wrap) → ring 220 "✓ fair deal" → settle 220).
- **P3** fogSweep (windup 220 torso twist → sweep 140 inQuart whip + 0.3 u step → push 380: additive 200° arc flies 1.0→3.6 u and fades, hit-stop 30, shake 0.12, "FOG −!" pop, `ctx.fog.push(origin, dir, strength)` + `onSweep(origin, dir, radius)` + `vfx.fogShader?.push` → settle 240).
- API: all six are registered into 3A's `HERO_MOVES` via `registerMoves(ABILITIES)` at import → `makeMove(name, ctx)` and `hero.playMove(name, opts)` work unchanged.
  `attachAbilities(hero)` (idempotent; calls `attachMoves` itself) adds hidden props `hero.props.{magnetCoins, bubble, rings, ledger, megaphone, arc}`, `hero.setTool('megaphone')`,
  copies `ABILITY_CTX_KEYS` (coins, onCollect, radius, event, onAbsorb, onPulse, text, cost, trueCost, onReveal, targets, onShout, fog, onSweep, strength) from opts, and `hero.hideAbilityProps()` runs whenever `hero.state !== 'move'` (so `stopMove()` mid-ability leaves nothing visible).
  `ensureAbilityProps(hero)` is called lazily by every ability so the plain `makeMove()` integrator path works without `attachAbilities`.
  Exports: `ABILITIES, ABILITY_NAMES(), ABILITY_CTX_KEYS, FINLIT` (key/title/lesson text per ability for 7A/8B UI), `GROWTH_RINGS, MAGNET_COINS, make{MagnetCoins,Bubble,Rings,Ledger,Megaphone,Arc}`.
- `tools/check.mjs --abilities` (additive section): real HeroController + mock game/vfx, `attachAbilities`, every ability runs to completion, all phases seen, no NaN, rest pose ±0.03, every ability prop hidden again, visible mesh count at rest unchanged (62 → 62), plus per-ability asserts (4/4 coins collected with 1 out of reach + moved 4.0 u · bubble + onAbsorb('Storm') + hit-stop · rings 1.4→2.1→3.1 ×1.5 + 3 pulses · ledger + flash + onReveal(100, 340) · megaphone + rings + onShout ×3 · arc + onSweep + fog.push) · stopMove() mid-ability hides props · makeMove standalone · FINLIT text ×6 · 3A hammer still OK. `--hero` still passes 9/9.

## Missing
- Nothing from the 3B list. Optional 9A/9B hooks (`sparkTrail, coinBurst, savingSparkle, levelRing, coinRain, screenFlash, fogShader, debtPulse`) are all `?.()`-style no-ops today; fallbacks are sparks/dust/pop/`vfx.flash`.

## Measured
- Ability props at rest: 0 draw calls (all hidden). When shown: magnetCoins 1 (InstancedMesh ×8, flat) · bubble 2 (toon translucent + flat rim, no outline) · rings 3 (flat additive, no outline) · ledger 3m+3o = 6 · megaphone 2m+2o = 4 (sword hides while held → net +2) · arc 1 (flat additive). Peak during any ability ≤ +2 dc vs rest.
- Headless totalMs: coinMagnetDash 740 · bubbleShield 1300 · growthStomp 1280 · ledgerFlash 1010 · haggleShout 1060 · fogSweep 980.
- Demo (island + 3 Glimmers + deal sign + 24-disc fog bank (1 IM) + 14 ground coins (1 IM) + Pip): **135–148 draw calls, ~36 k tris** at load/mid-ability, 100 dc close-up. Browser smoke (one run): **ERRORS: none**, screenshots in `screenshots/3B_abilities/`.

## Suspected / notes
- This chat was a RESUME pass: the previous 3B chat died right after writing P1 (coinMagnetDash/bubbleShield/growthStomp) with no demo/check/handoff. This chat fixed its review items (arc orientation baked into geometry, per-frame `new Euler` → shared `_e`, `dtLast` via `dtOf(M)` with a 1/60 fallback for the makeMove path, lazy `ensureAbilityProps` guard), then added P2 + P3, the check section, demo, handoff.
- In the smoke run keys E/F/G were pressed 1.2 s apart and landed while bubbleShield (1.3 s) was still in a non-cancellable phase → logged "blocked (busy)" (correct behaviour; `playMove` returns null). Headless check exercises all six.
- The ledger attaches to `p.handL`; the hero rig's left hand is a tiny sphere so the card reads as "held up" only in the draw/flash/reveal poses (armL −2.8 rad). Fine at game zoom.

## Notes for the integrator (10A/10B)
- `attachMoves(hero); attachAbilities(hero);` once after constructing HeroController (order doesn't matter). Then e.g. `hero.playMove('coinMagnetDash', { coins: incomeCoins, radius: 2.2, onCollect })`, `hero.playMove('bubbleShield', { event, onAbsorb })` (4B: fire this when the Protect jar ≥ 3 months and a bad event rolls), `hero.playMove('growthStomp', { onPulse })` (4A: apply +pct to stalls inside radius r), `hero.playMove('ledgerFlash', { cost, trueCost, target: scamNPC, onReveal })` (4B scams), `hero.playMove('haggleShout', { targets: nearbyGlimmers, text: '−20%!', onShout })`, `hero.playMove('fogSweep', { fog: debtFogSystem, strength, onSweep })` where `fog.push(originV3, dirV3, strength)` is your Debt Fog API.
- `FINLIT[name].lesson` is the one-line FinLit meaning for the HUD / tutorial (7A, 10D). `FINLIT[name].key` is the suggested keyboard binding Q/W/E/R/F/G.
- `coins` entries can be `Vector3 | { position } | { root }`; each is collected once per dash (`onCollect` fires once). magnetCoins / rings / arc live in `game.scene` (same parent as 3A's coin), bubble on `hero.root`, ledger on `handL`, megaphone on `weaponSlot`.
