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
  const doc = (root && root.ownerDocument) || (typeof document !== 'undefined' ? document : null);
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
  const sel = (ids, first) => { const s = el('select'); if (first) s.appendChild(new Option(first.label, first.value)); ids.forEach((id) => s.appendChild(new Option(id, id))); return s; };
  const ctx = { D, lg, game, el, show, call, btn, naBtn, row, sel, body };

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
      refresh() { try { stateBox.textContent = JSON.stringify(D.state(), null, 1); } catch (err) { stateBox.textContent = 'state() threw: ' + (err?.message || err); } },
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
  const { D, btn, naBtn, row, call } = ctx;
  row(btn('+100 ✦', () => call('grant', 100)), btn('dump state', () => call('dump')));
}
