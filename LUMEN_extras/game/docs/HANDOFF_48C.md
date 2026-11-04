# HANDOFF 48C — Semi-transparent warnings, icon art, Glimmer blue (2026-11-04, CLOSED)

## Done
- [x] P1 icon pipeline re-run: `node tools/icons_png.mjs --size 64 --cols 12` → 127 PNGs + `ui/icons/sheet.png` (procedural art side by side → sheet → sliced PNGs). `hand.png`, `fastforward.png`, `point.png` exist.
- [x] P1 `ui/nudge.js`: 👆 → `point` icon, bubble = `fastforward` icon only (no words). Bob + tap-through kept.
- [x] P1 `ui/wave.js`/`wave.css`: ⚠ 🎩 🌫 ✓ ➤ → `warn`/`tophat`/`fog`/`check`/`arrow` icons; banner `.show` opacity .55, no pulse, pointer-events none; good kind also .55.
- [x] P1 Glimmer blue: `dialogue.js` `GLIMMER_COLORS` (copy of GLIMMER_INFO colours — glimmers.js imports Three) → `--sp` on the box; css `var(--sp, var(--blue))`.
- [x] P2 `--icons` asserts hand/fastforward PNGs > 200 B; `--ui` asserts GLIMMER_COLORS == GLIMMER_INFO. `node tools/check.mjs --icons --ui` → ALL OK.
- [x] P3 banner enters with a 0.2 s fade (no slide).
- [x] 48B-1 lighthouse always visible (PLAY_BUGS).

## Missing (for 48D / 48F)
- Emoji glyph sources still in `ui/touch.js` (⚔ ✋ 💨 🔨 button table — 48D deletes two, swaps two), `ui/build.js` ICONS/OFFER_ICONS tables + button labels (all pass through `iconize()` → drawn at render; the literals are only the map keys), `ui/hud.js` ⏩/➤ (iconize'd). No raw emoji reaches the screen; `--icons` gate proves it.
- PLAY_BUGS 48B-2 (Settings → Title / Restart season do nothing) still open.

## Next chat
`bash tools/next.sh` → 48D (delete Interact + Build touch buttons, proximity interact, tap-on-land opens the tray).
