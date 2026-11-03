# Chat 44B — Wants are visible: want glyph on pickStall, noStall leave, Owl "nobody sells tea"
Needs: 44A (bark glyph classes, `cust:react`) · customers.js `PREFS` (line 45) + `_pickStall` (~224) · `cust:left` (325)      Blocked-by: 44A
Owned (only these files): src/systems/customers.js (`pickStall` want glyph + `noStall` result ≤ 20 lines), ui/bark.js + bark.css (`kind:'want'` icon bubble ≤ 12 lines, reuses ui iconize()), data/story.json (`barks.wants` 1 template "{who} want {what}. Nobody sells {what}." + 2 variants), ui/build.js (1 line: "wanted by: …" from PREFS in the stall detail), tools/gates/wants.mjs (new), tools/check.mjs (additive `--wants`)
Read (max 5 credits): START_HERE.md → HANDOFF_44Z.md → HANDOFF_44A.md "Notes" → this → customers.js `_pickStall` + `PREFS` → ui/build.js stall detail block
Export (API_CONTRACTS "Wants (44B)", ≤ 5 lines):
  `cust.wantOf(c)` → top PREFS stall id (ties → rng) · `cust:want {id, type, want, found}` on pickStall · bark `{kind:'want', icon:<stall id>, ok}` 1.2 s (S ≥ 2, 1 in 3 customers).
  No placed stall matches any PREFS key with weight ≥ 1 → `c.result = {noStall:true, want}` → `cust:left {result:'noStall', want}`; sad glyph.
  Owl bark once per `want` per season: `barks.wants` template with `{who}` = type plural (data map ≤ 12 entries in story.json) and `{what}` = stall name.
  `build.js` stall detail: "wanted by: elder, critic" (types whose PREFS weight ≥ 1.5 for that stall).

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 80 credits.
### P1 (≈ 18 credits): `wantOf` + `cust:want` + want bubble; `noStall` leave + `cust:left` reason; `--wants` asserts.
### P2 (≈ 10 credits): Owl bark once per want per season; build.js "wanted by" line.
### P3: hero shot of a want glyph → `screenshots/44B_want.png`.

## check.mjs `--wants` (sub-name `44B VISIBLE WANTS`)
- headless S3, only a `fruit` stall placed: spawn `elder` → `cust:want {want:'tea', found:false}` → leaves with `result:'noStall'`; spawn `saver` → `found:true` (fruit weight 2) → buys.
- Two elders in one season → exactly 1 Owl `wants` bark; next season → 1 again.
- `regular` (empty PREFS) never emits `noStall`. destroy → 0 leaked listeners. Full check ALL OK.

## Budgets: 0 draw calls (DOM). Bubble cap stays 2 (want bubbles yield to price bubbles — drop the want first).
## Handoff `docs/HANDOFF_44B.md`: Done / Missing / Measured / Notes for 44C (where PREFS weights are read so a season multiplier can be applied at read time).
