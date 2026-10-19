# LUMEN LEDGER v2 — THE VISION (read after START_HERE; this replaces GAME_BIBLE §1 as the pitch)
*Written 2026-10-19 by the plan chat. v1 (the 10-season market tycoon) took 4 days / ~76 chats and is DONE. It is now the HUB
of a much bigger game. The jam gives a month; a month-sized game is a Metroidvania-tycoon with combat, biomes, bosses, powers,
puzzles, a story with a twist, and a FinLit spine that gets more advanced the further Pip goes.*

## 0. One line
**Pip inherits a bankrupt island market and a sword. To relight the Lighthouse, Pip must run the market, explore six
sealed biomes, beat the mutated creatures Baron Gilt's Debt Fog has twisted, earn Spark-powers, find the four Ledger Keys
and walk into the Fog Citadel — where the Baron's only real weakness is that he cannot create Spark; he can only take it.**

## 1. What kind of game (pillars v2)
1. **Hub-and-spokes Metroidvania (Metroid Prime 1 structure).** Glowmarket is the hub. Six biomes are sealed behind gates;
   each gate needs a power or a FinLit mission. Paths are *closed* (guide the player) but every biome has a return path to
   the hub (shortcut doors that open from the far side). Backtracking with a new power reveals treasure rooms you saw but could not reach.
2. **Action with a sword and powers.** Enemies are fog-mutated animals (never undead/demonic — Bible §2). Hit-stop, knockback,
   hearts. Semi-bosses guard powers; bosses guard Ledger Keys. **No screen flash on normal attacks** (user rule).
3. **Cozy between the action.** Campfires in every biome = Ledger Review + Tally-Owl chat + cooking from gathered goods.
   The market keeps running while you are away (helpers) — coming home is a reward (Spark waiting, new Glimmers).
4. **Puzzles + obstacle courses.** Electric pylons (Electric Orb), light beams (Lumen Lantern), tether anchors (Spark Tether),
   ice/heat (Heat Stomp), moving/crumbling platforms, timed gates. Every biome has one course and 2–3 puzzles.
5. **Wisdom + comedy + an emotional ending.** FinLit is the spine, never a quiz. Humour comes from Fog Collectors, Juniper, Marlow's
   fall-ledger. The ending re-reads the villain.
6. **Immersive.** Rain in the rainforest, lightning on the crags, caustics in tidepools, lantern dark in the mines, snow-wind in the
   orchard, day/night + biome ambience, props that fade in with distance. Toon look everywhere (3-step ramp + outline). See `docs/IMMERSION.md`.
7. **Finite.** Endless mode is deleted. Gathering nodes are finite per biome. 100 % completion is a thing; "unlimited" is not.

## 2. The island v3 (one big island, 7 regions, closed pathways)
```
                     [6] FROST ORCHARD ──ice slide──► [7] FOG CITADEL (Lighthouse Peak, 4 keys)
                           ▲                                   ▲
            [5] DUST MINES │ (dark, lantern)          cliff lift (power: Tether)
                     ▲     │
   [2] ROOTWOOD ─────┼─────[1] GLOWMARKET HUB ─────► [3] THUNDER CRAGS (storm cliffs)
   RAINFOREST        │          │ pier                        │
   (rain, vines)     │          ▼                             ▼
                     └──► [4] SUNKEN TIDEPOOLS (water, caustics) ◄── Marlow's boat shortcut
```
| # | Biome | Atmosphere | Gate IN (from hub) | Enemies | Semi-boss / Boss → reward | Return path |
|---|---|---|---|---|---|---|
| 1 | **Glowmarket Hub** | cozy market, day/night | — | Fog Collectors (bumbling, non-lethal) | — | — |
| 2 | **Rootwood Rainforest** | fake rain, canopy shade, fireflies at night | FinLit mission T2-1 (pay 100 debt → Owl opens the root gate) | Mold-Pups, Sap-Wasps | **Tangle Bear** (bear, tentacles on its back, aggressive sweeps) → **Spark Tether** | vine drop to hub meadow |
| 3 | **Thunder Crags** | storm sky, lightning flashes (sky only), wind | Spark Tether (cross the chasm) | Static Goats, Rock Beetles | **Voltstripe** (winged tiger, electric pounce) → **Electric Orb** | cliff lift (powered by Orb) |
| 4 | **Sunken Tidepools** | water planes, caustics, bubbles, Marlow's boat | Electric Orb (power the pier crane) + rep ≥ 2★ (Marlow trusts you) | Shell Crabs, Jelly Drifters | **Reef Maw** (giant mutated anglerfish) → **Bubble Walk** (Bubble Shield evolves: walk on water 6 s) | boat |
| 5 | **Dust Mines** | dark, lantern cone, dust motes, echo | Bubble Walk (flooded entrance) | Rust Beetles, Cave Bats (bats are animals, OK) | **Ore Mole Matriarch** (helpers' mole species, mutated; you *cure* it) → **Lumen Lantern** | mine cart rail |
| 6 | **Frost Orchard** | snow, wind streaks, frozen trees, aurora at night | Lumen Lantern (reveal the hidden orchard path) + FinLit mission T4-2 | Frost Hares, Icicle Hawks | **Glacier Boar** → **Heat Stomp** (Growth Stomp evolves: melts ice, grows plants) | ice slide to hub |
| 7 | **Fog Citadel** | Baron's bank-fortress in purple fog, ledger-paper walls | **4 Ledger Keys** (one hidden in each of biomes 2–5 behind a closed path that needs a *later* power) + Heat Stomp (melt the frozen gate) | all enemy types, Collector elite | **Baron Gilt** (3 phases) → ending | — |

**Closed paths / treasures:** each biome has 3–5 sealed nooks (cracked wall = Heat Stomp, high ledge = Tether, dark alcove = Lantern,
flooded tunnel = Bubble Walk, dead pylon = Orb). Inside: Spark caches (finite), Heart Pieces (4 = +1 heart), recipe scrolls, a Ledger Key,
or a comedy scene (a Collector stuck in a jar). Map markers show "seen but unreachable" so the player knows to return.

## 3. Powers (no magic — Spark/energy "powers", Smash/Pokémon style). Each is *gained by action + FinLit*.
| Power | Gained by | FinLit tie (the mission that finishes the unlock) | Combat | Traversal / puzzle |
|---|---|---|---|---|
| Sword (start) | — | — | 3-hit combo, hit-stop 60 ms, NO flash | cut vines/crates |
| Spark Dash (v1 coinMagnetDash) | start | collect income promptly | i-frames, knock small enemies | gap ≤ 3 u |
| **Spark Tether** | Tangle Bear | *Diversify*: anchor to 2+ points before the bridge holds (one anchor snaps) | pull light enemies, yank shields | hookshot to anchors, swing |
| **Electric Orb** | Voltstripe | *Compound growth*: charge grows exponentially while held (bar shows 1.0×→1.5×→2.25×) | thrown orb, chain to 3 enemies, stun | charge pylons, power lifts/doors |
| **Bubble Walk** | Reef Maw | *Insurance*: Protect jar ≥ 100 makes the bubble absorb a hit | absorb one hit, bounce foes | walk on water 6 s, float down |
| **Lumen Lantern** | Ore Mole Matriarch | *Read the fine print*: Lantern reveals the Collectors' hidden fees and scam tells in dialogue | blinds bats, reveals cloaked Collectors | lights dark paths, hidden doors, beam-mirror puzzles |
| **Heat Stomp** | Glacier Boar | *Delayed gratification*: the stomp is bigger the longer you *don't* use it (cooldown = growth) | AoE, breaks armour | melt ice walls, grow vine ladders |
| Ledger Flash (v1) | start | true cost of deals | Baron's weakness (see §5) | reveals asterisk doors in the Citadel |

## 4. FinLit progression (easy → advanced, as MISSIONS, not lectures) — detail in `docs/FINLIT_V2.md`
Tier 1 (hub, seasons 1–3, v1 content): budgeting · needs vs wants · emergency fund.
Tier 2 (Rootwood, Crags): good vs bad interest · scams & tells · compound growth — missions: "pay 100 debt", "refuse 3 deals", "hold the Orb to 2×".
Tier 3 (Tidepools, Mines): insurance · diversification · delayed gratification — missions: "insure the expedition", "3 stall types in 3 zones", "save for the L3 crane".
Tier 4 (Orchard, Citadel): **advanced** — reputation/credit score (Marlow's boat fare drops with ★) · inflation (orchard prices +10 %/season: real vs nominal) ·
taxes vs fees (Rook explains legit tax; Collectors' "handling fee" is the scam) · opportunity cost (pick ONE of two treasure rooms, the other seals) ·
net worth (Lighthouse brightness = assets − debt) · fraud/identity (a Collector impersonates Owl — Lantern reveals) · risk/return (invest in expedition gear:
+damage but a storm event can break it) · giving (Juniper's family; rep ↑).

## 5. Baron Gilt's weakness (what FinLit says about debt)
**He cannot create Spark. He can only take it.** Every attack he has is *your* Spark coming back at you, compounding. So:
- **Phase 1 "Fine Print":** he is wrapped in contract-paper shields with asterisks. Normal hits bounce. Ledger Flash lights the asterisk → sword strike shreds a layer. (*Read before you sign.*)
- **Phase 2 "Compound Snowball":** he rolls a growing debt-snowball at you each lap (×1.2 per lap). Electric Orb reflects it; the longer *you* wait to reflect, the bigger it hits *him* — or you. (*Pay the highest interest first; don't let it roll.*)
- **Phase 3 "Starve the Fog":** he offers a Too-Good Deal mid-fight (take 500 Spark now!). Accept → he heals fully, fog +0.2. Refuse 3 times → his fog has nothing to feed on, he shrinks to blob size. The fight ends when Pip **hands him a Save jar** instead of a killing blow. (*Debt dies when you stop feeding it.*)
- Twist (ch. 6 reveal, Rook defects and tells it): the Baron was Glowmarket's bookkeeper who lost everything to the island's *first* Too-Good Deal; the fog is the shame he hid in. He is not evil, he is unlettered. The ending makes him **Gilt the Bookkeeper**, a new stall at the hub.

## 6. Cast v2
Pip (hero) · **Tally-Owl** (mentor, campfire ledgers) · **Captain Marlow** (tortoise fisher; boat; fishes Pip out after every edge fall and keeps a *Fall Ledger* — 12 comedy lines) · **Juniper** (kid Glimmer, follows Pip after ch. 2, points at secrets, says the wrong word for everything) · **Rook** (Fog Collector who defects in ch. 4, explains tax vs fee, slips on coins) · 6 helpers (now also hub companions: the bee scouts secrets, the mole digs mine shortcuts) · Baron Gilt · 3 Collectors + Collector Elite.

## 7. Edge fall + culling (user rules)
- Walking off the island → splash → fade → Pip appears at the nearest pier, −1 heart, Marlow line ("Fall #7. I am going to start charging. I am *thinking* about it."). If it was the last heart → the comedy "fall death" scene (Marlow's net, Juniper's drawing of the fall) → respawn at the campfire, Spark −5 %.
- Props and entities beyond `CULL_DIST` from the camera focus are hidden (`visible=false`, animators paused); they pop back with a 200 ms scale-in. Biome groups load/unload at gates.

## 8. What is deleted / changed from v1
Endless mode (and every `?endless` / ENDLESS button / `winRequiresSeasons`) · the white screen flash on sword hits · "10 seasons = win" (win = Citadel cleared; seasons keep ticking as the economy clock, Ledger Review at campfires/hub) · the frozen-Foundation rule for `src/core`, `src/entities/HeroController.js` (v2 IDs that own them may edit them; log in CHANGE_REQUESTS).
