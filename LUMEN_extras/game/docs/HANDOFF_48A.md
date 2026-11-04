# HANDOFF 48A — Kill every top toast (2026-11-04)
**Done:** `ui/toast.js` + `ui/toast.css` deleted (git rm) · `ui/index.js` no longer imports/mounts toast, `UI_CSS` drops toast.css, `ui.toast === undefined` · `index.html` `<link toast.css>` removed · `ui/reveal.js` widget-reveal toast push deleted (widget appearing is the only signal) · `src/systems/verbChain.js:90` "Later, then." `story:toast` emit deleted (silent auto-advance) · `tools/check.mjs` 7B toast block → **`48A NO TOASTS`** (toast files absent · ui.toast undefined · ui:toast ×20 + story:toast ×5 + build/eco events → 0 `[class*=toast]` nodes) · `tests/verbs.test.mjs` idle-path asserts 0 `story:toast` · `game/README.md` toast sentences rewritten (4 spots).
**Gate:** `node tools/check.mjs --ui --verbs --quiet --story` green.
**Dead emitters left (no listener → no-op; 48H may delete by line, run `--game` after each):**
- `src/Game.js` `'ui:toast'` at lines 693, 1013, 1042, 1047, 1063, 1070 (+ 957/986/991/996 if they contain `ui:toast` past col 120 — re-grep).
- `src/Game.js:1275` + `src/systems/story.js:187` `story:toast` (tutorial toast emits; `toastsFired` still tracked for save compatibility — keep the state, 48F may reuse the trigger list for tutor cards).
- `src/core/Audio.js:47` `'story:toast'` sfx map entry (harmless; delete with the emitters).
**Missing:** P3 Game.js emitter deletion skipped by design (prompt: optional, 48H).
**Notes:** check.mjs "Unexpected token export" = a missing closing `}` from a `//` comment on a one-line `if {}`; use `/* */` on single-line blocks. `game/` has no package.json on purpose (tools/package.json carries `type:module`).
