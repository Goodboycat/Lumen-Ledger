// 10C — ONE mount for the whole UI (7A HUD/jars/build · 7B ledger/dialogue/toast · 7C title/pause/touch). DOM only, no Three.
//   import { mountUI } from './ui/index.js';
//   const ui = mountUI(root, { bus, stats: () => game.stats, input: game.input, catalog: PROP_CATALOG, spark: () => eco.state.spark,
//                              seasonsToWin: 10, hasSave: false, onOutline: setOutlineThickness, touch: true });
//   per frame: ui.update(dt)   (all panels are mounted with selfDrive:false so the game loop is the single clock)
//   ui.destroy()               (removes every panel + bus listener — used by restart / back-to-title)
// Order matters (7A/7B/7C notes): title first (owns the screen) → HUD → jars → build → ledger → dialogue → toast → pause → touch (last: auto-hides under modals).
// Ledger is mounted with autoOpen:false — 10C opens it on `story:review` (8B) so the story lines play BEFORE the review sheet.
import { mountHUD } from './hud.js';
import { mountJars } from './jars.js';
import { mountBuildMenu } from './build.js';
import { mountLedger } from './ledger.js';
import { mountDialogue } from './dialogue.js';
import { mountToast } from './toast.js';
import { mountTitle } from './title.js';
import { mountPause } from './pause.js';
import { mountTouch } from './touch.js';
import { mountSeasonInfo } from './seasons.js';
import { mountTutorial } from './tutorial.js';

export const UI_VERSION = 'S40';
export const UI_CSS = ['ui/base.css', 'ui/hud.css', 'ui/jars.css', 'ui/build.css', 'ui/ledger.css', 'ui/dialogue.css', 'ui/toast.css', 'ui/title.css', 'ui/pause.css', 'ui/touch.css', 'ui/seasons.css', 'ui/tutorial.css'];

/**
 * @param {HTMLElement} root  overlay root (#game-root). Panels append themselves; the canvas stays underneath.
 * @param {object} opts  { bus, stats?, input?, catalog?, spark?, seasonsToWin=10, hasSave=false, hasWon=false (S25: shows ∞ ENDLESS), titleChrome=false (S24), onOutline?, touch=true, title=true, pauseGame=true, version? }
 */
export function mountUI(root, opts = {}) {
  const bus = opts.bus; if (!bus) throw new Error('mountUI: opts.bus required');
  const seasonsToWin = opts.seasonsToWin || 10;
  const ui = { version: UI_VERSION, root, bus, panels: [] };
  const add = (name, panel) => { ui[name] = panel; ui.panels.push(panel); return panel; };

  if (opts.title !== false) add('title', mountTitle(root, { bus, hasSave: opts.hasSave || false, hasWon: opts.hasWon || false, chrome: !!opts.titleChrome, version: opts.version || 'jam build', autoShow: opts.autoShowTitle !== false, showOnLose: false }));   // 10C shows the title itself after the lose ledger (TRY AGAIN)
  add('hud', mountHUD(root, { bus, stats: opts.stats || null, seasonsToWin, selfDrive: false }));
  add('jars', mountJars(root, { bus, pct: opts.jarPct }));
  // 7A's own B hotkey is not modal-aware (it would open the tray under the title / dialogue / pause) → it is off and re-owned below, gated by ui.isModal().
  add('build', mountBuildMenu(root, { bus, catalog: opts.catalog || {}, spark: opts.spark || 0, categories: opts.categories || ['stall', 'decor', 'nature'], noHotkey: true, noEsc: true }));
  add('ledger', mountLedger(root, { bus, seasonsToWin, autoOpen: false, selfDrive: false }));
  add('dialogue', mountDialogue(root, { bus, pauseGame: opts.pauseGame !== false, selfDrive: false, cps: opts.cps }));
  add('toast', mountToast(root, { bus, max: 3 }));
  // S11: ONE Escape dispatcher. Panels no longer listen for Escape themselves (hotkey:false / noEsc) — a single capture-phase window
  // listener walks a priority stack and the FIRST layer that owns the screen consumes the press:
  //   tutorial → season card → dialogue (swallowed: Enter/tap advance, Esc never opens pause over a line) → build (placing/demolish →
  //   cancel · tray open → close) → pause (toggle; never while title / ledger own the screen).
  // P34/P35 regressions (Esc opened the pause menu on top of the season card / dialogue) cannot come back: pause is the last layer.
  ui.escStack = () => [
    { id: 'tutorial', open: () => !!ui.tutorial?.isOpen, act: () => ui.tutorial.close('skip') },
    { id: 'seasons', open: () => !!ui.seasons?.isOpen, act: () => ui.seasons.close() },
    { id: 'dialogue', open: () => !!ui.dialogue?.isOpen, act: () => {} },
    { id: 'build', open: () => !!(ui.build?.isOpen || ui.build?.state?.placing || ui.build?.state?.demolish), act: () => { const st = ui.build.state; if (st.placing || st.demolish) ui.build.cancel(); else ui.build.close(); } },
    { id: 'pause', open: () => !(ui.title?.isOpen || ui.ledger?.isOpen), act: () => ui.pause.toggle() },
  ];
  /** S11: dispatch one Escape press through the stack. Returns the id of the layer that took it (null = nothing open). */
  ui.escape = () => { for (const L of ui.escStack()) { if (L.open()) { L.act(); bus.emit('ui:escape', { layer: L.id }); return L.id; } } return null; };
  if (typeof window !== 'undefined' && window.addEventListener) {
    const onEscCapture = (e) => {
      if (e.key !== 'Escape' || e.repeat) return;
      if (e.target && /INPUT|TEXTAREA/.test(e.target.tagName)) return;
      e.preventDefault?.(); e.stopImmediatePropagation?.(); e.stopPropagation?.();
      ui.escape();
    };
    window.addEventListener('keydown', onEscCapture, true); ui._offEsc = () => window.removeEventListener('keydown', onEscCapture, true);
  }
  add('pause', mountPause(root, { bus, onOutline: opts.onOutline, hotkey: false, canOpen: () => !(ui.title?.isOpen) && !(ui.ledger?.isOpen) && !(ui.tutorial?.isOpen) && !(ui.dialogue?.isOpen) && !(ui.seasons?.isOpen), storageKey: opts.storageKey }));
  // mobile bugfix: season info (HUD lesson tag + tap-the-pill card + new-season banner) — explains what a season is and what it teaches
  add('seasons', mountSeasonInfo(root, { bus, seasonsToWin, noEsc: true, lessons: opts.storyData?.lessons, seasons: opts.storyData?.seasons, isModal: () => !!(ui.title?.isOpen || ui.ledger?.isOpen || ui.dialogue?.isOpen || ui.pause?.isOpen || ui.tutorial?.isOpen) }));
  if (opts.touch !== false && opts.input) add('touch', mountTouch(root, opts.input, { bus, force: opts.forceTouch }));
  // guided tutorial: hand pointer + input lock, opens on the first PLAY (opts.autoTutorial — index.html turns it on; headless checks leave it off) and from the pause menu's 📖 TUTORIAL (mounted last = on top)
  if (opts.tutorial !== false) add('tutorial', mountTutorial(root, { bus, ui, input: opts.input, auto: !!opts.autoTutorial, storageKey: opts.tutorialKey }));

  /** One clock for every panel (count-ups, typewriter, fps readout). */
  ui.update = (dt) => { ui.hud.update(dt); ui.ledger.update(dt); ui.dialogue.update(dt); ui.tutorial?.update?.(dt); };
  /** True when any modal owns the screen (title / ledger / dialogue / pause / season card / tutorial) → the game loop should be paused. */
  ui.isModal = () => !!(ui.title?.isOpen || ui.ledger?.isOpen || ui.dialogue?.isOpen || ui.pause?.isOpen || ui.seasons?.isOpen || ui.tutorial?.isOpen);
  // B = build tray toggle, only when no modal owns the screen and not while placing (Esc cancels placing — 7A handles that one itself).
  let offKey = null;
  if (!opts.noBuildHotkey && typeof window !== 'undefined' && window.addEventListener) {
    const onKey = (e) => {
      if (e.repeat || (e.target && /INPUT|TEXTAREA/.test(e.target.tagName))) return;
      if ((e.key === 'b' || e.key === 'B') && !ui.isModal() && !ui.build.state?.placing) ui.build.toggle();
    };
    window.addEventListener('keydown', onKey); offKey = () => window.removeEventListener('keydown', onKey);
  }
  ui.destroy = () => { offKey?.(); offKey = null; ui._offEsc?.(); ui._offEsc = null; for (const p of ui.panels.slice().reverse()) { try { p.destroy?.(); } catch (_) { /* a panel without a parent is fine */ } } ui.panels.length = 0; };
  return ui;
}

export default mountUI;
