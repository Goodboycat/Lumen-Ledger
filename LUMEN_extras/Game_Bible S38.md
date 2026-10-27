# LUMEN LEDGER — Game Bible, version **S38** (2026-10-27)

S38 is a **release / consolidation pass**. S35, S36 and S37 landed code on `origin/main` but never wrote their Game Bible
or raised the title-menu version (the footer still read `S33` from `UI_VERSION`, `GAME_VERSION` said `S36`).
S38 sets both to **`S38`**, records what S35–S37 shipped, and packs the web build `lumen-ledger-web.zip`.

## 1. What is in the build since S34
| Ver | Commit | What |
|---|---|---|
| S35 | `766a4fa` | Slash VFX is now a blade-tracking ribbon (`SlashTrail` samples sword guard→tip, Catmull-Rom, age fade; `HeroController fire/track/release`), so the VFX stays in sync with the attack animation. |
| S35 | `7b8460a` | Cottage remodel: real triangular attic, roof slabs computed from pitch, ridge cap, chimney sunk into the slope, loft window (560 tris). |
| S35 | `d9bfb0a` | Dialogue rewrite: Pip is new to money words (innocent and a bit satirical). Opening numbers are 150 Spark / 260 debt. 51 Pip lines rewritten; story test 58/58. |
| S35 | `abb6976` | Icons: the last 5 emoji (⏩ ⏭ 🔍 🧹 📣) are now drawn, plus 25 face icons (Pip / Baron / Owl / Glimmer / Collector × 5 moods) baked to `ui/icons/*.png`. Dialogue portraits use them. |
| S36 | `8b5354c` | **Drag any bought prop** (stalls, decor, fences) to a new spot: lift 0.35 u, green/red pad, snaps back if blocked, R/✋ rotates. Helpers move to new seats and customers re-path on `build:moved`. Gate: `check.mjs --build`. |
| S37 | `53e5199` | First-player balance: 3 customer waves per season (`CUSTOMER_TRICKLE` day 0 / 0.34 / 0.67). A passive beginner's S1 income (~160) now beats expenses (74). Gate: `check.mjs --firstplayer`. |
| S38 | this | `GAME_VERSION` (`src/Game.js`) and `UI_VERSION` (`ui/index.js`) → `'S38'`. The title footer shows `S38`. |

## 2. Verify
```bash
cd LUMEN/game && node tools/check.mjs --game --build --firstplayer     # ALL OK at S38
bash tools/itch_zip.sh                                                # → lumen-ledger-web.zip (index.html at root)
```

## 3. Report for the next chat
- **Known open:** P23 (baked scenery can't be sold; deferred by design). No new P-bugs were logged after P83.
- **Not tested by hand yet:** S36 drag on touch devices (long-press vs. joystick conflicts); the S37 3-wave pacing over a full S1→S10 run
  (`node tests/economy.sim.mjs --sweep` was not re-run in S38); the full S6–S10 boss fight; endless mode.
- **Suggested next tasks (small, one per commit):** (1) beta pass on S36 drag + S37 balance, written to PLAY_BUGS P84+;
  (2) re-run the balance sweep and update `docs/GDD.md` with the 150 / 260 opening numbers;
  (3) `docs/SUBMISSION_CHECKLIST.md` dry run against the itch zip (jam due 2026-11-15).
- **Pipeline:** `bash LUMEN/game/tools/github.sh <TOKEN>` first. Bump **both** `GAME_VERSION` and `UI_VERSION`
  (the footer reads `UI_VERSION` via `mountUI`).
