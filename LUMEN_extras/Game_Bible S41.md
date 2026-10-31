# LUMEN — Lumen Ledger · Game Bible S41 (2026-10-31)

Previous: `Game_Bible S40.md` (everything there still applies; this file only lists what S41 changed).
Version strings: `GAME_VERSION = 'S41'` (src/Game.js) · `UI_VERSION = 'S41'` (ui/index.js) → shown in the title-menu footer.

## S41 — playtest readability pass (chat 15, IDs 15-0 … 15G)

Source: a 25-minute phone playtest by a new player (Oct 31). Every item below answers one observed confusion.

| ID | Observation | Change | Files |
|---|---|---|---|
| 15-0 | "what is calls?" (1:33) | fps · calls · dpr pill removed from the HUD; it only exists with `?debug` or F3 (tiny bottom-left line) | `index.html` |
| 15A | HUD overwhelmed a tutorial skipper | **Progressive HUD** — jars start collapsed on a new game; widgets reveal in stages jars → fog → rep → speed → powers, one toast per widget, fallback timers so skippers still meet everything | `ui/reveal.js` (new), `ui/hud.js`, `ui/index.js` |
| 15B | Toasts and dialogue talked over each other | **One text channel** — toasts held while a dialogue is open, released 350 ms apart afterwards; phones/touch show one toast at a time; dialogue is tap-to-complete, then tap-to-continue (hint shown, tap anywhere on the layer) | `ui/toast.js`, `ui/dialogue.js` |
| 15C | Tapped cards they could not afford | Unaffordable cards (stalls, decor, crew offers) say so *before* the tap: 🔒 glyph + cost pill reads "need N more" (shortfall), card greyed/desaturated. Owned stalls keep the normal pill | `ui/build.js`, `ui/build.css` |
| 15D | Did not notice the Collector wave | `ui/wave.js` (new): red ribbon banner (Baron purple accents) when a wave starts + **edge arrows** that project off-screen enemies through the live camera, scaled by distance; hidden under modals; the old toast is reduced to the fight hint | `ui/wave.js`, `index.html` |
| 15E | Walked through stalls | Props are **solid** for Pip: `HeroController.deps.isSolid = BuildSystem.occupied` (stalls / decor / nature / plaza scenery, not ghosts or lifted props), wall-slide on diagonal block, body margin .24; `landReach` / `recoverToLand` treat solid cells as non-standable (Pip steps out if a stall is built on him) | `src/Game.js`, `src/systems/hero.js` |
| 15F | "why did my debt go up?" | **Debt clarity** — the season report's interest is its own toast "Debt grew +40 ✦ (20% interest) → 240 ✦. Pay it down early — interest compounds." with a tappable **Pay** action (emits `ui:repay {source:'hud'}`, same as the HUD button). A *new story game* also gets one intro toast explaining the inherited debt + Baron's rate (not on continue / endless). `game:start` now carries `resumed`, `debt`, `loanRate` | `ui/toast.js`, `src/Game.js` |
| 15G | — | versions S41, README section "Playtest readability pass (S41)", this file, `lumen-ledger-web.zip` | `src/Game.js`, `ui/index.js`, `LUMEN/game/README.md` |

### Bus events touched
- `game:start` payload: `{ mode, seasonsToWin, seasonSeconds, resumed, debt, loanRate }` (resumed/debt/loanRate new).
- `eco:season` LedgerReport is now also consumed by `ui/toast.js` (interest toast, id `interest`).
- Toast actions accept `payload` (`{ label, emit, payload }`) — used by the two 15F toasts.

### Gates
`node tools/check.mjs` → ALL OK ✅ after 15F (no new gate for 15F; the toast is UI-only).
Existing gates still cover 15C (`owned cost pill: yours`), 15E (hero collision) and 15D (wave UI module load).

## Next chat
- Watch the two 15F toasts in a real run: on phones only one toast shows at a time (15B) — if the interest toast is ever hidden behind the season card for too long, raise its `duration` or make the season card itself host the Pay button.
- 15A: consider persisting the reveal stage in the save so a continued game does not re-reveal widgets.
- Optional: delete `PixelRatioGovernor` + its check.mjs cases (dead code since S40).
