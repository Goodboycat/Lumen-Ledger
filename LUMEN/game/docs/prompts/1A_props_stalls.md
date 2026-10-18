# ✅ DONE — see docs/HANDOFF_1A.md. Kept for reference.

# Chat 1A — Props: Stalls  (needs: LUMEN master folder)
Owned: game/src/assets/props/stalls.js, game/src/assets/props/merge.js, game/src/assets/props.js (catalog index), game/demo_stalls.html
Consume: A (geo.js, Toon.js, Outline.js, Island, Game) · Export: B "Props"
Build 12 stalls, each `makeStallX(opts) → Group`, ≤ 300 tris, pivot at base, footprint 2×2 tiles:
 fruit, bread, lantern, fish, flower, tool, cloth, pottery, toy, tea, book, sparkExchange (bank-like).
- Each stall: counter, awning (striped canopy), 2 posts, hanging sign (`userData.slots.sign`), goods on display.
- `group.userData.slots = { counter: Vector3, queue: [4 × Vector3 in a line in front], sign }`
- `group.userData.setLevel(1|2|3)`: L1 plain → L2 adds lanterns + bigger awning → L3 adds roof flag,
  gold trim, glowing lantern (flatMat). Level swap plays a Sequence: squash 120ms → pop-up outBack 260ms + dust.
- `PROP_CATALOG` entries with { make, footprint, category:'stall', cost (placeholder), tris }.
- `makeProp(id, opts)`.
Demo: all 12 stalls in a 4×3 grid on the island; keys 1/2/3 set level on all; show stats.
