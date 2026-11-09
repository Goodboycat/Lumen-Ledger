// S77-B probe: chips = Cloud speaking icon-only, stacked below each other, fading over 5 s.  node tools/probe_s77_chips.mjs [W H]
import { launch, startStory, shot } from './rig76.mjs';
const W = +process.argv[2] || 844, H = +process.argv[3] || 390;
const { p, b, errs } = await launch(W, H); await startStory(p);
await p.evaluate(() => { const bus = lg.bus || lg.game?.bus || window.bus; window.__bus = bus; });
const has = await p.evaluate(() => !!window.__bus);
if (!has) { console.log('no bus on lg; keys:', await p.evaluate(() => Object.keys(lg).slice(0, 40))); }
await p.evaluate(() => { const bus = window.__bus; bus.emit('hud:chip', { id: 'storm', icon: 'stormmark', text: 'STORM COMING', on: true, alert: true }); bus.emit('hud:chip', { id: 'want:tea', want: 'tea', text: 'Nobody sells tea', on: true, ttl: 7 }); bus.emit('hud:new', { id: 'nightMarket', text: 'NEW: Night market' }); });
await p.waitForTimeout(450);
const m = async () => p.evaluate(() => [...document.querySelectorAll('.ll-chips > .ll-chip')].map((c) => { const r = c.getBoundingClientRect(); return { id: c.dataset.id, top: Math.round(r.top), left: Math.round(r.left), w: Math.round(r.width), h: Math.round(r.height), op: +getComputedStyle(c).opacity.slice(0, 4), sr: getComputedStyle(c.querySelector('.ll-sr')).position, hasText: /[A-Za-z]{3}/.test([...c.querySelectorAll('.ll-say *')].map((x) => x.childNodes.length && x.children.length === 0 ? x.textContent : '').join('')) }; }));
console.log('t0', JSON.stringify(await m()));
await shot(p, `s77_chips_${W}x${H}`);
await p.waitForTimeout(1200);
console.log('later', JSON.stringify(await m()));
await p.waitForTimeout(6000); console.log('after 6s', JSON.stringify(await m()));
console.log('errs', errs); await b.close();
