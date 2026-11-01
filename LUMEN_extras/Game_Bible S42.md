# LUMEN — Lumen Ledger · Game Bible S42 (2026-11-01)

Previous: `Game_Bible S41.md` (everything there still applies; this file only lists what S42 changed).
Version strings: `GAME_VERSION = 'S42'` (src/Game.js) · `UI_VERSION = 'S42'` (ui/index.js) → title-menu footer.

## S42 — second phone playtest: sword fix + readability pass 2 (chat 16, IDs 16A · 16B)

| ID | Observation | Change | Files |
|---|---|---|---|
| 16A | "I hit him and nothing happened" — a Collector standing *on* Pip was missed | **Point-blank fix**: a target inside `POINT_BLANK = 0.9 u` is hit regardless of angle; the sword cone is measured from Pip's *pre-lunge* position (the strike lunges him ~0.2 u forward, which used to push a hugging Collector outside the cone); a zero-distance target keeps the current facing (no NaN lunge). `check.mjs --enemies` gains the point-blank gate | `src/entities/HeroController.js`, `tools/check.mjs` |
| 16B-1 | Two fog meters (HUD bar + island fog) confused people; the lesson tag/ⓘ in the Season pill was never read | **HUD Debt-Fog bar hidden** (element stays mounted, `display:none` — the purple island fog IS the indicator). Season lesson tag + ⓘ removed. Tutorial fog step → centred card about the island fog (no target). `ui/reveal.js` drops the `fog` stage (`REVEAL_ORDER = jars → rep → speed → powers`). `seasons.js` win text adjusted | `ui/hud.js`, `ui/tutorial.js`, `ui/reveal.js`, `ui/seasons.js` |
| 16B-2 | Between waves the island is empty 20–40 s; nobody found the ⏩ button | **Speed-up nudge** `ui/nudge.js` + `nudge.css`: after `idleS = 7` s of "bored" a 👆 hand bobs under the HUD ⏩ with a "Touch here! — Nothing happening? Speed up time ⏩" bubble; tapping the bubble emits `ui:speed {cycle:true, source:'nudge'}`. Hides when: predicate turns false, `ui:speed` / `game:speed > 1`, any modal (`ui:*:open`, `ui:pause on`), `eco:season` / `eco:win` / `eco:lose`, an ability tap. Max `maxShows = 3` per game, `cooldownS = 45`. `game:start` resets, `game:title` disarms. Position follows `.ll-hud .ll-speed` via rAF; hidden if the button is staged (no rect) | `ui/nudge.js` (new), `ui/nudge.css` (new), `ui/index.js`, `index.html`, `src/Game.js` |
| 16B-2 | — | `lg.isBored()` (Game.js) is the predicate: state playing/endless · not paused · `lg.speed === 1` · no `eco.pendingOffer` / `sb.modalOpen()` · `sb.enemies.active` empty · no active Glimmer (`sb.cust.active` all pooled/despawn) · build tray closed, not placing / demolishing | `src/Game.js` |
| 16B-2 | — | gate: `check.mjs --ui` "nudge (S42)" — idle → show, busy → hide + reset, cooldown + maxShows cap, speed / modal / season hide, title disarm / start re-arm, bubble click → `ui:speed` | `tools/check.mjs` |

### Bus events touched
- new: `ui:nudge { on, why, shows? }` (why ∈ bored · busy · speed · modal · pause · season · win · lose · tap · reset · destroy).
- `ui:speed` now also carries `source: 'nudge'` when it comes from the bubble.

### Gates
`node tools/check.mjs` → ALL OK ✅ (ui: + nudge section · enemies: + 16A point-blank).

## Next chat
- **16B P1 is still open** (see `LUMEN_extras/game/docs/prompts/16B_sword_combat.md`): `src/combat/Combat.js` 3-hit combo + lock-on + `installCombat(lg)`, `slash2`/`slash3` clips, `check.mjs --combat`, `demo_combat.html`, `docs/HANDOFF_16B.md`. Only 16A (point-blank) and the two readability items from the playtest were done under the S42 label.
- Watch the nudge on a phone: the hand is clamped to `[70, vw-110]` px; if the ⏩ pill moves in a future HUD layout, `ui/nudge.js target()` selector `.ll-hud .ll-speed` must follow.
- 15A carry-over: persist the reveal stage in the save.
