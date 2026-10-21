// LUMEN LEDGER — Pause menu + Settings (Chat 7C). DOM only, no Three. Contract: §B UI → mountPause(root).
//
//   import { mountPause } from './ui/pause.js';
//   const pause = mountPause(root, { bus, settings: { quality: 'medium', outline: 0.035, sfx: 0.8, music: 0.6 }, storageKey: 'lumen.settings', hotkey: true });
//   pause.open() · pause.close() · pause.toggle() · pause.isOpen · pause.settings (live object) · pause.setSetting(key, value) · pause.destroy()
//
// What it does
//   • Esc / `input.press('menu')` → `ui:pause { on: true, by: 'menu' }` — the integrator (10C) sets game.paused. Backdrop + sheet drop-in.
//     Resume / Esc again → `ui:pause { on: false, by: 'menu' }`. Buttons: ▶ RESUME · ⚙ SETTINGS (expands in-sheet) · ⟳ RESTART SEASON
//     · ⌂ TITLE. Restart / Title ask "Sure?" (second tap within 2.5 s) then emit `ui:restart` / `ui:title` and close.
//   • Settings (P3): quality low/medium/high (segmented) · outline thickness 0.02–0.06 (range) · SFX 0–1 · music 0–1 (ranges) · reduce motion
//     (checkbox → body.ll-reduce-motion). Every change emits `ui:settings { key, value, settings }` and persists to localStorage (if available).
//     Changing `outline` also calls `opts.onOutline(v)` if given (10C passes setOutlineThickness — this file must not import Three).
//   • Does NOT pause anything itself: pure DOM + bus. `ui:pause` from other sources (dialogue) is ignored — only our own `by:'menu'` toggles the sheet.
//   • Listens: `ui:title:open` → force close (title owns the screen). `eco:lose` / `eco:win` → force close.
//
// Motion table (CSS, pause.css): backdrop 180 ms · sheet drop-in 360 ms outBack · buttons stagger 60 ms · settings expand 240 ms outCubic ·
//   "Sure?" shake 300 ms · close 200 ms inQuad.

import { bus as defaultBus } from '../src/core/EventBus.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = html; return e; };
const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

export const DEFAULT_SETTINGS = { quality: 'medium', outline: 0.035, sfx: 0.8, music: 0.6, reduceMotion: false };
export const QUALITY_LEVELS = ['low', 'medium', 'high'];

/** Pure: merge + clamp a settings object (ignores unknown keys, coerces types). */
export function normalizeSettings(s = {}) {
  const out = { ...DEFAULT_SETTINGS };
  if (QUALITY_LEVELS.includes(s.quality)) out.quality = s.quality;
  if (Number.isFinite(+s.outline)) out.outline = clamp(+s.outline, 0.02, 0.06);
  if (Number.isFinite(+s.sfx)) out.sfx = clamp(+s.sfx, 0, 1);
  if (Number.isFinite(+s.music)) out.music = clamp(+s.music, 0, 1);
  out.reduceMotion = !!s.reduceMotion;
  return out;
}
export function loadSettings(key = 'lumen.settings', defaults = {}) {
  try { const raw = typeof localStorage !== 'undefined' && localStorage.getItem(key); return normalizeSettings({ ...defaults, ...(raw ? JSON.parse(raw) : {}) }); }
  catch { return normalizeSettings(defaults); }
}
export function saveSettings(settings, key = 'lumen.settings') {
  try { if (typeof localStorage !== 'undefined') localStorage.setItem(key, JSON.stringify(settings)); return true; } catch { return false; }
}

export function mountPause(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const storageKey = opts.storageKey || 'lumen.settings';
  const settings = opts.persist === false ? normalizeSettings(opts.settings || {}) : loadSettings(storageKey, opts.settings || {});

  // ---------------------------------------------------------------- DOM
  const wrap = el('section', 'll-pause'); wrap.id = 'll-pause'; wrap.setAttribute('aria-label', 'Pause menu');
  const back = el('div', 'll-pause-back');
  const sheet = el('div', 'll-pause-sheet');
  const title = el('h2', 'll-pause-title', 'PAUSED'); const sub = el('p', 'll-pause-sub', 'The Glowmarket waits for you.');
  const menu = el('nav', 'll-pause-menu');
  const mk = (id, cls, ico, lab, i) => { const b = el('button', 'll-pause-btn ' + cls); b.type = 'button'; b.dataset.action = id; b.style.animationDelay = (i * 60) + 'ms'; b.append(el('span', 'll-pause-ico', ico), el('span', 'll-pause-lab', lab)); menu.append(b); return b; };
  const buttons = {
    resume:   mk('resume', 'resume', '▶', 'RESUME', 0),
    settings: mk('settings', 'settings', '⚙', 'SETTINGS', 1),
    tutorial: mk('tutorial', 'tutorial', '📖', 'TUTORIAL', 2),
    restart:  mk('restart', 'restart', '⟳', 'RESTART SEASON', 3),
    title:    mk('title', 'title', '⌂', 'TITLE', 4),
  };
  // ⏸ pause button in the HUD (touch players have no Esc key) — it sits in the HUD's right column, falls back to a fixed corner button
  const fab = el('button', 'll-pause-fab', '⏸'); fab.type = 'button'; fab.setAttribute('aria-label', 'Pause menu'); fab.title = 'Pause (Esc)';
  fab.addEventListener('click', () => api.open('menu'));
  const hudRight = root.querySelector && root.querySelector('.ll-right');
  if (hudRight) hudRight.insertBefore ? hudRight.insertBefore(fab, hudRight.firstChild || null) : hudRight.append(fab); else { fab.classList.add('floating'); root.appendChild(fab); }

  // settings panel
  const panel = el('div', 'll-settings'); panel.setAttribute('aria-label', 'Settings');
  const row = (label, control, hint) => { const r = el('label', 'll-set-row'); r.append(el('span', 'll-set-lab', label), control); if (hint) r.append(el('span', 'll-set-hint', hint)); panel.append(r); return r; };
  const seg = el('div', 'll-seg'); const segBtns = {};
  for (const q of QUALITY_LEVELS) { const b = el('button', 'll-seg-btn'); b.type = 'button'; b.textContent = q; b.dataset.value = q; b.addEventListener('click', () => set('quality', q)); seg.append(b); segBtns[q] = b; }
  row('Quality', seg, 'low = no shadows, fewer flowers');
  const range = (key, min, max, step) => { const r = el('input', 'll-range'); r.type = 'range'; r.min = String(min); r.max = String(max); r.step = String(step); r.value = String(settings[key]); r.dataset.key = key; r.addEventListener('input', () => set(key, parseFloat(r.value))); r.addEventListener('change', () => set(key, parseFloat(r.value))); return r; };
  const rOutline = range('outline', 0.02, 0.06, 0.005), rSfx = range('sfx', 0, 1, 0.05), rMusic = range('music', 0, 1, 0.05);
  const vOutline = el('output', 'll-set-val'), vSfx = el('output', 'll-set-val'), vMusic = el('output', 'll-set-val');
  const wrapRange = (r, v) => { const w = el('div', 'll-range-wrap'); w.append(r, v); return w; };
  row('Outline', wrapRange(rOutline, vOutline)); row('SFX', wrapRange(rSfx, vSfx)); row('Music', wrapRange(rMusic, vMusic));
  const cb = el('input', 'll-check'); cb.type = 'checkbox'; cb.addEventListener('change', () => set('reduceMotion', !!cb.checked));
  row('Reduce motion', cb, 'calmer camera & UI');
  const resetBtn = el('button', 'll-set-reset'); resetBtn.type = 'button'; resetBtn.textContent = 'reset to defaults'; resetBtn.addEventListener('click', () => { for (const [k, v] of Object.entries(DEFAULT_SETTINGS)) set(k, v, true); emit('reset', null); }); panel.append(resetBtn);

  const foot = el('p', 'll-pause-foot', 'Esc resumes · Spark stays in your jars while paused');
  sheet.append(title, sub, menu, panel, foot);
  wrap.append(back, sheet);
  root.appendChild(wrap);

  // ---------------------------------------------------------------- state
  const st = { open: false, settingsOpen: false, confirm: null, confirmT: 0 };
  const emit = (key, value) => bus.emit('ui:settings', { key, value, settings: { ...settings } });
  const render = () => {
    for (const q of QUALITY_LEVELS) segBtns[q].classList.toggle('on', settings.quality === q);
    rOutline.value = String(settings.outline); rSfx.value = String(settings.sfx); rMusic.value = String(settings.music); cb.checked = !!settings.reduceMotion;
    vOutline.textContent = settings.outline <= 0.025 ? 'thin' : settings.outline >= 0.05 ? 'thick' : 'medium';
    vSfx.textContent = Math.round(settings.sfx * 100) + '%'; vMusic.textContent = Math.round(settings.music * 100) + '%';
    if (document.body && document.body.classList) document.body.classList.toggle('ll-reduce-motion', !!settings.reduceMotion);
  };
  function set(key, value, silent = false) {
    const next = normalizeSettings({ ...settings, [key]: value });
    if (!(key in DEFAULT_SETTINGS)) return api;
    const changed = next[key] !== settings[key];
    Object.assign(settings, next); render();
    if (opts.persist !== false) saveSettings(settings, storageKey);
    if (key === 'outline' && typeof opts.onOutline === 'function') opts.onOutline(settings.outline);
    if (!silent && changed) emit(key, settings[key]);
    return api;
  }

  const clearConfirm = () => { if (st.confirm) buttons[st.confirm].classList.remove('confirm'); st.confirm = null; clearTimeout(st.confirmT); for (const [k, b] of Object.entries(buttons)) if (k === 'restart') b.querySelector('.ll-pause-lab').textContent = 'RESTART SEASON'; else if (k === 'title') b.querySelector('.ll-pause-lab').textContent = 'TITLE'; };
  const dangerous = (id, evt) => {
    if (st.confirm === id) { clearConfirm(); bus.emit(evt, { from: 'pause' }); api.close('menu'); return; }
    clearConfirm(); st.confirm = id; buttons[id].classList.add('confirm'); buttons[id].querySelector('.ll-pause-lab').textContent = 'SURE? TAP AGAIN';
    st.confirmT = setTimeout(clearConfirm, 2500);
  };
  const act = {
    resume: () => api.close('menu'),
    settings: () => api.toggleSettings(),
    tutorial: () => { api.close('menu'); bus.emit('ui:tutorial', { from: 'pause' }); },
    restart: () => dangerous('restart', 'ui:restart'),
    title: () => dangerous('title', 'ui:title'),
  };
  for (const [id, b] of Object.entries(buttons)) b.addEventListener('click', () => act[id]());
  back.addEventListener('click', () => api.close('menu'));

  const onKey = (e) => {
    if (e.key === 'Escape' && opts.hotkey !== false) { if (st.open || !(opts.canOpen && !opts.canOpen())) { e.preventDefault && e.preventDefault(); api.toggle(); } }
    else if (st.open && (e.key === 'Enter' || e.key === ' ')) { e.preventDefault && e.preventDefault(); if (!st.confirm) api.close('menu'); }
  };
  window.addEventListener('keydown', onKey);

  const api = {
    el: wrap, sheet, buttons, panel, settings, state: st, fab,
    get isOpen() { return st.open; },
    get settingsOpen() { return st.settingsOpen; },
    open(by = 'menu') {
      if (st.open) return api; if (opts.canOpen && !opts.canOpen()) return api;
      st.open = true; wrap.classList.remove('closing'); wrap.classList.add('open'); render();
      bus.emit('ui:pause', { on: true, by }); bus.emit('ui:pause:open', {}); return api;
    },
    close(by = 'menu') {
      if (!st.open) return api;
      st.open = false; clearConfirm(); wrap.classList.remove('open'); wrap.classList.add('closing'); setTimeout(() => wrap.classList.remove('closing'), 220);
      if (st.settingsOpen) api.toggleSettings(false);
      bus.emit('ui:pause', { on: false, by }); bus.emit('ui:pause:close', {}); return api;
    },
    toggle() { return st.open ? api.close('menu') : api.open('menu'); },
    toggleSettings(force) { st.settingsOpen = force === undefined ? !st.settingsOpen : !!force; wrap.classList.toggle('settings', st.settingsOpen); buttons.settings.classList.toggle('on', st.settingsOpen); return api; },
    setSetting: (k, v) => set(k, v),
    getSettings: () => ({ ...settings }),
    destroy() { window.removeEventListener('keydown', onKey); offs.forEach((f) => f()); clearTimeout(st.confirmT); wrap.remove(); fab.remove(); },
  };

  const offs = [
    bus.on('ui:title:open', () => { if (st.open) api.close('title'); }),
    bus.on('eco:lose', () => { if (st.open) api.close('lose'); }),
    bus.on('eco:win', () => { if (st.open) api.close('win'); }),
    bus.on('ui:pause:request', (p) => { (p && p.on === false) ? api.close(p.by || 'request') : api.open((p && p.by) || 'request'); }),
  ];

  render();
  if (typeof opts.onOutline === 'function') opts.onOutline(settings.outline);
  return api;
}
