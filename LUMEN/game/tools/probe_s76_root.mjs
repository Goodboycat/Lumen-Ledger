import { launch, startStory } from './rig76.mjs';
const { p, b } = await launch(844, 390);
await startStory(p);
console.log(JSON.stringify(await p.evaluate(() => { const r = document.querySelector('#game-root'); return [...r.children].map(e => e.tagName + '#' + e.id + '.' + String(e.className).slice(0, 40)); })));
await b.close();
