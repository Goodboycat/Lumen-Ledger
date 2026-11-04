# Lumen Ledger — itch.io page copy (Chat 13A)
*Paste-ready. Everything between the `▬▬` rules is page text; everything else is a note to whoever fills the itch form.*
*Jam: Zoud GameLab · theme **"Make FinLit Fun"** · submit by **2026‑11‑15**. Companion files: `docs/GDD.md` (Concept Doc), `docs/BUDGET.md` (Game Budget), 13B trailer (2‑min video).*

## 1. Form fields (itch.io → Edit game)
| Field | Value |
|---|---|
| Title | **Lumen Ledger** |
| Short description / tagline (≤ 120 chars) | **Make FinLit Fun: a cozy 3D market tycoon where every coin needs a jar — or the Debt Fog rolls in.** |
| Classification | Game · Educational |
| Kind of project | HTML (play in browser) |
| Release status | Prototype (jam build) |
| Pricing | No payments |
| Uploads | `lumen-ledger-web.zip` — zip of `LUMEN/game/` with `index.html` at the zip root (see §6). Tick **"This file will be played in the browser"**. |
| Embed | **Embed in page** · Viewport **1280 × 720** · ☑ Fullscreen button ON · ☑ Mobile friendly ON · ☐ Automatically start on page load · Orientation: Landscape (portrait also works) · Enable scrollbars **off** |
| Frame options | SharedArrayBuffer **off** (not needed), Click to launch **on** (audio unlock needs a gesture) |
| Genre | Simulation (also: Educational, Strategy) |
| Tags (≤ 10) | `finlit` `economy` `3d` `browser` `jam` `educational` `tycoon` `cozy` `low-poly` `singleplayer` |
| Inputs | Keyboard · Mouse · Touchscreen |
| Accessibility | Subtitles (all dialogue is text) · Configurable controls? no · Color‑blind friendly (icon + text on every jar/state) · Reduce‑motion setting · One‑button (touch) |
| Average session | About half an hour (10 seasons ≈ 25 min) |
| Languages | English |
| Multiplayer | No |
| Links | Source: https://github.com/Goodboycat/Lumen-Ledger · GDD: `docs/GDD.md` · Budget: `docs/BUDGET.md` |
| Community | Comments on |
| Cover image | 630 × 500 — `LUMEN_extras/game/docs/screenshots/45_ship/cover.png` (centre crop of `2_market.png`: Pip at the S3 market, HOT tea sign, Glimmers browsing). No new art. |
| Screenshots | 6 PNG 1280 × 720 — `LUMEN_extras/game/docs/screenshots/45_ship/` (see §5; shot by `tools/hero_shots.mjs --ship` from the real `index.html`) |
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
1. **Build** — press **B** or **tap the ground**: the tray opens with a green ghost on that tile; pick a stall, confirm. *Needs* stalls (Fruit, Bakery, Fish, Tea) sell volume; *wants* stalls (Flower Cart, Toy Box, Lantern Shop, Pottery, Cloth Weaver, Book Nook, Tool Smith) sell margin — but only when Glimmers have Spark left.
2. **Sell** — Glimmers queue, browse and pay. Coins fly to Pip. Price near the fair price keeps them happy; 1.4× and they stomp off angry.
3. **Split** — the four jars are **yours to place** (first tray tab, one of each, no cost); walk up to a jar to put 10 Spark in (hold to take it back out); do it before the season's income lands. Save ≥ 200 Spark is what pushes the fog back; Protect absorbs storm damage; Invest grows 8 % ± 4 %.
4. **Review** — at the season bell, read your Ledger, collect stars, tap CONTINUE. One lesson per season, ten seasons, one lighthouse.

### Controls
Three verbs — **move · attack · dash**; **tap the ground to build; walk up to things to use them** (jars, tills, Glimmers — no interact button). The only text that ever pops is a blue once-only tutor card; tap it or wait 8 s.

| Action | Keyboard | Touch |
|---|---|---|
| Move Pip | WASD / arrows | left‑side virtual joystick |
| Attack / confirm | Space · J · Enter | **A** button (drawn icon) |
| Dash | Shift | dash button (drawn icon) |
| Use (jar, till, sign, NPC) | walk up to it (E · F also work) | walk up to it |
| Build menu | B | tap empty ground |
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
- **Every season adds one new thing** (S45) — a fresh stall type, a new customer, a Baron trick or a weather turn. Ten seasons, ten novelties; nothing repeats.
- **Prices are readable at a glance** (S46) — every stall sign carries ♥ (a bargain) / ✓ (fair) / ✗ (too dear) plus a **HOT** or **COLD** demand glyph for the season. Watch the sign, not a spreadsheet.
- **Tills can be raided** (S47) — coins pile up on each stall's counter until you walk by and collect them. Fog Collectors seek the fullest till; bonk one while it is **CARRYING** to get the coins back.
- **Content** — family‑friendly: no gambling, no loot boxes, no magic, no dark‑fantasy creatures. The villain is a fog with a top hat.

### Credits
Made for the **Zoud GameLab** jam, theme *"Make FinLit Fun"* (Oct 15 – Nov 15 2026).
Design · code · art · writing: **Goodboycat** — built with the LUMEN chat pipeline (Genspark). Engine: **Three.js r160** (MIT, vendored in `vendor/three.module.js` — no CDN, works offline on itch). All 3D is procedural (no external models or textures). Audio: procedural synth fallback in‑engine; optional Ludo.ai SFX/music (see `docs/audio_prompts.md`). Fonts: system stack.
Thanks to the National Financial Wellbeing initiative for the theme, and to every Glimmer who overpaid for a lantern.

▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬▬

## 3. Theme statement (for the jam submission form "How does your game fit the theme?")
> *Make FinLit Fun* means the lesson has to be the toy. In Lumen Ledger money is never a number in a corner: Spark is a coin that flies to you, a budget is four jars you fill with your hands, debt is a purple fog you can watch creep across the grass, and a scam is a smiling blob with an asterisk. Each of the ten seasons teaches exactly one idea — budgeting, needs vs wants, emergency fund, good vs bad interest, scams, compound growth, insurance, diversification, delayed gratification, planning for a goal — through a mechanic the player feels first and reads about second, in two sentences, on a Ledger Review that scores behaviour instead of quiz answers.

## 4. Dev‑log post seed (itch "Devlog", optional — GIF‑free)
Title: *"The spreadsheet is the island"* — ~300 words. Open with why debt is a fog (you watch it creep; nobody reads a debt number), how the 4‑jar slider was tuned so a *sensible* player wins at season 10 (17/20 seeds) and a *borrow‑everything* player loses by season 3–5 (`LUMEN_extras/game/docs/balance.md`), and the 150‑draw‑call phone budget (`docs/PERF.md`). Then "what changed since the first playable" — five lines, one per phase, written for the player (sources: Game_Bible S44 / S46 / S47 "What the player sees"):

1. **Nothing stretches any more (S44).** At ×2/×3 speed and in Spark Storms, Pip and the Glimmers used to shoot up tall and sideways — a spring that diverged at low frame rates. Fixed at the integrator; the ×1 feel is unchanged.
2. **Every season adds one new thing (S45/S46).** S1 is the tutorial, S2 a storm warning, S3 the night market, S4 the Baron in person, S5 picky critics, S6 a double raid; S7–S10 rotate them and Endless keeps rotating. A one‑line "NEW: …" chip tells you what it is, once.
3. **Prices are a thing you read, not a panel you open (S47).** Every stall sign shows ♥ / ✓ / ✗ for how fair your price is and a HOT ▲ / COLD ▼ glyph for this season's demand; the Owl says it once at the bell. Change a price in the world: walk to the sign, E for +1, hold for −1.
4. **Customers react (S47).** Each Glimmer pops a ♥ / ✓ / ✗ with the price they paid or refused, carries a little icon of what they came for, and walks away sad if nobody sells it — so an idle Toy Box is a thing you see, not a stat you miss.
5. **Tills can be raided (S47).** Coins pile on each counter until you walk by and collect them. Fog Collectors seek the fullest till; a red RAID chip and an edge arrow point at them, and a bonk while one is CARRYING drops the coins back on the grass.

Close with the save note (v3 saves migrate from v1/v2; a mid‑season reload re‑enters the current novelty cleanly) and a link to the GDD.

## 5. Screenshot shot list — the 6 files that ship (1280 × 720 PNG, 1.0 – 3.2 MB total)
All six are shot from the real `index.html` (not a demo page) by `node tools/hero_shots.mjs --ship [n]` (Playwright, 1280 × 720, `?mute`, touch controls hidden, no debug overlay). The harness only calls `window.game` / `sb()` to force a scene; it adds no system (Ship rule 4). Files live in `LUMEN_extras/game/docs/screenshots/45_ship/`. Upload in this order — itch shows the first one largest.

| # | File | Scene forced | What is visible | Caption (paste into itch) |
|---|---|---|---|---|
| 1 | `1_title.png` | Title screen after boot (no `ui:start`) | Logo, NEW GAME / CONTINUE / SETTINGS buttons, island behind, version footer S47 | *Lumen Ledger — a cozy 3D market where every coin needs a jar.* |
| 2 | `2_market.png` | Season 3 (`eco.state.season = 3`, `eco:season`), ≥ 2 Glimmers settled at stalls, ≥ 1 price bark, zoom 0.8 | Pip among the stalls, hanging price signs with ♥ / ✓ / ✗, the **HOT** tea glyph, a Glimmer's ♥ price bubble, HUD ribbon (Spark · Season 3 · fog bar) | *Prices are read, not calculated: ♥ bargain, ✓ fair, ✗ too dear — and tea is HOT this season.* |
| 3 | `3_raid.png` | Season 2, `enemies.spawnWave(2, {raiders: 2, distinct: true})` after ~9 s of sales, waited for `carry` | Two different Fog Collectors, one CARRYING coins from a till, red **RAID** chip in the HUD, edge arrow toward the raider | *Tills fill up while you sell. Fog Collectors come for the fullest one — bonk the carrier to get your coins back.* |
| 4 | `4_jar.png` | Pip teleported ≤ 1.3 u from the **Protect** jar, zoom 0.65 | The four physical jars on the island, Protect jar tag (`.ll-jar-tag`) open with its % and purpose, Pip beside it | *Four jars on the grass — Spend, Save, Invest, Protect. Walk up to one to see what it is doing for you.* |
| 5 | `5_ledger.png` | `eco.endSeason()` → real season report → `ui.ledger.show(report)` (count‑up finished) | Ledger Review modal: income rows, jar split, stars, lesson card, CONTINUE | *Every season ends in a one‑tap Ledger: stars for how you earned, one lesson card, no quiz.* |
| 6 | `6_pier.png` | `interestOwed ≥ 6`, `debt ≥ 40`, enter `'pier'` state, countdown phase `wait` with ≥ 10 s left, zoom 0.7 | Baron Gilt waiting at the pier end, countdown chip, debt / interest chip in the HUD, Debt Fog purple on the far shore | *Interest is due at the pier. Baron Gilt waits — pay him, or watch the fog take a stall.* |

Cover = `cover.png`, a 630 × 500 `page.screenshot({clip})` of the same frame as shot 2 (x 325, y 110), centre‑weighted on the market. No new art, no logo composite (the title screen is shot 1). If a re‑shoot is ever needed: `cd LUMEN/game && bash tools/setup_browser.sh && node tools/hero_shots.mjs --ship` (≈ 6 screenshots, ~2 min). The older 13A storyboard (pier arrival / build ghost / jars apply / debt fog / too‑good deal / lighthouse) now lives only in git history and in the 13B trailer beat sheet.

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
Size budget: itch allows 1 GB per file but browser games load everything up front — the build is **~9.6 MB zipped / ~12 MB unzipped**, 305 files (music OGGs ≈ 6 MB, vendor/three.module.js 1.3 MB, ui/icons sheet 0.6 MB — re-measured S39, 2026-10-27, with `tools/itch_zip.sh`). No `tools/`, `tests/`, `docs/` or demos in the upload. Everything is relative‑path (11B audit), so the itch CDN sub‑path works unchanged. After upload: open the itch page in an incognito window on a phone, tap once (audio unlock), play one season, check the console is clean.
