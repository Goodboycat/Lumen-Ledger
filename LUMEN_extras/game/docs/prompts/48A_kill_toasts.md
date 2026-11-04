# Chat 48A — Kill every top toast (deletion only)
Needs: 48Z      Blocked-by: —
Owned (only these files): game/ui/index.js · game/ui/toast.js (delete) · game/ui/toast.css (delete) · game/ui/reveal.js · game/src/systems/verbChain.js (one line) · game/tools/checks/quiet.mjs (or the `--quiet` block in tools/check.mjs) · docs/HANDOFF_48A.md
Read (max 6 credits): HANDOFF_48Z.md "Ship rules" + census row 1 → this → `grep -n "toast" game/ui/index.js game/ui/reveal.js game/src/systems/verbChain.js` and ±10 lines around each hit. Do NOT open Game.js: its 11 `bus.emit('ui:toast', …)` lines may STAY — with no listener they are no-ops (deleting them is 48H cleanup, optional).
Export: none. Removes: the `ui:toast` / `story:toast` listeners. `ui.toast` becomes `undefined` — every caller must use `ui.toast?.`.

## Build in THIS order. wip.sh after EVERY file. Ship whatever tier you reach at 60 credits.
### P1 — must ship (≈ 20 credits)
- `ui/index.js`: remove `import { mountToast }` and the `add('toast', …)` line (≈ line 45). `grep -rn "ui\.toast\|\.toast\." game/ui game/src game/index.html` → every remaining use becomes optional-chained (`ui.toast?.push`) or is deleted. Expected hits: reveal.js ×2 (delete those two pushes — the reveal already shows the widget), index.html maybe 0–1.
- `src/systems/verbChain.js` ≈ line 90: delete the `bus.emit('story:toast', { id: 'verb-later-…', text: 'Later, then.' … })` call (keep `return enter(V.step + 1)`).
- `git rm game/ui/toast.js game/ui/toast.css`; `grep -rn "toast.css\|toast.js" game/index.html game/ui` → remove the `<link>` / imports.
- Run `node tools/check.mjs --ui --verbs --quiet --story`; fix any assertion that expected `ui.toast` (make the test assert it is **absent**).
### P2 — should ship (≈ 10 credits)
- `--quiet` gate: add the assert "no element with class `ll-toast*` exists after mountUI + 20 s of simulated `ui:toast` spam" and "`story:toast` emits produce no DOM".
- `grep -rn "toast" LUMEN/game/README.md docs/ITCH_PAGE.md` → delete the sentences that describe toasts.
### P3 — nice to have
- Delete the 11 `ui:toast` emits in Game.js **only by grep-line** (`grep -n "'ui:toast'" game/src/Game.js`), one at a time, running `--game` after each. Stop at the first failure and leave the rest for 48H.

## Demo page: none — pure deletion; `node tools/check.mjs --quiet` is the proof.
## check.mjs section `--quiet` (additive, name it `48A NO TOASTS`)
- mountUI headless → `ui.toast === undefined` · emit `ui:toast` ×20 + `story:toast` ×5 → `document.querySelectorAll('[class*="toast"]').length === 0` · verbChain auto-advance (25 s) emits nothing on `story:toast`.
## Budgets: 0 new DOM nodes. Content rule: HANDOFF_48Z rule 3 (zero new sentences).
## Handoff `docs/HANDOFF_48A.md`: Done / Missing / list of the Game.js `ui:toast` lines left as dead emitters / Notes (≤ 15 lines). Then: README_pipeline Done row + strike 48A in "## Next".
