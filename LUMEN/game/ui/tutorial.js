// LUMEN LEDGER — Guided tutorial (hand pointer + input lock). DOM only, no Three.
//
//   import { mountTutorial } from './ui/tutorial.js';
//   const tut = mountTutorial(root, { bus, ui, auto: true, storageKey: 'lumen.tutorialDone' });
//   tut.open() · tut.close() · tut.next() · tut.back() · tut.isOpen · tut.step · tut.steps · tut.update(dt) · tut.destroy()
//
// What it does
//   • Opens by itself on the FIRST new game (ui:start story/endless → game:start) unless localStorage says it was finished/skipped.
//     Also opens on `ui:tutorial` (the pause menu's 📖 TUTORIAL button) — replay any time.
//   • 11 steps; a cartoon hand 👆 bobs next to the part of the screen it explains: joystick · ⚔ attack · ✋ interact · 🔨 Build ·
//     🚀 Deploy / ⬆ Upgrade · the 4 FinLit jars · the Debt Fog bar · the Season pill · ⏸ pause button. On desktop (no touch pad)
//     the joystick / attack / interact steps point at keycap chips (WASD · Space · E) drawn by the tutorial itself.
//   • INPUT LOCK while open: four dark shade panels surround a "hole" over the target, so the ONLY things that can be touched are
//     the spot under the hand and the tutorial's own dialogue card (Next / Back / Skip). Look-only steps put a transparent cover in
//     the hole (tap = Next); action steps (Build, jars) leave the hole open so the real control works. Every keydown is swallowed in
//     the capture phase except Enter / Space / → (next), ← (back), Esc (skip); Tab is trapped inside the card (+ the pointed control);
//     wheel / context menu are swallowed; held keys / joystick are released on open; a full-screen blocker covers the 450 ms
//     first-play delay. Everything is removed again on close.
//   • Pauses the game: emits `ui:pause {on, by:'tutorial'}` + `ui:tutorial:open` / `ui:tutorial:close` (10C OR-s the pause reason;
//     ui.isModal() already treats ui.tutorial.isOpen as a screen-blocking window; seasons.js defers its banner until close).
// Motion: shade fade 200 ms · hole/ring glide 220 ms outCubic · hand bob 0.9 s loop · card pop 260 ms outBack.

import { iconize, icon } from './icons.js';
import { bus as defaultBus } from '../src/core/EventBus.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };
const vw = () => (typeof window !== 'undefined' && window.innerWidth) || 1280;
const vh = () => (typeof window !== 'undefined' && window.innerHeight) || 720;
const isTouch = () => !!(typeof document !== 'undefined' && document.body?.classList?.contains('is-touch'));

/** Find a VISIBLE element for a selector (width/height > 0). */
function findVisible(root, sel) {
  if (!sel) return null;
  const list = (typeof document !== 'undefined' ? document : root).querySelectorAll(sel);
  for (const n of list) { const r = n.getBoundingClientRect?.(); if (r && r.width > 2 && r.height > 2) return n; }
  return null;
}

/** The step list. `target` = CSS selector of the real control; `keys` = desktop fallback chip; `mode`: 'look' (tap = next) | 'act'. */
export const TUTORIAL_STEPS = [
  { id: 'welcome',  title: 'Welcome to the Glowmarket!', text: 'I\'m Owl, keeper of the Ledger. Let me show you around — it takes a minute. Tap <b>Next</b> to begin.' },
  { id: 'joystick', title: 'Move Pip', target: '.ll-touch.on .ll-joy-zone', zone: 'joy', keys: 'W A S D', mode: 'look',
    text: 'Drag anywhere on the <b>left side</b> of the screen to walk Pip around the island.', keysText: 'Use <b>W A S D</b> or the <b>arrow keys</b> to walk Pip around the island.' },
  { id: 'attack',   title: '⚔ Attack', target: '.ll-touch.on .ll-touch-btn.attack', keys: 'Space', mode: 'look',
    text: 'Tap <b>Attack</b> to swing Pip\'s sword — bonk Fog Collectors and crack crates. Hold it to keep swinging.', keysText: 'Press <b>Space</b> (or J) to swing Pip\'s sword — bonk Fog Collectors and crack crates.' },
  { id: 'interact', title: '✋ Interact', target: '.ll-touch.on .ll-touch-btn.interact', keys: 'U', mode: 'look',
    text: 'Stand next to a stall and tap <b>Interact</b> to upgrade it. With no stall nearby it opens the Build Tray; while placing it rotates the ghost.', keysText: 'Stand next to a stall and press <b>U</b> to upgrade it (the Build Tray ⬆ works too). <b>Q W E R F G</b> are Pip\'s six FinLit powers.' },
  { id: 'build',    title: '🔨 Build', target: '.ll-build-toggle', mode: 'act', action: true,
    text: 'Stalls earn Spark. <b>Tap BUILD</b> to open the build tray.' },
  { id: 'deploy',   title: '🚀 Deploy · ⬆ Upgrade', target: '.ll-build.open .ll-build-detail', mode: 'look', prep: 'tray',
    text: 'Pick a card, then <b>🚀 Deploy</b> places a new stall on the ground, and <b>⬆ Upgrade</b> levels up the one you already have — bigger stall, more Spark.' },
  { id: 'jars',     title: '🫙 The 4 money jars', target: '#ll-jars', mode: 'act',
    text: 'Split your Spark: <b>Spend</b>, <b>Save</b>, <b>Invest</b> and <b>Protect</b>. Drag a jar and the others rebalance, then tap <b>APPLY</b> to move real Spark from your pouch into the jars. Try it — or tap <b>Next</b> to keep your Spark for now.' },
  { id: 'fog',      title: '🌫 Debt Fog', target: '.ll-hud .ll-fog', mode: 'look',
    text: 'This bar is the <b>Debt Fog</b>. Borrowing and bad deals make it grow; saving and smart choices push it back. At 100 % the island is lost!' },
  { id: 'season',   title: '📅 Season', target: '.ll-hud .ll-season', mode: 'look',
    text: 'Each <b>Season</b> is one market day with one money lesson. When the day bar fills you get your Ledger and stars. Tap this pill any time to read the lesson.' },
  { id: 'pause',    title: '⏸ Pause', target: '.ll-pause-fab', keys: 'Esc', mode: 'look',
    text: 'The ⏸ pause button opens the menu: settings, restart — and <b>📖 Tutorial</b> to watch this guide again.', keysText: 'Press <b>Esc</b> (or the ⏸ button) for the menu: settings, restart — and <b>📖 Tutorial</b> to watch this guide again.' },
  { id: 'done',     title: 'You\'re ready!', text: 'Build stalls, fill your jars wisely and keep the Debt Fog away. Survive 10 seasons to light the Lighthouse. Good luck!' },
];

export function mountTutorial(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const getUI = () => (typeof opts.ui === 'function' ? opts.ui() : opts.ui) || {};
  const storageKey = opts.storageKey || 'lumen.tutorialDone';
  const steps = opts.steps || TUTORIAL_STEPS;

  // ---------------------------------------------------------------- DOM
  const wrap = el('section', 'll-tut'); wrap.id = 'll-tut'; wrap.setAttribute('aria-label', 'Tutorial'); wrap.setAttribute('role', 'dialog');
  const shades = ['t', 'r', 'b', 'l'].map((s) => { const d = el('div', 'll-tut-shade ' + s); wrap.append(d); return d; });
  const ring = el('div', 'll-tut-ring');
  const cover = el('div', 'll-tut-cover');                       // look-only: catches taps inside the hole → next
  const chip = el('div', 'll-tut-keys');                         // desktop fallback target (keycaps)
  const hand = el('div', 'll-tut-hand', '<span>👆</span>');
  const card = el('div', 'll-tut-card');
  const cTop = el('div', 'll-tut-top');
  const cAvatar = el('span', 'll-tut-owl', '🦉'); const cCount = el('span', 'll-tut-count', '1 / 11');
  cTop.append(cAvatar, cCount);
  const cTitle = el('h3', 'll-tut-title'); const cText = el('p', 'll-tut-text');
  const cRow = el('div', 'll-tut-row');
  const bSkip = el('button', 'll-tut-btn skip', 'Skip'); const bBack = el('button', 'll-tut-btn back', '◂ Back'); const bNext = el('button', 'll-tut-btn next', 'Next ▸');
  bSkip.type = bBack.type = bNext.type = 'button';
  cRow.append(bSkip, bBack, bNext);
  card.append(cTop, cTitle, cText, cRow);
  // full-screen transparent blocker for the first-play delay (game:start → open, 450 ms): nothing may be touched before the guide shows
  const blocker = el('div', 'll-tut-blocker');
  wrap.append(ring, chip, cover, card, hand);
  root.appendChild(wrap);
  root.appendChild(blocker);

  // ---------------------------------------------------------------- state
  const st = { open: false, waiting: false, waitT: 0, i: 0, pendingFirst: false, rect: null, offs: [], keyOff: null, from: null };
  const done = () => { try { return typeof localStorage !== 'undefined' && localStorage.getItem(storageKey) === '1'; } catch { return false; } };
  const markDone = () => { try { if (typeof localStorage !== 'undefined') localStorage.setItem(storageKey, '1'); } catch { /* private mode */ } };

  const step = () => steps[st.i];
  const usesKeys = (s) => s.keys && !findVisible(root, s.target);

  function prep(s) {
    const ui = getUI();
    // the tray is only open for the Deploy/Upgrade step — and the Build step waits for the player to open it
    if (s.prep === 'tray' && ui.build) {
      if (!ui.build.isOpen) ui.build.open();
      if (!ui.build.state?.selected) {
        const firstStall = [...(ui.build.cards?.keys?.() || [])].find((id) => !ui.build.state?.locked?.has?.(id));
        if (firstStall) ui.build.select(firstStall);
      }
    } else if (ui.build?.isOpen && s.id !== 'deploy') { ui.build.deselect?.(); ui.build.close(); }
  }

  function render() {
    const s = step(); prep(s);
    const keys = usesKeys(s);
    cCount.textContent = `${st.i + 1} / ${steps.length}`;
    cTitle.innerHTML = iconize(s.title);
    cText.innerHTML = iconize(keys && s.keysText ? s.keysText : s.text);
    bBack.style.visibility = st.i > 0 ? 'visible' : 'hidden';
    bNext.innerHTML = iconize(st.i === steps.length - 1 ? 'Let\'s go! ✓' : 'Next ▸');
    bSkip.style.display = st.i === steps.length - 1 ? 'none' : '';
    chip.innerHTML = keys ? s.keys.split(' ').map((k) => `<kbd>${k}</kbd>`).join('') : '';
    chip.classList.toggle('on', !!keys);
    wrap.classList.toggle('act', s.mode === 'act' && !keys);
    wrap.classList.toggle('has-target', !!s.target);
    // action steps (Build) hide Next only while the real control is there to be tapped
    const actionLock = !!(s.action && !keys && findVisible(root, s.target));
    bNext.style.display = actionLock ? 'none' : '';
    cText.classList.toggle('waiting', actionLock);
    card.classList.remove('pop'); void card.offsetWidth; card.classList.add('pop');
    layout();
  }

  /** Target rect for a step (viewport px) or null (centre card, full shade). */
  function targetRect(s) {
    if (!s.target) return null;
    if (usesKeys(s)) { const r = chip.getBoundingClientRect?.(); return r && r.width > 2 ? pad(r, 8) : null; }
    const n = findVisible(root, s.target); if (!n) return null;
    let r = n.getBoundingClientRect();
    if (s.zone === 'joy') {                                         // the joystick zone is half the screen → highlight the thumb spot
      const size = Math.min(170, r.width * 0.8, r.height * 0.6);
      const cx = r.left + Math.min(r.width * 0.32, 150), cy = r.bottom - Math.min(150, r.height * 0.35);
      r = { left: cx - size / 2, top: cy - size / 2, width: size, height: size };
    }
    return pad(r, 6);
  }
  const pad = (r, p) => ({ left: Math.max(0, r.left - p), top: Math.max(0, r.top - p), width: r.width + p * 2, height: r.height + p * 2 });

  function layout() {
    if (!st.open) return;
    const s = step(), W = vw(), H = vh();
    const r = targetRect(s); st.rect = r;
    const px = (v) => Math.round(v) + 'px';
    if (!r) {                                                       // no target → one full shade, card centred
      Object.assign(shades[0].style, { left: '0px', top: '0px', width: W + 'px', height: H + 'px' });
      for (const sh of shades.slice(1)) Object.assign(sh.style, { width: '0px', height: '0px' });
      ring.style.display = cover.style.display = hand.style.display = 'none';
      Object.assign(card.style, { left: '50%', top: '50%', bottom: 'auto', transform: 'translate(-50%, -50%)' });
      return;
    }
    const L = r.left, T = r.top, R = Math.min(W, r.left + r.width), B = Math.min(H, r.top + r.height);
    Object.assign(shades[0].style, { left: '0px', top: '0px', width: px(W), height: px(T) });                 // top band
    Object.assign(shades[2].style, { left: '0px', top: px(B), width: px(W), height: px(Math.max(0, H - B)) });  // bottom band
    Object.assign(shades[3].style, { left: '0px', top: px(T), width: px(L), height: px(B - T) });               // left
    Object.assign(shades[1].style, { left: px(R), top: px(T), width: px(Math.max(0, W - R)), height: px(B - T) }); // right
    const box = { left: px(L), top: px(T), width: px(R - L), height: px(B - T) };
    Object.assign(ring.style, box, { display: 'block' });
    Object.assign(cover.style, box, { display: wrap.classList.contains('act') ? 'none' : 'block' });
    // hand + card placement. The hand sits on one side of the hole (below ↑ / above ↓ / right ← / left →) and the card must cover
    // NEITHER the hole NOR the hand. Search: hand sides (natural one first) × card widths (full → compact) × card positions; the first
    // layout with zero overlap wins, otherwise the one with the least overlap. Works on tall portrait phones and short landscape ones.
    const cx = (L + R) / 2, cy = (T + B) / 2, low = cy > H * 0.55;
    const HS = 52, m = 8;                                                   // hand box size · screen margin
    const handAt = (side) => {
      if (side === 'below') return { side, x: Math.max(HS / 2 + 2, Math.min(W - HS / 2 - 2, cx)) - HS / 2, y: Math.min(H - HS - 2, B + 4) };
      if (side === 'above') return { side, x: Math.max(HS / 2 + 2, Math.min(W - HS / 2 - 2, cx)) - HS / 2, y: Math.max(2, T - HS - 2) };
      if (side === 'right') return { side, x: Math.min(W - HS - 2, R + 4), y: Math.max(2, Math.min(H - HS - 2, cy - HS / 2)) };
      return { side, x: Math.max(2, L - HS - 4), y: Math.max(2, Math.min(H - HS - 2, cy - HS / 2)) };
    };
    const sideFits = (s) => (s === 'below' ? B + HS + 4 <= H : s === 'above' ? T - HS - 2 >= 0 : s === 'right' ? R + HS + 4 <= W : L - HS - 4 >= 0);
    const sides = (low ? ['above', 'below'] : ['below', 'above']).concat(cx > W / 2 ? ['left', 'right'] : ['right', 'left']).filter(sideFits);
    if (!sides.length) sides.push(low ? 'above' : 'below');
    const area = (a, b) => Math.max(0, Math.min(a.r, b.r) - Math.max(a.l, b.l)) * Math.max(0, Math.min(a.b, b.b) - Math.max(a.t, b.t));
    const holeBox = { l: L, t: T, r: R, b: B }, holePad = { l: L - 3, t: T - 3, r: R + 3, b: B + 3 };   // 3 px safety (rounding / ring border)
    const full = Math.min(420, W - m * 2);
    const widths = [full, Math.min(full, 340), Math.min(full, 280), Math.min(full, 240)].filter((w, k, a) => a.indexOf(w) === k);
    let best = null;
    outer: for (const cw of widths) {
      card.style.width = px(cw); card.classList.toggle('compact', cw < 300);
      const ch = card.offsetHeight || 170;
      const clampX = (x) => Math.max(m, Math.min(W - cw - m, x)), clampY = (y) => Math.max(m, Math.min(H - ch - m, y));
      for (const side of sides) {
        const h = handAt(side), hb = { l: h.x, t: h.y, r: h.x + HS, b: h.y + HS };
        const u = { l: Math.min(L, hb.l), t: Math.min(T, hb.t), r: Math.max(R, hb.r), b: Math.max(B, hb.b) };   // hole ∪ hand
        const cxL = clampX(cx - cw / 2), cyM = clampY(cy - ch / 2);
        const cands = [[cxL, clampY(u.b + 8)], [cxL, clampY(u.t - ch - 8)], [clampX(u.r + 8), cyM], [clampX(u.l - cw - 8), cyM],
          [m, m], [W - cw - m, m], [m, H - ch - m], [W - cw - m, H - ch - m], [clampX(u.r + 8), m], [clampX(u.l - cw - 8), m],
          [clampX(u.r + 8), H - ch - m], [clampX(u.l - cw - 8), H - ch - m]];
        for (const [x, y] of cands) {
          const cb = { l: x, t: y, r: x + cw, b: y + ch };
          const cost = area(cb, holePad) * 2 + area(cb, hb);
          if (!best || cost < best.cost) best = { cost, x, y, cw, h };
          if (cost === 0) break outer;
        }
      }
    }
    card.style.width = px(best.cw); card.classList.toggle('compact', best.cw < 300);
    Object.assign(card.style, { left: px(best.x), top: px(best.y), bottom: 'auto', transform: 'none' });
    hand.style.display = 'block';
    hand.classList.remove('down', 'left', 'right'); hand.classList.add(best.h.side === 'above' ? 'down' : best.h.side === 'right' ? 'left' : best.h.side === 'left' ? 'right' : 'up');
    Object.assign(hand.style, { left: px(best.h.x + HS / 2), top: px(best.h.y) });
    st.layout = { card: { l: best.x, t: best.y, w: best.cw }, hand: best.h, hole: holeBox, overlap: best.cost };
  }

  // ---------------------------------------------------------------- input lock (keyboard) — pointer lock = the shades
  const ALLOWED = new Set(['Enter', ' ', 'Spacebar', 'ArrowRight', 'ArrowLeft', 'Escape', 'Tab']);
  /** Focusable things the player may reach with Tab: the card's buttons + (action steps) the real control in the hole. */
  const focusables = () => {
    const list = [bSkip, bBack, bNext].filter((b) => b.style.display !== 'none' && b.style.visibility !== 'hidden');
    const s = step();
    if (s && s.mode === 'act' && wrap.classList.contains('act')) {
      const n = findVisible(root, s.target);
      if (n) { if (n.matches?.('button,input,[tabindex]')) list.push(n); list.push(...n.querySelectorAll?.('button:not([disabled]),input:not([disabled])') || []); }
    }
    return list;
  };
  const inAllowedTarget = (t) => { const s = step(); if (!t || !s || s.mode !== 'act' || !wrap.classList.contains('act')) return false; const n = findVisible(root, s.target); return !!(n && n.contains?.(t)); };
  const onKeyCapture = (e) => {
    if (st.waiting && !st.open) { e.stopImmediatePropagation?.(); e.stopPropagation?.(); e.preventDefault?.(); return; }   // first-play delay: swallow everything
    if (!st.open) return;
    e.stopImmediatePropagation?.(); e.stopPropagation?.(); e.preventDefault?.();
    if (e.key === 'Tab') {                                          // focus trap: cycle only through the card (+ the pointed control)
      const f = focusables(); if (!f.length) return;
      const k = f.indexOf(document.activeElement);
      const nx = k < 0 ? 0 : (k + (e.shiftKey ? -1 : 1) + f.length) % f.length;
      f[nx].focus?.(); return;
    }
    // Enter / Space on the pointed control (action steps) or a focused card button = press it, nothing else
    if ((e.key === 'Enter' || e.key === ' ') && !e.repeat) {
      const a = document.activeElement;
      if (a && (wrap.contains(a) || inAllowedTarget(a)) && a.tagName === 'BUTTON') { a.click(); return; }
    }
    if (e.repeat || !ALLOWED.has(e.key)) return;
    if (e.key === 'Escape') api.close('skip');
    else if (e.key === 'ArrowLeft') api.back();
    else { const s = step(); if (!(s.action && bNext.style.display === 'none')) api.next(); }
  };

  // ---------------------------------------------------------------- API
  const api = {
    el: wrap, card, hand, steps, state: st,
    get isOpen() { return st.open || st.waiting; },   // waiting = first-play delay: already blocks the season banner / pause menu
    get step() { return step(); },
    get index() { return st.i; },
    get done() { return done(); },
    open(from = 'menu') {
      if (st.open) return api;
      st.open = true; st.i = 0; st.from = from; st.pendingFirst = false;
      wrap.classList.add('open'); document.body?.classList?.add('ll-tut-open');
      lockOn(); releaseHeld();
      if (document.activeElement && !wrap.contains(document.activeElement)) document.activeElement.blur?.();
      bus.emit('ui:pause', { on: true, by: 'tutorial' }); bus.emit('ui:tutorial:open', { from });
      render(); return api;
    },
    close(why = 'done') {
      if (!st.open) return api;
      st.open = false; wrap.classList.remove('open', 'act'); document.body?.classList?.remove('ll-tut-open');
      if (!st.waiting) lockOff();
      if (document.activeElement && wrap.contains(document.activeElement)) document.activeElement.blur?.();
      const ui = getUI(); if (ui.build?.isOpen) { ui.build.deselect?.(); ui.build.close(); }
      markDone();
      bus.emit('ui:pause', { on: false, by: 'tutorial' }); bus.emit('ui:tutorial:close', { why, step: steps[st.i]?.id });
      return api;
    },
    next() { if (!st.open) return api; if (st.i >= steps.length - 1) return api.close('done'); st.i++; render(); bus.emit('ui:tutorial:step', { i: st.i, id: step().id }); return api; },
    back() { if (!st.open || st.i === 0) return api; st.i--; render(); bus.emit('ui:tutorial:step', { i: st.i, id: step().id }); return api; },
    goto(id) { const k = steps.findIndex((s) => s.id === id); if (st.open && k >= 0) { st.i = k; render(); } return api; },
    reset() { try { localStorage.removeItem(storageKey); } catch { /* */ } return api; },
    update() { if (st.open) layout(); },
    destroy() { clearTimeout(st.waitT); st.waiting = false; blocker.classList.remove('on'); api.close('destroy'); lockOff(); st.offs.forEach((f) => f()); if (typeof window !== 'undefined') window.removeEventListener?.('resize', layout); wrap.remove(); blocker.remove(); },
  };

  // ---------------------------------------------------------------- global lock (keyboard + wheel + context menu), on while open/waiting
  const swallow = (e) => { if (!(st.open || st.waiting)) return; if (e.target && wrap.contains(e.target) && e.type !== 'wheel') return; if (e.type !== 'contextmenu' && inAllowedTarget(e.target)) return; e.stopImmediatePropagation?.(); e.preventDefault?.(); };
  function lockOn() {
    if (st.keyOff || typeof window === 'undefined' || !window.addEventListener) return;
    window.addEventListener('keydown', onKeyCapture, true);
    window.addEventListener('wheel', swallow, { capture: true, passive: false });   // no camera zoom behind the guide
    window.addEventListener('contextmenu', swallow, true);
    st.keyOff = () => { window.removeEventListener('keydown', onKeyCapture, true); window.removeEventListener('wheel', swallow, { capture: true }); window.removeEventListener('contextmenu', swallow, true); };
  }
  function lockOff() { st.keyOff?.(); st.keyOff = null; }
  /** Let go of anything the player was already holding when the guide appeared (walk keys, joystick, held buttons). */
  function releaseHeld() {
    try { window.dispatchEvent?.(new Event('blur')); } catch { /* old DOM */ }
    const inp = opts.input || getUI().input;
    if (inp) { inp.keys?.clear?.(); if (inp.actions) for (const k in inp.actions) inp.actions[k] = false; if (inp.joystick) { inp.joystick.active = false; inp.joystick.vec?.set?.(0, 0); } }
  }

  bNext.addEventListener('click', () => api.next());
  bBack.addEventListener('click', () => api.back());
  bSkip.addEventListener('click', () => api.close('skip'));
  cover.addEventListener('click', () => api.next());               // tap the highlighted spot = got it
  for (const sh of shades) { sh.addEventListener('click', () => { card.classList.remove('nudge'); void card.offsetWidth; card.classList.add('nudge'); }); }
  if (typeof window !== 'undefined') window.addEventListener?.('resize', layout);

  st.offs.push(
    bus.on('ui:tutorial', (p) => api.open((p && p.from) || 'menu')),
    bus.on('ui:start', (p) => { st.pendingFirst = opts.auto !== false && (p?.mode || 'story') !== 'continue' && !done(); }),
    bus.on('game:start', () => {
      if (!st.pendingFirst) return; st.pendingFirst = false;
      // pause at once (so the season-1 opening lines wait), then show once the HUD / pad have laid out
      st.waiting = true; blocker.classList.add('on'); lockOn(); bus.emit('ui:pause', { on: true, by: 'tutorial-wait' });
      st.waitT = setTimeout(() => { st.waiting = false; blocker.classList.remove('on'); api.open('first'); bus.emit('ui:pause', { on: false, by: 'tutorial-wait' }); }, opts.delay ?? 450);
    }),
    bus.on('ui:build:open', () => { if (st.open && step().id === 'build') api.next(); }),
    // BUGFIX P39: APPLY on the jars step is the step's action — it now advances the tutorial (Next stays, since APPLY is disabled at 0 ✦)
    bus.on('ui:jar:apply', () => { if (st.open && step().id === 'jars') setTimeout(() => { if (st.open && step().id === 'jars') api.next(); }, 350); }),
    bus.on('game:title', () => { clearTimeout(st.waitT); if (st.waiting) { st.waiting = false; blocker.classList.remove('on'); bus.emit('ui:pause', { on: false, by: 'tutorial-wait' }); } api.close('title'); lockOff(); }),
    bus.on('eco:lose', () => api.close('lose')),
  );
  return api;
}

export default mountTutorial;
