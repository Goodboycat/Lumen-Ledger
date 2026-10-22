// Minimal DOM shim for headless UI checks (tools/check.mjs --ui). ~150 lines, no deps.
// Supports: createElement, className/classList, append/appendChild/remove, innerHTML (stores string; parses *nothing* except
// it exposes querySelector by class for one level), textContent, style (+ setProperty), dataset, attributes, addEventListener/
// dispatchEvent, firstChild/lastChild/children, offsetWidth (0), title/value/type/min/max/step/disabled.
// Good enough to mount ui/*.js, fire bus events, click buttons, and read back text. Not a browser; do not test layout with it.
export function installDomShim() {
  if (globalThis.__llDomShim) return globalThis.document;
  class ClassList {
    constructor(el) { this.el = el; this.set = new Set(); }
    _sync() { this.el._className = [...this.set].join(' '); }
    add(...c) { c.forEach((x) => x && this.set.add(x)); this._sync(); }
    remove(...c) { c.forEach((x) => this.set.delete(x)); this._sync(); }
    toggle(c, force) { const on = force === undefined ? !this.set.has(c) : !!force; on ? this.set.add(c) : this.set.delete(c); this._sync(); return on; }
    contains(c) { return this.set.has(c); }
    _from(str) { this.set = new Set(String(str || '').split(/\s+/).filter(Boolean)); this._sync(); }
  }
  class Style { setProperty(k, v) { this[k] = v; } removeProperty(k) { delete this[k]; } getPropertyValue(k) { return this[k] || ''; } }
  class Element {
    constructor(tag) {
      this.tagName = String(tag).toUpperCase(); this.children = []; this.parentNode = null; this._className = '';
      this.classList = new ClassList(this); this.style = new Style(); this.dataset = {}; this._attrs = {}; this._listeners = {};
      this._text = ''; this._html = ''; this.offsetWidth = 0; this.offsetHeight = 0; this.disabled = false; this.value = ''; this.title = '';
    }
    get className() { return this._className; } set className(v) { this.classList._from(v); }
    get id() { return this._attrs.id || ''; } set id(v) { this._attrs.id = v; }
    get textContent() { if (this._html) return this._text.replace(/&lt;/g,'<').replace(/&gt;/g,'>').replace(/&amp;/g,'&'); return this.children.length ? this.children.map((c) => c.textContent).join('') : this._text; }
    set textContent(v) { this.children.forEach((c) => (c.parentNode = null)); this.children = []; this._text = String(v); this._html = ''; }
    get innerHTML() { return this._html || this.textContent; }
    set innerHTML(v) {
      this.children.forEach((c) => (c.parentNode = null)); this.children = []; this._html = String(v); this._text = String(v).replace(/<[^>]*>/g, '');
      // very small parser: create child elements for top-level <tag class="x">text</tag> so querySelector('.x') works
      const re = /<(\w+)([^>]*)>([\s\S]*?)<\/\1>/g; let m;
      while ((m = re.exec(String(v)))) { const c = new Element(m[1]); const cls = /class="([^"]*)"/.exec(m[2]); if (cls) c.className = cls[1]; c.innerHTML = m[3]; c.parentNode = this; this.children.push(c); }
    }
    get firstChild() { return this.children[0] || null; } get lastChild() { return this.children[this.children.length - 1] || null; }
    get isConnected() { let n = this; while (n) { if (n === globalThis.document.body) return true; n = n.parentNode; } return false; }
    appendChild(c) { if (this._html) { this._html = ''; this._text = ''; this.children = []; } if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.push(c); return c; }
    append(...cs) { cs.forEach((c) => this.appendChild(typeof c === 'string' ? Object.assign(new Element('span'), { _text: c }) : c)); }
    prepend(c) { if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; this.children.unshift(c); }
    removeChild(c) { const i = this.children.indexOf(c); if (i >= 0) { this.children.splice(i, 1); c.parentNode = null; } return c; }
    remove() { if (this.parentNode) this.parentNode.removeChild(this); }
    insertBefore(c, ref) { const i = this.children.indexOf(ref); if (c.parentNode) c.parentNode.removeChild(c); c.parentNode = this; i < 0 ? this.children.push(c) : this.children.splice(i, 0, c); return c; }
    setAttribute(k, v) { this._attrs[k] = String(v); if (k === 'class') this.className = v; } getAttribute(k) { return this._attrs[k] ?? null; } removeAttribute(k) { delete this._attrs[k]; } hasAttribute(k) { return k in this._attrs; }
    addEventListener(t, fn) { (this._listeners[t] ||= []).push(fn); } removeEventListener(t, fn) { this._listeners[t] = (this._listeners[t] || []).filter((f) => f !== fn); }
    dispatchEvent(ev) { ev.target ||= this; ev.currentTarget = this; (this._listeners[ev.type] || []).slice().forEach((f) => f.call(this, ev)); if (ev.bubbles && this.parentNode && !ev._stop) this.parentNode.dispatchEvent(ev); return true; }
    click() { if (this.disabled) return; const h = this['onclick']; if (h) h.call(this, { type: 'click', target: this }); this.dispatchEvent({ type: 'click', bubbles: true, preventDefault() {}, stopPropagation() { this._stop = true; } }); }
    focus() {} blur() {} getBoundingClientRect() { return { left: 0, top: 0, width: 100, height: 100, right: 100, bottom: 100 }; }
    setPointerCapture() {} releasePointerCapture() {} scrollIntoView() {}
    get getContext() { return () => null; }
    _matchCompound(c) { // "tag.cls.cls#id[attr=val]"
      const parts = c.match(/^[\w-]+|\.[\w-]+|#[\w-]+|\[[^\]]+\]/g) || []; if (!parts.length) return false;
      return parts.every((p) => { if (p[0] === '.') return this.classList.contains(p.slice(1)); if (p[0] === '#') return this.id === p.slice(1); if (p[0] === '[') { const m = /^\[([\w-]+)(?:=["']?([^"'\]]*)["']?)?\]$/.exec(p); if (!m) return false; const v = m[1] === 'type' ? (this.type || this._attrs.type) : this._attrs[m[1]]; return m[2] === undefined ? v != null : v === m[2]; } return this.tagName === p.toUpperCase(); });
    }
    matches(sel) {
      return sel.split(',').some((s) => {
        const chain = s.trim().split(/\s+/); if (!this._matchCompound(chain[chain.length - 1])) return false;
        let n = this.parentNode; for (let i = chain.length - 2; i >= 0; i--) { while (n && !(n._matchCompound && n._matchCompound(chain[i]))) n = n.parentNode; if (!n) return false; n = n.parentNode; }
        return true;
      });
    }
    querySelectorAll(sel) { const out = []; const walk = (n) => { for (const c of n.children) { if (c.matches(sel)) out.push(c); walk(c); } }; walk(this); return out; }
    querySelector(sel) { return this.querySelectorAll(sel)[0] || null; }
    contains(n) { while (n) { if (n === this) return true; n = n.parentNode; } return false; }
    get closest() { return (sel) => { let n = this; while (n) { if (n.matches && n.matches(sel)) return n; n = n.parentNode; } return null; }; }
  }
  const body = new Element('body'); const head = new Element('head'); const html = new Element('html'); html.append(head, body);
  const docListeners = {};
  const document = {
    body, head, documentElement: html,
    createElement: (t) => new Element(t), createTextNode: (t) => Object.assign(new Element('#text'), { _text: String(t) }),
    createElementNS: (_ns, t) => new Element(t),
    getElementById: (id) => html.querySelector('#' + id),
    querySelector: (s) => html.querySelector(s), querySelectorAll: (s) => html.querySelectorAll(s),
    addEventListener(t, fn) { (docListeners[t] ||= []).push(fn); }, removeEventListener(t, fn) { docListeners[t] = (docListeners[t] || []).filter((f) => f !== fn); },
    dispatchEvent(ev) { (docListeners[ev.type] || []).slice().forEach((f) => f(ev)); return true; },
    hidden: false, visibilityState: 'visible', fonts: { ready: Promise.resolve() },
    activeElement: body,
  };
  const winListeners = {};
  globalThis.document = document;
  globalThis.window = globalThis; globalThis.self = globalThis;
  // capture-phase listeners (addEventListener(t, fn, true) / {capture:true}) run before bubble listeners, like a real window
  globalThis.addEventListener = (t, fn, o) => { const cap = o === true || (o && o.capture); (cap ? winListeners[t] ||= [] : winListeners[t] ||= [])[cap ? 'unshift' : 'push'](fn); if (cap) fn._cap = true; };
  globalThis.removeEventListener = (t, fn) => { winListeners[t] = (winListeners[t] || []).filter((f) => f !== fn); };
  globalThis.dispatchEvent = (ev) => { const L = (winListeners[ev.type] || []).slice(); L.filter((f) => f._cap).forEach((f) => f(ev)); L.filter((f) => !f._cap).forEach((f) => f(ev)); return true; };
  globalThis.innerWidth ??= 1280; globalThis.innerHeight ??= 720; globalThis.devicePixelRatio ??= 1;
  globalThis.navigator ??= { userAgent: 'node', maxTouchPoints: 0 };
  globalThis.localStorage ??= (() => { const m = new Map(); return { getItem: (k) => (m.has(k) ? m.get(k) : null), setItem: (k, v) => m.set(k, String(v)), removeItem: (k) => m.delete(k), clear: () => m.clear(), key: (i) => [...m.keys()][i] ?? null, get length() { return m.size; } }; })();
  globalThis.requestAnimationFrame ??= (f) => setTimeout(() => f(performance.now()), 16);
  globalThis.cancelAnimationFrame ??= (id) => clearTimeout(id);
  globalThis.getComputedStyle ??= () => ({ getPropertyValue: () => '' });
  globalThis.matchMedia ??= () => ({ matches: false, addEventListener() {}, removeEventListener() {}, addListener() {}, removeListener() {} });
  globalThis.HTMLElement ??= Element; globalThis.Element ??= Element;
  globalThis.KeyboardEvent ??= class { constructor(type, init = {}) { Object.assign(this, { type, bubbles: true }, init); } preventDefault() {} stopPropagation() {} };
  globalThis.PointerEvent ??= class { constructor(type, init = {}) { Object.assign(this, { type, bubbles: true }, init); } preventDefault() {} stopPropagation() {} };
  globalThis.CustomEvent ??= class { constructor(type, init = {}) { Object.assign(this, { type, bubbles: true }, init); } preventDefault() {} };
  globalThis.__llDomShim = true;
  return document;
}
/** Fire a window keydown for hotkey tests. */
export function pressKey(key, extra = {}) { globalThis.dispatchEvent(Object.assign(new KeyboardEvent('keydown', { key }), extra, { target: globalThis.document.body })); }
/** Set an <input type=range> value and fire input + change like a drag. */
export function dragRange(input, value) { input.value = String(value); input.dispatchEvent({ type: 'input', target: input }); input.dispatchEvent({ type: 'change', target: input }); }
