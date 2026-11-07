# LUMEN — Lumen Ledger (Zoud GameLab jam, "Make FinLit Fun", due 2026-11-15)

**Play:** https://goodboycat.itch.io/lumen-ledger (itch.io, browser + phone) · locally: `cd LUMEN/game && python3 -m http.server 3000` → http://localhost:3000/ · jam build = `bash tools/itch_zip.sh` → `/tmp/lumen-ledger-web.zip`.

This folder holds **only the game and the jam documents**.
Dev material (screenshots, demos, chat prompts, handoffs, plans) was moved to `../LUMEN_extras/`
(same relative paths, e.g. `LUMEN_extras/game/tools/check.mjs`, so it can be copied back if you need it).

```
LUMEN/
  game/
    index.html        THE game — serve statically: cd game && python3 -m http.server 3000 → http://localhost:3000/
    src/ ui/ data/ audio/ vendor/   game code, UI (incl. ui/tutorial.js), story, sounds, Three.js r160 (MIT)
    docs/             GDD.md (concept doc) · BUDGET.md (game budget) · ITCH_PAGE.md · SUBMISSION_CHECKLIST.md
                      (dev notes GAME_BIBLE / balance / story_outline / PLAY_BUGS / SUGGESTIONS live in ../LUMEN_extras/game/docs/)
    README.md         how to play, controls, URL flags
```

> **PLAN NOTICE (2026-11-04):** Phase 48 "HUSH" is next — comfort by DELETION (kill toasts, bark diet, delete ✋/🔨 buttons, jars become buildables, blue once-only tutor cards, scam dialogue with 3 decisions). Plan + per-chat prompts: `../LUMEN_extras/game/docs/HANDOFF_48Z.md`, `prompts/48A…48H`. `bash game/tools/next.sh` prints the ID to do.
>
> **PLAN NOTICE (2026-11-02):** development now follows **`../LUMEN_extras/game/docs/MASTER_PLAN_V6.md`** ("One game, not two").
> Everything from update 17 onward in the old plan (regions/biomes/World v3, 13B, 14) is **stopped**. Next IDs: `40A 40B 41A–41D 42A–42D 43Z 44Z 45Z`
> (see `LUMEN_extras/README_pipeline.md` "## Next"; `game/tools/next.sh` prints the one to do).

## Placing fix (S62, 2026-11-07) — version shown in the title menu: `S62 · jam build`
User report: after placing a jar the game kept offering to place another one (red 'blocked' ghost). Now **placing any item (jar, decor, stall) ends placing mode at once** (`src/Game.js` `build:placed` -> `build.exit()`); the blue tutor card no longer covers the placing bar on phones (`body.ll-placing`), and the keyboard letters B / R are hidden on touch. Gate `node tools/check.mjs --jars1` 11/11 (T1.8), rigs `tools/play_s62.mjs`, `tools/play_s62b.mjs`. IDs S62-A..D in `game/docs/HANDOFF_S59.md`.

## Fun pass T2 — Curiosity guide (S54, 2026-11-06) — version shown in the title menu: `S54 · jam build`
Third FUN_PASS task (`game/docs/FUN_PASS.md` §4 T2 + §7.A). The tutorial is now a **guide**: `src/systems/curiosity.js` (registry, 5 Hz, pooled) + `curiosityWire.js` (jars, stalls, signs, tills, Collectors, Baron, stranger, crew, pier, zone gates) emit `curious {id, hint, why}` on **approach**, **linger** (≥ 1.2 s, still), **tap** from any distance, and **hold ≥ 350 ms** (`Input.onHold`; card only, no game action). `ui/tutor.js` shows up to `maxShows` (3) per card until its `doneOn` event retires it, queues (max 2) instead of dropping, never during a modal, `tutorCounts` persisted (additive v4 field; old `tutorSeen` arrays migrate). HUD items carry `data-guide`; pause menu has a **GUIDE** codex (`ui/guideCodex.js`, "N / M met"). Real-browser fixes found by playing: a held press was dead because `holdT` never reset; `lg.selectTap` swallowed every real jar tap (a far jar tap now walks + deposits again). Gates: `--curiosity` 9/9 (+ unit `tests/curiosity.test.mjs`), browser rigs `tools/play_t2*.mjs`. Phone check of the codex / HUD taps is still a human step.

## Fun pass T1 — Jars (S53, 2026-11-06) — version shown in the title menu: `S53 · jam build`
Second FUN_PASS task (`game/docs/FUN_PASS.md` §4 T1). Jars now **unlock one by one** and **can be reached by tapping**: the build tray lists only Spend on a fresh game; Save unlocks on the first till sweep, Protect at the storm warning, Invest after the Season‑2 Ledger (`game/data/jars.json`, `src/systems/jarUnlocks.js`, bus `jars:unlocked`; NEW tag + Jars‑tab pulse, no modal). Tapping a jar that is far away starts `sb.startAutoWalk(jar)` (steers `hero.inputOverride`, ends on arrival → 10 ✦ deposit, stick input, pause, build mode, modal, jar removed, or 6 s). Save carries `jarsUnlocked` (additive; `SAVE_VERSION` stays 4; legacy = placed jars + season progress). The verb chain's last step unlocks Save itself and says "Build the Save jar: B → Jars" when none exists (no more silent 25 s wait). Also fixed: CONTINUE now re‑registers jars that `build.load()` places silently (saved jars were unusable after resume). Debug panel `unlock jar` is live (2 n/a buttons left: T4, T7). Gate `node tools/check.mjs --jars1` 10/10; `tests/save.test.mjs` + `tests/verbs.test.mjs` +5 tests.

## Fun pass T0 (S52, 2026-11-05) — version shown in the title menu: `S52 · jam build`
First FUN_PASS task (`game/docs/FUN_PASS.md` §4 T0), a **dev tool, not a player feature**: `index.html?debug=1` mounts a debug panel (`src/debug/panel.js`, `<aside id="ll-debug">`, ▣ tab top‑right, 44 px buttons) over `lg.debug` hooks installed in `Game.js` (`installDebugHooks`: grant · season · day · speed · stranger · wave · event · hire · clearTutor · resetSave · state · dump; crisis / unlockJar / stranger('fair') answer `n/a` until T7 / T1 / T4). Without the flag nothing is imported and no global exists. Gate `node tools/check.mjs --debug` 17/17 (no extra draw calls, HUD spark/season === `state()`). Plan + log: `game/docs/FUN_PASS.md` §4 T0 / §6. T0.2 (tap every button on a phone) is still a human check.

## Hush (48, S51, 2026-11-04) — version shown in the title menu: `S51 · jam build`
Comfort by **deletion**, no new system (ship rule 4). Gone: every top toast (`ui/toast.js` + 11 `ui:toast` + `story:toast` emitters, Audio map row), the hero's head bark + 7-line walk-in (1 word bubble, 6 s gap), the ✋ Interact / 🔨 Build touch buttons (walk up to things · tap the ground to build), the pre-placed floating jars (4 `jar_*` buildables in the first tray tab, rows hidden until built), the verb chip + Skip, nudge text (point / fast-forward icons only). Added — the one thing: **blue once-only tutor cards** (`data/tutor.json`, 16, one at a time, tap/key/8 s, per profile) and the 3 lesson scams as depth-3 **Too Good Deals** trees (look/walk → sign/ask/stall → accept/refuse, Owl names the tactic). Zip: `bash tools/itch_zip.sh` → **9.1 MB · 337 files · sha256 `c0d4c2b0454bf5799fd5a2f0300d16d89c00e8b7c74069902c20959bf32c2a85`**. Handoffs `LUMEN_extras/game/docs/HANDOFF_48Z.md` + `HANDOFF_48A–48H.md`.

## Measure-fix (47, S50, 2026-11-04) — version shown in the title menu: `S50 · jam build`
Two PLAY_BUGS rows closed, no new system (ship rule 4): telemetry `modalSeconds` now **counts the time a dialogue box is open** (the opening Owl dialogue pauses the game, so the old per-tick sampler never saw it — PLAY_BUGS 45B-2; `tests/telemetry.test.mjs` 6 pass), and `PERF.md` records the real-browser **167 draw calls @ S47 game zoom** with the **≤ 180** jam budget (45B-3). Remaining rows 45B-4/5 are harness notes only. Zip: `bash tools/itch_zip.sh` → **9.7 MB · 334 files · sha256 `8c42303f50b5394466814d5a9393cb121c30f345a4cbf373bb50569b058c53c0`**. Handoff `LUMEN_extras/game/docs/HANDOFF_47.md`.

## Quiet (46, S49, 2026-11-04) — version shown in the title menu: `S49 · jam build`
Comfort by deletion, no new system: the S1 tutorial verb chain now **waits for the Owl's opening dialogue** to close (it used to count its 25 s auto-advance while you were still reading — PLAY_BUGS 45B-1), the old 11-step overlay tutorial (`?oldtutorial`, pause-menu TUTORIAL) and the legacy `?sliders=1` jars panel are **removed**, and the itch page / GDD now describe the jars as they are (walk to them, press E). Zip: `bash tools/itch_zip.sh` → **9.7 MB · 334 files · sha256 `0bc0ed8398d179c254d18a0b51cc32be7ede1baca9f1246d1e989c6263cda00f`**. Handoffs `HANDOFF_46Z.md`, `HANDOFF_46D.md`.

## Ship v3 (45, S48, 2026-11-04) — version shown in the title menu: `S48 · jam build`
Phase 45 added **no system** (ship rule 4). It produced the itch page text + 6 ship screenshots (`LUMEN_extras/game/docs/screenshots/45_ship/`, `game/docs/ITCH_PAGE.md`), the first **real-browser** funnel row (Playwright Chromium, `FUNNEL_BASELINE.md` "## 45B browser") with 13 quality gates ticked in `SUBMISSION_CHECKLIST.md` §D and 5 non-blocking findings in `PLAY_BUGS.md`, and the release zip: `bash tools/itch_zip.sh` → **9.7 MB · 336 files · sha256 `f07679fa14035e58b4377551230cf4c93f94ecc00c17adff85a096eb97f90080`**, `index.html` at zip root, every fetch relative (works offline, no CDN). Trailer (13B), APK (14) and the telemetry endpoint are **skipped** for the jam. Report: `LUMEN_extras/Game_Bible S48.md` · handoffs `HANDOFF_45Z/45A/45B/45C.md`.

## Readable market (44, S47, 2026-11-03) — version shown in the title menu: `S47`
Prices, wants and seasonal demand are now *readable in the world*: every customer reacts with a ♥ / ✓ / ✗ glyph and the price (≤ 2 bubbles, never modal),
each stall's hanging sign tints green → white → amber → red with how fair your price is, and you change a price **at the sign** (E = +1, hold E = −1; the build panel
is the second way). Glimmers show a small stall icon for what they came for and leave sad (`noStall`) when nobody sells it — the Owl says so once per want per season.
From S2 each season has one **HOT ▲** (≥ ×1.3) and one **COLD ▼** (≤ ×0.7) good (`game/data/seasons.json` `demand`), shown as a cone glyph beside the sign and announced once.
Funnel unchanged (reach S2 100 %, Spark-through-hands 86.3 %) → **45Z ungated**; islands stay **NO** through the jam. Report: `LUMEN_extras/Game_Bible S47.md` · handoffs `HANDOFF_44Z–44D.md`.

## Season scripts (43, S46, 2026-11-03) — version shown in the title menu: `S46` (now `S47`)
Every season now follows a script (`game/data/seasons.json`, S1–S10 + endless rotation) and brings **one novelty**:
S2 storm warning · S3 night market (×1.3 spend, ×2 spill) · S4 the Baron pitches a "zero-interest" loan in person · S5 picky critics price-check your stalls ·
S6 **double raid** (two Collectors, two tills, staggered telegraphs) · S7–S10 rotate them · S11+ repeat S6–S10. A 4 s "NEW: …" chip names each novelty
the first time it appears; saves are v3 (active novelty resumes after load). Report: `LUMEN_extras/Game_Bible S46.md` · handoffs `HANDOFF_43Z–43D.md`.

## Release pass (S38, 2026-10-27) — version shown in the title menu: `S38`
Gathers the S35–S37 work: blade-tracking slash ribbon, cottage remodel, dialogue rewrite (150 Spark / 260 debt), drawn icons and faces,
**drag-to-move bought props** (S36), and **3 customer waves per season** for first-time players (S37). `GAME_VERSION` and `UI_VERSION` are now `S38`.
Web build: `lumen-ledger-web.zip` (`bash game/tools/itch_zip.sh`). Report: `LUMEN_extras/Game_Bible S44.md` (S44 = stretched-characters-at-speed-×3 bugfix; latest is S46 above).

## Knockback (S32, 2026-10-27) — version shown in the title menu: `S32`
Every sword target now **really moves**. `CreatureAnimator.hit(dir, power)` (`src/assets/creatures/animator.js`) applies a world-space slide to the
creature's root — `KNOCK_SPEED` 8 u/s decaying at `KNOCK_DECAY` 9/s (≈ 0.9 u travelled at power 1), a `KNOCK_STUN` 0.35 s window, an optional
`canStand(x,z)` clamp (land + no stall) and it turns the creature to face the attacker. **Glimmers**: `CustomerSystem` pauses its steering while
`anim.knocked`, re-paths afterwards, and browsing / queueing customers walk back to their slot — sales continue. **Hired helpers** are sword targets
too: they slide (own stall cell allowed — the seat is inside its footprint), flash red, pop an "ouch", emit `helper:hit`, then walk back
(1.6 u/s) to their remembered `seat` and resume work. Enemies keep their own `ENEMY_RULES.knockback`; the Baron never slides.
Headless gate: `node tools/check.mjs --knockback` (`tools/gates/knockback.mjs`) — it caught the first tuning (2.6 u/s ≈ 0.29 u, invisible)
and the helper clamp bug (seat inside own stall → shoves never moved it).

## Stalls & upgrades (S29–S31, 2026-10-26)
**One stall per type.** The old bug: deploying a second Fruit Stand after upgrading the first made the tray/level badge fall back to L1
(and L1 vs L2 looked the same). Now `BuildSystem.owned(id)` / `placeBlocker(id)` deny a duplicate deploy everywhere (tray card, `enter()`,
`place()`, `canPlace()` → ghost red, reason `duplicate`), and `load()` is tolerant: a legacy save with two of a kind keeps the highest level
and refunds the rest. The build tray shows a **level badge** (L1 / L2 / L3 ★) on every stall card; once placed the card reads
**✓ Deployed · Lx** and the button becomes ⬆ Upgrade. **Every stall type has its own L2 and L3 model** (`src/assets/props/stalls.js`
`LEVEL_EXTRAS`): e.g. Bakery L2 adds a clay oven, L3 a pretzel sign + flour sacks; Fish Market L2 an ice barrel, L3 an anchor + buoy;
Tool Smith L2 an anvil, L3 a forge chimney with embers. All 12 stay ≤ 900 tris at L3 (gate: `node tools/check.mjs --props` → STALL LEVELS).
Gallery of all 12 × 3 levels: `LUMEN_extras/game/demo_stall_levels.html`.

## Cinematics (S18, 2026-10-24)
Three short camera pieces (`game/src/vfx/cinematics.js`): the island is built behind the **title** and the camera orbits it; a fresh PLAY
walks Pip from the **pier to the plaza** (letterbox, SKIP / tap / Esc) before the tutorial and the Season-1 lines; on the win the camera
flies to the **lighthouse**, the lamp lights, then it returns to Pip for the finale. Reduce Motion turns each into a cut. `?nocine` disables them.

## Guided tutorial
Opens on the first PLAY (desktop and mobile). A hand 👆 points at the joystick (WASD on desktop), ⚔ Attack, ✋ Interact, 🔨 Build,
🚀 Deploy / ⬆ Upgrade, the 4 jars, the Debt Fog bar, the Season pill and ⏸ Pause. While it is open the game is paused and the
**only** things you can touch are the highlighted spot and the tutorial card. Keys, wheel and focus are locked too. All of it is removed when
the tutorial closes. You can replay it any time from the pause menu (📖 TUTORIAL). `?notutorial` skips it.
