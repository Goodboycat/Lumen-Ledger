// LUMEN LEDGER — Title screen (Chat 7C). DOM only, no Three. Contract: §B UI → mountTitle(root).
//
//   import { mountTitle } from './ui/title.js';
//   const title = mountTitle(root, { bus, hasSave: () => !!localStorage.getItem('lumen.save'), version: 'v0.7', autoShow: true });
//   title.show() · title.hide() · title.isOpen · title.setHasSave(bool) · title.setBusy(bool) · title.destroy()
//
// What it does
//   • Full-screen sky panel: logo "LUMEN LEDGER" (letters pop in, 60 ms stagger, outBack), lantern glyph swing, tagline "Make FinLit Fun",
//     three chunky buttons: ▶ PLAY (new story run) · ⟳ CONTINUE (only when a save exists) · ∞ ENDLESS (free play, no Baron story).
//     Footer: credits line + version + "Zoud GameLab jam".
//   • Emits `ui:title:open` / `ui:title:close` (touch pad hides itself while the title owns the screen) and
//     `ui:start { mode: 'story' | 'continue' | 'endless' }` when a button is pressed (10C starts the game, then calls title.hide()).
//     `title.hide()` is NOT automatic on press — the integrator decides (e.g. fade only after the world is built). `opts.hideOnStart: true` flips that.
//   • Keyboard: Enter / Space = PLAY (or CONTINUE when a save exists); E = endless; C = continue. Arrow ↑/↓ moves focus.
//   • Listens `eco:lose {reason}` + `ui:continue {outcome:'lose'}` → re-shows with "The Fog won this time…" sub-line (opts.showOnLose, default true).
//   • Pure display otherwise. Nothing is read from localStorage unless `opts.hasSave` is given.
//
// Motion table (CSS, title.css): panel fade 260 ms · logo letters 420 ms outBack stagger 60 ms · lantern swing 2.4 s loop · buttons slide-up
//   380 ms outBack stagger 90 ms (after 500 ms) · press: translateY 4px instant, release 140 ms outBack · hide: 320 ms fade + zoom 1.04.

import { bus as defaultBus } from '../src/core/EventBus.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };

export const TITLE_MODES = {
  story:    { icon: '▶', label: 'PLAY',     sub: 'New story · 10 seasons', cls: 'play', key: 'Enter' },
  continue: { icon: '⟳', label: 'CONTINUE', sub: 'Resume your island',      cls: 'cont', key: 'c' },
  endless:  { icon: '∞', label: 'ENDLESS',  sub: 'Free play · no Baron',    cls: 'endless', key: 'e' },
};

export function mountTitle(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const hasSaveFn = typeof opts.hasSave === 'function' ? opts.hasSave : () => !!opts.hasSave;
  const version = opts.version || 'jam build';

  // ---------------------------------------------------------------- DOM
  const wrap = el('section', 'll-title'); wrap.id = 'll-title'; wrap.setAttribute('aria-label', 'Title screen');
  const sky = el('div', 'll-title-sky'); const clouds = el('div', 'll-title-clouds'); clouds.append(el('i'), el('i'), el('i'));
  const sea = el('div', 'll-title-sea'); const isle = el('div', 'll-title-isle'); isle.append(el('i', 'll-title-tower'), el('b', 'll-title-beam'));
  sky.append(clouds, sea, isle);
  const card = el('div', 'll-title-card');
  const lantern = el('div', 'll-title-lantern', '✦');
  const logo = el('h1', 'll-title-logo'); logo.setAttribute('aria-label', 'Lumen Ledger');
  const words = ['LUMEN', 'LEDGER']; let li = 0;
  for (const w of words) { const row = el('span', 'll-title-word'); for (const ch of w) { const s = el('span', 'll-title-ch', ch); s.style.animationDelay = (li++ * 60) + 'ms'; row.append(s); } logo.append(row); }
  const tag = el('p', 'll-title-tag'); tag.append('Make ', el('b', null, 'FinLit'), ' Fun'); const sub = el('p', 'll-title-sub', 'Relight the Lighthouse. Push back the Debt Fog.');
  const menu = el('nav', 'll-title-menu'); menu.setAttribute('aria-label', 'Main menu');
  const buttons = {}; let bi = 0;
  for (const [mode, def] of Object.entries(TITLE_MODES)) {
    const b = el('button', 'll-title-btn ' + def.cls); b.type = 'button'; b.dataset.mode = mode; b.style.animationDelay = (500 + bi++ * 90) + 'ms';
    b.append(el('span', 'll-title-btn-ico', def.icon), el('span', 'll-title-btn-lab', def.label), el('span', 'll-title-btn-sub', def.sub));
    menu.append(b); buttons[mode] = b;
  }
  const foot = el('footer', 'll-title-foot', `<span>Zoud GameLab · “Make FinLit Fun”</span><span class="ll-title-ver">${version}</span>`);
  card.append(lantern, logo, tag, sub, menu, foot);
  wrap.append(sky, card);
  root.appendChild(wrap);

  // ---------------------------------------------------------------- state
  const st = { open: false, busy: false, hasSave: false, focus: 0, lastMode: null };
  const order = () => Object.keys(TITLE_MODES).filter((m) => m !== 'continue' || st.hasSave);
  const setFocus = (i) => { const o = order(); st.focus = (i + o.length) % o.length; o.forEach((m, k) => buttons[m].classList.toggle('focus', k === st.focus)); };

  const start = (mode) => {
    if (!st.open || st.busy) return;
    if (mode === 'continue' && !st.hasSave) mode = 'story';
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
    setBusy(v) { st.busy = !!v; wrap.classList.toggle('busy', st.busy); for (const b of Object.values(buttons)) b.disabled = st.busy; return api; },
    setSub(text) { sub.textContent = text; return api; },
    show(o = {}) {
      if (st.open) return api;
      st.open = true; api.setHasSave(hasSaveFn()); if (o.sub) api.setSub(o.sub); clearTimeout(st.goneT); wrap.classList.remove('hide', 'gone'); wrap.classList.add('open');
      wrap.classList.toggle('replay', !!o.replay); document.body && document.body.classList && document.body.classList.add('ll-title-open');
      bus.emit('ui:title:open', { hasSave: st.hasSave, replay: !!o.replay }); return api;
    },
    hide() {
      if (!st.open) return api;
      st.open = false; wrap.classList.add('hide'); wrap.classList.remove('open'); document.body && document.body.classList && document.body.classList.remove('ll-title-open');
      // 11B: after the fade the layer is display:none (it stayed display:flex at opacity 0 → full-screen invisible layer, overflow in QA)
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

  setFocus(0);
  if (opts.autoShow !== false) api.show();
  return api;
}
