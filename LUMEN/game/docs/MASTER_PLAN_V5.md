# MASTER PLAN v5 — Lumen Ledger v2 (2026-10-19). THE ONLY CURRENT PLAN. `MASTER_PLAN.md` (v3.2) is v1 history.

v1 (IDs 0–13A) is **done** in 4 days. v2 turns it into the game in `docs/VISION_V2.md`. Rules: `docs/START_HERE.md` (v5 delta at
its top) — one message per chat, wip.sh after every file, push always, `next.sh` picks the ID. **Nothing below needs a human
decision; the user only pastes `_TEMPLATE.md` and downloads LUMEN.**

## 0. How the plan itself is written (THE EXPANSION MECHANISM — read this if you are a Z-chat)
The chat that wrote this plan would have died writing 60 full prompts. So the plan is **two-level**:
- **This file** = the index: every ID, one line, order, dependencies, owned files. Final.
- **`docs/prompts/<ID>_*.md`** = full prompt (P1/P2/P3, owned files, check.mjs section, HANDOFF shape). Phases 15–16 are written.
  For phases 17–30 there is one **`<N>Z_plan_phase.md` prompt per phase**. A Z-ID is a normal ID picked by `next.sh`: its deliverable
  is *writing the full prompts of its phase* (6–10 files × ≤ 60 lines, each ≤ 1 Write, wip.sh after each) + appending the phase's IDs to
  README "Next" right after itself. Cost ≈ 25–35 credits, so a Z-chat closes its Z and continues into the first ID it just wrote.
  **A Z prompt never writes code.** The format every Z must follow is `docs/prompts/_FORMAT_V2.md`.
- Reading rule: an ID chat reads START_HERE → VISION_V2 → its own prompt → (only the API_CONTRACTS / HANDOFF sections it names). Not this whole file.

## 1. Phase map (sequential phases; IDs inside a phase are sequential too unless marked ∥)
| Phase | Theme | IDs | Chats (est. incl. ~40 % axe overhead) |
|---|---|---|---|
| 15 | **Hotfix + foundation v2** (user bugs, delete endless, no flash, hearts, edge fall, culling) | 15A 15B 15C 15D | 6 |
| 16 | **Combat core**: enemy base, sword vs enemy, 4 hub-meadow enemies, hit reactions, loot | 16A 16B 16C 16D | 6 |
| 17 | **World v3 skeleton**: 7 regions, gates, closed paths, map screen, return paths, biome load/unload | 17Z → 17A–17E | 7 |
| 18 | **Rootwood Rainforest** (rain atmosphere, vines, 2 enemies, Tangle Bear, Spark Tether, course, 3 puzzles, treasures, Ledger Key #1 nook) | 18Z → 18A–18G | 10 |
| 19 | **Thunder Crags** (storm, 2 enemies, Voltstripe, Electric Orb + electric puzzles, cliff lift, Key #2 nook) | 19Z → 19A–19G | 10 |
| 20 | **Sunken Tidepools** (water/caustics, Marlow's boat, 2 enemies, Reef Maw, Bubble Walk, Key #3 nook) | 20Z → 20A–20G | 10 |
| 21 | **Dust Mines** (dark + lantern, 2 enemies, Ore Mole Matriarch cure-fight, Lumen Lantern, beam puzzles, cart rail, Key #4 nook) | 21Z → 21A–21G | 10 |
| 22 | **Frost Orchard** (snow, 2 enemies, Glacier Boar, Heat Stomp, ice slide, inflation market) | 22Z → 22A–22F | 9 |
| 23 | **Fog Citadel + Baron 3-phase boss + ending** (4-key door, asterisk doors, snowball reflect, Save-jar finale, credits) | 23Z → 23A–23F | 9 |
| 24 | **Story v2** (6 chapters, Marlow/Juniper/Rook, campfire scenes, twist, 12 fall lines, comedy bits) + **FinLit v2 missions** T2–T4 | 24Z → 24A–24F | 8 |
| 25 | **VFX v2** (multi-mesh shader VFX per power, toon-stylised: tether beam, orb lightning, bubble refraction, lantern cone, heat shockwave; rain/snow/caustics particles; boss intros) | 25Z → 25A–25E | 7 |
| 26 | **Gathering, cooking, campfire, map, inventory UI, Heart Pieces, recipe scrolls, companions** | 26Z → 26A–26E | 7 |
| 27 | **Hub v2** (market reacts to biomes: new goods, Gilt stall post-ending, Rook's tax desk, Marlow fare, helpers as companions, night market) | 27Z → 27A–27D | 6 |
| 28 | **Playtest rounds** (the gameplay chats — see §3) + bugfix IDs they spawn | 28Z → 28A–28H (+28F1…) | 14 |
| 29 | **Perf v2 + mobile v2 + save v2 + accessibility** | 29Z → 29A–29D | 6 |
| 30 | **Ship**: jam package v2, GDD v2, budget v2, APK, **then** 13B trailer + 12B SFX leave standby | 30Z → 30A–30D, 13B, 12B, 14 | 8 |
| | | **≈ 85 IDs** | **≈ 135 chats** |

**Order inside README "Next"** = exactly the row order above. `next.sh` reads it left to right; a Z-ID appends its phase's IDs
*immediately after itself* so they run before the next phase's Z. Phases 18–21 are independent of each other in code (each biome
owns its folder) but run sequentially so each builds on the previous biome's patterns; a Z may mark IDs ∥ if they touch disjoint files.

## 2. STANDBY (user rule — do not touch until the user says otherwise)
- **13B trailer / demo mode** — half-done files stay; `next.sh` skips it (listed under README "## Standby", not "## Next").
- **12B SFX/music files** — the synth fallback ships; real audio waits for the final content list.
- **14 Flutter APK** — needs the final web build.
They re-enter "Next" in phase 30 (30Z moves them) or when the user writes "unstandby 13B" in a paste block.

## 3. Playtest rounds (phase 28, but ALSO a cheap slice at the end of every biome phase)
A full playthrough costs more than 100 credits in screenshots. So **a playtest chat never plays the whole game**. Each 28x ID
plays ONE segment, by script, with a hard credit cap, and files bugs as new IDs:
| ID | Segment | Method | Cap |
|---|---|---|---|
| 28A | Hub S1–S2 + first fight + edge fall | `tools/play.mjs --script hub_intro` (Playwright, scripted inputs, 6 shots max) | 35 cr |
| 28B | Rootwood: gate → Tangle Bear → Tether → return | `--script rootwood` | 35 |
| 28C | Crags: Tether chasm → Voltstripe → Orb puzzles → lift | `--script crags` | 35 |
| 28D | Tidepools + Mines | `--script tide_mines` | 35 |
| 28E | Orchard + Citadel + ending | `--script orchard_citadel` | 35 |
| 28F | Mobile touch: 360×800 and 800×360, every button reachable, joystick vs buttons (user bug) | `qa_mobile.mjs` + `play.mjs --touch` | 30 |
| 28G | Beta-tester intake: `docs/BETA_FEEDBACK.md` → triage → one `28F<n>_fix_*.md` prompt per bug cluster (≤ 8) appended to Next | docs only | 25 |
| 28H | Economy + FinLit mission balance sim v2 (pure Node, no browser) | `tests/*.sim.mjs` | 30 |
Each playtest ID = 1 ID, max one browser session, headless script does the walking (`tools/play.mjs`, written by 28Z: step list → keys/
touch events → asserts on `window.game` state → ≤ 6 PNGs). Found bugs → `docs/BUGS.md` rows + `28F<n>` fix prompts (the fixer owns the
files the bug names). **A playtest chat never fixes a bug itself** unless it is a one-line typo in a file nobody else owns.
Mini-playtests: the last ID of every biome phase (18G, 19G…) is `*_playtest_slice` — same method, 25-credit cap, only that biome.

## 4. Chat budget per ID (how to size an ID so it survives)
- An ID must be closable in **≤ 55 credits** of real work (P1 ≈ 25, P2 ≈ 15, P3 ≈ 10). Reading ≤ 8. Close ≤ 7. Margin 30.
- A Z-ID writing N prompts: 3 credits each → N ≤ 10.
- A boss = its own ID. A biome's enemies (2) = one ID. A power (move + traversal + puzzle hook) = one ID. Atmosphere (rain, snow) = one ID.
- If a prompt's P1 cannot be done in 25 credits, the Z-chat splits the ID (18C → 18C1 18C2) *when writing the prompt*, not later.

## 5. Ownership map v2 (new folders; v1 folders keep v1 owners for unchanged files)
```
src/combat/        16A (Enemy base, Health, Hitbox) · 16B (sword↔enemy) · 16C/16D hub enemies · biome IDs add enemies/<biome>.js
src/powers/        18D tether · 19D orb · 20D bubbleWalk · 21D lantern · 22D heatStomp (each: move + traversal + puzzle hook)
src/world/regions/ 17B hub · 18A rootwood · 19A crags · 20A tidepools · 21A mines · 22A orchard · 23A citadel ; 17A Regions.js (gates, load/unload, return paths)
src/world/Map.js   17D (map screen data) · ui/map.* 26C
src/puzzles/       17C base (Switch, Door, Pylon, Anchor, Mirror, Platform) · biome IDs add puzzles/<biome>.js
src/systems/vitals.js   15B hearts, damage, i-frames, edge fall, respawn
src/systems/cull.js     15C distance culling + biome streaming
src/systems/missions.js 24E FinLit missions T2–T4 · data/missions.json 24D
src/systems/gather.js   26A finite nodes, inventory · src/systems/cook.js 26B campfire
src/vfx/pack3..6.js     25A–25E (multi-mesh shader VFX, weather)
src/entities/HeroController.js  15B/16B may edit (no longer frozen); src/core still frozen except 15C (Game.js cull hook) and 15D
data/story2.json  24A–24C · src/systems/story.js 24C extends
```

## 6. Timeline (Oct 19 → Nov 15; buffer-first)
Oct 19–21 phase 15–16 · Oct 22–24 phase 17 · Oct 25–Nov 2 phases 18–21 (one biome per ~2 days) · Nov 3–4 phase 22 · Nov 5–6 phase 23 ·
Nov 7–8 phases 24–25 · Nov 9 phases 26–27 · Nov 10–11 phase 28 · Nov 12 phase 29 · Nov 13 phase 30 + trailer/SFX/APK · Nov 14 buffer · Nov 15 submit.
At 76 chats / 4 days the user runs ~19 chats/day; 135 chats ≈ 7 days of chats. The timeline has ~3× slack; **scope is cut from the
end of each biome phase (treasure count, puzzle count), never from phase 15, 23, 28 or 30.**

## 7. Content safety (Bible §2 still binds)
Mutated *animals* (bear, tiger, boar, mole, fish, crab, goat, beetle, hare, hawk, bat, jelly) — never undead/demonic. Fog mutation =
purple veins + extra limb/feature, always comic-grotesque, not gory. Enemies "pop" into fog puffs and drop Spark; bosses are *cured*
or *shrink*, never killed. No magic: powers are Spark/energy. Baron is handed a jar, not slain.
