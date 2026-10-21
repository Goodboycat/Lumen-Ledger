# Chat 7B — UI: Ledger Review + Dialogue + Toasts
Needs: LUMEN master folder (/home/user/webapp/LUMEN/game) (no Three)
Owned (only these files): game/ui/ledger.*, dialogue.*, toast.*, game/demo_ui_ledger.html
Read (API_CONTRACTS): §A EventBus · §B UI, Economy LedgerReport shape, Story events
Export: mountLedger(root), mountDialogue(root), mountToast(root)

## Build in THIS order. Write files to disk after P1 (no zip). Ship whatever tier you reach at 80 credits.
### P1 — must ship (≈ 30 credits)
- Ledger Review screen: income/expenses/interest rows count up, 0–3 stars pop in (Sequence-like CSS keyframes), lesson card, Continue → ui:continue.
### P2 — should ship (≈ 25 credits)
- Dialogue box with portrait slot + name + typewriter text + choices (ui:choice). Toast queue (top, auto-dismiss).
### P3 — nice to have (only if P1+P2 are tested and written to disk)
- Portrait placeholders as CSS blobs per speaker (Pip, Baron, Tally-Owl).

## Demo page `game/demo_ui_ledger.html`
Buttons fire fake reports/lines.
Set `window.game = game`; show `game.stats` (fps · draw calls). Verify: `node tools/check.mjs` after every file (no browser). Once, at the end, optional: `bash tools/setup_browser.sh` then `node tools/smoke.mjs demo_ui_ledger.html --shots --close`.

## Handoff `docs/HANDOFF_7B.md`: Done / Missing / Measured (tris, draw calls per item) / Notes for integrator.
