// Global pub/sub. All systems talk through this (UI <-> Economy <-> World).
// Event names are documented in docs/API_CONTRACTS.md (section "Events").
export class EventBus {
  constructor() { this.map = new Map(); }
  on(name, fn) {
    if (!this.map.has(name)) this.map.set(name, new Set());
    this.map.get(name).add(fn);
    return () => this.off(name, fn);
  }
  once(name, fn) {
    const off = this.on(name, (...a) => { off(); fn(...a); });
    return off;
  }
  off(name, fn) { const s = this.map.get(name); if (s) s.delete(fn); }
  emit(name, payload) {
    const s = this.map.get(name);
    if (!s) return;
    for (const fn of Array.from(s)) fn(payload);
  }
  clear() { this.map.clear(); }
}
export const bus = new EventBus();
