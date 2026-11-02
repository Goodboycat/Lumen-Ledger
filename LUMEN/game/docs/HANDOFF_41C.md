# HANDOFF 41C — Season 1 = 70 s and dense, Collector in S1 (MASTER_PLAN_V6 phase 41, 2026-11-02)
Two chats: P1 by chat A (axed mid-report), P2 + P3 + this handoff by chat B. All pushed.
## Done (P1 + P2 + P3)
- `economyData.js` BALANCE: `seasonCurve [70, 90, 110, 130, 150]`, `seasonSeconds:150` kept as fallback, `seasonScaleCosts:true`, `startDebt 260 → 300`.
- `economy.js`: pure `seasonSecondsFor(config, s)` + method; `seasonCostScale(s) = min(1, len/150)` applied to per-season upkeep + loan interest; `tick` divides by the current season's length; `eco:season` payload gains `seasonSeconds` (NEXT season). `config.seasonSecondsOverride` (set from `opts.seasonSeconds`) wins for tests / accelerated runs.
- `enemies.js`: `collectorS1` row via `rulesFor(e)` — hp 1, speed 1.6, reward 2 ✦, 2 s contact grace. `spawnWave(1)` → one Collector.
- `Game.js`: `SCHEDULER_MARKS` table at the top of `installScheduler` (ONE table — 43 edits only there); S1 wave at 0.55, S ≥ 2 at 0.70. `game:start` carries `seasonSeconds`.
- `ui/hud.js` (+5 lines, allowed) `setSeasonSeconds(sec)`: day bar width = 54 px × len/150, "70 s" chip shown on S1 only; wired to `game:start` + `eco:season`. `hud.css` chip style.
- `tests/economy.sim.mjs --seasons70`: per-season income/expenses/interest/net S1–S5, sensible, mean of seeds 1–5 (table pasted in `LUMEN_extras/game/docs/balance.md` § "Season length curve (41C)").
- `check.mjs --sandbox` additive 41C block: curve 70/90/150(S5)/150(S9), S1 wave ×1 hp 1 reward 2 at 38.5 s, S1 ends 70.0 s, `eco:season.seasonSeconds` 90, **P3** flat-150 v1 snapshot deserializes onto the curve (S3 → 110 s, next 130 s).
## Measured
- Bands (`--sweep`, 20 seeds) after 41C: sensible **win@10 ×20** (was ≈ 17/20 before) · borrow lose@3×7 lose@5×13 · hoarder lose@7–9 ×17 / open@12+ ×3. Bands hold (sensible wins, borrow & hoarder lose).
- S1 at 70 s (sensible mean): income 216, expenses 151, interest 23, net +43, ≈ 3.1 ✦/s. S5 at 150 s: income 499, net +423.
- `check.mjs --sandbox` 41C block ≈ 1 s.
## Missing
- No browser screenshot of the HUD chip (no Playwright in sandbox); verified by syntax + wiring only. Open `index.html?debug` once and eyeball the "70 s" chip next to the shorter day bar.
- `tut:collector` toast ("A Collector! Space to bonk.") depended on 41B's reduced set — 41B is STOPPED, so the existing tutorial/toast path is what fires (unverified text).
- `?debug` stats line does not yet print the season length (trivial: read `eco.seasonSecondsFor()` in the stats formatter).
## Suspected
- The sensible band got *easier* (20/20 vs 17/20): if 42A/42C add costs, keep an eye on hoarder "open@12+ ×3" — it may tip to a win; raise `startDebt` or drop `seasonScaleCosts` for interest first.
- Old saves taken mid-S1 at 150 s: day01 is a fraction so the remaining S1 shortens to 70 s × (1 − day01). Acceptable.
## Notes for the integrator
- 41D reads stars from `eco:season` — payload unchanged apart from the added `seasonSeconds`.
- 42A/42C rely on the S1 Collector existing (`enemy:wave` {season:1, count:1} at day01 0.55).
- 43 moves marks per season — edit `SCHEDULER_MARKS` in `Game.js` only.
- Hud: call `hud.setSeasonSeconds(n)` whenever a custom season length is used in demos.
