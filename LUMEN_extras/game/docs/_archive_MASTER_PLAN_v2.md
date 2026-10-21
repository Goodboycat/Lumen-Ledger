# MASTER PLAN v2 — Lumen Ledger (corrected for 100-credit chats)

## Why v1 failed
Chat 0 was given ~8 deliverables (engine core + anim kit + hero + glimmer + sword + VFX + island + docs).
It shipped the code (≈1 900 lines, all modules load, sword spec is implemented) but ran out of credits
before writing `docs/` (Bible, API contracts, prompt template) and before a visual QA pass.
**Lesson: one chat ≈ 400–700 lines of new code + one demo page + zip. Nothing more.**
Docs, QA and integration are separate chats. Each chat below is sized to that.

## Status of Chat 0 (verified in this sandbox)
| Item | Status |
|---|---|
| core/ (Game, Camera, Input, Toon, Outline, EventBus) | ✅ done, syntax-clean |
| anim/ (Easing, Tween, Sequencer, SquashStretch) | ✅ done |
| assets/geo, hero, glimmer · world/Island · vfx/VFX | ✅ done |
| Sword attack to spec (200/100/100/200/300, hit-stop 60 ms, slash, shake, flash) | ✅ implemented |
| docs/GAME_BIBLE.md, API_CONTRACTS.md | ✅ written NOW by this chat (0B) |
| Visual QA on a real browser/phone | ⬜ Chat 0C |

## Sizing rules (apply to every chat)
1. **Budget split**: 10 credits read Bible+contract · 70 build · 10 demo page · 10 zip + link.
2. **Deliverable = one folder + one `demo_X.html`** that imports the Foundation kit and shows the work.
3. **Hard stop at 75 credits**: if not done, stop adding features, make what exists load without errors,
   write `docs/HANDOFF_X.md` (what's done / what's missing / exact next steps), zip, upload. A partial
   zip with a handoff note is worth 10× more than a chat that dies at 100 credits with nothing uploaded.
4. **Never polish. Never refactor Foundation.** Change requests go in `docs/CHANGE_REQUESTS.md`.
5. Every chat starts from the **latest master zip** (you merge in the Integration chats and re-upload).
6. New code lines target per chat: **≤ 600**. Props/creature chats: ≤ 25 assets each.

## Chat list (37 chats; ✅ = done)
Legend: **Needs** = zips you must upload to that chat. **Out** = folder it returns.

### Phase A — Foundation wrap-up (Week 1, days 1–2)
| # | Chat | Deliverable | Needs | Out |
|---|---|---|---|---|
| 0 | Foundation | engine + anim kit + hero + sword + VFX + island | — | ✅ `game/` |
| 0B | Docs & Contracts (THIS CHAT) | GAME_BIBLE, API_CONTRACTS, MASTER_PLAN_v2, per-chat prompts | 0 | ✅ `game/docs/` |
| 0C | Foundation QA | Open demo on desktop + phone, fix runtime bugs only, measure fps/draw calls, confirm touch joystick, record 10-s clip. Fix list ≤ 10 items. | 0,0B | `game/` (patched) + `docs/QA_0C.md` |

### Phase B — Content factories (Week 1–2, all parallel, each needs only 0+0B)
| # | Chat | Deliverable (≤ 25 assets / ≤ 600 lines) | Out |
|---|---|---|---|
| 1A | Props: Stalls | 12 stall types × 3 levels (`setLevel`), each with `userData.slots` (counter, 4 queue points, sign). Fruit, bread, lantern, fish, flower, tool, cloth, pottery, toy, tea, book, spark-exchange. | `src/assets/props/stalls.js` + `demo_stalls.html` |
| 1B | Props: Nature & Decor | 8 trees, 10 rocks, 6 bushes, 5 flowers (instanced), fences ×3, lanterns ×2, crates, barrels, jars ×4, signs ×3, benches, paths tiles. | `src/assets/props/nature.js`, `decor.js` |
| 1C | Props: Landmarks & World v2 | Lighthouse (3 states: dark/flicker/lit), Pip's cottage, pier, Baron's fog towers ×3, bridge, island expansion zones (Island v2: `unlockZone(i)`), cliffs. | `src/assets/props/landmarks.js`, `src/world/Island.js` v2 |
| 2A | Creatures: Glimmers | 12 Glimmer variants (hats/colors/eyes) + `CreatureAnimator` with idle/walk/happy/sad/pay/browse/wait/angry Sequences. | `src/assets/creatures/glimmers.js`, `animator.js` |
| 2B | Creatures: Helpers | 6 helper creatures with idle/work/carry anims (Tally-Owl, Pack-Mole, Spark-Bee, Guard-Tortoise, Scout-Fox, Gardener-Snail). | `src/assets/creatures/helpers.js` |
| 2C | Creatures: Baron & Collectors | Baron Gilt (top-hat blob lord, monocle, cane) + 3 Fog Collector variants; anims: strut, taunt, offer-deal, flee, slip-on-coin. | `src/assets/creatures/villains.js` |
| 3A | Hero moves set 1 | build, hammer, pickUp, carry(loop), throwCoin, dash, celebrate, sad, stunned — each with phase table. | `src/anim/heroAnims.js` (part 1) |
| 3B | Hero abilities set 2 | Coin-Magnet Dash, Bubble Shield, Growth Stomp, Ledger Flash, Haggle Shout, Fog Sweep + their VFX hooks. | `src/anim/heroAbilities.js` |

### Phase C — Systems (Week 2, parallel; pure-JS ones need only the Bible)
| # | Chat | Deliverable | Needs | Out |
|---|---|---|---|---|
| 4A | Economy core (pure JS) | Economy class: spark, jars, prices, demand curve, interest (good/bad), loans, season ledger, win/lose, serialize. `test.html` headless asserts. | 0B | `src/systems/economy.js`, `tests/economy.test.html` |
| 4B | Economy content & balance | EVENTS (storm, festival, price shock…), SCAMS (6 Too-Good Deals), UPGRADES tree, BALANCE table tuned for 10 seasons ≈ 25 min; `docs/balance.md`. | 4A | `src/systems/economyData.js`, `docs/balance.md` |
| 5 | Build & placement | grid ghost, snap, rotate, cost, demolish refund, upgrade; uses PROP_CATALOG. | 0,1A | `src/systems/build.js`, `demo_build.html` |
| 6A | Customer AI | flow-field pathing on island grid, FSM spawn→wander→queue→pay→leave, mood. | 0,2A,5 | `src/systems/customers.js` |
| 6B | Customer feel | coin-fly to hero, reactions to price, VIP/impulse behaviors, crowd instancing (≥ 60 Glimmers at 60 fps). | 6A, 9A | `src/systems/customers.js` v2 |
| 7A | UI: HUD + Build menu + Jars | XP-Hero ribbon (Spark, Season, Fog %), build menu grid, 4 jar sliders. | 0B | `ui/hud.*`, `ui/build.*`, `ui/jars.*` |
| 7B | UI: Ledger Review + Dialogue + Toasts | Season ledger screen (stars, lesson card), dialogue box with portraits, tutorial toasts. | 0B | `ui/ledger.*`, `ui/dialogue.*`, `ui/toast.*` |
| 7C | UI: Title, Pause, Settings, Touch | title screen, pause, settings (quality, outline, sfx vol), touch joystick + 3 buttons, portrait layout. | 0,0C | `ui/title.*`, `ui/touch.*` |
| 8A | Story data | `story.json`: 10 seasons × (opening, mid, ledger) dialogue; Baron scam lines; ending; endless unlock; 10 FinLit lesson cards. | 0B | `data/story.json` |
| 8B | Story system + GDD | StorySystem (pure JS), triggers, choices; **Concept Doc / GDD (jam requirement)**. | 8A,4A | `src/systems/story.js`, `docs/GDD.md` |
| 9A | VFX pack 1 | coinBurst, coinFly, confetti, sparkTrail, savingSparkle, levelRing (pooled). | 0 | `src/vfx/pack1.js` |
| 9B | VFX pack 2 | Debt Fog creeping shader (fog01 → island coverage), debtPulse, coinRain, lighthouse beam, screen vignette. | 0,1C | `src/vfx/pack2.js` |

### Phase D — Integration (Week 3, SEQUENTIAL — each gets the previous merged zip)
| # | Chat | Deliverable | Needs |
|---|---|---|---|
| 10A | Integrate world | Merge 1A,1B,1C,2A,2B,2C,3A,3B,9A,9B into Foundation. Fix import paths/API mismatches ONLY. `demo_world.html` shows everything on the island. | all B + 9 |
| 10B | Integrate systems | Merge 4A,4B,5,6A,6B. Playable sandbox season (no UI yet, debug keys). | 10A |
| 10C | Integrate UI + story | Merge 7A,7B,7C,8A,8B. `src/Game.js` state machine: Title → Tutorial → Season loop → Ledger → Ending → Endless. | 10B |
| 10D | Save/load + tutorial flow | `systems/save.js` (versioned localStorage), first-season tutorial toasts, resume. | 10C |
| 11A | Perf pass | profile on 4× CPU throttle, instancing, LOD, pool sizes, draw calls ≤ 100, memory. | 10D |
| 11B | Mobile QA | iOS Safari + Android Chrome quirks, portrait, touch, safe-area, Flutter WebView test checklist. Final gameplay zip. | 11A |
| 12 | Audio | `core/Audio.js` + bus→SFX map + `docs/audio_prompts.md` (≈40 SFX + 6 music Ludo.ai prompts) + manifest for files you drop in `game/audio/`. | 10C |
| 13A | Jam package | README, itch.io page copy, screenshots plan, Game Budget sheet, submission checklist. | 11B, 8B |
| 13B | Trailer | 2-min trailer shot list + in-game "demo mode" (`?demo=1` autoplay camera path) to record footage. | 11B |
| 14 | Flutter APK (your chat) | WebView wrapper of 11B zip. | 11B |

## Timeline (Oct 17 → Nov 15)
- **Oct 17–19**: 0B ✅, 0C. Launch 1A,1B,1C,2A,2B,2C,3A,3B,4A,7A,7B,8A,9A in parallel (they don't depend on each other).
- **Oct 20–26**: 4B, 5, 6A, 7C, 8B, 9B, then 6B. Start 12 (prompts) early so Ludo.ai audio is ready.
- **Oct 27–Nov 2**: 10A → 10B → 10C → 10D (strictly sequential, one per day, test between).
- **Nov 3–8**: 11A, 11B, 12 integration, 13A, 13B footage, 14 APK.
- **Nov 9–13**: buffer / fixes / second QA pass. **Submit Nov 13** (2-day margin).

## Your merge routine (between chats, 5 minutes, no credits)
1. Download chat zip → unzip → copy its owned folder into your master `game/`.
2. Open `game/index.html` or the chat's `demo_X.html` through a static server
   (e.g. VS Code Live Server, or `python -m http.server`). ES modules won't load from `file://`.
3. Re-zip master as `lumen_master_YYYY-MM-DD.zip`; that is what you upload to the next chat.

## Jam submission checklist (from itch.io page)
- [ ] Game (HTML5 upload, itch.io "This file will be played in the browser", viewport 1280×720, mobile friendly)
- [ ] Concept Doc / GDD (Chat 8B) — [ ] 2-min gameplay video (Chat 13B) — [ ] Game Budget (Chat 13A)
- [ ] Theme "Make FinLit Fun" visibly in title screen + lesson cards
