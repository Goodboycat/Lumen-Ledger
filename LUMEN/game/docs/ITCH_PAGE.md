# Lumen Ledger — itch.io page copy (Chat 13A)
*Paste-ready. Everything between the `▬▬` rules is page text; everything else is a note to whoever fills the itch form.*
*Jam: Zoud GameLab · theme **"Make FinLit Fun"** · submit by **2026‑11‑15**. Companion files: `docs/GDD.md` (Concept Doc), `docs/BUDGET.md` (Game Budget), 13B trailer (2‑min video).*

## 1. Form fields (itch.io → Edit game)
| Field | Value |
|---|---|
| Title | **Lumen Ledger** |
| Short description / tagline (≤ 120 chars) | **Make FinLit Fun: a cozy 3D market tycoon where every coin needs a jar — or the Debt Fog rolls in.** |
| Classification | Game |
| Kind of project | HTML (play in browser) |
| Release status | Prototype (jam build) |
| Pricing | No payments |
| Uploads | `lumen-ledger-web.zip` — zip of `LUMEN/game/` with `index.html` at the zip root (see §6). Tick **"This file will be played in the browser"**. |
| Embed | Viewport **1280 × 720**, ☑ Mobile friendly, ☑ Fullscreen button, ☐ Automatically start on page load, Orientation: Landscape (portrait also works), ☑ Enable scrollbars **off** |
| Frame options | SharedArrayBuffer **off** (not needed), Click to launch **on** (audio unlock needs a gesture) |
| Genre | Simulation (also: Educational, Strategy) |
| Tags (≤ 10) | `financial-literacy` `educational` `tycoon` `management` `cozy` `3d` `low-poly` `singleplayer` `family-friendly` `zoud-gamelab` |
| Inputs | Keyboard · Mouse · Touchscreen |
| Accessibility | Subtitles (all dialogue is text) · Configurable controls? no · Color‑blind friendly (icon + text on every jar/state) · Reduce‑motion setting · One‑button (touch) |
| Average session | About half an hour (10 seasons ≈ 25 min) |
| Languages | English |
| Multiplayer | No |
| Links | Source: https://github.com/Goodboycat/Lumen-Ledger · GDD: `docs/GDD.md` · Budget: `docs/BUDGET.md` |
| Community | Comments on |
| Cover image | 630 × 500 — Pip mid‑celebrate on the pier, 3 Glimmers, Spark coins arcing, Debt Fog purple at the edge, logo top‑left (shot list §5, shot 1 crop) |
| Screenshots | 6 PNG 1280 × 720 — see §5 |
| Trailer | YouTube/itch upload of the 13B 2‑minute gameplay video (jam requires **actual gameplay**, no cinematic cuts) |

## 2. Page body
▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

### 🪙 Lumen Ledger
**Make FinLit Fun.** A cozy, toy‑like 3D market tycoon where every coin you earn must be given a jar before it gets a wish — and the island's purple **Debt Fog** shows you, live, what happens when it isn't.

You are **Pip**, a young *Channeler* who inherits **Glowmarket**, a bankrupt island market, together with a 260‑Spark loan from **Baron Gilt, Lord of the Debt Fog** — at 20 % per season, *compounding*. Build stalls, sell bread, tea, lanterns and toys to the blob‑shaped **Glimmers** who arrive by boat, and route your **Spark** between four jars: **Spend · Save · Invest · Protect**. Save enough and the fog recedes; borrow more and it creeps across the grass toward your stalls.

Every 150‑second **Season** ends in a one‑tap **Ledger Review**: 0–3 stars for *how* you earned, and one short lesson card. Dodge the Fog Collectors' "Too‑Good Deals" (every one has a tell), survive a Spark Storm or two, and push the fog off the island in ten seasons to relight the **Lighthouse**. Then **Endless** mode opens.

No spreadsheets. The spreadsheet is the island.

*~25 minutes for the story run · keyboard, mouse or touch · plays in the browser, nothing to install.*

### How to play
1. **Build** — press **B** (or the 🔨 button), pick a stall, walk the green ghost to a free tile, confirm. *Needs* stalls (Fruit, Bakery, Fish, Tea) sell volume; *wants* stalls (Flower Cart, Toy Box, Lantern Shop, Pottery, Cloth Weaver, Book Nook, Tool Smith) sell margin — but only when Glimmers have Spark left.
2. **Sell** — Glimmers queue, browse and pay. Coins fly to Pip. Price near the fair price keeps them happy; 1.4× and they stomp off angry.
3. **Split** — drag the four jar sliders (always 100 %) and tap **APPLY** before the season's income lands. Save ≥ 200 Spark is what pushes the fog back; Protect absorbs storm damage; Invest grows 8 % ± 4 %.
4. **Review** — at the season bell, read your Ledger, collect stars, tap CONTINUE. One lesson per season, ten seasons, one lighthouse.

### Controls
| Action | Keyboard | Touch |
|---|---|---|
| Move Pip | WASD / arrows | left‑side virtual joystick |
| Hammer / confirm | Space · J · Enter | **A** button |
| Interact | E · F | **B** button |
| Build menu | B | 🔨 button |
| Abilities | Q W E R F G | ability tray |
| Pause / settings | Esc · P | ⏸ in the HUD · Android back button |
| Dialogue | Enter / click · 1–4 for choices | tap · choice buttons |

**Six abilities, six money ideas:** Coin‑Magnet Dash (Q) *collect income promptly* · Bubble Shield (W) *emergency fund* · Growth Stomp (E) *compound growth* · Ledger Flash (R) *see a deal's true cost* · Haggle Shout (F) *prices are negotiable* · Fog Sweep (G) *repay the highest‑interest loan first*.

### What you learn (one lesson per season)
| Season | Lesson | …and how the island teaches it |
|---|---|---|
| 1 | **Budgeting** | Four jars that always sum to 100 % — a plan for money before it is spent |
| 2 | **Needs vs Wants** | Glimmers queue for bread while the Toy Box idles |
| 3 | **Emergency Fund** | Save ≥ 200 is the line that pushes the fog back; a Leaky Roof tests it |
| 4 | **Good vs Bad Interest** | your Save jar earns 5 %; the Baron's loan costs 20 % — watch which grows faster |
| 5 | **Too‑Good Deals (scams)** | six pitches with tells: hurry · secrecy · "guaranteed" · an asterisk |
| 6 | **Compound Growth** | the Invest line on your Ledger curves upward |
| 7 | **Insurance** | a Spark Storm with Protect vs without |
| 8 | **Diversification** | events hit one zone or one stall type — three kinds beat three of the same |
| 9 | **Delayed Gratification** | the Festival is tempting; the Lighthouse is waiting |
| 10 | **Planning for a Goal** | fog left ÷ seasons left = this season's target |

Stars come from what you *did*, not from a quiz. The Ledger Review is the assessment; the lesson card restates the idea you just lived.

### Good to know
- **Saves** automatically at every season bell (browser localStorage). CONTINUE on the title screen resumes.
- **Sound** starts after your first tap/click (browser rule). Music and SFX sliders are in ⏸ Settings; `?mute` in the URL silences everything.
- **Accessibility** — reduce‑motion, outline thickness and quality presets in Settings; every jar and state uses colour **and** icon **and** text; no flashing above 3 Hz; dialogue waits for you.
- **Phone?** Yes — landscape or portrait, all buttons ≥ 44 px. Tested at 360 × 800. An Android APK (Flutter WebView) ships alongside the web build.
- **Content** — family‑friendly: no gambling, no loot boxes, no magic, no dark‑fantasy creatures. The villain is a fog with a top hat.

### Credits
Made for the **Zoud GameLab** jam, theme *"Make FinLit Fun"* (Oct 15 – Nov 15 2026).
Design · code · art · writing: **[team name]** — built with the LUMEN chat pipeline (Genspark). Engine: **Three.js r160** (MIT). All 3D is procedural (no external models or textures). Audio: procedural synth fallback in‑engine; optional Ludo.ai SFX/music (see `docs/audio_prompts.md`). Fonts: system stack.
Thanks to the National Financial Wellbeing initiative for the theme, and to every Glimmer who overpaid for a lantern.

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬
