# Chat 3B — Hero abilities set 2 (FinLit powers)
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) + 3A work (already in the folder) if available
Owned (only these files): game/src/anim/heroAbilities.js, game/demo_abilities.html
Read (API_CONTRACTS): §A + 3A makeMove pattern · §B Hero anims
Export: makeMove names coinMagnetDash, bubbleShield, growthStomp, ledgerFlash, haggleShout, fogSweep; `attachAbilities(hero)`

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- coinMagnetDash (collect income fast), bubbleShield (Emergency Fund absorbs one bad event: translucent sphere scale outBack), growthStomp (compound-growth pulse: jump + land ring). VFX hooks `ctx.vfx.<name>?.()` must no-op gracefully.
### P2 — should ship (≈ 25 credits)
- ledgerFlash (reveal true cost of a scam: screen flash + pop text), haggleShout (megaphone pose + rings).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- fogSweep (push Debt Fog back: wide sweep + additive arc).

## Demo page `game/demo_abilities.html`
Keys Q/W/E/R/F/G; pop text explains the FinLit meaning of each.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_abilities.html --shots --close`.

## Handoff `docs/HANDOFF_3B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
