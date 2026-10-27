// LUMEN LEDGER — procedural icon set (replaces every emoji in the UI).
// Each icon is GENERATED in code from a few primitives (seeded wobbly blobs, star polygons, radial rays, rounded boxes)
// and emitted as inline SVG in the game's toon look: flat fills, a lighter top highlight and a thick ink (#263238) outline.
// Nothing is hand-drawn or loaded from a file; the same name always yields the same drawing (seed = hash of the name).
//
//   import { icon, iconize, iconName } from './icons.js';
//   el.innerHTML = icon('hammer') + ' BUILD';          // <svg class="ll-ico">…</svg>, sized 1.15em → follows font-size
//   el.innerHTML = iconize('Press 🔨 to build');         // any known emoji inside a string → its drawn icon
//   icon('owl', { cls: 'big' })                          // extra class
//   iconDataURL('lock')                                  // data: URL (CSS content / background)
//   drawIconOnCanvas(ctx, 'star', x, y, size)            // 3D pop-text sprites (Three canvas textures)

const INK = '#263238';
const C = {
  gold: '#FFD54F', goldD: '#F9A825', goldL: '#FFF3C4', grass: '#7ED957', grassD: '#43A047', leaf: '#66BB6A', leafD: '#2E7D32',
  blue: '#4FC3F7', blueD: '#0288D1', sky: '#B3E5FC', red: '#EF5350', redD: '#C62828', orange: '#FFA726', orangeD: '#EF6C00',
  purple: '#9575CD', purpleD: '#5E35B1', fog: '#B39DDB', pink: '#F48FB1', pinkD: '#D81B60', brown: '#A1887F', brownD: '#6D4C41',
  wood: '#C68B59', woodD: '#8D5A35', stone: '#B0BEC5', stoneD: '#78909C', white: '#FFFFFF', paper: '#FFF8E7', cream: '#FFE0B2',
  teal: '#4DB6AC', tealD: '#00897B', skin: '#FFCC80', dark: '#455A64',
};

// ---------- deterministic randomness ----------
const hash = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };
const rng = (seed) => () => { seed = (seed + 0x6D2B79F5) | 0; let t = Math.imul(seed ^ (seed >>> 15), 1 | seed); t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t; return ((t ^ (t >>> 14)) >>> 0) / 4294967296; };
const f = (n) => Math.round(n * 10) / 10;

// ---------- primitives (all in a 64×64 box) ----------
const sw = 3.2;   // ink width
// BUGFIX (icons PNG bake): `extra` may override stroke / stroke-width — strict XML parsers (rsvg, Inkscape) reject a
// redefined attribute, browsers silently keep the last. Drop the base attribute when extra sets it.
const st = (fill, extra = '') => {
  const base = { fill, stroke: INK, 'stroke-width': sw, 'stroke-linejoin': 'round', 'stroke-linecap': 'round' };
  for (const m of extra.matchAll(/\s([\w-]+)=/g)) delete base[m[1]];
  return Object.entries(base).map(([k, v]) => `${k}="${v}"`).join(' ') + extra;
};
const P = (d, fill = 'none', extra = '') => `<path d="${d}" ${st(fill, extra)}/>`;
const Pn = (d, fill) => `<path d="${d}" fill="${fill}"/>`;                     // no outline (highlights / shading)
const L = (d, w = sw, col = INK) => `<path d="${d}" fill="none" stroke="${col}" stroke-width="${w}" stroke-linecap="round" stroke-linejoin="round"/>`;
const O = (cx, cy, r, fill) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" ${st(fill)}/>`;
const On = (cx, cy, r, fill, op = 1) => `<circle cx="${f(cx)}" cy="${f(cy)}" r="${f(r)}" fill="${fill}" opacity="${op}"/>`;
const E = (cx, cy, rx, ry, fill) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" ${st(fill)}/>`;
const R = (x, y, w, h, r, fill) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" ${st(fill)}/>`;
const Rn = (x, y, w, h, r, fill, op = 1) => `<rect x="${f(x)}" y="${f(y)}" width="${f(w)}" height="${f(h)}" rx="${f(r)}" fill="${fill}" opacity="${op}"/>`;
const hi = (cx, cy, rx, ry, op = 0.55) => `<ellipse cx="${f(cx)}" cy="${f(cy)}" rx="${f(rx)}" ry="${f(ry)}" fill="#fff" opacity="${op}"/>`;
const eye = (x, y, r = 2.6) => On(x, y, r, INK) + On(x + r * 0.35, y - r * 0.35, r * 0.38, '#fff');

/** Star / sparkle polygon: n points, outer r1, inner r2, rotation. */
function starPts(cx, cy, n, r1, r2, rot = -Math.PI / 2) {
  const pts = []; for (let i = 0; i < n * 2; i++) { const r = i % 2 ? r2 : r1, a = rot + (i * Math.PI) / n; pts.push(`${f(cx + Math.cos(a) * r)},${f(cy + Math.sin(a) * r)}`); }
  return 'M' + pts.join('L') + 'Z';
}
/** Organic closed blob: k lobes around (cx,cy), radii jittered by the seeded rng → smooth quadratic path. */
function blob(cx, cy, rx, ry, rnd, k = 8, wob = 0.18) {
  const p = []; for (let i = 0; i < k; i++) { const a = (i / k) * Math.PI * 2, j = 1 + (rnd() * 2 - 1) * wob; p.push([cx + Math.cos(a) * rx * j, cy + Math.sin(a) * ry * j]); }
  let d = ''; for (let i = 0; i < k; i++) { const a = p[i], b = p[(i + 1) % k], m = [(a[0] + b[0]) / 2, (a[1] + b[1]) / 2]; d += (i ? '' : `M${f((p[k - 1][0] + a[0]) / 2)},${f((p[k - 1][1] + a[1]) / 2)}`) + `Q${f(a[0])},${f(a[1])} ${f(m[0])},${f(m[1])}`; }
  return d + 'Z';
}
/** Puffy cloud: circles along a baseline (used for foliage, fog, smoke, bushes). */
function puffs(cx, cy, w, h, rnd, n = 5) {
  const pts = []; for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); const x = cx - w / 2 + t * w; const arch = Math.sin(t * Math.PI); pts.push([x, cy - arch * h * 0.5 + (rnd() - 0.5) * 3, h * (0.42 + arch * 0.3 + rnd() * 0.12)]); }
  return pts;
}
const puffShape = (pts, fill, shade) => {
  const outline = pts.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r + sw / 2)}" fill="${INK}"/>`).join('');
  const body = pts.map(([x, y, r]) => `<circle cx="${f(x)}" cy="${f(y)}" r="${f(r - sw / 2)}" fill="${fill}"/>`).join('');
  const shine = pts.map(([x, y, r]) => `<circle cx="${f(x - r * 0.3)}" cy="${f(y - r * 0.35)}" r="${f(r * 0.35)}" fill="#fff" opacity=".35"/>`).join('');
  const sh = shade ? pts.map(([x, y, r]) => `<circle cx="${f(x + r * 0.15)}" cy="${f(y + r * 0.3)}" r="${f(r * 0.55)}" fill="${shade}" opacity=".45"/>`).join('') : '';
  return outline + body + sh + shine;
};
/** Radial rays (sun, burst, glow). */
const rays = (cx, cy, n, r1, r2, col = INK, w = 3, rot = 0) => { let d = ''; for (let i = 0; i < n; i++) { const a = rot + (i / n) * Math.PI * 2; d += `M${f(cx + Math.cos(a) * r1)},${f(cy + Math.sin(a) * r1)}L${f(cx + Math.cos(a) * r2)},${f(cy + Math.sin(a) * r2)}`; } return L(d, w, col); };
/** Ground shadow under objects. */
const shadow = (cx = 32, cy = 58, rx = 20) => `<ellipse cx="${cx}" cy="${cy}" rx="${rx}" ry="3.2" fill="${INK}" opacity=".18"/>`;

// ---------- generators: name → (rnd) => svg body ----------
const G = {};
const def = (names, fn) => names.split(' ').forEach((n) => { G[n] = fn; });

// --- currency / stars ---
def('spark', () => O(32, 32, 26, C.gold) + `<circle cx="32" cy="32" r="18" fill="none" stroke="${C.goldD}" stroke-width="3.5"/>` + P(starPts(32, 32, 4, 15, 5.5), INK) + hi(23, 21, 7, 4, 0.6));
def('glint', () => P(starPts(32, 32, 4, 24, 8), INK, ` stroke-width="1"`) + On(26, 26, 3, '#fff', 0.5));
def('star', () => P(starPts(32, 34, 5, 27, 12), C.gold) + Pn(starPts(32, 34, 5, 14, 6.5), C.goldL) + hi(26, 22, 5, 3, 0.7));
def('sparkle', () => P(starPts(32, 32, 4, 27, 8), C.gold) + P(starPts(51, 14, 4, 8, 3), C.goldL) + P(starPts(13, 50, 4, 6, 2.4), C.goldL));
def('coinbag', (r) => P('M18 26Q10 40 14 52Q32 60 50 52Q54 40 46 26Z', C.wood) + P('M22 26L18 14Q32 20 46 14L42 26Z', C.woodD) + L('M20 26H44', 4) + O(32, 42, 8, C.gold) + P(starPts(32, 42, 4, 5, 2), INK) + hi(22, 36, 3, 6, 0.35));
def('moneywing', () => P('M24 20Q6 10 4 22Q10 26 22 28Z', C.white) + P('M40 20Q58 10 60 22Q54 26 42 28Z', C.white) + R(18, 20, 28, 26, 4, C.grass) + O(32, 33, 6, C.grassD) + L('M32 29V37', 2.4, '#fff'));

// --- UI glyphs ---
def('check', () => P('M10 34L25 49L54 16', 'none', ` stroke-width="0"`) + L('M10 34L25 49L54 16', 13) + L('M10 34L25 49L54 16', 6.5, C.grass));
def('cross', () => L('M15 15L49 49M49 15L15 49', 13) + L('M15 15L49 49M49 15L15 49', 6.5, C.red));
def('play', () => P('M18 10Q16 8 18 8L52 30Q54 32 52 34L18 56Q16 56 16 54V10Z', C.grass) + hi(24, 22, 3, 7, 0.5));
def('pause', () => R(14, 10, 13, 44, 4, C.blue) + R(37, 10, 13, 44, 4, C.blue) + hi(20, 20, 2.5, 6) + hi(43, 20, 2.5, 6));
def('rotate', () => L('M50 30A18 18 0 1 1 40 15', 9) + L('M50 30A18 18 0 1 1 40 15', 4, C.blue) + P('M34 5L48 14L35 24Z', C.blue));
def('undo', () => L('M20 26H42A10 10 0 0 1 42 46H28', 10) + L('M20 26H42A10 10 0 0 1 42 46H28', 4.5, C.gold) + P('M22 14L8 26L22 38Z', C.gold));
def('home', () => P('M8 32L32 10L56 32H50V54H14V32Z', C.cream) + P('M5 32L32 7L59 32', 'none') + R(26, 38, 12, 16, 2, C.wood) + P('M44 12H51V24L44 18Z', C.redD));
def('gear', () => { let d = ''; const n = 8; for (let i = 0; i < n * 4; i++) { const a = (i / (n * 4)) * Math.PI * 2 - 0.2, r = (i % 4 < 2) ? 27 : 20; d += (i ? 'L' : 'M') + f(32 + Math.cos(a) * r) + ',' + f(32 + Math.sin(a) * r); } return P(d + 'Z', C.stone) + O(32, 32, 8, C.paper) + hi(24, 20, 6, 3, 0.4); });
def('info', () => O(32, 32, 26, C.blue) + On(32, 19, 4, '#fff') + L('M32 28V47', 7, '#fff'));
def('infinity', () => L('M32 32C24 18 8 20 8 32S24 46 32 32S56 18 56 32S40 46 32 32Z', 11) + L('M32 32C24 18 8 20 8 32S24 46 32 32S56 18 56 32S40 46 32 32Z', 5, C.purple));
def('chevR', () => L('M22 12L44 32L22 52', 12) + L('M22 12L44 32L22 52', 5.5, C.gold));
def('chevL', () => L('M42 12L20 32L42 52', 12) + L('M42 12L20 32L42 52', 5.5, C.gold));
def('chevD', () => L('M12 22L32 44L52 22', 12) + L('M12 22L32 44L52 22', 5.5, C.gold));
def('lock', () => L('M20 28V20A12 12 0 0 1 44 20V28', 9) + L('M20 28V20A12 12 0 0 1 44 20V28', 4, C.stone) + R(12, 27, 40, 30, 6, C.gold) + O(32, 40, 4, INK) + L('M32 42V49', 4) + hi(20, 33, 4, 2.5));
def('upgrade', () => P('M32 6L56 32H42V56H22V32H8Z', C.grass) + Pn('M32 14L46 29H38V50H32Z', '#fff" opacity=".25') + hi(26, 30, 2.5, 8, 0.45));
def('rocket', () => P('M32 4Q46 16 44 38H20Q18 16 32 4Z', C.white) + P('M20 30L10 44L20 42Z', C.red) + P('M44 30L54 44L44 42Z', C.red) + O(32, 24, 6, C.blue) + P('M24 40L32 60L40 40Z', C.orange) + Pn('M28 41L32 52L36 41Z', C.gold) + hi(27, 14, 2, 6));
def('boom', (r) => P(blob(32, 32, 28, 28, r, 14, 0.0).replace(/Q/g, 'L'), C.orange) + P(starPts(32, 32, 9, 28, 15, r() * 2), C.orange) + P(starPts(32, 32, 7, 17, 9, r()), C.gold) + On(32, 32, 5, '#fff'));
def('hammer', () => R(28, 24, 9, 36, 3, C.wood) + Rn(30, 27, 3, 30, 1.5, '#fff', 0.3) + R(10, 8, 44, 18, 4, C.stone) + Rn(13, 11, 38, 5, 2, '#fff', 0.45) + L('M46 9V25', 2.4, C.stoneD));
def('swords', () => { const blade = (rot) => `<g transform="rotate(${rot} 32 32)">${P('M29 4H35V40H29Z', C.stone)}${Pn('M30.5 6H32.5V38H30.5Z', '#fff')}${R(20, 38, 24, 6, 3, C.goldD)}${R(28.5, 44, 7, 12, 2, C.wood)}${O(32, 58, 3.5, C.gold)}</g>`; return blade(-35) + blade(35); });
def('dash', () => L('M6 22H36Q48 22 46 12Q44 6 38 8', 6) + L('M10 34H50Q60 34 58 44Q56 50 50 48', 6) + L('M4 46H28', 6) + L('M6 22H36Q48 22 46 12Q44 6 38 8', 2.6, C.sky) + L('M10 34H50Q60 34 58 44Q56 50 50 48', 2.6, C.sky) + L('M4 46H28', 2.6, C.sky));
def('hand', () => P('M18 36V18Q18 13 22 13Q26 13 26 18V30V12Q26 7 30 7Q34 7 34 12V30V14Q34 9 38 9Q42 9 42 14V32V22Q42 17 46 17Q50 17 50 22V40Q50 58 32 58Q22 58 16 48L8 36Q6 31 10 30Q14 29 18 36Z', C.skin) + L('M26 30V40M34 30V40M42 32V40', 2) + hi(30, 44, 6, 3, 0.4));
def('point', () => P('M24 30V10Q24 4 29.5 4Q35 4 35 10V30L44 31Q52 32 52 40V50Q52 60 40 60H30Q22 60 18 52L12 42Q10 37 14 36Q18 35 22 40L24 42Z', C.skin) + L('M35 31V40M43 32V40', 2) + hi(28, 16, 2, 5, 0.5));
def('pointR', () => `<g transform="rotate(90 32 32)">${G.point()}</g>`);
def('eyes', () => E(20, 32, 12, 15, '#fff') + E(44, 32, 12, 15, '#fff') + On(23, 34, 6, INK) + On(47, 34, 6, INK) + On(25, 31, 2.2, '#fff') + On(49, 31, 2.2, '#fff'));
def('bolt', () => P('M36 4L12 36H30L24 60L52 24H34L42 4Z', C.gold) + hi(32, 14, 2.5, 6, 0.6));
def('warn', () => P('M32 5L60 55H4Z', C.orange) + L('M32 22V38', 6) + On(32, 46, 3.5, INK));
def('bulb', () => P('M32 6A18 18 0 0 1 44 38Q41 41 41 46H23Q23 41 20 38A18 18 0 0 1 32 6Z', C.gold) + R(23, 46, 18, 6, 2, C.stone) + R(25, 52, 14, 6, 3, C.stoneD) + L('M27 36Q32 26 37 36', 2.4, C.orangeD) + hi(25, 18, 4, 6, 0.6) + rays(32, 24, 5, 26, 31, C.goldD, 3, -Math.PI * 0.95));
def('clock', () => O(32, 35, 24, C.white) + R(27, 4, 10, 7, 2, C.red) + L('M32 11V12') + L('M32 35V21M32 35L42 41', 4.5) + rays(32, 35, 12, 18, 21, INK, 2.2) + On(32, 35, 3, C.red));
def('hourglass', () => R(12, 4, 40, 7, 3, C.wood) + R(12, 53, 40, 7, 3, C.wood) + P('M17 11H47Q47 26 34 32Q47 38 47 53H17Q17 38 30 32Q17 26 17 11Z', C.sky) + Pn('M22 17H42Q40 26 32 30Q24 26 22 17Z', C.gold) + Pn('M21 51Q24 42 32 40Q40 42 43 51Z', C.gold));
def('calendar', () => R(8, 12, 48, 44, 6, C.white) + `<path d="M8 18Q8 12 14 12H50Q56 12 56 18V24H8Z" fill="${C.red}" stroke="${INK}" stroke-width="${sw}"/>` + L('M20 6V16M44 6V16', 5) + [0, 1, 2].map((i) => [0, 1].map((j) => Rn(15 + i * 13, 30 + j * 12, 8, 7, 2, j === 1 && i === 1 ? C.red : C.stone)).join('')).join(''));
def('ledger', () => R(12, 6, 42, 52, 5, C.orange) + R(8, 6, 10, 52, 4, C.orangeD) + R(24, 16, 22, 10, 2, C.paper) + L('M27 21H43', 2) + L('M12 14H6M12 26H6M12 38H6M12 50H6', 3) + hi(30, 44, 9, 3, 0.25));
def('book', () => P('M32 14Q22 6 6 10V54Q22 50 32 58Z', C.blue) + P('M32 14Q42 6 58 10V54Q42 50 32 58Z', C.blueD) + P('M32 18Q24 12 11 14V48Q24 46 32 52Z', C.paper) + P('M32 18Q40 12 53 14V48Q40 46 32 52Z', C.paper) + L('M16 22Q22 21 27 24M16 30Q22 29 27 32M37 24Q42 21 48 22M37 32Q42 29 48 30', 2));
def('scroll', () => P('M14 10H48Q54 10 54 16V50Q54 56 48 56H18', C.paper) + O(14, 14, 6, C.cream) + P('M8 50Q8 56 14 56Q20 56 20 50Q20 44 14 44H44V50', C.cream) + L('M24 22H44M24 30H44M24 38H38', 2.6, C.brown));
def('map', () => P('M4 14L22 8L42 14L60 8V50L42 56L22 50L4 56Z', C.paper) + L('M22 8V50M42 14V56', 2.2, C.brown) + P(blob(30, 32, 10, 8, rng(7), 7, 0.25), C.grass) + L('M10 44Q20 40 26 44T46 26', 2.4, C.red + '" stroke-dasharray="3 4') + L('M46 22L52 28M52 22L46 28', 3, C.red));
def('tophat', () => E(32, 48, 28, 8, INK) + R(16, 10, 32, 38, 4, '#37474F') + Rn(16, 34, 32, 7, 0, C.red) + L('M16 34H48M16 41H48', 2) + hi(23, 20, 2.5, 7, 0.25) + O(46, 38, 3, C.gold));
def('angry', () => O(32, 32, 26, C.red) + L('M16 20L28 26M48 20L36 26', 4) + eye(23, 31, 3) + eye(41, 31, 3) + L('M22 47Q32 38 42 47', 4) + hi(22, 16, 6, 3, 0.35));
def('think', () => O(32, 32, 26, C.gold) + eye(23, 26, 3) + eye(41, 24, 3) + L('M24 44H40', 4) + L('M18 18L28 16M38 14L46 18', 3) + P('M38 46Q46 40 52 46Q54 54 46 56Q42 56 40 52', C.skin) + hi(22, 14, 6, 3, 0.4));
def('umbrella', () => P('M6 32A26 22 0 0 1 58 32Q51 27 45 32Q38 27 32 32Q26 27 19 32Q13 27 6 32Z', C.purple) + Pn('M14 26Q32 6 50 26Q40 20 32 22Q24 20 14 26Z', '#fff" opacity=".25') + L('M32 10V52Q32 58 26 58Q21 58 21 53', 4.5) + L('M32 6V10', 4.5));
def('chart', () => R(6, 6, 52, 52, 6, C.white) + R(14, 38, 8, 12, 1.5, C.blue) + R(28, 28, 8, 22, 1.5, C.blue) + R(42, 18, 8, 32, 1.5, C.blue) + L('M12 34L26 24L36 28L52 12', 4.5) + L('M12 34L26 24L36 28L52 12', 2, C.grass) + P('M46 10H54V18Z', C.grass));
def('sprout', () => shadow() + P('M16 46H48L44 60H20Z', C.wood) + R(13, 42, 38, 7, 3, C.woodD) + L('M32 42V26', 4.5) + P('M32 30Q14 30 12 14Q30 12 32 30Z', C.grass) + P('M32 26Q36 8 54 8Q54 26 32 26Z', C.leaf) + L('M32 30Q22 24 17 17M32 26Q41 18 49 13', 1.8, C.leafD));
def('shield', () => P('M32 4L56 12V30Q56 50 32 60Q8 50 8 30V12Z', C.blue) + Pn('M32 4L56 12V30Q56 50 32 60Z', C.blueD) + P('M32 4L56 12V30Q56 50 32 60Q8 50 8 30V12Z', 'none') + P(starPts(32, 30, 5, 12, 5.5), C.gold));
def('basket', () => P('M8 28H56L50 56H14Z', C.wood) + L('M14 36H52M16 46H50M24 28L26 56M32 28V56M40 28L38 56', 2, C.woodD) + O(22, 24, 7, C.red) + O(34, 22, 7, C.gold) + O(45, 25, 6, C.grass) + L('M12 28Q32 2 52 28', 4));
def('fog', (r) => puffShape(puffs(32, 36, 38, 28, r, 5), C.fog, C.purple) + L('M6 52H40M18 58H54', 4, C.purpleD));
def('owl', () => P('M10 30Q10 6 32 6Q54 6 54 30V44Q54 60 32 60Q10 60 10 44Z', C.brown) + P('M10 14L18 4L24 12M54 14L46 4L40 12', C.brown) + P('M20 38Q32 60 44 38Q44 56 32 56Q20 56 20 38Z', C.cream) + O(22, 26, 9, '#fff') + O(42, 26, 9, '#fff') + eye(23, 27, 4) + eye(41, 27, 4) + P('M28 34L32 42L36 34Z', C.orange) + L('M26 46L28 49M32 47V50M38 46L36 49', 1.8, C.brown));

// --- stalls (market icons) ---
def('apple', () => shadow() + P('M32 18Q20 8 11 20Q4 34 14 48Q22 60 32 54Q42 60 50 48Q60 34 53 20Q44 8 32 18Z', C.red) + L('M32 18Q31 10 36 4', 4) + P('M35 12Q44 2 52 8Q44 18 35 12Z', C.leaf) + hi(20, 26, 4, 7, 0.55));
def('bread', () => shadow() + P('M6 40Q4 22 32 20Q60 22 58 40Q58 50 32 50Q6 50 6 40Z', C.orange) + Pn('M10 38Q10 26 32 25Q54 26 54 38Z', C.gold) + L('M20 28Q24 34 22 40M32 26Q36 33 34 40M44 28Q48 34 46 40', 3, C.orangeD));
def('lantern', () => L('M32 2V10', 3.5) + R(22, 8, 20, 6, 2, C.redD) + E(32, 32, 20, 18, C.red) + L('M32 14Q20 32 32 50M32 14Q44 32 32 50', 2.2, C.redD) + R(22, 48, 20, 6, 2, C.redD) + L('M30 54V62M34 54V62', 2.6, C.gold) + hi(24, 26, 4, 6, 0.4) + On(32, 32, 6, C.gold, 0.6));
def('fish', () => P('M8 32Q24 12 44 26L58 14V50L44 38Q24 52 8 32Z', C.blue) + Pn('M12 34Q26 46 44 36Z', C.sky) + eye(19, 29, 3) + L('M28 24Q32 32 28 40', 2.4, C.blueD) + P('M30 20L36 10L42 24Z', C.blueD));
def('tulip', () => L('M32 30V60', 4.5, C.leafD) + P('M32 52Q14 50 12 32Q28 34 32 52Z', C.leaf) + P('M32 46Q50 44 52 28Q36 30 32 46Z', C.leaf) + P('M16 10L24 20L32 6L40 20L48 10Q50 34 32 34Q14 34 16 10Z', C.pink) + Pn('M32 10L38 22L32 32Z', C.pinkD));
def('thread', () => R(14, 6, 36, 8, 3, C.wood) + R(14, 50, 36, 8, 3, C.wood) + R(19, 14, 26, 36, 4, C.purple) + L('M19 20L45 26M19 28L45 34M19 36L45 42M19 44L45 48', 2.2, C.purpleD) + L('M45 30Q56 32 54 46Q52 58 60 60', 3, C.purple) + L('M56 6L48 60', 2.2, C.stoneD));
def('vase', () => shadow() + P('M24 6H40V12Q40 16 46 22Q56 32 50 48Q46 58 32 58Q18 58 14 48Q8 32 18 22Q24 16 24 12Z', C.orange) + R(22, 4, 20, 6, 3, C.orangeD) + L('M14 36Q32 44 50 36', 3.5, C.cream) + L('M12 44Q32 50 52 44', 2, C.orangeD) + hi(22, 28, 3, 6, 0.4));
def('teddy', () => O(16, 14, 8, C.brown) + O(48, 14, 8, C.brown) + On(16, 14, 4, C.cream) + On(48, 14, 4, C.cream) + O(32, 46, 16, C.brown) + O(32, 26, 16, C.brown) + E(32, 31, 7, 5.5, C.cream) + On(32, 29, 2.5, INK) + eye(25, 22, 2.4) + eye(39, 22, 2.4) + E(32, 48, 8, 7, C.cream));
def('tea', () => shadow(30) + P('M10 26H46V40Q46 56 28 56Q10 56 10 40Z', C.white) + P('M46 30Q58 30 56 40Q54 48 44 46', 'none') + E(28, 26, 18, 4, C.tealD) + L('M20 18Q16 12 22 8M30 18Q26 10 32 4M38 18Q34 12 40 8', 2.6, C.stoneD) + L('M18 40Q28 46 38 40', 2.4, C.teal));
def('books', () => R(6, 20, 12, 38, 2, C.red) + R(18, 12, 12, 46, 2, C.blue) + `<g transform="rotate(14 46 58)">${R(34, 14, 12, 44, 2, C.grass)}</g>` + L('M8 28H16M8 50H16M20 20H28M20 50H28', 2, '#fff') + shadow(32, 60, 26));
def('trowel', () => G.hammer());

// --- nature ---
const trunk = (x = 32, top = 36, w = 8) => R(x - w / 2, top, w, 58 - top, 2, C.woodD);
def('treeRound', (r) => shadow() + trunk() + puffShape(puffs(32, 28, 34, 34, r, 4), C.leaf, C.leafD));
def('treeCone', () => shadow() + trunk(32, 46, 7) + P('M32 4L50 26H42L54 46H10L22 26H14Z', C.leafD) + Pn('M32 10L26 24H32Z', '#fff" opacity=".25'));
def('treePalm', () => shadow() + P('M30 58Q28 40 34 22L38 22Q34 40 36 58Z', C.wood) + L('M31 48H36M32 38H36M33 30H37', 1.8, C.woodD) + P('M36 20Q20 8 6 18Q22 16 36 22Z', C.leaf) + P('M36 20Q52 6 60 18Q46 14 36 22Z', C.leaf) + P('M36 20Q32 2 18 4Q30 10 36 22Z', C.grass) + P('M36 20Q48 34 50 42Q40 30 34 22Z', C.leafD) + O(34, 24, 3.5, C.brownD));
def('treeBlossom', (r) => shadow() + trunk() + puffShape(puffs(32, 28, 34, 32, r, 4), C.pink, C.pinkD) + [0, 1, 2, 3, 4].map(() => P(starPts(14 + r() * 36, 12 + r() * 24, 5, 3, 1.5), '#fff')).join(''));
def('chime', () => L('M8 10H56', 5) + L('M32 2V10', 3) + [14, 24, 34, 44, 52].map((x, i) => L(`M${x} 10V${16 + i * 3}`, 1.6) + R(x - 3, 16 + i * 3, 6, 20 - i * 2, 3, [C.blue, C.teal, C.gold, C.pink, C.purple][i])).join('') + P('M28 44H36L34 58H30Z', C.paper) + L('M32 36V44', 1.6));
def('rock', (r) => shadow() + P(blob(32, 40, 24, 16, r, 7, 0.18), C.stone) + Pn(blob(26, 34, 10, 5, r, 6, 0.2), '#fff" opacity=".35') + L(`M${f(30 + r() * 8)} 30L${f(34 + r() * 6)} 42`, 2, C.stoneD));
def('mountain', () => shadow(32, 58, 28) + P('M2 56L24 14L34 30L42 20L62 56Z', C.stoneD) + P('M24 14L31 28L26 26L20 31L18 26Z', '#fff') + P('M42 20L48 31L43 29L39 33L36 29Z', '#fff'));
def('spire', () => shadow() + P('M4 56L26 12Q32 6 38 12L60 56Z', C.blueD) + P('M26 12Q32 6 38 12L44 24L38 22L32 28L26 22L20 24Z', '#fff'));
def('gem', () => shadow() + P('M18 10H46L58 26L32 58L6 26Z', C.teal) + L('M6 26H58M18 10L24 26L32 58L40 26L46 10M24 26L32 10L40 26', 2.2, C.tealD) + hi(20, 18, 4, 3, 0.6));
def('bridge', () => P('M2 30Q32 8 62 30V40H2Z', C.wood) + L('M2 30Q32 8 62 30', 4) + R(2, 38, 60, 8, 2, C.woodD) + L('M14 24V38M24 20V38M32 19V38M40 20V38M50 24V38', 2.4) + P('M2 56Q16 50 32 56T62 56', 'none', ` stroke="${C.blueD}"`));
def('wall', () => R(6, 12, 52, 44, 3, C.orange) + L('M6 26H58M6 41H58M24 12V26M44 12V26M14 26V41M34 26V41M54 26V41M24 41V56M44 41V56', 2.6, C.orangeD) + Rn(9, 15, 12, 3, 1.5, '#fff', 0.4));
def('bush', (r) => shadow() + puffShape(puffs(32, 40, 38, 24, r, 5), C.grass, C.leafD));
def('berries', (r) => shadow() + puffShape(puffs(32, 40, 38, 24, r, 5), C.leaf, C.leafD) + [0, 1, 2, 3, 4, 5].map(() => O(14 + r() * 36, 30 + r() * 16, 3.6, C.purpleD) + On(0, 0, 0, '#fff')).join(''));
def('bouquet', (r) => L('M32 60L22 30M32 60L32 28M32 60L42 30', 3, C.leafD) + P('M22 44L42 44L36 58H28Z', C.paper) + [[20, 22, C.pink], [32, 16, C.gold], [44, 22, C.red], [26, 30, C.purple], [38, 30, C.white]].map(([x, y, c]) => P(starPts(x, y, 5, 8, 4.5, r()), c) + On(x, y, 2.2, C.orange)).join(''));
def('wheat', () => [18, 32, 46].map((x, i) => L(`M${x} 60Q${x + (i - 1) * 2} 34 ${x + (i - 1) * 4} 14`, 2.6, C.goldD) + [0, 1, 2, 3].map((k) => E(x + (i - 1) * 3 - 4, 18 + k * 7, 3.4, 5.5, C.gold) + E(x + (i - 1) * 3 + 4, 18 + k * 7, 3.4, 5.5, C.gold)).join('')).join(''));
def('droplet', () => P('M32 4Q50 30 50 40A18 18 0 0 1 14 40Q14 30 32 4Z', C.blue) + hi(25, 36, 3.5, 7, 0.6));

// --- landmarks ---
def('lighthouse', () => shadow() + P('M22 56L26 18H38L42 56Z', C.white) + Pn('M24.6 38L25.6 30H38.4L39.4 38Z', C.red) + Pn('M23 52L23.8 46H40.2L41 52Z', C.red) + P('M22 56L26 18H38L42 56Z', 'none') + R(22, 10, 20, 9, 2, C.gold) + P('M20 10L32 2L44 10Z', C.red) + rays(32, 14, 6, 14, 22, C.goldD, 3, Math.PI) + R(29, 46, 6, 10, 2, C.woodD));
def('house', () => shadow() + R(12, 28, 40, 28, 3, C.cream) + P('M6 30L32 8L58 30Z', C.red) + R(28, 40, 10, 16, 2, C.wood) + R(16, 34, 9, 9, 2, C.sky) + R(42, 12, 6, 12, 1, C.stoneD));
def('anchor', () => O(32, 12, 6, 'none') + L('M32 18V56', 6) + L('M20 26H44', 5) + L('M8 38Q10 56 32 56Q54 56 56 38', 6) + P('M2 40L8 32L14 40Z', INK) + P('M50 40L56 32L62 40Z', INK) + L('M32 18V56M8 38Q10 56 32 56Q54 56 56 38', 2.4, C.stone));
def('pagoda', () => shadow() + R(20, 42, 24, 14, 2, C.redD) + P('M8 44L32 34L56 44Z', C.purple) + R(23, 24, 18, 12, 2, C.redD) + P('M12 26L32 16L52 26Z', C.purple) + P('M18 16L32 6L46 16Z', C.purple) + L('M32 6V0', 3) + R(28, 46, 8, 10, 1, C.gold));
def('jar', () => shadow() + P('M20 14H44V20Q52 26 52 38V48Q52 58 42 58H22Q12 58 12 48V38Q12 26 20 20Z', C.sky + '" fill-opacity=".9') + Pn('M15 40H49V48Q49 55 42 55H22Q15 55 15 48Z', C.gold) + R(18, 6, 28, 9, 3, C.wood) + hi(20, 30, 3, 7, 0.7));
def('log', () => shadow() + R(6, 22, 46, 26, 13, C.wood) + E(50, 35, 9, 13, C.cream) + `<ellipse cx="50" cy="35" rx="4" ry="6.5" fill="none" stroke="${C.woodD}" stroke-width="2"/>` + L('M14 30H36M18 40H40', 2, C.woodD));
def('door', () => R(14, 4, 36, 54, 5, C.wood) + L('M24 4V58M32 4V58M40 4V58', 2, C.woodD) + R(12, 14, 40, 6, 2, C.stoneD) + R(12, 42, 40, 6, 2, C.stoneD) + O(42, 32, 3, C.gold));
def('crate', () => shadow() + R(8, 12, 48, 44, 3, C.wood) + L('M8 12L56 56M56 12L8 56', 4, C.woodD) + R(8, 12, 48, 44, 3, 'none') + L('M8 24H56M8 44H56', 2.4));
def('barrel', () => shadow() + P('M14 8H50Q56 32 50 56H14Q8 32 14 8Z', C.wood) + L('M11 20H53M11 44H53', 4, C.stoneD) + L('M24 8Q22 32 24 56M40 8Q42 32 40 56', 2, C.woodD) + hi(20, 30, 2, 8, 0.35));
def('signArrow', () => R(28, 24, 8, 36, 2, C.woodD) + P('M6 10H44L58 22L44 34H6Z', C.wood) + L('M14 22H40', 4, C.paper) + P('M36 16L44 22L36 28', 'none', ` stroke="${C.paper}"`));
def('signBoard', () => L('M14 30V60M50 30V60', 6) + L('M14 30V60M50 30V60', 2.5, C.woodD) + R(6, 8, 52, 30, 4, C.wood) + L('M14 18H50M14 27H40', 3, C.paper));
def('bench', () => R(6, 18, 52, 9, 3, C.wood) + R(6, 31, 52, 9, 3, C.wood) + L('M12 40V58M52 40V58', 5) + L('M12 40V58M52 40V58', 2, C.stoneD) + L('M16 27V31M48 27V31', 4));
def('pathDirt', (r) => R(6, 6, 52, 52, 8, C.brown) + [0, 1, 2, 3, 4, 5, 6].map(() => On(12 + r() * 40, 12 + r() * 40, 2 + r() * 2.5, C.brownD, 0.7)).join(''));
def('pathStone', (r) => R(6, 6, 52, 52, 8, C.grass) + [[19, 19], [44, 18], [20, 44], [44, 44]].map(([x, y]) => P(blob(x, y, 10, 9, r, 6, 0.15), C.stone)).join(''));
def('banner', () => L('M4 12Q32 26 60 12', 3) + [10, 22, 34, 46].map((x, i) => { const y = 14 + Math.sin(((x + 4) / 64) * Math.PI) * 7; return P(`M${x} ${f(y)}H${x + 9}L${x + 4.5} ${f(y + 16)}Z`, [C.red, C.gold, C.blue, C.grass][i]); }).join('') + L('M4 6V60', 4) + L('M60 6V60', 4));
def('pot', () => P('M16 36H48L44 60H20Z', C.orange) + R(13, 32, 38, 7, 3, C.orangeD) + P('M32 34Q10 30 12 12Q30 14 32 34Z', C.leaf) + P('M32 34Q54 30 52 10Q34 14 32 34Z', C.grass) + P('M32 34Q26 16 32 4Q38 16 32 34Z', C.leafD));
def('trough', () => shadow() + P('M4 24H60L54 52H10Z', C.wood) + E(32, 25, 27, 5, C.blue) + L('M10 40H54', 2, C.woodD) + L('M14 52V60M50 52V60', 4) + hi(22, 24, 6, 1.6, 0.6));
def('square', () => R(12, 12, 40, 40, 8, C.stone) + hi(24, 20, 7, 3, 0.5));

// ---------- S35: the five emoji that still slipped through (⏩ ⏭ 🔍 🧹 📣) ----------
def('fastforward', () => O(32, 32, 27, C.blue) + P('M14 20L30 32L14 44Z', '#fff') + P('M32 20L48 32L32 44Z', '#fff') + hi(22, 16, 7, 3, 0.35));
def('skipnext', () => O(32, 32, 27, C.blue) + P('M16 20L36 32L16 44Z', '#fff') + R(40, 20, 7, 24, 2, '#fff') + hi(22, 16, 7, 3, 0.35));
def('magnify', () => O(26, 26, 17, C.sky) + hi(20, 19, 5, 3, 0.7) + L('M38 38L56 56', 9) + L('M38 38L56 56', 4, C.wood));
def('broom', () => L('M44 6L26 36', 6) + L('M44 6L26 36', 2.6, C.wood) + P('M14 34L34 40L30 60Q20 62 10 54Z', C.gold) + L('M18 42L14 56M24 44L22 58', 2, C.goldD) + R(13, 30, 22, 8, 3, C.red));
def('megaphone', () => P('M10 26H22L48 12V52L22 38H10Z', C.red) + R(8, 24, 8, 16, 3, C.redD) + P('M22 38L20 56H28L30 40Z', C.dark) + L('M52 24Q58 32 52 40', 3.5) + L('M54 16Q64 32 54 48', 3, C.redD));

// ---------- S35: character FACES for the dialogue portraits (drawn, not CSS) — face_<who>[_<mood>] ----------
// kind: pip (orange cap of hair, skin face, sword-scarf KNOT at the collar — no more "red stick") · baron (purple, top hat, monocle)
//       owl (Tally-Owl) · glimmer (blue blob) · collector (fog blob, purple cap). mood: neutral | happy | sad | angry | shout
const FACE_MOODS = ['neutral', 'happy', 'sad', 'angry', 'shout'];
function faceMouth(cx, cy, mood, w = 10) {
  if (mood === 'happy') return P(`M${cx - w} ${cy}Q${cx} ${cy + w * 1.2} ${cx + w} ${cy}Z`, C.redD) + Pn(`M${cx - w * 0.6} ${cy + 1}Q${cx} ${cy + w * 0.9} ${cx + w * 0.6} ${cy + 1}Z`, C.pink);
  if (mood === 'sad') return L(`M${cx - w * 0.8} ${cy + 4}Q${cx} ${cy - 4} ${cx + w * 0.8} ${cy + 4}`, 3);
  if (mood === 'angry') return L(`M${cx - w * 0.8} ${cy + 2}L${cx + w * 0.8} ${cy}`, 3.4);
  if (mood === 'shout') return E(cx, cy + 2, w * 0.55, w * 0.75, C.redD) + hi(cx, cy + 6, w * 0.3, w * 0.25, 0.9);
  return L(`M${cx - w * 0.6} ${cy}Q${cx} ${cy + 4} ${cx + w * 0.6} ${cy}`, 3);
}
function faceEyes(lx, rx, y, mood, r = 3.2) {
  if (mood === 'angry') return eye(lx, y + 1, r) + eye(rx, y + 1, r) + L(`M${lx - 6} ${y - 7}L${lx + 5} ${y - 3}M${rx + 6} ${y - 7}L${rx - 5} ${y - 3}`, 3);
  if (mood === 'happy') return L(`M${lx - 4} ${y + 1}Q${lx} ${y - 5} ${lx + 4} ${y + 1}`, 3.2) + L(`M${rx - 4} ${y + 1}Q${rx} ${y - 5} ${rx + 4} ${y + 1}`, 3.2);
  if (mood === 'sad') return eye(lx, y + 1, r) + eye(rx, y + 1, r) + L(`M${lx - 5} ${y - 6}L${lx + 4} ${y - 3}M${rx + 5} ${y - 6}L${rx - 4} ${y - 3}`, 2.4) + On(lx + 4, y + 6, 1.6, C.sky);
  if (mood === 'shout') return eye(lx, y, r + 0.8) + eye(rx, y, r + 0.8);
  return eye(lx, y, r) + eye(rx, y, r);
}
const FACES = {
  pip: (m) => shadow(32, 60, 16)
    + P('M14 56Q14 46 32 46Q50 46 50 56Z', C.orange)                                        // shoulders (shirt)
    + P('M18 48Q32 54 46 48L44 54Q32 58 20 54Z', C.red) + O(44, 52, 4.2, C.red) + P('M46 54L54 60L50 50Z', C.redD)   // scarf band + knot + tail
    + O(32, 30, 17, C.skin)                                                                  // head
    + P('M15 28Q14 10 32 11Q50 10 49 28Q44 18 36 20Q30 14 26 20Q19 18 15 28Z', C.orangeD)    // hair cap
    + P('M24 14Q28 4 34 10Q38 4 42 14Z', C.orangeD)                                           // tuft
    + On(24, 38, 3, '#ff8a80', 0.55) + On(40, 38, 3, '#ff8a80', 0.55)                          // blush
    + faceEyes(26, 38, 31, m) + faceMouth(32, 40, m, 7) + hi(24, 22, 4, 2, 0.35),
  baron: (m) => shadow(32, 60, 18)
    + P('M10 58Q10 44 32 44Q54 44 54 58Z', '#37474F') + P('M28 46L32 54L36 46Z', C.red)         // coat + cravat
    + O(32, 32, 17, C.fog)                                                                    // head
    + E(32, 15, 22, 4, INK) + R(18, 2, 28, 14, 2, '#37474F') + Rn(18, 10, 28, 4, 0, C.red)      // top hat (brim, crown, band)
    + faceEyes(26, 38, 31, m === 'happy' ? 'neutral' : m)
    + O(38, 31, 6.2, 'none') + L('M44 33L50 44', 2.2) + On(38, 31, 5, C.gold, 0.18)             // monocle + chain
    + P('M22 36Q27 40 32 37Q37 40 42 36', 'none') + faceMouth(32, 42, m === 'neutral' ? 'happy' : m, 8),
  owl: () => '',   // filled in below: the existing 'owl' drawing is reused
  glimmer: (m) => shadow(32, 60, 16) + P('M12 56Q10 20 32 16Q54 20 52 56Q32 62 12 56Z', C.blue) + hi(22, 28, 6, 4, 0.5)
    + P('M28 16Q32 6 36 16Z', C.blueD) + faceEyes(25, 39, 36, m, 3.6) + faceMouth(32, 46, m, 7),
  collector: (m) => shadow(32, 60, 16) + P('M12 56Q10 22 32 18Q54 22 52 56Q32 62 12 56Z', '#9c89c4') + hi(22, 30, 6, 4, 0.4)
    + P('M18 22Q32 6 46 22Z', '#4a148c') + R(16, 20, 32, 6, 2, '#4a148c')                      // pointy cap
    + faceEyes(25, 39, 36, m, 3.4) + faceMouth(32, 46, m, 7),
};
for (const who of Object.keys(FACES)) for (const m of FACE_MOODS) {
  const key = m === 'neutral' ? `face_${who}` : `face_${who}_${m}`;
  if (who === 'owl') {
    def(key, (r) => G.owl(r) + (m === 'happy' ? L('M14 26Q22 20 30 26M34 26Q42 20 50 26', 3.2) : m === 'angry' ? L('M14 16L28 22M50 16L36 22', 3.4) : m === 'sad' ? L('M14 20L28 16M50 20L36 16', 2.6) : m === 'shout' ? E(32, 42, 4, 5, C.redD) : ''));
  } else def(key, () => FACES[who](m));
}
export const faceIcon = (who, mood) => `face_${who}${mood && mood !== 'neutral' && FACE_MOODS.includes(mood) ? '_' + mood : ''}`;

// ---------- emoji → icon name (everything the game used to print) ----------
export const EMOJI = {
  '🦉': 'owl', '🔨': 'hammer', '🫙': 'jar', '📒': 'ledger', '⬆️': 'upgrade', '⬆': 'upgrade', '✨': 'sparkle', '🏺': 'vase', '🌫️': 'fog', '🌫': 'fog',
  '👀': 'eyes', '⚡': 'bolt', '★': 'star', '⭐': 'star', '✦': 'spark', '✓': 'check', '✔': 'check', '✗': 'cross', '✕': 'cross', '✖': 'cross', '🔒': 'lock',
  '🚀': 'rocket', '💥': 'boom', '⟳': 'rotate', '⏸': 'pause', '▶': 'play', '⚙': 'gear', '📖': 'book', '📘': 'book', '⌂': 'home', 'ⓘ': 'info', 'ℹ': 'info',
  '⚔': 'swords', '✋': 'hand', '💨': 'dash', '👆': 'point', '👉': 'pointR', '📅': 'calendar', '💡': 'bulb', '⏱': 'clock', '💰': 'coinbag', '🗼': 'lighthouse',
  '🤔': 'think', '☂️': 'umbrella', '☂': 'umbrella', '📈': 'chart', '🎩': 'tophat', '🌱': 'sprout', '🛡️': 'shield', '🛡': 'shield', '🧺': 'basket', '⏳': 'hourglass',
  '⚠': 'warn', '📜': 'scroll', '💸': 'moneywing', '😠': 'angry', '🗺': 'map', '∞': 'infinity', '▸': 'chevR', '◂': 'chevL', '▾': 'chevD', '▼': 'chevD',
  '🍎': 'apple', '🥖': 'bread', '🏮': 'lantern', '🐟': 'fish', '🌷': 'tulip', '🧵': 'thread', '🧸': 'teddy', '🍵': 'tea', '📚': 'books',
  '🌳': 'treeRound', '🌲': 'treeCone', '🌴': 'treePalm', '🌸': 'treeBlossom', '🎐': 'chime', '🪨': 'rock', '⛰️': 'mountain', '⛰': 'mountain', '🗻': 'spire',
  '💎': 'gem', '🌉': 'bridge', '🧱': 'wall', '🌿': 'bush', '🫐': 'berries', '💐': 'bouquet', '🌾': 'wheat', '🏠': 'house', '⚓': 'anchor', '🏯': 'pagoda',
  '💧': 'droplet', '🪵': 'log', '🚪': 'door', '📦': 'crate', '🛢️': 'barrel', '🛢': 'barrel', '➡️': 'signArrow', '🪧': 'signBoard', '🪑': 'bench', '🟫': 'pathDirt',
  '⬜': 'pathStone', '🎏': 'banner', '🪴': 'pot', '🛁': 'trough', '▪️': 'square', '▪': 'square', '↩': 'undo', '↩️': 'undo',
  '⏩': 'fastforward', '⏭': 'skipnext', '🔍': 'magnify', '🧹': 'broom', '📣': 'megaphone',
};

const cache = new Map();
/** Raw SVG markup for a name (or an emoji). Unknown → null. */
function svgBody(name) {
  const n = G[name] ? name : EMOJI[name];
  if (!n || !G[n]) return null;
  if (!cache.has(n)) cache.set(n, G[n](rng(hash(n))));
  return { n, body: cache.get(n) };
}
/** Icon name for a name-or-emoji (null if unknown). */
export const iconName = (v) => (v && (G[v] ? v : EMOJI[v])) || null;
/** Raw inner SVG markup (no <svg> wrapper) for a name — used by tools/icons_png.mjs to build the sprite sheet. */
export const iconSVG = (name) => { const s = svgBody(name); return s ? s.body : ''; };

// ---------- render mode: 'svg' (inline, default) or 'png' (ui/icons/<name>.png baked by tools/icons_png.mjs) ----------
// PNG mode is what ships: the drawings are rasterised ONCE into ui/icons/*.png (sheet.png = all icons side by side) and the
// game shows <img> tags — zero inline SVG parsing per toast / card, and the files are plain art assets with no font licence.
// setIconMode('png', manifest) switches at runtime; icons missing from the manifest fall back to inline SVG.
let MODE = 'svg', PNG_NAMES = null, PNG_BASE = './ui/icons/';
export function setIconMode(mode, manifest, base) {
  MODE = mode === 'png' ? 'png' : 'svg';
  if (manifest && Array.isArray(manifest.names)) PNG_NAMES = new Set(manifest.names);
  if (base) PNG_BASE = base.endsWith('/') ? base : base + '/';
  return MODE;
}
export const iconMode = () => MODE;
/** Load ui/icons/manifest.json and switch to PNG mode (no-op / stays SVG when the file is missing, e.g. headless or before the tool ran). */
export async function usePngIcons(base = './ui/icons/') {
  if (typeof fetch !== 'function') return 'svg';
  try { const r = await fetch(base + 'manifest.json', { cache: 'force-cache' }); if (!r.ok) return 'svg'; return setIconMode('png', await r.json(), base); } catch { return 'svg'; }
}
/** Inline <svg> (or <img> of the baked PNG in png mode) for a name or emoji. Unknown strings are returned escaped as-is (so text fallbacks still show). */
export function icon(name, { cls = '', title = '' } = {}) {
  const s = svgBody(name);
  if (!s) return String(name ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c]));
  if (MODE === 'png' && (!PNG_NAMES || PNG_NAMES.has(s.n))) return `<img class="ll-ico ll-ico-${s.n}${cls ? ' ' + cls : ''}" src="${PNG_BASE}${s.n}.png" alt="" draggable="false" aria-hidden="true"${title ? ` title="${title}"` : ''}>`;
  return `<svg class="ll-ico ll-ico-${s.n}${cls ? ' ' + cls : ''}" viewBox="0 0 64 64" aria-hidden="true" focusable="false">${title ? `<title>${title}</title>` : ''}${s.body}</svg>`;
}
const EMOJI_RE = new RegExp(Object.keys(EMOJI).sort((a, b) => b.length - a.length).map((k) => k.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')).join('|'), 'gu');
/** Replace every known emoji inside an HTML string with its drawn icon. */
export const iconize = (html) => String(html ?? '').replace(EMOJI_RE, (m) => icon(m));
/** Same, but the input is plain text (escaped first) → safe for innerHTML. */
export const iconizeText = (txt) => iconize(String(txt ?? '').replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' }[c])));
/** data: URL (for CSS content/background). In png mode → the baked file's URL. */
export function iconDataURL(name, px = 64) {
  const s = svgBody(name); if (!s) return '';
  if (MODE === 'png' && (!PNG_NAMES || PNG_NAMES.has(s.n))) return `${PNG_BASE}${s.n}.png`;
  return 'data:image/svg+xml,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" width="${px}" height="${px}" viewBox="0 0 64 64">${s.body}</svg>`);
}
/** List of all generator names (debug / gallery). */
export const ICON_NAMES = Object.keys(G);

// ---------- canvas (Three sprite textures): procedural star / check / cross drawn with paths ----------
export function drawIconOnCanvas(ctx, name, x, y, size) {
  const n = iconName(name); ctx.save(); ctx.translate(x - size / 2, y - size / 2); ctx.scale(size / 64, size / 64);
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  const poly = (d, fill, w = 6) => { const p = new Path2D(d); ctx.lineWidth = w; ctx.strokeStyle = INK; ctx.stroke(p); ctx.fillStyle = fill; ctx.fill(p); };
  const line = (d, w, col) => { ctx.lineWidth = w; ctx.strokeStyle = col; ctx.stroke(new Path2D(d)); };
  if (n === 'star') poly(starPts(32, 34, 5, 27, 12), C.gold, 8);
  else if (n === 'spark') { ctx.beginPath(); ctx.arc(32, 32, 26, 0, 7); ctx.fillStyle = C.gold; ctx.fill(); ctx.lineWidth = 7; ctx.strokeStyle = INK; ctx.stroke(); poly(starPts(32, 32, 4, 15, 5.5), INK, 1); }
  else if (n === 'check') { line('M10 34L25 49L54 16', 16, INK); line('M10 34L25 49L54 16', 8, C.grass); }
  else if (n === 'cross') { line('M15 15L49 49M49 15L15 49', 16, INK); line('M15 15L49 49M49 15L15 49', 8, C.red); }
  ctx.restore(); return !!n;
}

// ---------- CSS: size the icons, expose data-URL variables for CSS `content:` ----------
if (typeof document !== 'undefined' && document.head && !document.getElementById('ll-icons-css')) {
  const s = document.createElement('style'); s.id = 'll-icons-css';
  s.textContent = `.ll-ico{display:inline-block;width:1.15em;height:1.15em;vertical-align:-.22em;flex:none;overflow:visible}
.ll-card-icon .ll-ico{width:1.35em;height:1.35em}
.ll-toast-icon .ll-ico{width:16px;height:16px;vertical-align:middle}
.ll-tut-hand .ll-ico{width:44px;height:44px;vertical-align:middle}
.ll-tut-owl .ll-ico,.ll-sc-big .ll-ico{width:1.1em;height:1.1em}
:root{--ll-ico-lock:url("${iconDataURL('lock', 13)}");--ll-ico-pointR:url("${iconDataURL('pointR', 16)}");--ll-ico-chevR:url("${iconDataURL('chevR', 18)}")}`;
  document.head.appendChild(s);
}
