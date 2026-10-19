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

export const UI_VERSION = '10C';
export const UI_CSS = ['ui/base.css', 'ui/hud.css', 'ui/jars.css', 'ui/build.css', 'ui/ledger.css', 'ui/dialogue.css', 'ui/toast.css', 'ui/title.css', 'ui/pause.css', 'ui/touch.css'];

/**
 * @param {HTMLElement} root  overlay root (#game-root). Panels append themselves; the canvas stays underneath.
 * @param {object} opts  { bus, stats?, input?, catalog?, spark?, seasonsToWin=10, hasSave=false, onOutline?, touch=true, title=true, pauseGame=true, version? }
 */
export function mountUI(root, opts = {}) {
  const bus = opts.bus; if (!bus) throw new Error('mountUI: opts.bus required');
  const seasonsToWin = opts.seasonsToWin || 10;
  const ui = { version: UI_VERSION, root, bus, panels: [] };
  const add = (name, panel) => { ui[name] = panel; ui.panels.push(panel); return panel; };

  if (opts.title !== false) add('title', mountTitle(root, { bus, hasSave: opts.hasSave || false, version: opts.version || 'jam build', autoShow: opts.autoShowTitle !== false, showOnLose: false }));   // 10C shows the title itself after the lose ledger (TRY AGAIN)
  add('hud', mountHUD(root, { bus, stats: opts.stats || null, seasonsToWin, selfDrive: false }));
  add('jars', mountJars(root, { bus, pct: opts.jarPct }));
  add('build', mountBuildMenu(root, { bus, catalog: opts.catalog || {}, spark: opts.spark || 0, categories: opts.categories || ['stall', 'decor', 'nature'], noHotkey: !!opts.noBuildHotkey }));
  add('ledger', mountLedger(root, { bus, seasonsToWin, autoOpen: false, selfDrive: false }));
  add('dialogue', mountDialogue(root, { bus, pauseGame: opts.pauseGame !== false, selfDrive: false, cps: opts.cps }));
  add('toast', mountToast(root, { bus, max: 3 }));
  add('pause', mountPause(root, { bus, onOutline: opts.onOutline, canOpen: () => !(ui.title?.isOpen) && !(ui.ledger?.isOpen), storageKey: opts.storageKey }));
  if (opts.touch !== false && opts.input) add('touch', mountTouch(root, opts.input, { bus, force: opts.forceTouch }));

  /** One clock for every panel (count-ups, typewriter, fps readout). */
  ui.update = (dt) => { ui.hud.update(dt); ui.ledger.update(dt); ui.dialogue.update(dt); };
  /** True when any modal owns the screen (title / ledger / dialogue / pause) → the game loop should be paused. */
  ui.isModal = () => !!(ui.title?.isOpen || ui.ledger?.isOpen || ui.dialogue?.isOpen || ui.pause?.isOpen);
  ui.destroy = () => { for (const p of ui.panels.slice().reverse()) { try { p.destroy?.(); } catch (_) { /* a panel without a parent is fine */ } } ui.panels.length = 0; };
  return ui;
}

export default mountUI;
