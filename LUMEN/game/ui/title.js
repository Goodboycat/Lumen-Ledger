// LUMEN LEDGER — Title screen (Chat 7C). DOM only, no Three. Contract: §B UI → mountTitle(root).
//
//   import { mountTitle } from './ui/title.js';
//   const title = mountTitle(root, { bus, hasSave: () => !!localStorage.getItem('lumen.save'), version: 'v0.7', autoShow: true });
//   title.show() · title.hide() · title.isOpen · title.setHasSave(bool) · title.setBusy(bool) · title.destroy()
//
// What it does
//   • Full-screen sky panel: logo image (icon.png, lettered h1 kept hidden for a11y), the 3D island orbit behind it (S18) and
//     three chunky buttons: ▶ PLAY (new story run) · ⟳ CONTINUE (only when a save exists) · ∞ ENDLESS (free play — HIDDEN until the
//     player has won the story once: `opts.hasWon` fn / `title.setUnlocked({endless:true})`, persisted by Game.js under `lumen.unlocks`).
//     S24 (2026-10-24): no tagline / no sub-line / no footer by default — the menu is only the logo + buttons; the version sits as a
//     tiny corner tag. `opts.chrome: true` restores the old texts (tests). Button labels use the toon style of the logo (title.css).
//   • Emits `ui:title:open` / `ui:title:close` (touch pad hides itself while the title owns the screen) and
//     `ui:start { mode: 'story' | 'continue' | 'endless' }` when a button is pressed (10C starts the game, then calls title.hide()).
//     `title.hide()` is NOT automatic on press — the integrator decides (e.g. fade only after the world is built). `opts.hideOnStart: true` flips that.
//   • Keyboard: Enter / Space = PLAY (or CONTINUE when a save exists); E = endless; C = continue. Arrow ↑/↓ moves focus.
//   • Listens `eco:lose {reason}` + `ui:continue {outcome:'lose'}` → re-shows with "The Fog won this time…" sub-line (opts.showOnLose, default true).
//   • Pure display otherwise. Nothing is read from localStorage unless `opts.hasSave` is given.
//
// Motion table (CSS, title.css): panel fade 260 ms · logo letters 420 ms outBack stagger 60 ms · lantern swing 2.4 s loop · buttons slide-up
//   380 ms outBack stagger 90 ms (after 500 ms) · press: translateY 4px instant, release 140 ms outBack · hide: 320 ms fade + zoom 1.04.

import { iconize, icon } from './icons.js';
import { bus as defaultBus } from '../src/core/EventBus.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };

export const TITLE_MODES = {
  story:    { icon: '▶', label: 'PLAY',     sub: 'New story · 10 seasons', cls: 'play', key: 'Enter' },
  continue: { icon: '⟳', label: 'CONTINUE', sub: 'Resume your island',      cls: 'cont', key: 'c' },
  endless:  { icon: '∞', label: 'ENDLESS',  sub: 'Free play · no Baron',    cls: 'endless', key: 'e' },
};

export function mountTitle(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const hasSaveFn = typeof opts.hasSave === 'function' ? opts.hasSave : () => !!opts.hasSave;
  const version = opts.version || 'jam build';
  const hasWonFn = typeof opts.hasWon === 'function' ? opts.hasWon : () => !!opts.hasWon;
  const chrome = !!opts.chrome;   // S24: tagline / sub-line / footer are off by default (clean menu)

  // ---------------------------------------------------------------- DOM
  const wrap = el('section', 'll-title'); wrap.id = 'll-title'; wrap.setAttribute('aria-label', 'Title screen');
  const sky = el('div', 'll-title-sky'); const clouds = el('div', 'll-title-clouds'); clouds.append(el('i'), el('i'), el('i'));
  const sea = el('div', 'll-title-sea'); const isle = el('div', 'll-title-isle'); isle.append(el('i', 'll-title-tower'), el('b', 'll-title-beam'));
  sky.append(clouds, sea, isle);
  const card = el('div', 'll-title-card');
  // Icon swap: the lantern glyph is now the official logo image (icon.png); the lettered h1 stays in the DOM for a11y / tests but is visually hidden.
  const lantern = el('div', 'll-title-lantern'); const lanternImg = el('img', 'll-title-icon'); lanternImg.src = 'icon.png'; lanternImg.alt = 'Lumen Ledger'; lanternImg.decoding = 'async'; lantern.append(lanternImg);
  const logo = el('h1', 'll-title-logo'); logo.setAttribute('aria-label', 'Lumen Ledger');
  const words = ['LUMEN', 'LEDGER']; let li = 0;
  for (const w of words) { const row = el('span', 'll-title-word'); for (const ch of w) { const s = el('span', 'll-title-ch', ch); s.style.animationDelay = (li++ * 60) + 'ms'; row.append(s); } logo.append(row); }
  const tag = el('p', 'll-title-tag'); tag.append('Make ', el('b', null, 'FinLit'), ' Fun'); const sub = el('p', 'll-title-sub', '');
  if (!chrome) { tag.hidden = true; tag.style.display = 'none'; sub.hidden = true; sub.style.display = 'none'; }
  else sub.textContent = 'Relight the Lighthouse. Push back the Debt Fog.';
  const menu = el('nav', 'll-title-menu'); menu.setAttribute('aria-label', 'Main menu');
  const buttons = {}; let bi = 0;
  for (const [mode, def] of Object.entries(TITLE_MODES)) {
    const b = el('button', 'll-title-btn ' + def.cls); b.type = 'button'; b.dataset.mode = mode; b.style.animationDelay = (500 + bi++ * 90) + 'ms';
    b.append(el('span', 'll-title-btn-ico', def.icon), el('span', 'll-title-btn-lab', def.label), el('span', 'll-title-btn-sub', def.sub));
    menu.append(b); buttons[mode] = b;
  }
  const foot = el('footer', 'll-title-foot', chrome ? `<span>Zoud GameLab · “Make FinLit Fun”</span><span class="ll-title-ver">${version}</span>` : `<span class="ll-title-ver">${version}</span>`);
  if (!chrome) foot.classList.add('corner');
  card.append(lantern, logo, tag, sub, menu);
  wrap.append(sky, card, foot);
  root.appendChild(wrap);

  // ---------------------------------------------------------------- state
  const st = { open: false, busy: false, hasSave: false, endless: false, focus: 0, lastMode: null };
  const order = () => Object.keys(TITLE_MODES).filter((m) => (m !== 'continue' || st.hasSave) && (m !== 'endless' || st.endless));
  const setFocus = (i) => { const o = order(); st.focus = (i + o.length) % o.length; o.forEach((m, k) => buttons[m].classList.toggle('focus', k === st.focus)); };

  const start = (mode) => {
    if (!st.open || st.busy) return;
    if (mode === 'continue' && !st.hasSave) mode = 'story';
    if (mode === 'endless' && !st.endless) return;   // locked until the first story win
    st.lastMode = mode; buttons[mode].classList.add('down'); setTimeout(() => buttons[mode].classList.remove('down'), 160);
    bus.emit('ui:start', { mode, hasSave: st.hasSave });
    if (opts.hideOnStart) api.hide();
  };
  for (const [mode, b] of Object.entries(buttons)) { b.addEventListener('click', () => start(mode)); b.addEventListener('pointerdown', (e) => { e.stopPropagation && e.stopPropagation(); }); }

  const onKey = (e) => {
    if (!st.open) return;
    const k = e.key;
    if (k === 'Enter' || k === ' ') { e.preventDefault && e.preventDefault(); start(order()[st.focus]); }
    else if (k === 'e' || k === 'E') start('endless');
    else if (k === 'c' || k === 'C') start(st.hasSave ? 'continue' : 'story');
    else if (k === 'ArrowDown' || k === 'ArrowRight') setFocus(st.focus + 1);
    else if (k === 'ArrowUp' || k === 'ArrowLeft') setFocus(st.focus - 1);
  };
  window.addEventListener('keydown', onKey);

  const api = {
    el: wrap, buttons, state: st,
    get isOpen() { return st.open; },
    get lastMode() { return st.lastMode; },
    setHasSave(v) { st.hasSave = !!v; buttons.continue.style.display = st.hasSave ? '' : 'none'; wrap.classList.toggle('has-save', st.hasSave); setFocus(0); return api; },
    /** S25: unlock flags. `{ endless: true }` shows the ∞ ENDLESS button (after the first story win). */
    setUnlocked(u = {}) { if ('endless' in u) { st.endless = !!u.endless; buttons.endless.style.display = st.endless ? '' : 'none'; wrap.classList.toggle('has-endless', st.endless); setFocus(Math.min(st.focus, order().length - 1)); } return api; },
    get unlocked() { return { endless: st.endless }; },
    setBusy(v) { st.busy = !!v; wrap.classList.toggle('busy', st.busy); for (const b of Object.values(buttons)) b.disabled = st.busy; return api; },
    setSub(text) { sub.textContent = text; return api; },
    show(o = {}) {
      if (st.open) return api;
      st.open = true; api.setHasSave(hasSaveFn()); api.setUnlocked({ endless: hasWonFn() }); if (o.sub) { api.setSub(o.sub); sub.hidden = false; sub.style.display = ''; } else if (!chrome) { sub.hidden = true; sub.style.display = 'none'; } clearTimeout(st.goneT); wrap.classList.remove('hide', 'gone'); wrap.classList.add('open');
      wrap.classList.toggle('replay', !!o.replay); document.body && document.body.classList && document.body.classList.add('ll-title-open');
      bus.emit('ui:title:open', { hasSave: st.hasSave, replay: !!o.replay }); return api;
    },
    hide() {
      if (!st.open) return api;
      st.open = false; wrap.classList.add('hide'); wrap.classList.remove('open'); document.body && document.body.classList && document.body.classList.remove('ll-title-open');
      // 11B: after the fade the layer is display:none (it stayed display:flex at opacity 0 → full-screen invisible layer, overflowed on phones)
      clearTimeout(st.goneT); st.goneT = setTimeout(() => { if (!st.open) wrap.classList.add('gone'); }, 340);
      bus.emit('ui:title:close', { mode: st.lastMode }); return api;
    },
    start,
    destroy() { window.removeEventListener('keydown', onKey); offs.forEach((f) => f()); wrap.remove(); },
  };

  const offs = [];
  if (opts.showOnLose !== false) {
    offs.push(bus.on('eco:lose', (p) => { api.show({ sub: 'The Fog won this time… ' + (p && p.reason ? `(${p.reason}) ` : '') + 'Try again?', replay: true }); }));
    offs.push(bus.on('ui:continue', (p) => { if (p && p.outcome === 'lose') api.show({ sub: 'The Fog won this time… Try again?', replay: true }); }));
  }

  api.setUnlocked({ endless: hasWonFn() });
  setFocus(0);
  if (opts.autoShow !== false) api.show();
  return api;
}
