# LUMEN LEDGER — Game Bible, version **S32** (2026-10-27)

Title-menu footer reads `jam build · S32` (`GAME_VERSION` in `LUMEN/game/src/Game.js`, `UI_VERSION` in `LUMEN/game/ui/index.js`).
The full design bible (pitch, content rules, visual/tech bible, folder ownership) is unchanged and lives in
`LUMEN_extras/game/docs/GAME_BIBLE.md`. This file records **what S32 adds** and how to verify it.

## 1. What S32 is
**Real knockback on every sword target.** Before S32 a hit only squashed/jiggled the creature in place (the "slide" was 2.6 u/s
≈ 0.29 u — invisible). Now:

| Target | Reaction |
|---|---|
| **Glimmers** (customers) | slide ≈ 0.9 u away from Pip, steering paused 0.35 s, turn to face the attacker, then `CustomerSystem` re-paths; browsing / queueing Glimmers walk back to their slot — **sales never break**. Pooled / despawning Glimmers are excluded from the target list. |
| **Hired helpers** (6 types, seated at their stall) | now sword targets: slide (land + no *other* stall — their **own** stall cell is allowed because the seat is inside its footprint), red flash, "ouch" pop, `bus.emit('helper:hit', {type, count})`, then walk straight back (`HELPER_WALK` 1.6 u/s) to the remembered `h.seat` and resume working. |
| **Debt Collectors** | unchanged — keep `ENEMY_RULES.knockback` from S16. |
| **Baron Gilt** | never slides (Pip's hit during his wind-up cancels the attack instead). |

## 2. Code map
- `src/assets/creatures/animator.js` — `KNOCK_SPEED = 8` (u/s at power 1), `KNOCK_DECAY = 9` (/s, exponential), `KNOCK_STUN = 0.35` s.
  `CreatureAnimator.hit(dir, power)` sets `this.knock` (world-space, y = 0) and `this.knockT`; `get knocked()`; the slide is advanced in
  `update()` (split out so systems that own the root can call it) and clamped by the optional `canStand(x, z)` callback.
- `src/systems/customers.js` — pauses its own steering while `anim.knocked`, re-paths after, browse/queue states walk back to the slot.
- `src/Game.js` — sword targets = Glimmers (not pooled/despawning) + live enemies + **hired helpers**; helper `seat` remembered on hire
  (`fx/fz` = facing point); helper `canStand` allows own stall cell; `updateHelperReturn()` walks a knocked helper home.
- `tools/gates/knockback.mjs` + `check.mjs --knockback` — headless gate: animator slide/decay/stun/clamp numbers · knocked customers stay
  walkable, re-path and still sell · helpers are in the target list, slide, emit `helper:hit`, walk back to seat.

## 3. Verify
```bash
cd LUMEN/game
node tools/check.mjs --knockback            # S32 gate (~1 s)
node tools/check.mjs --props --creatures --hero --abilities --economy --build --customers --ui --story --vfx --world --sandbox --game --save --audio --enemies --storm --cinematics --knockback
```
In the browser: PLAY → swing the sword (Space/J) next to a Glimmer or a seated helper — it slides, glares at Pip, then walks back.

## 4. Bugs the gate caught during S32 (keep as regression notes)
1. `KNOCK_SPEED` 2.6 → **8**: documented "≈ 0.9 u" but the real travel was v0/decay = 0.29 u.
2. Helper `canStand` rejected the helper's own stall cell → every shove was clamped to zero; the seat sits inside the footprint, so own-stall is allowed.

## 5. Shipping
- `bash LUMEN/game/tools/itch_zip.sh` → `/tmp/LumenLedger_itch.zip` (index.html at the zip root). The S32 download was published as **lumen-ledger-web.zip**.
- Jam: Zoud GameLab "Make FinLit Fun", due **2026-11-15**. Checklist: `LUMEN/game/docs/SUBMISSION_CHECKLIST.md`.

## 6. Open items / next chat
- Browser-verify knockback feel on mobile (touch A button) — only the headless gate ran for S32 docs.
- Optional: helper "ouch" SFX id in `audio/manifest.json` (currently a toast pop only).
- Ideas backlog: `LUMEN_extras/game/docs/SUGGESTIONS.md`; known bugs: `LUMEN_extras/game/docs/PLAY_BUGS.md`.
