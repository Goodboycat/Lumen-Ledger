# HANDOFF 44B — Visible wants: want glyph on pickStall, noStall leave, Owl "nobody sells tea" (2026-11-03, CLOSED, P1 + P2)

## Done
- `src/systems/customers.js` — `wantOf(c)` (line ~241): top `PREFS[c.type]` weight, ties → rng, `null` for empty PREFS (regular). `_want(c)` (~247) runs once per visit from the pickStall step (~299, `c.wanted` flag): emits `cust:want {id, type, want, found}`; from **S ≥ 2** shows the want bubble for 1 in 3 customers (always when `!found`). When no placed stall matches any PREFS key with weight ≥ 1 → `c.result = {noStall:true, want, type}`, `totals.noStall++`, sad `_react(c,'sad','noStall')`, customer leaves; `cust:left` (~354) now carries `{result, want, noStall}`.
- Owl `_owlWant(want, type)` (~259): once per `want` per season (`_wantBarked` Set, reset when `this.season` changes, line ~142). Template from `story.json barks.wants[3]` (`{who}` = `barks.wantsWho[type]`, `{what}` = stall kind) → `story:bark {speaker:'owl', kind:'wants', want, text, ttl:3}`. `Game.js` passes `story` as a customers dep (1 line).
- `ui/bark.js` `kind:'want'` branch (~28–34): icon-only bubble (`stall_<kind>` → drawn icon via icons.js, no emoji), `.ll-bark.want.ok|.no`, ttl 1.2 s, `aria-label`. Cap stays 2 — want bubbles are evicted **first** (yield to price/story bubbles). `ui/bark.css` +7 lines (ok green / no red).
- `ui/build.js` (~172/179): stall detail `wanted by: elder, critic` = types whose PREFS weight ≥ 1.5 for that stall kind (imports `PREFS`).
- `data/story.json`: `barks.wants` ×3 (≤ 60 chars), `barks.wantsWho` type → plural map (12 entries).
- `tools/gates/wants.mjs` "44B VISIBLE WANTS" wired into `check.mjs --wants`; full `node tools/check.mjs` **ALL OK**.

## Missing
- P3 hero shot (`screenshots/44B_want.png`) not taken — no browser session this ID (headless gate only). 44D close takes it.
- Touch/mobile: nothing new to verify (DOM bubble only).
- `GAME_VERSION` still `'S46'` (bumps at 44D close).

## Measured (gate output)
- S3, only a `fruit` stall: elder → `cust:want {want:'tea', found:false}` → want bubble `stall_tea` ✗ → `cust:left {result:'noStall'}`; saver → `found:true` (fruit weight 2) → buys; regular → no `cust:want`, never `noStall`.
- Two elders in one season → exactly 1 Owl "Elders want tea. Nobody sells tea."; S4 → Owl again (1). 4 `cust:want` total, 0 leaked listeners after destroy.
- Diff since 44A close: 8 files, +210 / −16 (customers.js +36, bark.js +16, bark.css +7, build.js 4, story.json +69, wants.mjs 87 new, check.mjs +5, Game.js 1). 0 draw calls (DOM only).

## Suspected
- `_want` runs when the customer first picks a stall; a stall placed *while* the customer is walking is not re-checked (they already left sad). Acceptable — the next spawn finds it.
- `wantedBy` in build.js uses the raw PREFS table; once 44C multiplies PREFS by a season `demand`, the "wanted by" line will not reflect the season unless 44C routes it through the same multiplier.

## Notes for 44C (season demand)
- **PREFS is read in exactly 3 places** in customers.js: `_pickStall` (~227, `PREFS[c.type]`), `wantOf` (~242) and `_want` (~249). Wrap them with ONE helper `prefWeight(type, kind)` = `PREFS[type][kind] * (season demand[kind] ?? 1)` so the multiplier applies at read time (pickStall choice, want glyph and noStall threshold all shift together). build.js `wantedBy` (~172) is the 4th reader — import the same helper.
- `fair` price × demand: `_settle` computes the ratio from the stall's fair price; after changing `fair` on `eco:season`, call `sb.signTint(id)` for every stall (44A Suspected) so tints don't go stale.
- HOT/COLD tag: `bark.js` already has an icon-only bubble path (`kind:'want'`); a HOT sign tag should go in the build panel / sign tint, not as another bubble kind (cap 2 is tight).
- `cust:want.found` is the cheapest hook for a 44D funnel column "wants unmet %" (`totals.noStall / totals.spawned`).
