# LUMEN LEDGER — Game Bible, version **S34** (2026-10-27)

S34 was the **fix pass for the S33 beta report (P66–P83)**. The code landed in commits `2cfd2aa` and `ff0b1b1`
("S34: fix P66–P83 …") but the chat was cut before this report, the PLAY_BUGS statuses and the title-menu version
were written. S35 (this file's sibling) closes that gap: PLAY_BUGS entries P66–P83 now read `FIXED (S34)`, and the
footer version jumps S33 → S35 (S34 was never shown in a build).

## 1. What S34 fixed (files)
| File | Fixes |
|---|---|
| `src/systems/enemies.js` | P66 VillainAnimator gets `canStand` (land + not occupied), Baron `knockPower: 0`, Collectors no longer double-knocked; shore slide moves on X **and** Z (no water soft-lock). P67 reward coin snapped to nearest land cell. P71 no contact damage while `dazed`, `hitAt` set on stomp land. P72 shield shove condition fixed (bubble blocks Spark loss, not the push). P73 `occupied` passed from Game.js and checked in `_shove`/movement. P74 stomp shove uses jump `dir`. P76 dazed pose held for the whole daze. P77 sword-interrupt / `sendHome()` during minigun → `_cancelAttack` (no fake DODGED). P78 decals/puddles update before the empty-list early return. |
| `src/Game.js` | P68 `seatHelper()` zeroes `anim.knock/knockT`. P69 `updateHelperKnock()` clamps with `canStand`. P75 hero move `M.start` rebased when shoved. P79 upgrade disarms demolish mode. P81 idle helpers fan out on land + rebalance onto new stalls. P82 `pierSpawn` reserved in build cells. |
| `src/systems/customers.js` | P70 browse timer pauses while knocked. |
| `ui/build.js` | P80 Upgrade/Sell disabled while `busy`/`swapping`. |
| `src/assets/props/stalls.js` | P83 L2/L3 side pieces pulled inside the 2×2 footprint (`SX` 1.32 → 0.78). |

## 2. Verify
```bash
cd LUMEN/game && node tools/check.mjs --enemies --knockback --build --customers --game --props
```
