// Input: unified keyboard (WASD/arrows), mouse/touch tap-to-move, and a virtual joystick
// for mobile. Exposes a normalized move vector and action buttons.
// Also raycasts pointer onto the ground plane (y=0) for build placement / tap-to-move.
import * as THREE from '../../vendor/three.module.js';

export class Input {
  /** @param {HTMLElement} dom renderer canvas @param {THREE.Camera} camera */
  constructor(dom, camera) {
    this.dom = dom; this.camera = camera;
    this.keys = new Set();
    this.move = new THREE.Vector2();        // -1..1 (x right, y forward/up on screen)
    this.pointer = new THREE.Vector2();     // NDC
    this.pointerDown = false;
    this.pointerWorld = new THREE.Vector3(); // on ground plane
    this.hasPointerWorld = false;
    this.actions = { attack: false, interact: false, dash: false, build: false, pause: false };
    this.justPressed = new Set();
    this._ray = new THREE.Raycaster();
    this._plane = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
    this.isTouch = 'ontouchstart' in window || navigator.maxTouchPoints > 0;
    this.joystick = { active: false, id: -1, origin: new THREE.Vector2(), vec: new THREE.Vector2(), radius: 56 };
    this.onTap = null;       // (worldPos) => {}  fired on short tap/click without drag
    this.onAction = null;    // (name) => {}
    this.pointerDrag = -1;   // pointerId of a touch finger dragging on the canvas (not the joystick) — build ghost follows it
    this._bind();
  }

  _bind() {
    const d = this.dom;
    window.addEventListener('keydown', (e) => {
      if (e.repeat) return;
      this.keys.add(e.code);
      const a = KEYMAP[e.code]; if (a) { this.actions[a] = true; this.justPressed.add(a); if (this.onAction) this.onAction(a); }
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.code)) e.preventDefault();
    });
    window.addEventListener('keyup', (e) => { this.keys.delete(e.code); const a = KEYMAP[e.code]; if (a) this.actions[a] = false; });
    window.addEventListener('blur', () => { this.keys.clear(); for (const k in this.actions) this.actions[k] = false; });

    const pos = (e) => {
      const r = d.getBoundingClientRect();
      this.pointer.set(((e.clientX - r.left) / r.width) * 2 - 1, -((e.clientY - r.top) / r.height) * 2 + 1);
    };
    let downAt = 0, downX = 0, downY = 0;
    d.addEventListener('pointerdown', (e) => {
      pos(e); this.pointerDown = true; this.pointerDrag = e.pointerType === 'touch' ? e.pointerId : -1; downAt = performance.now(); downX = e.clientX; downY = e.clientY;
      // Touch left half → joystick; right half → tap/attack
      if (e.pointerType === 'touch') {
        const r = d.getBoundingClientRect();
        if (e.clientX - r.left < r.width * 0.5 && !this.joystick.active) {
          this.joystick.active = true; this.joystick.id = e.pointerId; this.pointerDrag = -1;
          this.joystick.origin.set(e.clientX, e.clientY); this.joystick.vec.set(0, 0);
          if (this.onJoystick) this.onJoystick(true, e.clientX, e.clientY, 0, 0);
          return;
        }
      }
    });
    d.addEventListener('pointermove', (e) => {
      if (this.joystick.active && e.pointerId === this.joystick.id) {
        const dx = e.clientX - this.joystick.origin.x, dy = e.clientY - this.joystick.origin.y;
        const len = Math.hypot(dx, dy), r = this.joystick.radius;
        const k = len > r ? r / len : 1;
        this.joystick.vec.set((dx * k) / r, (dy * k) / r);
        if (this.onJoystick) this.onJoystick(true, this.joystick.origin.x, this.joystick.origin.y, dx * k, dy * k);
        return;
      }
      pos(e);
    });
    const up = (e) => {
      if (this.joystick.active && e.pointerId === this.joystick.id) {
        this.joystick.active = false; this.joystick.vec.set(0, 0);
        if (this.onJoystick) this.onJoystick(false);
        return;
      }
      this.pointerDown = false; if (e.pointerId === this.pointerDrag) this.pointerDrag = -1;
      const dt = performance.now() - downAt, dist = Math.hypot(e.clientX - downX, e.clientY - downY);
      if (dt < 300 && dist < 12) {
        pos(e); this._project();
        if (this.onTap && this.hasPointerWorld) this.onTap(this.pointerWorld.clone(), e);
      }
    };
    d.addEventListener('pointerup', up); d.addEventListener('pointercancel', up);
    d.addEventListener('contextmenu', (e) => e.preventDefault());
    window.addEventListener('wheel', (e) => { if (this.onWheel) this.onWheel(Math.sign(e.deltaY)); }, { passive: true });
  }

  _project() {
    this._ray.setFromCamera(this.pointer, this.camera);
    this.hasPointerWorld = !!this._ray.ray.intersectPlane(this._plane, this.pointerWorld);
  }

  /** Project a screen point (client px) onto the ground plane → Vector3 | null. Used by the touch overlay, which sits above the canvas. */
  worldAt(clientX, clientY) {
    const r = this.dom.getBoundingClientRect();
    this.pointer.set(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1);
    this._project(); return this.hasPointerWorld ? this.pointerWorld.clone() : null;
  }
  /** A short tap that landed on an overlay (e.g. the joystick zone) instead of the canvas → same onTap as a canvas tap. */
  tapAt(clientX, clientY, ev) { const w = this.worldAt(clientX, clientY); if (w && this.onTap) this.onTap(w, ev || { clientX, clientY, pointerType: 'touch' }); return w; }

  /** Call once per frame before systems read input. */
  update() {
    let x = 0, y = 0;
    const k = this.keys;
    if (k.has('KeyA') || k.has('ArrowLeft')) x -= 1;
    if (k.has('KeyD') || k.has('ArrowRight')) x += 1;
    if (k.has('KeyW') || k.has('ArrowUp')) y += 1;
    if (k.has('KeyS') || k.has('ArrowDown')) y -= 1;
    if (this.joystick.active) { x = this.joystick.vec.x; y = -this.joystick.vec.y; }
    const l = Math.hypot(x, y);
    if (l > 1) { x /= l; y /= l; }
    this.move.set(x, y);
    this._project();
  }
  /** Clear one-frame flags. Call at END of frame. */
  lateUpdate() { this.justPressed.clear(); }
  pressed(action) { return this.justPressed.has(action); }
  /** Trigger an action programmatically (e.g. from on-screen buttons). */
  press(action) { this.justPressed.add(action); if (this.onAction) this.onAction(action); }
}

const KEYMAP = {
  Space: 'attack', KeyJ: 'attack', Enter: 'attack',
  KeyE: 'interact', KeyF: 'interact',
  ShiftLeft: 'dash', KeyK: 'dash',
  KeyB: 'build', Escape: 'pause', KeyP: 'pause',
};
