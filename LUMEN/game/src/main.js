// Foundation demo entry: island + Pip + 5 Glimmers + sword attack + VFX.
// Integration chat (Chat 10) replaces this with src/Game.js state machine.
import * as THREE from '../vendor/three.module.js';
import { Game } from './core/Game.js';
import { setOutlineThickness } from './core/Outline.js';
import { PALETTE as P } from './core/Toon.js';
import { Island } from './world/Island.js';
import { VFX } from './vfx/VFX.js';
import { HeroController } from './entities/HeroController.js';
import { makeGlimmer, GlimmerController } from './assets/glimmer.js';

const container = document.getElementById('game-container');
const game = new Game(container);
window.game = game; // debugging

// World
const island = new Island({ radius: 11, seed: 7 });
game.scene.add(island.group);
game.add({ update: (dt) => island.update(dt) });

// VFX
const vfx = game.add(new VFX(game));

// Glimmers (targets)
const glimmers = [];
const colors = [P.glimmerBlue, P.glimmerPink, P.glimmerGreen, P.glimmerYellow, P.glimmerBlue];
for (let i = 0; i < 5; i++) {
  const a = (i / 5) * Math.PI * 2 + 0.4, d = 3.2;
  const g = makeGlimmer({ color: colors[i], size: 0.9 + (i % 2) * 0.25 });
  g.position.set(Math.cos(a) * d, 0, Math.sin(a) * d);
  g.rotation.y = -a + Math.PI / 2;
  game.scene.add(g);
  const ctl = new GlimmerController(g);
  ctl.hopping = i % 2 === 0;
  glimmers.push(ctl);
}
game.add({ update: (dt) => {
  for (const g of glimmers) {
    g.update(dt);
    // keep on island & face hero loosely
    const pos = g.root.position;
    if (!island.isLand(pos.x, pos.z)) { pos.multiplyScalar(0.96); }
  }
} });

// Hero
const hero = new HeroController(game, {
  vfx,
  targets: () => glimmers,
  isLand: (x, z) => island.isLand(x, z),
});
hero.root.position.set(0, 0, 0.5);
game.add({ update: (dt) => hero.update(dt) });
game.followTarget = hero.root.position;
game.camera.snapTo(hero.root.position);

// Input extras
game.input.onWheel = (dir) => { game.camera.zoom = THREE.MathUtils.clamp(game.camera.zoom + dir * 0.1, 0.6, 1.8); };
game.input.onTap = () => { game.input.press('attack'); };
window.addEventListener('keydown', (e) => {
  if (e.code === 'Digit1') setOutlineThickness(0.02);
  if (e.code === 'Digit2') setOutlineThickness(0.035);
  if (e.code === 'Digit3') setOutlineThickness(0.06);
  if (e.code === 'KeyT') game.timeScale = game.timeScale === 1 ? 0.25 : 1;
});

// Touch UI
if (game.input.isTouch) document.body.classList.add('is-touch');
const joyBase = document.getElementById('joy-base'), joyKnob = document.getElementById('joy-knob');
game.input.onJoystick = (active, ox, oy, dx, dy) => {
  joyBase.style.display = active ? 'block' : 'none';
  if (active) { joyBase.style.left = ox + 'px'; joyBase.style.top = oy + 'px'; joyKnob.style.transform = `translate(calc(-50% + ${dx}px), calc(-50% + ${dy}px))`; }
};
document.getElementById('btn-attack').addEventListener('pointerdown', (e) => { e.stopPropagation(); e.preventDefault(); game.input.press('attack'); });

// Stats overlay
const statsEl = document.getElementById('stats');
game.add({ update: () => { const s = game.stats; statsEl.textContent = `fps ${s.fps} · calls ${s.drawCalls} · tris ${(s.triangles / 1000).toFixed(0)}k`; } });

// Welcome pop
setTimeout(() => vfx.pop.show(hero.root.position, 'Hi, I\'m Pip!', { color: '#FFA726', dur: 1.4, size: 1.2 }), 400);

game.start();
