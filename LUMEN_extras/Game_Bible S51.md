# LUMEN — Lumen Ledger · Game Bible S51 (2026-11-04)

Previous: `Game_Bible S48.md` (S49 Quiet / S50 Measure-fix had no bible — see `LUMEN/README.md`). This file lists only what **phase 48 "HUSH"** (chats 48Z–48H) changed for the player. No system was added (ship rule 4); the phase is *comfort by deletion v2*. Version strings `GAME_VERSION = 'S51'` · `UI_VERSION = 'S51'` → title footer `S51 · jam build`. Zip `bash tools/itch_zip.sh` → `/tmp/lumen-ledger-web.zip` **9.1 MB · 337 files · sha256 `c0d4c2b0454bf5799fd5a2f0300d16d89c00e8b7c74069902c20959bf32c2a85`**.

## What changed for the player
- **Nothing pops at the top of the screen any more.** Speed changes, demolish mode, "pay yourself first", "paid the Baron", "stall is max level", "that is part of the island", "moving X — drop it on green", "cannot stand there" — all gone. The world already shows each of these (sign tint, jar wobble, ghost colour, hop-back).
- **One bubble at a time, six seconds apart, never over Pip's head.** The 7-line walk-in is 2 lines; word barks fire once per run; a bubble with nothing to stand on is dropped instead of parked on the hero.
- **Warnings are see-through.** The wave banner sits at 55 % and fades; the speed nudge is a drawn hand/fast-forward icon with no sentence under it; Glimmer speakers are tinted per type in dialogue.
- **Two touch buttons fewer.** Only *attack* and *dash* are drawn. Walk up to a jar, till, sign or Glimmer to use it; tap empty ground and the build tray opens with the ghost already on that tile.
- **The jars are yours to place.** No four floating jars by the cottage at start: the first tray tab "Jars" holds Spend / Save / Protect / Invest (one each, free). The jar rows in the HUD stay hidden until you have built that jar.
- **The tutorial is curiosity, not a chip.** 16 blue cards (`data/tutor.json`) appear one at a time when you first touch a thing, once per profile, dismissed by tap / any key / 8 s. The verb chip, Skip button and "Later, then." are gone; idle steps complete silently.
- **Too Good Deals are three decisions, not one.** Each lesson scam is a depth-3 tree — look / walk → sign / ask / stall → accept / refuse — and the Owl names the tactic afterwards (hurry · everyone-does-it · tiny first yes · anchoring). Every path is ≤ 110 chars per line and ends in exactly one `eco:scamResult`.

## Text census — S50 → now
| Source (HANDOFF_48Z census) | S50 | Now (S51) |
|---|---|---|
| Top toasts (`ui:toast` ×11 Game.js, `story:toast` ×4 sites, reveal ×2) | `ui/toast.js` mounted | **deleted** — no file, no mount, 0 emitters, no Audio map row (48A + 48H sweep) |
| Speech bubbles over heads | ~27 emitters, walkIn 7 lines, hero-anchored fallback | ≤ 1 on screen, 6 s gap, walkIn 2, word barks once/run, hero anchor dropped (48B) |
| `jars:locked` "Locked till the ledger." bark on hero | every E press | **deleted** — jar wobbles (48B) |
| Verb-chain chip + Skip + "Later, then." | DOM chip | **deleted** → `tutor:hint` blue card (48F) |
| Speed nudge 👆 + "Touch here! … ⏩" | emoji + sentence | drawn icons only, no text (48C) |
| Wave banner "⚠ N DEBT COLLECTORS LANDED" | opaque | kept, 55 % opacity + fade + icons (48C) |
| HUD "NEW: …" chip, season lesson tag | kept | kept (not a top toast) |
| Demolish-mode toast (6 s + Stop) | toast | **deleted** → tutor card "careful with demolish" (48F) |
| ✋ Interact / 🔨 Build touch buttons | 4 buttons | 2 buttons: attack + dash; proximity interact + tap-on-land (48D) |
| Pre-placed jars ×4 | at start | 0 — 4 `jar_*` buildables, rows hidden until built (48E) |
| Scam pitch | 2 choices | 3 decisions, 4 named tactics (48G) |

## Known / open
- `check.mjs --customers` `wave FAIL → paid 8/20` and `edge-cases → did not pick a stall` are **pre-existing** (recorded in HANDOFF_48D, also red on 128dd07). All other flags green at S51. Fix candidate: 6A harness vs 47 pricing / 48E jar-free island — a post-jam chat.
- Not done from P3s: long-press a placed stall → tray on its upgrade card (48D) · jar ghost liquid/wobble (48E).
- Handoffs: `LUMEN_extras/game/docs/HANDOFF_48Z.md`, `HANDOFF_48A–48G.md` (48B in `LUMEN/game/docs/`), `LUMEN/game/docs/HANDOFF_48H.md`.
