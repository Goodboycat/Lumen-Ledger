// S71: credits card after THE END (ui/credits.js) on the tiny DOM shim.
import test from 'node:test'; import assert from 'node:assert/strict';
import { installDomShim, pressKey } from '../tools/domshim.mjs';
import { readFileSync } from 'node:fs';
installDomShim();
const { EventBus } = await import('../src/core/EventBus.js');
const { mountCredits } = await import('../ui/credits.js');
const story = JSON.parse(readFileSync(new URL('../data/story.json', import.meta.url), 'utf8'));
const mk = () => { const bus = new EventBus(); const root = document.createElement('div'); document.body.appendChild(root); const ev = []; bus.on('ui:credits:open', (p) => ev.push(['open', p])); bus.on('ui:credits:close', () => ev.push(['close'])); return { bus, root, ev, cr: mountCredits(root, { bus, lessons: story.lessons }) }; };
test('lists the 10 story lessons in season order', () => { const { cr } = mk(); assert.equal(cr.lessons.length, 10); assert.equal(cr.lessons[0].title, 'Budgeting'); assert.equal(cr.lessons[9].title, 'Planning for a Goal'); cr.destroy(); });
test('game:won opens it with the star total; closed before', () => { const { bus, cr, ev } = mk(); assert.equal(cr.isOpen, false); bus.emit('game:won', { season: 10, stars: 27 }); assert.equal(cr.isOpen, true); assert.match(cr.el.textContent, /27/); assert.match(cr.el.textContent, /30/); assert.deepEqual(ev[0], ['open', { stars: 27, seasons: 10 }]); cr.destroy(); });
test('Enter closes it (once) and a second Enter does nothing', () => { const { bus, cr, ev } = mk(); bus.emit('game:won', { season: 10, stars: 3 }); pressKey('Enter'); assert.equal(cr.isOpen, false); pressKey('Enter'); assert.equal(ev.filter((e) => e[0] === 'close').length, 1); cr.destroy(); });
test('BACK TO TITLE button closes; game:start also closes', () => { const { bus, cr } = mk(); bus.emit('game:won', { season: 10, stars: 9 }); cr.el.querySelector('.ll-credits-back').click(); assert.equal(cr.isOpen, false); bus.emit('game:won', { season: 10, stars: 9 }); bus.emit('game:start', {}); assert.equal(cr.isOpen, false); cr.destroy(); });
test('missing stars shows 0 and never NaN', () => { const { bus, cr } = mk(); bus.emit('game:won', {}); assert.doesNotMatch(cr.el.textContent, /NaN/); cr.destroy(); });
test('destroy removes the node', () => { const { root, cr } = mk(); cr.destroy(); assert.equal(root.children.length, 0); });
