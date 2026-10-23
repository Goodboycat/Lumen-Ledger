// LUMEN LEDGER — Touch controls (Chat 7C). DOM only, no Three. Contract: §B UI → mountTouch(root, input).
//
//   import { mountTouch } from './ui/touch.js';
//   const touch = mountTouch(root, game.input, { bus, force: false, side: 'left', buttons: ['attack','interact','build'], deadzone: 0.12 });
//   touch.show() · touch.hide() · touch.visible · touch.setEnabled(name, bool) · touch.setBadge(name, text) · touch.destroy()
//
// What it does
//   • Virtual joystick: the whole LEFT 55 % of the screen is the joystick zone (pointerdown anywhere → base appears under the finger,
//     knob follows, clamped to radius 56 px — same radius as Input.joystick). Feeds `input.joystick.{active,vec}` directly, which
//     Input.update() already turns into `input.move` (x right, y forward). Also calls `input.onJoystick` if the integrator set it.
//     The Foundation Input already has its own left-half joystick on the canvas; this overlay sits ABOVE the canvas (pointer-events on),
//     so only one joystick is ever active. Deadzone 0.12, outer ring tint grows with magnitude.
//   • 3 chunky buttons (right/bottom): ⚔ attack · ✋ interact · 🔨 build → `input.press(name)` on pointerdown (press-and-hold repeats
//     attack every 220 ms while held — `opts.repeat`); each also sets `input.actions[name]` true while held (released on up/cancel).
//   • Portrait + landscape layouts, safe-area insets, buttons ≥ 64 px, nothing under the thumb zones of HUD / build tray.
//   • Auto-shows when `input.isTouch` (or opts.force / `?touch=1` in the URL); hidden on desktop. `show()/hide()` override.
//   • Multi-touch: joystick + any number of buttons at once (each control owns its own pointerId; tools/qa_touch.mjs verifies it).
//   • Emits `ui:touch { action }` for every button press (12 maps sounds) — otherwise emits nothing.
//   • S08: a 6-chip FinLit ability strip (Magnet / Shield / Grow / Flash / Haggle / Sweep) above the pad → `ui:touch { action: 'ability', name }`;
//     radial cooldown sweep from `sandbox:ability:start {name, cooldown}`, shake from `sandbox:denied`. `touch.setCooldown(name, s)` / `flashDenied(name)` / `simulateAbility(name)`.
//
// Motion table: base fade-in 120 ms · knob spring back 180 ms outBack (CSS transition, only when released) · button press: translateY(4px) +
//   shadow 6→2 px instantly, release 140 ms outBack · build button pulse 1.2 s loop when `setBadge('build','!')`.

import { iconize, icon } from './icons.js';
import { bus as defaultBus } from '../src/core/EventBus.js';

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };

export const TOUCH_BUTTONS = {
  attack:   { icon: '⚔', label: 'Attack',   cls: 'attack',   repeat: 220 },
  interact: { icon: '✋', label: 'Interact', cls: 'interact', repeat: 0 },
  build:    { icon: '🔨', label: 'Build',    cls: 'build',    repeat: 0 },
  dash:     { icon: '💨', label: 'Dash',     cls: 'dash',     repeat: 0 },
};
// S08: FinLit ability strip for touch — the 6 hero powers that desktop fires with Q W E R F G. Order = FINLIT (3B). Each tap emits
//   `ui:touch { action: 'ability', name }` (Game.js → lg.ability(name)); `touch.setCooldown(name, seconds)` runs the radial cooldown
//   sweep and `touch.flashDenied(name)` shakes the chip (busy / cooling). Hidden with the rest of the pad under modals and while placing.
export const TOUCH_ABILITIES = [
  { name: 'coinMagnetDash', icon: '💨', label: 'Magnet', key: 'Q' },
  { name: 'bubbleShield',   icon: '🛡', label: 'Shield', key: 'W' },
  { name: 'growthStomp',    icon: '🌱', label: 'Grow',   key: 'E' },
  { name: 'ledgerFlash',    icon: '📒', label: 'Flash',  key: 'R' },
  { name: 'haggleShout',    icon: '📣', label: 'Haggle', key: 'F' },
  { name: 'fogSweep',       icon: '🌫', label: 'Sweep',  key: 'G' },
];

/** Pure helper: clamp (dx,dy) to radius → { x, y, nx, ny, mag } (nx/ny normalized −1..1, mag 0..1 after deadzone). */
export function joyVector(dx, dy, radius = 56, deadzone = 0.12) {
  const len = Math.hypot(dx, dy); const k = len > radius ? radius / len : 1;
  const x = dx * k, y = dy * k; let mag = Math.min(1, len / radius);
  if (mag < deadzone) return { x, y, nx: 0, ny: 0, mag: 0 };
  mag = (mag - deadzone) / (1 - deadzone); const nx = (x / radius) * (mag / Math.min(1, len / radius)), ny = (y / radius) * (mag / Math.min(1, len / radius));
  return { x, y, nx, ny, mag };
}

export function mountTouch(root, input, opts = {}) {
  const bus = opts.bus || defaultBus;
  const radius = opts.radius || (input && input.joystick && input.joystick.radius) || 56;
  const deadzone = opts.deadzone ?? 0.12;
  const names = opts.buttons || ['attack', 'interact', 'build'];
  const zonePct = opts.zonePct ?? 0.55;

  // ---------------------------------------------------------------- DOM
  const wrap = el('nav', 'll-touch'); wrap.id = 'll-touch'; wrap.setAttribute('aria-label', 'Touch controls');
  const zone = el('div', 'll-joy-zone'); zone.style.width = Math.round(zonePct * 100) + '%';
  const base = el('div', 'll-joy-base'); const ring = el('i', 'll-joy-ring'); const knob = el('div', 'll-joy-knob'); base.append(ring, knob);
  const hint = el('span', 'll-joy-hint', 'drag to move');
  zone.append(base, hint);
  const pad = el('div', 'll-touch-pad');
  const buttons = {};
  for (const n of names) {
    const def = TOUCH_BUTTONS[n] || { icon: n[0].toUpperCase(), label: n, cls: n, repeat: 0 };
    const b = el('button', 'll-touch-btn ' + def.cls); b.type = 'button'; b.setAttribute('aria-label', def.label); b.dataset.action = n;
    const ic = el('span', 'll-touch-ico', def.icon); const lab = el('span', 'll-touch-lab', def.label); const badge = el('span', 'll-touch-badge', ''); badge.style.display = 'none';
    b.append(ic, lab, badge); pad.append(b);
    buttons[n] = { el: b, badge, def, held: false, timer: 0, pointerId: -1 };
  }
  // S08: ability strip (6 small chips in a row above the pad, right-aligned)
  const strip = el('div', 'll-touch-abilities'); strip.setAttribute('aria-label', 'FinLit powers');
  const abilities = {};
  const abilityList = opts.abilities === false ? [] : (opts.abilities || TOUCH_ABILITIES);
  for (const a of abilityList) {
    const b = el('button', 'll-touch-ab'); b.type = 'button'; b.dataset.ability = a.name; b.setAttribute('aria-label', a.label);
    const cd = el('i', 'll-touch-ab-cd'); const ic = el('span', 'll-touch-ab-ico', a.icon); const lab = el('span', 'll-touch-ab-lab', a.label);
    b.append(cd, ic, lab); strip.appendChild(b);
    abilities[a.name] = { el: b, cd, def: a, until: 0, total: 0, timer: 0 };
  }
  wrap.append(zone, strip, pad);
  root.appendChild(wrap);

  // ---------------------------------------------------------------- state
  const st = { visible: false, joy: { active: false, id: -1, ox: 0, oy: 0, x: 0, y: 0, nx: 0, ny: 0, mag: 0 }, enabled: Object.fromEntries(names.map((n) => [n, true])) };

  const feed = (active, nx, ny) => {
    if (input && input.joystick) { input.joystick.active = active; input.joystick.vec.set(active ? nx : 0, active ? ny : 0); if (active) input.joystick.id = -2; }
    if (input && typeof input.onJoystick === 'function') input.onJoystick(active, st.joy.ox, st.joy.oy, st.joy.x, st.joy.y);
  };
  const joyStart = (e) => {
    if (st.joy.active) return;
    st.joy.active = true; st.joy.id = e.pointerId ?? 0; st.joy.ox = e.clientX; st.joy.oy = e.clientY; st.joy.t0 = (typeof performance !== 'undefined' ? performance.now() : Date.now()); st.joy.maxD = 0; st.joy.x = st.joy.y = st.joy.nx = st.joy.ny = st.joy.mag = 0;
    base.style.left = e.clientX + 'px'; base.style.top = e.clientY + 'px'; base.classList.add('on'); knob.classList.remove('release'); knob.style.transform = 'translate(-50%, -50%)'; ring.style.opacity = '0';
    zone.classList.add('used'); zone.setPointerCapture && e.pointerId != null && zone.setPointerCapture(e.pointerId);
    feed(true, 0, 0); e.preventDefault && e.preventDefault();
  };
  const joyMove = (e) => {
    if (!st.joy.active || (e.pointerId ?? 0) !== st.joy.id) return;
    st.joy.maxD = Math.max(st.joy.maxD || 0, Math.hypot(e.clientX - st.joy.ox, e.clientY - st.joy.oy));
    const v = joyVector(e.clientX - st.joy.ox, e.clientY - st.joy.oy, radius, deadzone);
    st.joy.x = v.x; st.joy.y = v.y; st.joy.nx = v.nx; st.joy.ny = v.ny; st.joy.mag = v.mag;
    knob.style.transform = `translate(calc(-50% + ${v.x.toFixed(1)}px), calc(-50% + ${v.y.toFixed(1)}px))`; ring.style.opacity = String(v.mag * 0.6);
    feed(true, v.nx, v.ny); e.preventDefault && e.preventDefault();
  };
  const joyEnd = (e) => {
    if (!st.joy.active || (e.pointerId ?? 0) !== st.joy.id) return;
    st.joy.active = false; st.joy.id = -1; st.joy.x = st.joy.y = st.joy.nx = st.joy.ny = st.joy.mag = 0;
    knob.classList.add('release'); knob.style.transform = 'translate(-50%, -50%)'; base.classList.remove('on'); ring.style.opacity = '0';
    feed(false, 0, 0);
    // BUGFIX (mobile): the joystick zone covers the left half of the island, so a TAP there never reached the canvas → you could not
    // move a build ghost / pick a stall to demolish on that side. A short, still touch (< 280 ms, < 12 px) is forwarded as a ground tap.
    const now = (typeof performance !== 'undefined' ? performance.now() : Date.now());
    if (e.type === 'pointerup' && e.clientX != null && now - (st.joy.t0 || 0) < 280 && (st.joy.maxD || 0) < 12 && input && typeof input.tapAt === 'function') input.tapAt(e.clientX, e.clientY, e);
  };
  zone.addEventListener('pointerdown', joyStart); zone.addEventListener('pointermove', joyMove);
  zone.addEventListener('pointerup', joyEnd); zone.addEventListener('pointercancel', joyEnd); zone.addEventListener('lostpointercapture', joyEnd);

  const press = (n) => { if (!st.enabled[n]) return; if (input && typeof input.press === 'function') input.press(n); bus.emit('ui:touch', { action: n }); };
  const down = (n, e) => {
    const b = buttons[n]; if (!b || b.held || !st.enabled[n]) return;
    b.held = true; b.pointerId = e.pointerId ?? 0; b.el.classList.add('down'); if (input && input.actions && n in input.actions) input.actions[n] = true;
    press(n);
    const rep = opts.repeat ?? b.def.repeat; if (rep > 0) b.timer = setInterval(() => { if (b.held) press(n); }, rep);
    e.stopPropagation && e.stopPropagation(); e.preventDefault && e.preventDefault();
  };
  const up = (n) => { const b = buttons[n]; if (!b || !b.held) return; b.held = false; b.pointerId = -1; b.el.classList.remove('down'); clearInterval(b.timer); b.timer = 0; if (input && input.actions && n in input.actions) input.actions[n] = false; };
  for (const n of names) {
    const b = buttons[n].el;
    // multi-touch: each button tracks its own pointerId → a release from ANOTHER finger (joystick thumb, other button) never lets go of it
    const mine = (e) => { const bb = buttons[n]; return !e || e.pointerId == null || bb.pointerId === -1 || e.pointerId === bb.pointerId; };
    b.addEventListener('pointerdown', (e) => down(n, e));
    for (const t of ['pointerup', 'pointercancel', 'pointerleave']) b.addEventListener(t, (e) => { if (mine(e)) up(n); });
    b.addEventListener('contextmenu', (e) => e.preventDefault && e.preventDefault());
  }
  const onBlur = () => { for (const n of names) up(n); if (st.joy.active) joyEnd({ pointerId: st.joy.id }); };
  window.addEventListener('blur', onBlur);

  // S08: ability chips — a tap emits ui:touch { action: 'ability', name }; Game.js decides (cooldown / busy) and answers with
  //   setCooldown(name, s) on success or flashDenied(name) on refusal (it listens to sandbox:ability:start / sandbox:denied).
  const nowMs = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());
  const tapAbility = (name, e) => {
    const a = abilities[name]; if (!a) return;
    e && e.stopPropagation && e.stopPropagation(); e && e.preventDefault && e.preventDefault();
    a.el.classList.add('down'); setTimeout(() => a.el.classList.remove('down'), 140);
    if (a.until > nowMs()) { api.flashDenied(name); return; }
    bus.emit('ui:touch', { action: 'ability', name });
  };
  for (const name of Object.keys(abilities)) {
    const b = abilities[name].el;
    b.addEventListener('pointerdown', (e) => tapAbility(name, e));
    b.addEventListener('contextmenu', (e) => e.preventDefault && e.preventDefault());
  }
  const tickCooldowns = () => {
    const t = nowMs(); let live = false;
    for (const a of Object.values(abilities)) {
      if (!a.until) continue;
      const left = a.until - t;
      if (left <= 0) { a.until = 0; a.el.classList.remove('cooling'); a.cd.style.setProperty('--cd', '0'); a.el.removeAttribute('data-left'); continue; }
      live = true; a.cd.style.setProperty('--cd', String(Math.max(0, Math.min(1, left / Math.max(1, a.total))))); a.el.setAttribute('data-left', Math.ceil(left / 1000));
    }
    if (!live && st.cdTimer) { clearInterval(st.cdTimer); st.cdTimer = 0; }
  };

  const api = {
    el: wrap, state: st, buttons, zone, knob, base, abilities, strip,
    /** S08: start a cooldown sweep on an ability chip (seconds). */
    setCooldown(name, seconds) { const a = abilities[name]; if (!a) return api; a.total = Math.max(0, seconds * 1000); a.until = a.total ? nowMs() + a.total : 0; a.el.classList.toggle('cooling', a.total > 0); a.cd.style.setProperty('--cd', a.total ? '1' : '0'); if (a.total && !st.cdTimer) st.cdTimer = setInterval(tickCooldowns, 100); if (!a.total) a.el.removeAttribute('data-left'); return api; },
    /** S08: shake a chip (ability refused: cooling / busy / blocked). */
    flashDenied(name) { const a = abilities[name]; if (!a) return api; a.el.classList.remove('deny'); void a.el.offsetWidth; a.el.classList.add('deny'); setTimeout(() => a.el.classList.remove('deny'), 320); return api; },
    /** S08: show / hide the whole strip (e.g. opts.abilities off in a tutorial). */
    setAbilitiesVisible(on) { strip.classList.toggle('hidden', !on); return api; },
    simulateAbility(name) { tapAbility(name, null); return api; },
    get visible() { return st.visible; },
    get joystick() { return st.joy; },
    show() { st.visible = true; wrap.classList.add('on'); document.body && document.body.classList && document.body.classList.add('is-touch'); return api; },
    hide() { st.visible = false; wrap.classList.remove('on'); onBlur(); return api; },
    setEnabled(n, on) { if (!(n in st.enabled)) return api; st.enabled[n] = !!on; buttons[n].el.classList.toggle('off', !on); buttons[n].el.disabled = !on; if (!on) up(n); return api; },
    setBadge(n, text) { const b = buttons[n]; if (!b) return api; b.badge.textContent = text || ''; b.badge.style.display = text ? '' : 'none'; b.el.classList.toggle('pulse', !!text); return api; },
    /** Simulated input for headless tests / tutorials: joystick drag in px from the touch origin. */
    simulateJoystick(dx, dy, done = false) { if (!st.joy.active) joyStart({ pointerId: 99, clientX: 100, clientY: 500 }); joyMove({ pointerId: 99, clientX: 100 + dx, clientY: 500 + dy }); if (done) joyEnd({ pointerId: 99 }); return api; },
    simulatePress(n) { down(n, { pointerId: 98 }); up(n); return api; },
    destroy() { onBlur(); window.removeEventListener('blur', onBlur); if (st.cdTimer) clearInterval(st.cdTimer); st.cdTimer = 0; offs.forEach((f) => f()); wrap.remove(); },
  };

  const offs = [
    // hide the pad while a modal owns the screen (ledger / dialogue / title) — buttons would otherwise fire through
    bus.on('ui:ledger:open', () => wrap.classList.add('modal')), bus.on('ui:ledger:close', () => wrap.classList.remove('modal')),
    bus.on('ui:dialogue:open', () => wrap.classList.add('modal')), bus.on('ui:dialogue:close', () => wrap.classList.remove('modal')),
    bus.on('ui:title:open', () => wrap.classList.add('modal')), bus.on('ui:title:close', () => wrap.classList.remove('modal')),
    bus.on('ui:pause', (p) => wrap.classList.toggle('modal', !!(p && p.on))),
    bus.on('ui:season:close', () => wrap.classList.remove('modal')), bus.on('ui:tutorial:close', () => wrap.classList.remove('modal')),
    bus.on('build:enter', () => { api.setEnabled('attack', false); strip.classList.add('placing'); }), bus.on('build:exit', () => { api.setEnabled('attack', true); strip.classList.remove('placing'); }),
    // S08: the sandbox answers every ability — success → cooldown sweep (COOLDOWN_S from the payload or 5 s) · refused → shake
    bus.on('sandbox:ability:start', (p) => { if (p?.name && abilities[p.name]) api.setCooldown(p.name, p.cooldown ?? 5); }),
    bus.on('sandbox:denied', (p) => { if (p?.name && abilities[p.name]) api.flashDenied(p.name); }),
    bus.on('ui:build:open', () => strip.classList.add('tray')), bus.on('ui:build:close', () => strip.classList.remove('tray')),
  ];

  const wantTouch = opts.force || (input && input.isTouch) || (typeof location !== 'undefined' && /[?&]touch=1/.test(location.search || ''));
  if (opts.autoShow !== false && wantTouch) api.show();
  return api;
}
