# Screenshots — visual reference for every chat (look here before building anything)

## reference/ — what we are aiming at and what the jam wants
| File | What it is | Why it matters |
|---|---|---|
| `xp_hero_gameplay.png` | XP Hero (Supercent) actual gameplay: top-down ¾ camera, chunky toon grass, orange hero, blue blob crowd, small HUD ribbon top-center | THE look: palette, camera angle, blob density, outline weight, VFX ring under the hero |
| `xp_hero_store_page.png` | XP Hero store page / key art: orange hero, cape, exaggerated pose, stylized toy-like props | Character proportion (big head, stubby limbs), toy-like finish, cheerful key-art pose for our itch page |
| `jam_page_1_overview.png` | Zoud GameLab jam page: Oct 15 → Nov 15 2026, up to $140k prizes, Global Game Jam partnership | Deadline + audience (UAE National Financial Wellbeing initiative → family-friendly, no magic/demons) |
| `jam_page_2_submission_theme.png` | Submission requirements: Game + Concept Doc/GDD + **2-min video of actual gameplay** + Game Budget. Theme: **"Make FinLit Fun"** | Chat 8B (GDD), 13A (budget), 13B (video), title screen must show the theme |

## 0_foundation/ — Chat 0 output as it runs today (`index.html`)
`01_foundation_island.png` — island, Pip, Glimmers, sword demo. 379 draw calls (tiles/trees not instanced → Chat 1C Island v2).

## 1A_stalls/ — Chat 1A output (`demo_stalls.html`), verified 2026-10-17, 0 console errors
| File | Shows |
|---|---|
| `01_load_L1.png` | 12 stalls at Level 1 in a 4×3 grid, queue-slot discs, name labels, tri table |
| `02_key1_L1.png` / `03_key2_L2.png` / `04_key3_L3.png` | after pressing 1 / 2 / 3 — all stalls animate to that level (L2 = lanterns + bigger awning, L3 = flag + gold trim + glowing lantern) |
| `05_close_L3.png` | zoomed in (`--close`): Tea House, Book Nook, Spark Exchange at L3 next to Pip for scale |
| `06_prev_chat_close.png` | the previous chat's own close-up, kept for comparison |

## 3B_abilities/ — Chat 3B output (`demo_abilities.html`), verified 2026-10-17, 0 console errors, 135–148 draw calls
| File | What |
|---|---|
| `demo_abilities_0.png` | load: island, 3 Glimmers, red "Too-Good Deal" sign, purple Debt-Fog bank (24 discs, 1 InstancedMesh), 14 ground coins (1 IM), Pip |
| `demo_abilities_1.png` | after Q coinMagnetDash — gather phase, "+7" pop (7 coins collected along the 4 u dash) |
| `demo_abilities_2.png` / `_3.png` | after W bubbleShield — hold phase with translucent bubble + "SAFE!", then burst with "Storm!" + "ABSORBED!" |
| `demo_abilities_4.png`–`_6.png` | R ledgerFlash reveal ("TRUE COST:" pop); E/F/G in the smoke run landed while bubbleShield was still busy → blocked (by design) |
| `demo_abilities_close.png` | zoomed in (`--close`) |

## How to add yours
`node tools/smoke.mjs demo_<id>.html --keys 1,2,3 --shots --close` → copy `tools/shots/*.png` to
`docs/screenshots/<ID>_<name>/` with numbered names → they are included by `bash tools/pack.sh <ID>`.
