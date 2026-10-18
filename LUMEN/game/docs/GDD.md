# LUMEN LEDGER — Game Design Document
*Zoud GameLab jam · theme “Make FinLit Fun” · deadline 2026-11-15 · browser (itch.io HTML5) + Flutter WebView APK*
*Version 1.0 (Chat 8B, 2026-10-18). Source of truth for numbers: `src/systems/economy.js` (BALANCE) + `src/systems/economyData.js` (BALANCE_TUNED, `docs/balance.md`). Source of truth for text: `data/story.json`.*

---

## 1. One-line pitch
**A cozy, toy-like 3D market tycoon where every coin you earn must be given a jar before it gets a wish — and the island's purple Debt Fog shows you, live, what happens when it isn't.**

You are **Pip**, a young *Channeler* who inherits a bankrupt island market, **Glowmarket**. Build stalls, sell to blob customers (**Glimmers**), and route your **Spark** (currency) between four jars — **Spend · Save · Invest · Protect**. **Baron Gilt, Lord of the Debt Fog**, lends at 20 %/season compounding and sends bumbling **Fog Collectors** with “Too-Good Deals”. Every 150-second **Season** ends in a one-tap **Ledger Review** that awards 0–3 stars and teaches one FinLit lesson. Push the fog off the island in 10 Seasons (~25 min) and relight the **Lighthouse**; then **Endless** mode opens.

## 2. Design pillars
1. **The money is visible.** Spark is a coin that flies to Pip. Jars are physical objects that fill. Debt is a fog you can see creeping across the grass. No spreadsheets — the spreadsheet is the island.
2. **One lesson, one season, one tap.** Each Season teaches exactly one idea; the Ledger Review restates it in two sentences and a tip. The player never reads a wall of text.
3. **Cozy, snappy, optimistic.** XP-Hero toon look, squash-and-stretch on everything, humour instead of scolding. Failure is foggy, not punishing; Tally-Owl never scolds twice.
4. **Choices are real but cheap to make.** Every decision (build / price / jar split / accept-or-refuse a deal) takes one tap and shows its consequence within a season.
5. **Family-friendly, 16+ rating safe, UAE partner.** No gambling, no loot boxes, no magic words, no dark-fantasy creatures (see GAME_BIBLE §2).

## 3. Core loop

```
   build / upgrade a stall ──► Glimmers arrive at the pier ──► walk · queue · browse · PAY
          ▲                                                              │
          │                                                        coin flies to Pip
          │                                                              ▼
   Ledger Review (★0–3, lesson card) ◄── Season ends (150 s) ◄── route Spark into the 4 jars
          │                                                              │
          └─── Debt Fog grows (debt > 0) or shrinks (debt 0 + Save ≥ 200) ◄──┘
```

**Second-to-second (action layer):** walk Pip (WASD / virtual joystick), hammer to build (B), pick stalls from a tray, drag the price, use six **abilities** (Q W E R F G) that are each a playable metaphor for a FinLit idea (§5).
**Minute-to-minute (tycoon layer):** choose which stall to build (needs vs wants), set prices against the fair price (Glimmer mood: happy ≤ 1.1× · sad ~1.3× · angry ≥ 1.4×), hire helper creatures, split income into jars with four sliders that always sum to 100 %.
**Season-to-season (story layer):** opening dialogue → mid-season nudge → optional event/scam → Ledger Review (lesson, stars, CONTINUE) → next season. Ten seasons, then the finale.

### Season clock & economy (defaults, 4B-tuned)
| Thing | Value |
|---|---|
| Season length | 150 s (10 seasons ≈ 25 min + dialogue) |
| Start | 100 Spark · 260 debt · fog 0.40 |
| Good interest | Save jar +5 %/season |
| Bad interest | Baron loan 20 %/season, compounding, max principal 500 |
| Invest jar | +8 % ± 4 %/season (can be negative in a storm) |
| Fog | +0.07/season while debt > 0 · −0.12/season when debt = 0 **and** Save ≥ 200 (+0.02 extra with Protect > 0) |
| Lose | fog reaches 1.0, or debt > 2 × maxLoan |
| Win | season ≥ 10 and fog ≤ 0 → Lighthouse relit → Endless |
| Stars | +1 income ≥ 1.25 × expenses · +1 saved ≥ 20 or debt went down · +1 no new debt and fog did not grow |

Balance targets (20 seeds, `tests/economy.sim.mjs --sweep`): a *sensible* player wins at S10 (17/20) or S11 (3/20); *borrow-everything* loses by S3–S5; a *hoarder* who never uses jars drifts into a slow loss at S8–S10. The story therefore ends exactly when a well-played run lights the lighthouse.

## 4. FinLit mapping (the jam requirement)
One lesson per season, in `BALANCE.lessons` order. Every lesson has (a) a **mechanic** the player feels, (b) a **story beat**, (c) a **Ledger lesson card** (`data/story.json → lessons`).

| S | Lesson id | Concept | How the player *plays* it | Story beat |
|---|---|---|---|---|
| 1 | `budgeting` | A budget is a plan for money before it is spent | 4 jar sliders always sum to 100 %; APPLY before income arrives | *The Inheritance* — Owl explains the jars, Baron introduces “compounding” |
| 2 | `needsVsWants` | Needs first, wants after | Needs-stalls (tea, fruit, bread, fish) are volume; wants-stalls (flower, toy, lantern, pottery…) are margin but fragile | Glimmers queue for bread while the toy stall idles |
| 3 | `emergencyFund` | 3 months of costs set aside | Save ≥ 200 is the threshold that pushes the fog back; **Bubble Shield** ability = Protect jar | *Leaky Roof* / *Storm* events test the fund |
| 4 | `goodVsBadInterest` | 5 % earned vs 20 % owed, compounding | Save jar visibly grows; Baron's debt chip grows faster; **Fog Sweep** = repay highest-interest first | Baron offers to “extend” the loan |
| 5 | `scams` | Too-Good Deals have tells | 6 scripted scams (Zero-Interest* Loan, Lucky Lantern, Double Spark, Quick Flip…) with accept/refuse; **Ledger Flash** reveals the true cost | Fog Collectors pitch; the asterisk |
| 6 | `compoundGrowth` | Interest earns interest | Invest jar line on the Ledger curves upward; **Growth Stomp** rings grow each hit | Owl shows two seasons of Save vs none |
| 7 | `insurance` | Pay a little to avoid losing a lot | Protect jar absorbs event losses (`protectAbsorb` 1.0 up to balance) | *Spark Storm* with vs without Protect |
| 8 | `diversification` | Don't put all stalls in one basket | Events hit a zone or stall type; 3 zones (Pier, West Meadow, East Shore) | *Tourist Boat* lifts one zone, *Spark Dip* sinks another |
| 9 | `delayedGratification` | Wait for the bigger thing | Stall L3 upgrades cost 180 but double base units; spending it on wants now delays the Lighthouse | Pip is tempted by the Festival |
| 10 | `planningForAGoal` | Set a goal, work backwards | The Lighthouse needs fog 0: the HUD shows seasons left vs fog left | *The Lighthouse* — finale, Baron offered a Save jar |

**Ability ↔ lesson mapping** (`src/anim/heroAbilities.js → FINLIT`): Coin-Magnet Dash (Q) *collect income promptly* · Bubble Shield (W) *emergency fund* · Growth Stomp (E) *compound growth* · Ledger Flash (R) *true cost of deals* · Haggle Shout (F) *prices are negotiable* · Fog Sweep (G) *repay the highest-interest loan first*. Abilities never replace a decision — they dramatise one.

**Learning check:** the Ledger Review is the assessment. Stars are computed from behaviour, not quiz answers; the lesson card restates the idea the player just lived. Tutorial toasts (10, once per run) fire on first-time triggers (`build:placed`, `cust:paid`, `ui:jar:apply`, `eco:fog`, `eco:scam`…).

## 5. Systems overview
| System | Owner | File(s) | Notes |
|---|---|---|---|
| Foundation (loop, toon, outline, Sequencer, camera, input, bus) | 0 | `src/core`, `src/anim` | frozen |
| Props: 12 stalls × 3 levels, nature, landmarks, decor | 1A–1D | `src/assets/props/*` | ≤ 10 dc per prop, baked with `mergeGroup` |
| Creatures: 12 Glimmer types, 6 helpers, Baron + 3 Collectors | 2A–2D | `src/assets/creatures/*` | ≤ 12 dc per creature |
| Hero: 9 moves + 6 abilities | 3A/3B | `src/anim/heroAnims.js`, `heroAbilities.js` | phase tables in comments |
| Economy (pure JS) | 4A/4B | `src/systems/economy.js`, `economyData.js` | 80 asserts + 3-strategy sim |
| Build & placement | 5 | `src/systems/build.js` | ghost, grid snap, 50 % refund |
| Customer AI | 6A/6B | `src/systems/customers.js`, `flowfield.js` | BFS flow field, 4-slot queues, cap 20 |
| UI (DOM) | 7A–7C | `ui/*.js` | HUD, jars, build tray, Ledger, dialogue, toasts, touch pad, title, pause |
| Story data + system (pure JS) | 8A/8B | `data/story.json`, `src/systems/story.js` | 207 lines, 10 lesson cards, 6 scam scripts |
| VFX packs | 9A/9B | `src/vfx/*` | coinFly, confetti, fog shader, savingSparkle… |
| Integration / save / tutorial | 10A–10D | `index.html`, `src/main.js`, `src/systems/save.js` | |
| Perf, mobile QA, audio, package, trailer, APK | 11A–14 | — | |

Everything talks over `core/EventBus.js`: Economy emits `eco:*`, Build `build:*`, Customers `cust:*`, Story `story:*`; UI listens and emits `ui:*`. Pure systems (economy, story) have no Three/DOM import and run in Node (`node tools/check.mjs`).

## 6. Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move Pip | WASD / arrows | left-side virtual joystick |
| Attack / hammer / confirm | Space · J · Enter | A button (hold-able) |
| Interact | E · F | B button |
| Build menu | B | 🔨 button |
| Abilities | Q W E R F G | ability tray (10C) |
| Pause / Settings | Esc · P | ⏸ in HUD |
| Dialogue | Enter / tap to advance · 1–4 for choices | tap · choice buttons |
| Ledger Review | Enter = CONTINUE | CONTINUE button |

Portrait and landscape both work (camera zooms out in portrait). All UI targets ≥ 44 px.

## 7. Art direction
- **XP Hero look**: 3-step toon ramp (`toonMat`) + inverted-hull outline on everything. Flat colours, no textures, all geometry procedural (boxes, rounded boxes, spheres, cones). Pivot at ground.
- **Palette**: grass `#7ED957` · hero orange `#FFA726` · Glimmer blue `#4FC3F7` · Spark gold `#FFD54F` · Debt Fog purple `#7B5EA7` · wood `#A1704A` · stone `#9E9E9E` · sky `#BFE8FF`.
- **Camera**: top-down ¾, fov 38, offset (0, 13, 10), follows Pip, trauma-based shake.
- **Motion**: every move is a `Sequence` with explicit ms + easing (anticipation slow → action instant → settle with overshoot), JellySpring squash-and-stretch, dust on land, 60 ms hit-stop, additive trails.
- **UI**: pure HTML/CSS, rounded cards, chunky type, CSS-blob portraits (Pip / Baron / Tally-Owl), typewriter dialogue at 50 cps.
- **Audio** (Chat 12): cozy marimba/ukulele loop, per-season layer; SFX for coin, build, jar fill, fog puff; no generated audio — files in `game/audio/`.

## 8. Narrative & cast
| Who | Role | Voice |
|---|---|---|
| **Pip** | hero, young Channeler | optimistic, a little impulsive, shouts “Per SEASON?!” |
| **Tally-Owl** | mentor, kept grandmother's books | dry humour, never scolds twice |
| **Baron Gilt** | villain, Lord of the Debt Fog | pompous, loves asterisks and the word *compounding* |
| **Fog Collectors** | Baron's tax-collector blobs | bumbling, slip on coins, pitch Too-Good Deals |
| **Glimmers** | blob customers (12 types) | short bursts: “Fruit! Shiny!” |

Structure per season: *opening* (6–9 lines, narrator title card first) → *mid* (2 lines at 50 % of the season) → *ledger* lines (2, variant by stars: low 0–1 / default 2 / high 3) → Ledger Review. Events (10) and scams (6, pitch → choice → accept/refuse lines → lesson = the scam's *tell*) interleave. Ending: *win* (9 lines, Lighthouse relit, Baron is handed a Save jar) → *endlessUnlock*; *lose* (3 lines, fogged out, title returns). Full outline: `docs/story_outline.md`.

## 9. Scope & schedule
**MVP (jam build):** 10-season story run on one island, 12 stalls × 3 levels, 12 Glimmer types, 6 helpers, 6 abilities, 4 jars, Ledger Review, 6 scams, 10 events, title/pause/settings/touch, localStorage save, tutorial toasts, audio, itch.io HTML5 upload, Flutter WebView APK.
**Stretch (only after MVP is green):** Endless mode text/variations, branching on stars (8B P3), per-Glimmer barks (6B), demo/trailer mode (13B), localisation.
**Out of scope:** multiplayer, external 3D models/textures, server/online features, in-app purchases, any gambling-like mechanic.

Pipeline: ~40 independent 100-credit chats, each owning a folder (GAME_BIBLE §6), each gated by `node tools/check.mjs` (headless, ~3 s). Done table and next IDs live in `LUMEN/README.md`.

**Performance budget (2018 Android phone, 60 fps):** ≤ 150 draw calls on screen (mesh + outline = 2), ≤ 900 tris per stall / 600 per creature, InstancedMesh for grass, flowers, coins and crowds, shadow map ≤ 1024, pixelRatio ≤ 1.5.

## 10. Accessibility & safety
Reduce-motion setting (CSS class + fewer shakes), outline thickness setting, quality presets (low/med/high), SFX/music toggles, no flashing above 3 Hz, no time-pressure on choices (dialogue waits), colour + icon + text for every jar/state (never colour alone). Content rules per GAME_BIBLE §2 are enforced by a banned-word regex in `check.mjs --story`.

## 11. Team / credits (placeholder — fill before submission, 13A)
- Design, code, art, writing: *[name(s)]* with the LUMEN chat pipeline (Genspark).
- Engine: Three.js r160 (MIT). Fonts/CSS: system stack. Audio: *[Ludo.ai / credits]*.
- Jam: Zoud GameLab “Make FinLit Fun”, 2026.

## 12. Glossary
**Spark** currency · **Channeler** Pip's job: routes Spark · **Glimmer** customer blob · **Jar** one of Spend/Save/Invest/Protect · **Debt Fog** visible debt, 0–1 coverage · **Season** 150 s round · **Ledger Review** end-of-season scorecard · **Too-Good Deal** a scam with a tell · **Lighthouse** the win condition · **Endless** post-win sandbox.
