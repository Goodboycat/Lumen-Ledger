# HANDOFF 48Z — Phase 48 "HUSH" (comfort by DELETION, v2) — plan written 2026-11-04

**Why this phase exists.** The user's prompt (below, verbatim in `prompts/48Z_user_prompt.md`) was handed to several chats; each one
ADDED text (a bubble over Pip's head that keeps respawning, more chips, more hints). Nothing was deleted. This plan is the opposite:
**every ID here removes text first and adds at most ONE thing, and that thing is never a sentence on screen unless it is the tutorial card.**

## Ship rules for every 48x chat (read this block, then ONLY your prompt + the files it names)
1. **Reading is the budget killer.** Do NOT open `src/Game.js` (1 300 lines) or `data/story.json` (1 300 lines) top to bottom.
   Every prompt gives you `grep -n` anchors → read ±15 lines around them. A chat that reads whole files gets axed before it ships.
2. **Delete > change > add.** If an item can be solved by removing a listener or a mount line, do that. No new bus events unless the prompt lists them.
3. **Zero new on-screen sentences** outside `ui/tutor.js` (48F). Glyphs (♥ ✓ ✗ ▲ ▼ price numbers) are allowed; words are not.
4. **No emojis as art.** Icons come from `ui/icons.js` → `node tools/icons_png.mjs` (procedural SVG → one side-by-side sheet → PNG slices in `ui/icons/`). That IS the user's "procedural art → side by side → screenshot → extract PNGs" pipeline. Use `iconize()` / the PNGs; never a 👆 ⏩ 🔨 ✋ glyph.
5. `bash tools/wip.sh "48X: <what>" --<flag>` after EVERY file. Then `git push -q origin main` if wip.sh printed a push error.
6. Close your ID: `docs/HANDOFF_48X.md` (≤ 15 lines) + one row in `LUMEN_extras/README_pipeline.md` Done table + strike your ID in "## Next".
7. Headless gate: `node tools/check.mjs --quiet --barks --verbs --jarsworld --ui` must stay green (48A/48B extend `--quiet`).

## The text census (2026-11-04, S50) — what pops on screen and where it comes from
| Source | Where | Verdict |
|---|---|---|
| Top toasts (`ui:toast` ×11 in Game.js, `story:toast` in Game.js/Audio.js/story.js/verbChain.js, `reveal.js` toast.push ×2) | `ui/toast.js` mounted at `ui/index.js:45` | **DELETE ALL** (48A) |
| Speech bubbles ("barks") over heads | `ui/bark.js`; emitters: story.js ×12 (walkIn 7 lines!, firstCoin/Stall/Deposit, seasonStart, abilityUnlock, novelty), customers.js ×4, Game.js ×4, 5 novelties, scamNpc, baronPier, Audio.js | **DIET** (48B): no bark may anchor to the hero; unbound anchor → drop (today it falls back to the hero = the respawning text over Pip); walkIn 7→2; one bark on screen; 6 s spacing |
| `jars:locked` → bark "Locked till the ledger." anchored **'hero'**, fires on every E press at the Invest jar | `src/Game.js:414` | **DELETE** (48B) — the jar already wobbles |
| Verb-chain chip + Skip + "Later, then." toast | `src/systems/verbChain.js:22-37,90` | chip → tutor card (48F); toast deleted (48A) |
| Speed nudge 👆 + "Touch here! … ⏩" bubble | `ui/nudge.js:35-37` | icon art, bubble text removed (48C) |
| Wave banner "⚠ N DEBT COLLECTORS LANDED — follow the arrows" / "✓ Collectors beaten!" | `ui/wave.js:73-76`, `ui/wave.css` | keep, **semi-transparent** + iconize (48C) |
| HUD "NEW: …" chip (4 s), season lesson tag | `ui/hud.js`, `ui/seasons.js` | keep (not a top toast; user did not name it) |
| Demolish-mode toast (6 s, with Stop button) | `src/Game.js:957` | → tutor card "careful with demolish" (48F), toast deleted (48A) |

## IDs (do them in this order; A–D are "easy", E–G need thinking, H closes). `bash tools/next.sh` prints the one to do.
| ID | Title | Depth | Deletes | Adds |
|---|---|---|---|---|
| 48A | Kill every top toast | easy | toast mount + 16 emitters' effect, verbChain "Later, then." | nothing |
| 48B | Bark diet + hero-head bubble bug | easy | hero-anchored bark, anchor fallback, walkIn 5 of 7 lines | bark budget (1 on screen, 6 s spacing) |
| 48C | Semi-transparent warnings + icon art + glimmer blue | easy | nudge text, emoji in nudge/wave | PNG icons `hand`,`fastforward` via icons_png.mjs; `.ll-wave-banner` opacity .55; dialogue portrait uses the Glimmer type colour |
| 48D | Delete Interact + Build touch buttons | medium | 2 touch buttons | proximity interact (jars/till/NPC), tap-on-land opens the tray at that cell (decision D1 below) |
| 48E | Jars are buildables (no pre-placed jars, no floating jar) | deep | `Game.js:187` 4 pre-placed jars, `?sliders` leftovers | 4 Build-tab "Savings" cards, one of each, register/unregister on place/demolish, panel shows only placed jars + opens when near, mobile scroll affordance, save v4 |
| 48F | Curiosity tutorial (blue UI, once-only, reactive) | deep | verbChain DOM chip + Skip, nudge bubble, reveal toasts | `ui/tutor.js` + `tutor.css` — ONE card at a time, each card id once per profile, reacts to the player's first action |
| 48G | Too Good Deals — realistic manipulation, 3 decision points | medium | old 2-choice scam text | branching `t_scam` script in story.json (data only; dialogue.js already supports choices) |
| 48H | Close S51: version, README (itch URL), ITCH_PAGE, zip, Game_Bible S51 | easy | — | — |

## Decisions already taken (so chats do not stall) — the user may overrule by name
- **D1 (48D):** after the Build button goes, the tray opens by **tapping empty land** (the ghost starts on that cell) and by key **B**. Interaction is **automatic on proximity**: walking within 1.3 u of a jar opens the jars panel (48E), tills collect on walk (42A already), the Baron / scam NPC open their dialogue when you stop next to them for 0.6 s. Tapping a stall = its sign (price ±1 already exists, 44A).
- **D2 (48F):** the tutorial never pauses the game, never blocks input, never has a Skip button (tapping anywhere dismisses the card). Blue glass theme (`--tut-bg: rgba(28,72,120,.88)`, `--tut-ink: #E6F4FF`), distinct from the paper/ink game UI.
- **D3 (48E):** jars cost 0 ✦ and have upkeep 0; they are placed like decor (any land cell, snapped to ground height); only ONE of each; demolish refunds nothing and un-registers the jar (its Spark goes back to the pouch).
- **D4 (48B):** customer glyph barks (♥ ✓ ✗ + price, 44A) are NOT text and stay. Owl word-barks become once-per-run.

## Missing (tick as IDs close)
- [ ] 48A · [ ] 48B · [ ] 48C · [ ] 48D · [ ] 48E · [ ] 48F · [x] 48G · [ ] 48H

## Notes for the integrator
- `tools/icons_png.mjs` needs `rsvg-convert` or ImageMagick (`sudo apt-get install -y librsvg2-bin` in the sandbox) — it is the icon pipeline, do not write a Playwright screenshot one.
- `sb.interact()` (Game.js, 42B) is the ONE dispatcher for E/✋ — 48D moves its callers, it does not duplicate it.
- `BuildSystem.owned(id)` / `placeBlocker(id)` (S29) already deny duplicates for `stall_*` — 48E extends the same check to `jar_*`.
