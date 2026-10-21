# MASTER PLAN v3.2 — Lumen Ledger (updated 2026-10-17 after 1C)

> ### ⚠️ CHAIN RULE v4 (2026-10-18) — supersedes every "one chat = one ID" / "post a summary" line below
> A chat ends the moment it posts a message with no tool call (credits left → 0). A chat therefore posts ONE message, at ~80 credits.
> IDs are picked by `bash tools/next.sh` (half-done axed ID first, else first row-less ID in README "Next"); closing an axed ID is
> iteration #1 of the loop, never a stop. Rule text: `docs/START_HERE.md` → CHAIN RULE v4; paste block: `docs/prompts/_TEMPLATE.md`.

> ### ⚠️ DELIVERY POLICY CHANGE (v3.2) — supersedes every "zip / upload / link" line below
> Zips and upload links cost 3–6 credits each and repeatedly killed chats before their final message.
> **From now on no chat zips or uploads anything.** All work is written straight into the single folder
> **`/home/user/webapp/LUMEN/`** (`game/` = the game, `screenshots/`, `archive/`, `README.md`). The user downloads
> that folder from the Genspark File Explorer and attaches `LUMEN_master_<date>.tar.gz` (or the folder) to the
> next chat. Chats end at **80 credits** with: `node tools/check.mjs` → `docs/HANDOFF_<ID>.md` → README "Done"
> table → 5-line chat summary. Browser QA at most once, no screenshot-tweak loops. See `docs/START_HERE.md`.
> Where the text below says "zip / pack / upload / link", read "write the files to the LUMEN folder".
>
> **Status:** 0 ✅ · 0B ✅ · 1A ✅ · 1B ✅ · 1C ✅ · **2A ✅ (this update)** · next: 1D, 2B, 2C, 2D, 3A, 3B, 4A, 4B, 5, 6A, 7A, 7B, 7C, 8A, 8B, 9A, 9B (all independent).


This is the ONLY current plan. `_archive_MASTER_PLAN_v2.md` / `_v3.md` are history.
State on 2026-10-17: **Chat 0 (Foundation) ✅ · 0B (docs) ✅ · 1A (12 stalls) ✅ verified in this zip.**

---------------------------------------------------------------------------------------------------
## 1. Why chats keep "axing" (dying before they upload) — the real root causes

Two chats in a row (1A, then 1A-fix) ran out of credits before giving you a zip, even though the code
was ~90 % done both times. I re-ran everything in a fresh sandbox: **the 1A code was already correct**
(0 console errors, 12 stalls × 3 levels, 341–453 draw calls incl. the un-instanced Foundation island).
So the work was never the problem. The *process* was:

| # | Root cause | Evidence | Fix in v3.1 |
|---|---|---|---|
| 1 | **Visual QA is the credit sink.** Each "open page → screenshot → look → tweak → repeat" loop costs 3–6 credits. Both chats did 10+ loops. | pwtest/ folder had 9 screenshots + 5 hand-written Playwright scripts | Browser QA is allowed **once**, at the end, with `tools/smoke.mjs`. Everything else uses `tools/check.mjs` (Node only, no browser, ~0.2 credits). |
| 2 | **Installing a browser costs 5–10 credits** and often fails (missing libatk/libgbm → the chat then debugs apt instead of the game). | 1A-fix hit the same "Host system is missing dependencies" wall I hit here | `tools/setup_browser.sh` does it in one command, and the prompt says: *if it fails once, skip browser QA entirely and ship*. |
| 3 | **The zip was the LAST step**, so when credits ran out there was nothing to download. | you had to `tar` the sandbox yourself twice | **Zip FIRST, work SECOND.** Rule 2 is now: produce `tools/pack.sh` output at credit 10 (empty skeleton), 35, 60 and 75. The upload link is the deliverable; the code is the bonus. |
| 4 | **Long pasted prompts** (the whole original brief + plan ≈ 4–6 credits of reading) + reading other chats' prompt files. | 1A read every prompt in docs/prompts | 10-line launch message (see `_TEMPLATE.md`). Prompt files are per-chat and say *"do not read other prompt files"*. |
| 5 | **One suspected bug → endless "fixing" of working code.** 1A's `setLevel` dropped queued calls during a swap; the chat concluded the whole system was broken. | `ud.pending` queue was added by 1A-fix | Rule: *if a thing looks broken, write it in HANDOFF under "Suspected", zip, and move on.* The next chat (or you) decides. |
| 6 | **Impossible targets** ("≤ 300 tris" for a 3-level stall with goods) make the chat optimise instead of finish. | real stalls are 360–872 tris and look right | Budgets are now draw calls (≤ 10/prop incl. outline), not tris. |
| 7 | The task had **no priority order**, so breadth-first work meant nothing was "done" at any point. | 12 stalls all half-finished at the same time | Every prompt has P1 / P2 / P3. P1 is small enough to finish + zip in 30 credits. |

**One sentence:** a chat dies when the *proof* (screenshots) is more expensive than the *work*, and the
zip is scheduled after the proof. v3.1 moves the zip before the proof and makes the proof nearly free.

---------------------------------------------------------------------------------------------------
## 2. The v3.1 rules (also in `START_HERE.md`, which every chat reads first)

1. **Read ≤ 8 credits.** START_HERE → GAME_BIBLE → your own prompt file → only the Foundation files you import.
2. **Zip at 10 / 35 / 60 / 75 credits** with `bash tools/pack.sh <ID>` → upload → paste link. No exceptions.
   The 10-credit zip is just the skeleton (one empty module + demo page that loads). That is fine.
3. **Verify with Node, not a browser:** `node tools/check.mjs` after every file. Browser smoke test
   (`node tools/smoke.mjs demo_x.html --shots`) **once**, after the 60-credit zip, only if
   `bash tools/setup_browser.sh` succeeds on the first try. If it fails → skip, say so in HANDOFF, ship.
4. **Hard stop at 75 credits.** No features. HANDOFF → pack → upload → link → 5-line summary.
5. **Never edit frozen files** (`src/core`, `src/anim/{Easing,Tween,Sequencer,SquashStretch}`, `src/assets/geo.js`,
   `vendor/`). Need a change? one line in `docs/CHANGE_REQUESTS.md`, then work around it.
6. **Smallest working item end-to-end first** (one asset/move/screen that loads → renders → has a demo button),
   then copy the pattern. P1 → zip → P2 → zip → P3.
7. **Suspected bug ≠ stop.** Write it under "Suspected" in HANDOFF and continue with the next item.
8. Deliverable = zip containing ONLY your owned files + `demo_<id>.html` + `docs/HANDOFF_<ID>.md`
   + `docs/screenshots/<ID>_*/` (if any). The merge (you, 0 credits) = unzip over the master.

---------------------------------------------------------------------------------------------------
## 3. Tools that ship in this zip (`game/tools/`)

| Tool | Cost | What it does |
|---|---|---|
| `node tools/check.mjs [--props]` | ~0.2 cr | Imports every `src/**/*.js` in Node (no browser). Catches syntax errors, bad import paths, undefined exports. `--props` builds every `PROP_CATALOG` entry at L1/L2/L3 and prints tris + mesh counts. |
| `bash tools/pack.sh <ID> [files…]` | ~0.3 cr | Creates `lumen_<ID>_<date>.zip` with the owned files listed in the chat's prompt, the demo page, HANDOFF and screenshots. Then the chat uploads it. |
| `bash tools/setup_browser.sh` | 3–8 cr | One-shot: `npm i playwright` + `playwright install chromium` + apt libs (sudo). Prints OK / FAILED. |
| `node tools/smoke.mjs demo_x.html --keys 1,2,3 --shots --close` | ~2 cr | Headless browser: console errors, fps, draw calls, screenshots to `tools/shots/` (`--close` = zoomed-in shot). |

---------------------------------------------------------------------------------------------------
## 4. Chat list v3.1 (✅ done · status of everything else: not started)

**Phase A — done:** 0 Foundation ✅ · 0B docs ✅ · 1A stalls ✅ (`src/assets/props/{stalls,merge}.js`, `src/assets/props.js`, `demo_stalls.html`)
**0C Foundation QA** — still useful but LOW priority; run it only after Phase B (it reviews, it doesn't build).

**Phase B — all independent, launch now, any order (each needs only this master zip):**
| ID | Deliverable | Owned files |
|---|---|---|
| 1B | Nature props: trees, rocks, bushes, instanced flower field | `src/assets/props/nature.js`, `demo_nature.html` |
| 1D | Decor props: fences, lanterns, crates, jars, signs, benches, barrels | `src/assets/props/decor.js`, `demo_decor.html` |
| 1C | Landmarks (lighthouse, Pip's hut, fog towers, dock) + **Island v2** (instanced tiles — fixes the 379 draw calls) | `src/assets/props/landmarks.js`, `src/world/Island2.js`, `demo_landmarks.html` |
| 2A | Creature animator + 4 Glimmers (Saver, Spender, Impulse, Haggler) | `src/assets/creatures/{animator,glimmers}.js`, `demo_glimmers.html` |
| 3A | Hero moves: build, hammer, pick-up, carry, throw-coin, dash, celebrate, sad | `src/anim/heroAnims.js`, `demo_hero.html` |
| 4A | Economy core (pure JS, no Three): Spark, 4 jars, prices, interest, season ledger, win/lose | `src/systems/economy.js`, `test_economy.html` |
| 7A | HUD + build menu + jar sliders (DOM/CSS, EventBus) | `ui/hud.{js,css}`, `demo_hud.html` |
| 7B | Season Ledger screen, dialogue box, lesson card, toasts | `ui/ledger.{js,css}`, `ui/dialogue.{js,css}`, `demo_ledger.html` |
| 7C | Title screen, pause, settings, touch joystick + buttons | `ui/title.{js,css}`, `ui/touch.{js,css}`, `demo_title.html` |
| 8A | Story data: 10 seasons of dialogue + 10 FinLit lesson cards (JSON) | `data/story.json`, `docs/STORY_OUTLINE.md` |
| 9A | VFX pack 1: coin burst, confetti, spark trail, level-up ring, save sparkle | `src/vfx/pack1.js`, `demo_vfx.html` |

**Phase C — needs one Phase-B zip merged first:**
2D 8 more Glimmers (2A) · 2B helper creatures (2A) · 2C Baron Gilt + 3 Fog Collectors (2A) · 3B hero abilities (3A) ·
4B balance + events + scams (4A) · **5 build/placement (needs only 1A ✅ → can launch today)** · 6A customer AI (2A, 5) ·
6B crowd/perf (6A, 9A) · 8B story system + GDD (8A, 4A) · 9B Debt Fog shader (1C)

**Phase D — integration, strictly sequential, you merge between each:**
10A world (1A,1B,1C,1D) → 10B systems (4,5,6) → 10C UI + story + state machine (7,8) → 10D save/load + tutorial

**Phase E — ship:** 11A perf → 11B mobile QA + final zip → 12 audio (Ludo.ai prompt list + `core/Audio.js`) →
13A jam package (itch page, budget sheet) → 13B trailer shot list + demo mode → 14 Flutter APK (your other chat)

**Launch today (10 chats, all parallel): 1B, 1C, 1D, 2A, 3A, 4A, 7A, 8A, 9A, 5.**

---------------------------------------------------------------------------------------------------
## 5. Your routine per chat (0 credits for you)

1. Paste the 10-line block from `docs/prompts/_TEMPLATE.md`, attach the newest `lumen_master_*.zip`.
2. When a link arrives (at 10/35/60/75 credits) download it. **Keep the latest one.** If the chat dies, you still have the 60-credit zip.
3. Unzip over `game/` in the master folder (it only contains the chat's own files → nothing else is touched).
4. Optional: `cd game && node tools/check.mjs` (needs only Node). If it prints FAIL, send that line to the chat's "-fix" successor.
5. Re-zip the master as `lumen_master_YYYY-MM-DD.zip` → that is what the next chats get.
6. Dead chat? Use the "finish it" block in `_TEMPLATE.md`. Never restart from zero. Never ask it to "polish".

---------------------------------------------------------------------------------------------------
## 6. Timeline (Oct 17 → Nov 15)

- **Oct 17–21:** Phase B (10 chats) + 5. Merge as they land.
- **Oct 22–27:** Phase C (9 chats).
- **Oct 28–Nov 3:** 10A → 10B → 10C → 10D (one at a time; you merge + check between).
- **Nov 4–9:** 11A, 11B, 12, 13A, 13B, 14.
- **Nov 10–13:** buffer + submission (itch.io HTML5 zip, GDD, 2-min gameplay video, budget sheet). **Submit Nov 13.**

## 7. Jam submission checklist (from the jam page — see `docs/screenshots/reference/`)
- [ ] Playable HTML5 zip on itch.io (index.html at root, 1280×720, mobile OK)
- [ ] Concept Doc / GDD (Chat 8B) · [ ] 2-minute video of **actual gameplay** (13B) · [ ] Game Budget (13A)
- [ ] Theme "Make FinLit Fun" visible on title screen + lesson cards · [ ] No magic/demons/undead (Bible §2)
