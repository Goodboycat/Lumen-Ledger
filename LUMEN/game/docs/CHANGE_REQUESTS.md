# CHANGE REQUESTS against frozen Foundation files
Format: `- [chat id] file → what you need → your workaround`. Chat 10A applies these during integration.

- [1C] src/main.js / index.html → Island v1 placeholder trees/rocks are hidden by 1B's demo via `o.name === 'tree'`; Island v2 keeps
  the names `tree` / `rock` on the merged groups so that still works. 10A: pass `starterProps:false` and scatter 1B props instead.
- 2A: Foundation glimmer.js body uses G.sphere(0.42,10,8)+G.sphere(0.46,10,6) ≈ 600 tris; consider (8,6)/(8,5) for crowds (saves ~40%). 2A works around it with compactGlimmer() (draw calls, not tris).
- [2D] src/assets/creatures/glimmers.js (2A) → export `BUILD` (or accept a `registerBuilder(type, fn)`) so `makeGlimmerVariant('kid')` builds the 2D kit instead of the regular fallback → workaround: everyone uses `makeGlimmerAny(type)` from glimmers2.js (routes correctly for all 12).
