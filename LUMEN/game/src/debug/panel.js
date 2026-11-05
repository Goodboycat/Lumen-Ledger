// LUMEN LEDGER — Debug panel (T0-B, FUN_PASS §4 T0). DOM only, no Three, 0 draw calls by construction.
//
//   index.html (only when `?debug=1`):
//     const { mountDebugPanel } = await import('./src/debug/panel.js');
//     window.LUMEN_DEBUG = mountDebugPanel(document.body, { lg, game });
//
//   Every button calls one `lg.debug.*` hook (Game.js installDebugHooks, T0-A). Hooks that return `{ na: 'T#' }` render as
//   disabled buttons labelled "n/a (T#)". The returned object mirrors the hooks (`LUMEN_DEBUG.grant(100)`, `.state()`, …)
//   plus `panel = { el, open(), close(), toggle(), refresh(), destroy() }`. Absent without the flag: this module is never imported.
//
//   Layout: <aside id="ll-debug"> top-right · a 44 px ▣ tab toggles the body · buttons ≥ 44 px tall (phone taps) ·
//   `pointer-events: auto` only on the panel itself, the page behind keeps working.

export const PANEL_ID = 'll-debug';

const CSS = `
#${PANEL_ID} { position: fixed; top: max(6px, env(safe-area-inset-top)); right: max(6px, env(safe-area-inset-right)); z-index: 90;
  font: 600 12px/1.25 ui-monospace, Menlo, Consolas, monospace; color: #eaf6ff; pointer-events: none; }
#${PANEL_ID} * { box-sizing: border-box; }
#${PANEL_ID} .lld-tab { pointer-events: auto; display: block; margin-left: auto; width: 44px; height: 44px; border: 2px solid #7fd3ff; border-radius: 10px;
  background: rgba(14,26,44,.92); color: #7fd3ff; font-size: 20px; cursor: pointer; }
#${PANEL_ID} .lld-body { pointer-events: auto; display: none; margin-top: 4px; width: min(92vw, 360px); max-height: calc(100vh - 70px); overflow: auto;
  padding: 8px; border: 2px solid #7fd3ff; border-radius: 12px; background: rgba(14,26,44,.94); box-shadow: 0 6px 24px rgba(0,0,0,.5); }
#${PANEL_ID}.open .lld-body { display: block; }
#${PANEL_ID} .lld-row { display: flex; gap: 6px; align-items: stretch; margin: 0 0 6px; }
#${PANEL_ID} .lld-row > * { flex: 1 1 0; min-width: 0; }
#${PANEL_ID} button, #${PANEL_ID} select, #${PANEL_ID} input { min-height: 44px; border-radius: 9px; border: 1.5px solid #4e7fa8; background: #1d3657; color: #eaf6ff;
  font: inherit; padding: 0 8px; cursor: pointer; }
#${PANEL_ID} button:active { background: #2f6aa0; }
#${PANEL_ID} button:disabled { opacity: .45; cursor: not-allowed; border-style: dashed; }
#${PANEL_ID} .lld-res { min-height: 20px; margin: 0 0 6px; padding: 4px 6px; border-radius: 6px; background: rgba(0,0,0,.35); color: #ffe08a; white-space: pre-wrap; word-break: break-word; }
#${PANEL_ID} .lld-res.bad { color: #ff9c9c; }
#${PANEL_ID} .lld-state { margin: 0; padding: 6px; border-radius: 6px; background: rgba(0,0,0,.35); color: #bfe6ff; font-size: 11px; white-space: pre-wrap; word-break: break-word; max-height: 40vh; overflow: auto; }
#${PANEL_ID} h4 { margin: 8px 0 4px; font-size: 11px; letter-spacing: .08em; text-transform: uppercase; color: #7fd3ff; }
`;

/** Mounts the panel. `lg.debug` must exist (Game.js T0-A). Returns `{ ...lg.debug, panel }`. */
export function mountDebugPanel(root, { lg, game } = {}) {
  const D = lg?.debug;
  if (!D) throw new Error('mountDebugPanel: lg.debug missing (Game.js installDebugHooks)');
  const doc = typeof document !== 'undefined' ? document : null;
  if (!doc) throw new Error('mountDebugPanel: no document');
  const el = (tag, cls, txt) => { const n = doc.createElement(tag); if (cls) n.className = cls; if (txt != null) n.textContent = txt; return n; };

  const aside = el('aside'); aside.id = PANEL_ID; aside.setAttribute('aria-label', 'LUMEN debug panel');
  const style = el('style'); style.textContent = CSS; aside.appendChild(style);
  const tab = el('button', 'lld-tab', '▣'); tab.type = 'button'; tab.title = 'debug panel (?debug=1)'; aside.appendChild(tab);
  const body = el('div', 'lld-body'); aside.appendChild(body);
  const res = el('div', 'lld-res', 'ready — press PLAY, then tap a button'); body.appendChild(res);

  // ---- helpers shared by the sections below (filled in by buildSections)
  const show = (out) => {
    const bad = !out || out.ok === false || out.na; res.classList.toggle('bad', !!bad);
    res.textContent = typeof out === 'string' ? out.slice(0, 400) : JSON.stringify(out ?? null).slice(0, 400);
    api.panel.refresh(); return out;
  };
  const call = (name, ...args) => { try { return show(D[name]?.(...args)); } catch (err) { return show({ ok: false, why: String(err?.message || err) }); } };
  const btn = (label, onTap, cls) => { const b = el('button', cls, label); b.type = 'button'; b.addEventListener('click', onTap); return b; };
  const naBtn = (label, na) => { const b = el('button', null, `${label} — n/a (${na})`); b.type = 'button'; b.disabled = true; b.dataset.na = na; return b; };
  const row = (...kids) => { const r = el('div', 'lld-row'); kids.forEach((k) => k && r.appendChild(k)); body.appendChild(r); return r; };
  const opt = (label, value) => { const o = el('option', null, label); o.value = value; return o; };   // no `new Option` (tools/domshim.mjs has none)
  const sel = (ids, first) => { const s = el('select'); if (first) s.appendChild(opt(first.label, first.value)); ids.forEach((id) => s.appendChild(opt(id, id))); return s; };
  const ctx = { D, lg, game, el, show, call, btn, naBtn, row, sel, opt, body };

  buildSections(ctx);

  // ---- state readout (bottom) + refresh timer, only while open
  body.appendChild(el('h4', null, 'state()'));
  const stateBox = el('pre', 'lld-state', '—'); body.appendChild(stateBox);
  let timer = 0;
  const api = {
    ...D,
    panel: {
      el: aside,
      get isOpen() { return aside.classList.contains('open'); },
      refresh() { ctx.refill?.(); try { stateBox.textContent = JSON.stringify(D.state(), null, 1); } catch (err) { stateBox.textContent = 'state() threw: ' + (err?.message || err); } },
      open() { aside.classList.add('open'); api.panel.refresh(); if (!timer) timer = setInterval(() => aside.isConnected && api.panel.isOpen && api.panel.refresh(), 1000); },
      close() { aside.classList.remove('open'); if (timer) { clearInterval(timer); timer = 0; } },
      toggle() { api.panel.isOpen ? api.panel.close() : api.panel.open(); },
      destroy() { api.panel.close(); aside.remove(); },
    },
  };
  tab.addEventListener('click', () => api.panel.toggle());
  (root || doc.body).appendChild(aside);
  return api;
}

/** Button sections — one row per hook. Grown below (BIG-FILE rule: skeleton first). */
function buildSections(ctx) {
  const { D, lg, el, btn, naBtn, row, call, sel, opt, body } = ctx;
  const h4 = (t) => body.appendChild(el('h4', null, t));
  const num = (tag, v, min, max, step) => { const i = el('input'); i.type = 'number'; i.value = v; i.min = min; i.max = max; i.step = step; i.setAttribute('aria-label', tag); return i; };
  // a hook whose probe (called with no live sandbox → `{ na }` or `{ ok:false }`) says n/a renders disabled. Probes are side-effect free
  // because every hook returns noSb() before PLAY; for 'fair' stranger / crisis / unlockJar the hook returns { na } unconditionally.
  const naOf = (name, ...args) => { try { const r = D[name]?.(...args); return r && r.na ? r.na : null; } catch { return null; } };
  const sb = () => lg.sb;
  const ids = {
    scams: () => Object.keys(sb()?.eco?.scams || {}),
    events: () => Object.keys(sb()?.eco?.events || {}),
    crew: () => (D.hire && (D.hire('__probe__')?.types)) || [],   // hire('__probe__') → { ok:false, why:'unknown crew type', types } once a sandbox exists; before PLAY → noSb()
  };

  h4('economy');
  row(btn('+100 ✦', () => call('grant', 100)), btn('+1000 ✦', () => call('grant', 1000)), btn('dump state', () => call('dump')));

  h4('time');
  const seasonN = num('season', 1, 1, 10, 1);
  row(seasonN, btn('→ season N', () => call('season', +seasonN.value)));
  const dayF = num('day', 0.7, 0, 0.99, 0.1);
  row(dayF, btn('set day', () => call('day', +dayF.value)));
  row(btn('×1', () => call('speed', 1)), btn('×2', () => call('speed', 2)), btn('×3', () => call('speed', 3)), btn('×4', () => call('speed', 4)));

  h4('world');
  const scamSel = sel([], { label: 'random scam', value: '' });
  row(scamSel, btn('spawn stranger', () => call('stranger', scamSel.value || undefined)));
  const fairNa = naOf('stranger', 'fair');
  row(fairNa ? naBtn('fair stranger', fairNa) : btn('fair stranger', () => call('stranger', 'fair')), btn('spawn wave', () => call('wave')));
  const evSel = sel([]);
  row(evSel, btn('trigger event', () => call('event', evSel.value)));
  const crisisNa = naOf('crisis', 'any');
  row(crisisNa ? naBtn('trigger crisis', crisisNa) : btn('trigger crisis', () => call('crisis', evSel.value)));

  h4('jars & crew');
  const jarSel = sel(['spend', 'save', 'invest', 'protect']);
  const jarNa = naOf('unlockJar', 'save');
  row(jarSel, jarNa ? naBtn('unlock jar', jarNa) : btn('unlock jar', () => call('unlockJar', jarSel.value)));
  const crewSel = sel([], { label: 'next unowned', value: '' });
  row(crewSel, btn('hire crew', () => call('hire', crewSel.value || undefined)));

  h4('save');
  row(btn('clear tutor-seen', () => call('clearTutor')), btn('reset save', () => call('resetSave')));

  // the id lists depend on the live sandbox (only after PLAY) — refill them whenever the panel refreshes
  const fill = (s, list, keepFirst) => {
    const want = list.join('|'); if (s.dataset.ids === want) return; s.dataset.ids = want;
    const cur = s.value; const first = keepFirst ? s.children[0] : null;
    [...s.children].forEach((c) => c.remove()); if (first) s.appendChild(first); list.forEach((id) => s.appendChild(opt(id, id)));
    if ([...s.children].some((o) => o.value === cur)) s.value = cur;
  };
  ctx.refill = () => { fill(scamSel, ids.scams(), true); fill(evSel, ids.events(), false); fill(crewSel, ids.crew(), true); };
  ctx.refill();
}
