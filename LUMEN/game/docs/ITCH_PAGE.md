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

## 3. Theme statement (for the jam submission form "How does your game fit the theme?")
> *Make FinLit Fun* means the lesson has to be the toy. In Lumen Ledger money is never a number in a corner: Spark is a coin that flies to you, a budget is four jars you fill with your hands, debt is a purple fog you can watch creep across the grass, and a scam is a smiling blob with an asterisk. Each of the ten seasons teaches exactly one idea — budgeting, needs vs wants, emergency fund, good vs bad interest, scams, compound growth, insurance, diversification, delayed gratification, planning for a goal — through a mechanic the player feels first and reads about second, in two sentences, on a Ledger Review that scores behaviour instead of quiz answers.

## 4. Dev‑log / devlog post seed (optional, itch "Devlog")
Title: *"The spreadsheet is the island"* — 300 words on why debt is a fog, how the 4‑jar slider was tuned so a *sensible* player wins at season 10 (17/20 seeds) and a *borrow‑everything* player loses by season 3–5 (`docs/balance.md`), and the 150‑draw‑call phone budget (`docs/PERF.md`).

## 5. Screenshot shot list (6 × 1280 × 720 PNG) — also the storyboard anchor for 13B
Camera is the game's own ¾ follow camera (offset 0,13,10 · fov 38). "Zoom" = `game.camera.zoom` (0.6 close … 1.6 far); set in the console via `window.game.camera.zoom = …` or use the `?debug` overlay. Use `index.html?autoplay&season=30` for fast seasons; `?endless` for a fully built island. Hide the debug stats before shooting (no `?debug`). Shots go to `LUMEN/screenshots/13A_itch/`.

| # | File | Where / when | Camera | Must be visible | Caption (itch) |
|---|---|---|---|---|---|
| 1 | `01_pier_arrival.png` | Season 1, first boat of Glimmers at the **pier** (Pip standing on the pier end, −z edge of zone 0) | zoom 0.8, Pip lower‑third | Pip, pier, boat, 4–6 Glimmers walking up, HUD ribbon (Spark · Season 1 · fog bar 40 %), Debt Fog purple on the far shore | *Glimmers arrive by boat. Every one of them has Spark to spend — if you have something they need.* |
| 2 | `02_build_ghost.png` | Build menu open, Bakery ghost snapped green on a free tile next to the Fruit Stand | zoom 0.7 | Build tray (cards w/ cost + footprint), green ghost + grid, hammer in Pip's hand | *Build with the hammer. Needs‑stalls first: bread sells while the Toy Box idles.* |
| 3 | `03_jars_apply.png` | Jar panel open mid‑season, sliders set Spend 30 / Save 40 / Invest 15 / Protect 15, APPLY highlighted | zoom 1.0, jars panel left | 4 jar sliders summing to 100 %, physical jars on the island filling (1D decor), coin flying to Pip | *Four jars. One hundred percent. Decide before the Spark lands.* |
| 4 | `04_debt_fog.png` | Season 3–4 with debt > 0, fog 0.55+ — the fog ring over the East Shore edge, Baron Gilt strutting at the fog line, red vignette pulse just fired (`eco:fog` tick) | zoom 1.2, tilt toward the fog | Fog blobs covering grass + a stall half‑swallowed, Baron, debt chip in HUD, "20 %/season" toast | *This is what 20 % compounding looks like. The Baron would like a word.* |
| 5 | `05_too_good_deal.png` | Scam pitch: Fog Collector's "Zero‑Interest\* Loan" dialogue with ACCEPT / REFUSE choices, Ledger Flash (R) "TRUE COST:" pop in frame | zoom 0.9 | Dialogue box w/ Collector portrait, asterisk in the title, two choice buttons, TRUE COST reveal | *Every Too‑Good Deal has a tell. Hurry, secrecy, "guaranteed" — and that asterisk.* |
| 6 | `06_ledger_lighthouse.png` | Season 10 win: Ledger Review ★★★ "Planning for a Goal" card over the island as the **Lighthouse** beam sweeps and the fog recedes (`fogRecede` Sequence, confetti) | zoom 1.4, lighthouse upper‑left | 3 stars, lesson card, lighthouse beam, confetti, fog ring shrinking, Baron handed a Save jar | *Ten seasons. Ten lessons. One lighthouse. Then: Endless.* |

Cover image = shot 1 re‑framed to 630 × 500 with the title logo (`ui/title.css` logo element) composited top‑left. GIF for the page (optional, ≤ 3 MB): 4 s loop of shot 3's coin flying into a jar.

## 6. Building the itch upload (`lumen-ledger-web.zip`)
```bash
cd /home/user/webapp/LUMEN/game
node tools/check.mjs --props --creatures --hero --abilities --economy --build --customers --ui --story --vfx --world --sandbox --game --save --audio   # ALL OK first
cd /home/user/webapp/LUMEN && rm -f lumen-ledger-web.zip && \
  zip -qr lumen-ledger-web.zip game -x 'game/tools/*' 'game/tests/*' 'game/docs/*' 'game/demo_*.html' '*/.DS_Store' && \
  python3 - <<'PY'
import zipfile,shutil,os
# itch wants index.html at the ZIP ROOT → re-root "game/" to "/"
src=zipfile.ZipFile('lumen-ledger-web.zip'); dst=zipfile.ZipFile('lumen-ledger-web.rooted.zip','w',zipfile.ZIP_DEFLATED)
for i in src.infolist():
    if i.filename.startswith('game/') and not i.is_dir(): dst.writestr(i.filename[5:], src.read(i))
src.close(); dst.close(); shutil.move('lumen-ledger-web.rooted.zip','lumen-ledger-web.zip')
print('ok', os.path.getsize('lumen-ledger-web.zip')//1024, 'KB')
PY
unzip -l lumen-ledger-web.zip | head -5   # first entries must be index.html, src/, ui/, vendor/, data/, audio/
```
Size budget: itch allows 1 GB per file but browser games load everything up front — the build is **~0.54 MB zipped / ~1.9 MB unzipped** (vendor/three.module.js is 1.3 MB of that, 72 files — verified 2026-10-19 with the recipe above). No `tools/`, `tests/`, `docs/` or demos in the upload. Everything is relative‑path (11B audit), so the itch CDN sub‑path works unchanged. After upload: open the itch page in an incognito window on a phone, tap once (audio unlock), play one season, check the console is clean.
