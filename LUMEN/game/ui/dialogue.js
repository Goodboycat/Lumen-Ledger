// LUMEN LEDGER — Dialogue box (Chat 7B). DOM only, no Three. Contract: §B UI → mountDialogue(root).
//
//   import { mountDialogue } from './ui/dialogue.js';
//   const dlg = mountDialogue(root, { bus, cps: 45, pauseGame: true });
//   dlg.say({ speaker: 'pip', name?: 'Pip', text: 'Hello!', choices?: ['Yes', 'No'], mood?: 'happy', portrait?: HTMLElement|string })
//   dlg.queue([line, line, ...])  → plays them one after another (tap / Enter / Space advances; a line with choices waits for a pick)
//   dlg.advance() · dlg.skip() (finish the typewriter) · dlg.choose(i) · dlg.hide() · dlg.isOpen · dlg.isTyping · dlg.update(dt) · dlg.destroy()
//
// Listens on bus:  story:line  { speaker, name?, text, choices?, mood? }  → say() (queued if a line is already showing)
//                  story:end   → hide()
// Emits:           'ui:choice'   { index, text, line }            when the player picks a choice
//                  'ui:advance'  { line }                          when the player taps past a line without choices
//                  'ui:dialogue:open' / 'ui:dialogue:close' / 'ui:pause' {on:true|false} (only when opts.pauseGame)
//                  'ui:dialogue:say' { speaker, line }  every time a line STARTS typing (Audio.js plays the speaker's voice blurb: voice_<speaker>)
//
// Speakers (P3 portraits = CSS blobs, see dialogue.css): pip (orange, sword scarf) · baron (purple top-hat blob) · owl (Tally-Owl, brown, big eyes)
//   · glimmer (blue blob) · narrator (no portrait). Unknown speaker → generic blob with the first letter.
// Motion: box slide-up 320 ms outBack · portrait pop 380 ms outBack · typewriter cps (default 60 chars/s, punctuation pause ×3.5 for . ! ? and ×2 for ,) ·
//   portrait bob while typing (talk) · choices stagger 70 ms × i (240 ms outBack) · hide: slide-down 200 ms inQuad.

import { iconize, icon, faceIcon, iconName } from './icons.js';
import { bus as defaultBus } from '../src/core/EventBus.js';

export const SPEAKERS = {
  pip:      { name: 'Pip',        cls: 'pip',      initial: 'P' },
  baron:    { name: 'Baron Gilt', cls: 'baron',    initial: 'B' },
  owl:      { name: 'Tally-Owl',  cls: 'owl',      initial: 'O' },
  tallyOwl: { name: 'Tally-Owl',  cls: 'owl',      initial: 'O' },
  glimmer:  { name: 'Glimmer',    cls: 'glimmer',  initial: 'G' },
  collector:{ name: 'Fog Collector', cls: 'collector', initial: 'F' },
  narrator: { name: '',           cls: 'narrator', initial: '' },
};

// 48C: per-type Glimmer colours — a copy of GLIMMER_INFO[type].color (src/assets/creatures/glimmers.js imports Three, so the
// UI cannot import it). check.mjs --ui asserts the two tables agree. A Glimmer speaker key (or speaker 'glimmer' + line.type)
// paints the name-plate / blob with its world colour via the --sp CSS variable instead of the one fixed blue.
export const GLIMMER_COLORS = {
  regular: 0x4fc3f7, saver: 0xaed581, spender: 0xf48fb1, vip: 0xfff176,
  impulse: 0xFF8A65, haggler: 0xB39DDB, kid: 0x80DEEA, elder: 0xBCAAA4,
  tourist: 0xFFF176, critic: 0x90A4AE, collector: 0xCE93D8, newbie: 0xA5D6A7,
};
export const glimmerHex = (type) => (type in GLIMMER_COLORS ? '#' + GLIMMER_COLORS[type].toString(16).padStart(6, '0') : null);

const el = (tag, cls, html) => { const e = document.createElement(tag); if (cls) e.className = cls; if (html != null) e.innerHTML = iconize(html); return e; };

export function mountDialogue(root, opts = {}) {
  const bus = opts.bus || defaultBus;
  const cps = opts.cps || 70;   // 70 chars/s: fluid, professional read (was 45 + long stops → felt clipped/Yoda-ish)
  const selfDrive = opts.selfDrive !== false;

  // ---------------------------------------------------------------- DOM
  const wrap = el('section', 'll-dlg'); wrap.id = 'll-dlg';
  const box = el('article', 'll-dlg-box');
  const portrait = el('div', 'll-dlg-portrait');
  const blob = el('div', 'll-blob'); const face = el('div', 'll-blob-face'); const eyeL = el('i', 'eye l'); const eyeR = el('i', 'eye r'); const mouth = el('i', 'mouth'); face.append(eyeL, eyeR, mouth);
  const hat = el('div', 'll-blob-hat'); const initial = el('span', 'll-blob-initial', '');
  blob.append(hat, face, initial); portrait.append(blob);
  const body = el('div', 'll-dlg-body');
  const nameTag = el('div', 'll-dlg-name', 'Pip');
  const text = el('p', 'll-dlg-text', '');
  const choices = el('div', 'll-dlg-choices');
  const next = el('button', 'll-dlg-next', '▼');
  // S41/15B: tap-to-complete hint — while typing, a tiny 'tap to complete' tag sits in the corner; after the text is done it reads 'tap to continue'
  const hint = el('span', 'll-dlg-hint', 'tap to complete'); hint.setAttribute('aria-hidden', 'true');
  body.append(nameTag, text, choices, next, hint);
  box.append(portrait, body);
  wrap.append(box);
  root.appendChild(wrap);

  // ---------------------------------------------------------------- state
  const st = { open: false, line: null, queue: [], full: '', shown: 0, acc: 0, typing: false, raf: 0, choiceEls: [], pauseEmitted: false, hideT: 0 };
  const retrigger = (node, cls) => { node.classList.remove(cls); void node.offsetWidth; node.classList.add(cls); };

  const setSpeaker = (line) => {
    const key = line.speaker || 'narrator';
    // 48C: a Glimmer type used as speaker ('saver', 'kid', …) is a Glimmer with that type's colour. 'collector' stays the Fog Collector.
    const gType = (key !== 'collector' && key in GLIMMER_COLORS) ? key : (key === 'glimmer' && line.type in GLIMMER_COLORS ? line.type : null);
    const sp = SPEAKERS[key] || (gType ? SPEAKERS.glimmer : null) || { name: key, cls: 'generic', initial: String(key)[0].toUpperCase() };
    const hex = gType ? glimmerHex(gType) : null;
    if (hex) box.style.setProperty('--sp', hex); else box.style.removeProperty('--sp');
    blob.className = 'll-blob ' + sp.cls + (line.mood ? ' mood-' + line.mood : '');
    initial.textContent = sp.cls === 'generic' ? sp.initial : '';
    portrait.classList.toggle('hidden', sp.cls === 'narrator' && !line.portrait);
    portrait.querySelectorAll('.ll-dlg-custom').forEach((n) => n.remove());
    if (line.portrait) { const c = typeof line.portrait === 'string' ? el('div', 'll-dlg-custom', line.portrait) : line.portrait; c.classList && c.classList.add('ll-dlg-custom'); portrait.append(c); blob.style.display = 'none'; }
    else {
      // S35: drawn character FACE (ui/icons.js face_<who>[_<mood>], baked to ui/icons/*.png) replaces the CSS blob when one exists
      const fname = faceIcon(sp.cls, line.mood); const has = iconName(fname) || iconName(faceIcon(sp.cls));
      if (has) { const c = el('div', 'll-dlg-custom ll-dlg-face', icon(has, { cls: 'll-face' })); portrait.append(c); blob.style.display = 'none'; } else blob.style.display = '';
    }
    const nm = line.name ?? sp.name; nameTag.textContent = nm; nameTag.style.display = nm ? '' : 'none';
    box.className = 'll-dlg-box sp-' + sp.cls;
    retrigger(portrait, 'pop');
  };
  const renderChoices = (line) => {
    choices.innerHTML = ''; st.choiceEls = [];
    const list = line.choices || [];
    list.forEach((c, i) => {
      const b = el('button', 'll-dlg-choice', typeof c === 'string' ? c : (c.text || c.label || String(c)));
      b.style.setProperty('--i', i); b.addEventListener('click', (e) => { e.stopPropagation && e.stopPropagation(); api.choose(i); });
      choices.append(b); st.choiceEls.push(b);
    });
    choices.classList.toggle('has', list.length > 0); next.style.display = list.length ? 'none' : '';
    choices.classList.remove('in');
  };

  const api = {
    el: wrap, state: st,
    get isOpen() { return st.open; }, get isTyping() { return st.typing; }, get line() { return st.line; },
    /** Show one line now (replaces whatever is showing; use queue() to chain). */
    say(line) {
      if (!line) return api; if (typeof line === 'string') line = { speaker: 'narrator', text: line };
      clearTimeout(st.hideT); st.line = line; st.full = String(line.text || ''); st.shown = 0; st.acc = 0; st.typing = true;
      text.textContent = ''; text.classList.remove('done'); box.classList.add('typing'); hint.textContent = 'tap to complete';
      setSpeaker(line); renderChoices(line);
      bus.emit('ui:dialogue:say', { speaker: line.speaker || 'narrator', line });
      if (!st.open) { st.open = true; wrap.classList.remove('closing'); wrap.classList.add('open'); document.body && document.body.classList && document.body.classList.add('ll-dlg-open'); bus.emit('ui:dialogue:open', { line }); if (opts.pauseGame && !st.pauseEmitted) { st.pauseEmitted = true; bus.emit('ui:pause', { on: true, by: 'dialogue' }); } }
      return api;
    },
    queue(lines) { const arr = Array.isArray(lines) ? lines : [lines]; if (!st.open) { const first = arr.shift(); st.queue.push(...arr); if (first) api.say(first); } else st.queue.push(...arr); return api; },
    /** Finish the typewriter instantly. */
    skip() { if (!st.typing) return api; st.shown = st.full.length; text.textContent = st.full; finishTyping(); return api; },
    /** Tap: typing → skip · done without choices → next line / emit ui:advance + hide · with choices → nothing (must pick). */
    advance() {
      if (!st.open) return api;
      if (st.typing) return api.skip();
      if (st.line && st.line.choices && st.line.choices.length) return api;
      bus.emit('ui:advance', { line: st.line });
      if (st.queue.length) api.say(st.queue.shift()); else api.hide();
      return api;
    },
    choose(i) {
      const line = st.line; if (!line || !line.choices || !line.choices[i]) return api;
      if (st.typing) api.skip();
      const c = line.choices[i]; const txt = typeof c === 'string' ? c : (c.text || c.label || String(c));
      st.choiceEls.forEach((b, j) => b.classList.toggle('picked', j === i));
      bus.emit('ui:choice', { index: i, text: txt, choice: c, line });
      if (st.queue.length) api.say(st.queue.shift()); else api.hide();
      return api;
    },
    hide() {
      if (!st.open) return api; st.open = false; st.typing = false; st.queue = [];
      wrap.classList.remove('open'); wrap.classList.add('closing'); document.body && document.body.classList && document.body.classList.remove('ll-dlg-open'); st.hideT = setTimeout(() => wrap.classList.remove('closing'), 220);
      bus.emit('ui:dialogue:close', {}); if (st.pauseEmitted) { st.pauseEmitted = false; bus.emit('ui:pause', { on: false, by: 'dialogue' }); }
      return api;
    },
    clearQueue() { st.queue = []; return api; },
    /** Typewriter: cps chars per second, punctuation pauses. Frame-rate independent. */
    update(dt) {
      if (!st.typing) return;
      dt = Math.min(0.1, Math.max(0, +dt || 0)); st.acc += dt * cps;
      while (st.acc >= 1 && st.shown < st.full.length) {
        const ch = st.full[st.shown]; st.shown++; st.acc -= 1;
        if ('.!?'.includes(ch)) st.acc -= 1.5; else if (',;:—'.includes(ch)) st.acc -= 0.5;   // fluid read: short breath at sentence ends, barely a beat at commas
      }
      text.textContent = st.full.slice(0, st.shown);
      if (st.shown >= st.full.length) finishTyping();
    },
    destroy() { offs.forEach((f) => f()); if (st.raf) cancelAnimationFrame(st.raf); window.removeEventListener('keydown', onKey); clearTimeout(st.hideT); wrap.remove(); },
  };
  function finishTyping() {
    st.typing = false; box.classList.remove('typing'); text.classList.add('done'); hint.textContent = (st.line && st.line.choices && st.line.choices.length) ? 'pick one' : 'tap to continue';
    if (st.line && st.line.choices && st.line.choices.length) { choices.classList.add('in'); }
    else retrigger(next, 'bounce');
  }

  box.addEventListener('click', (e) => { if (e.target && e.target.classList && e.target.classList.contains('ll-dlg-choice')) return; e.stopPropagation && e.stopPropagation(); api.advance(); });
  // S41/15B: a tap anywhere on the dialogue layer (not just the card) completes / advances the line — the box is small on phones
  wrap.addEventListener('click', (e) => { if (e.target === wrap) api.advance(); });
  const onKey = (e) => {
    if (!st.open) return;
    if (e.key === 'Enter' || e.key === ' ') { e.preventDefault && e.preventDefault(); api.advance(); }
    const n = parseInt(e.key, 10); if (n >= 1 && n <= 4 && st.line && st.line.choices && !st.typing) api.choose(n - 1);
  };
  window.addEventListener('keydown', onKey);

  const offs = [
    bus.on('story:line', (l) => { if (l) api.queue(l); }),
    bus.on('story:end', () => api.hide()),
  ];
  if (selfDrive && typeof requestAnimationFrame === 'function') {
    let last = performance.now();
    const loop = (t) => { api.update((t - last) / 1000); last = t; st.raf = requestAnimationFrame(loop); };
    st.raf = requestAnimationFrame(loop);
  }
  return api;
}
