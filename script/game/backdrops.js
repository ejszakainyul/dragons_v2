/* =====================================================================
   Csatahátterek — a renderelt darabokból (img/battle/bt-*.png, a
   tools/worldart/battle.mjs gyártja) a képernyő méretére rakva.
   Ugyanaz a térhatású, megvilágított stílus, mint a sárkányoké és a
   völgy tárgyaié: sziklakulisszák (távol halványabbak, a levegő
   színébe olvadnak), cseppkövek, kristályok, fák, hegyláncok, kerítés.
   Az ég, a víz és a fények festettek — ezek nem tárgyak, hanem levegő.
   Az V. barlangban Níðhöggr renderelt részei (boss-*) is innen töltődnek.
   ===================================================================== */
import { WORLD_ART } from './world-manifest.js';
import { mulberry32 } from './rules.js';

const THEMES = { 1: 'moss', 2: 'ice', 3: 'amethyst', 4: 'lava', 5: 'roots' };
const CAVE_LOOK = {
  moss:     { top: '#040a07', deep: '#1f4634', layers: ['#16342a', '#0e221a', '#07130e'], glow: '#9dffc9', floor: ['#33463a', '#0a110c'] },
  ice:      { top: '#040912', deep: '#36608a', layers: ['#223f5e', '#142840', '#0a1626'], glow: '#9fe8ff', floor: ['#4a5e7a', '#0a1018'] },
  amethyst: { top: '#06040c', deep: '#43307a', layers: ['#2c2052', '#1c1436', '#0f0a1e'], glow: '#c9a0ff', floor: ['#3a3054', '#08060e'] },
  lava:     { top: '#0a0303', deep: '#7a2a10', layers: ['#3e1a10', '#26100a', '#140706'], glow: '#ff7a2c', floor: ['#44302a', '#0a0505'] },
  roots:    { top: '#040306', deep: '#3e2e1a', layers: ['#2a1f30', '#1a1220', '#0c0812'], glow: '#ffd36b', floor: ['#352c38', '#050407'] },
};
const FIELD = {
  meadow: { sky: ['#0a1430', '#24386a', '#4a5a8a'], air: '#24386a', ground: ['#3a6a44', '#0e1a12'], accent: '#9dffc9', moon: true, range: 'rock' },
  forest: { sky: ['#06100c', '#12301f', '#22503a'], air: '#163626', ground: ['#2c4c32', '#08120a'], accent: '#d8ff8a', range: 'rock' },
  snow:   { sky: ['#0a1428', '#28406a', '#7a90b8'], air: '#4a5f88', ground: ['#c9d6ea', '#5a6a88'], accent: '#e8fffb', moon: true, range: 'snow' },
  ash:    { sky: ['#120404', '#3a0e08', '#8a2a10'], air: '#4a1810', ground: ['#3a2a2a', '#0a0505'], accent: '#ff8a3d', range: 'ash' },
  shore:  { sky: ['#081430', '#1d3a6a', '#c4683a'], air: '#3a3a5a', ground: ['#a8946a', '#2a2418'], accent: '#9fe8ff', range: 'rock', sea: true },
};

/** A csatához kellő darabok listája (csak azt töltjük le, amit a háttér használ). */
function needed(mode, kind) {
  if (mode === 'cave') return (k) => k.startsWith(`bt-${caveTheme(kind)}-`) || (kind === 5 && k.startsWith('boss-'));
  if (mode === 'spar') return (k) => /^bt-(range-snow|post|rail|torch|banner|pebbles0|tuft0)/.test(k);
  const L = FIELD[kind] || FIELD.meadow;
  const pre = [`range-${L.range}`, 'moon', 'hills', 'pebbles0', 'tuft0', 'fern0', 'bush', 'boulder', 'reeds0', 'bones0',
    kind === 'ash' ? 'dead' : kind === 'snow' ? 'pine-snow' : 'pine', 'birch'];
  return (k) => pre.some((p) => k.startsWith(`bt-${p}`)) && !(kind !== 'snow' && k.startsWith('bt-pine-snow'));
}
/** A csatához kellő darabok betöltése (egyszer; a többi csata már a gyorsítótárból veszi). */
export function loadBattleArt(scene, mode, kind) {
  const want = (WORLD_ART.battle || []).filter(needed(mode, kind)).filter((k) => !scene.textures.exists(k));
  if (!want.length) return Promise.resolve();
  return new Promise((resolve) => {
    for (const k of want) scene.load.image(k, `img/battle/${k}.png?v=${WORLD_ART.v}`);
    scene.load.once('complete', resolve);
    scene.load.start();
  });
}
export const caveTheme = (tier) => THEMES[tier] || 'moss';

/* --- Rajzoló segédek ------------------------------------------------------ */
function canvas(w, h) { const c = document.createElement('canvas'); c.width = Math.max(1, Math.round(w)); c.height = Math.max(1, Math.round(h)); return c; }
function hexA(hex, a) { const n = parseInt(hex.slice(1), 16); return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`; }
function vgrad(ctx, y0, y1, stops) { const g = ctx.createLinearGradient(0, y0, 0, y1); for (const [t, c] of stops) g.addColorStop(t, c); return g; }
function glowAt(ctx, x, y, r, col, a) {
  const g = ctx.createRadialGradient(x, y, 0, x, y, r);
  g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
  ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
}
function vignette(ctx, w, h, a) {
  const v = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, `rgba(0,0,0,${a})`);
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
}

/** Egy darab rajzolója: tükrözés + „légköri" sötétítés (távol a levegő színébe olvad). */
function painter(scene, ctx) {
  const cache = new Map();
  const source = (key, flip, shade) => {
    if (!scene.textures.exists(key)) return null;
    const id = `${key}|${flip ? 1 : 0}|${shade ? shade.join() : ''}`;
    if (cache.has(id)) return cache.get(id);
    const img = scene.textures.get(key).getSourceImage();
    let out = img;
    if (flip || shade) {
      const c = canvas(img.width, img.height), x = c.getContext('2d');
      if (flip) { x.translate(img.width, 0); x.scale(-1, 1); }
      x.drawImage(img, 0, 0);
      if (shade) { x.setTransform(1, 0, 0, 1, 0, 0); x.globalCompositeOperation = 'source-atop'; x.fillStyle = hexA(shade[0], shade[1]); x.fillRect(0, 0, c.width, c.height); }
      out = c;
    }
    cache.set(id, out);
    return out;
  };
  /** ax, ay: a rögzítési pont a képen (0..1). */
  return (key, x, y, sc, o = {}) => {
    const img = source(key, o.flip, o.shade);
    if (!img) return null;
    const w = img.width * sc, h = img.height * sc;
    ctx.drawImage(img, x - w * (o.ax ?? 0.5), y - h * (o.ay ?? 1), w, h);
    return [w, h];
  };
}

/* =====================================================================
   Barlang
   ===================================================================== */
/** A padló látóhatára: a csata adja meg (a leghátsó sárkány talpa fölött), különben a magasság 72%-a. */
const horizonOf = (h, hz) => Math.round(hz ?? h * 0.72);

export function caveBackdrop(scene, tier, w, h, hz) {
  const key = `cavebg3:${tier}:${w}x${h}:${horizonOf(h, hz)}`;
  if (scene.textures.exists(key)) return key;
  const T = caveTheme(tier), L = CAVE_LOOK[T];
  const rng = mulberry32(tier * 999 + 7);
  const c = canvas(w, h), ctx = c.getContext('2d');
  const draw = painter(scene, ctx);
  const s = Math.max(0.5, Math.min(1.6, h / 760));
  const floorY = horizonOf(h, hz);
  const rock = (i) => `bt-${T}-rock${i % 4}`;

  // 1. Mélység: sötét boltozat, a messzi csarnok fénye középen
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, L.top], [0.5, L.deep], [0.72, L.layers[0]], [1, L.top]]);
  ctx.fillRect(0, 0, w, h);
  glowAt(ctx, w * 0.5, h * 0.52, Math.max(w, h) * 0.42, L.glow, 0.3);

  /** Sziklakulissza: két oldalfal + mennyezet egymásra torlódó tömbökből. */
  const curtain = (inner, ceil, sc, shade, seed) => {
    const r = mulberry32(seed), cw = 180 * sc, ch = 160 * sc;
    const ceilY = h * ceil;
    // a tömbök mögé tömör kitöltés, hogy ne látsszon át
    ctx.fillStyle = shade[0];
    for (const side of [0, 1]) {
      const ix = side ? w * (1 - inner) + cw * 0.3 : w * inner - cw * 0.3;
      ctx.fillRect(side ? ix : -10, -10, side ? w - ix + 10 : ix + 10, floorY + 10);
    }
    ctx.fillRect(-10, -10, w + 20, ceilY - ch * 0.15 + 10);
    // mennyezet
    for (let x = -cw * 0.4; x < w + cw * 0.4; x += cw * (0.5 + r() * 0.2)) {
      const y = ceilY + Math.sin((x / w) * Math.PI) * h * 0.04 + (r() - 0.5) * ch * 0.2;
      draw(rock(Math.floor(r() * 4)), x, y, sc * (0.85 + r() * 0.3), { ay: 0.85, flip: r() < 0.5, shade });
    }
    // oldalfalak: belső élükön a fény felé fordulva (bal oldalon tükrözve)
    for (const side of [0, 1]) {
      const ix = side ? w * (1 - inner) : w * inner;
      for (let y = ceilY * 0.6; y < floorY + ch * 0.4; y += ch * (0.42 + r() * 0.12)) {
        const bulge = Math.sin((y / h) * Math.PI * 1.1) * w * 0.04 + (r() - 0.5) * cw * 0.25;
        for (let k = 0; k < 4; k++) {
          const x = side ? ix + cw * 0.35 - bulge + k * cw * 0.6 : ix - cw * 0.35 + bulge - k * cw * 0.6;
          if (side ? x - cw > w : x + cw < 0) break;
          draw(rock(Math.floor(r() * 4)), x, y, sc * (0.9 + r() * 0.3), { ay: 0.6, flip: !side, shade });
        }
      }
    }
  };

  // 2. A fokozat saját háttérlátványa
  if (T === 'moss' || T === 'ice') {
    const wx = w * (0.5 + (rng() - 0.5) * 0.1), ww = w * 0.05, top = h * 0.2;
    const fall = ctx.createLinearGradient(0, top, 0, floorY);
    fall.addColorStop(0, hexA(T === 'ice' ? '#e8f8ff' : '#bff0ff', 0.15)); fall.addColorStop(0.3, hexA(T === 'ice' ? '#cdeeff' : '#9fe8ff', 0.55)); fall.addColorStop(1, hexA('#ffffff', 0.7));
    ctx.fillStyle = fall;
    ctx.beginPath(); ctx.moveTo(wx - ww * 0.6, top); ctx.lineTo(wx + ww * 0.6, top); ctx.lineTo(wx + ww, floorY - 6); ctx.lineTo(wx - ww, floorY - 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexA('#ffffff', T === 'ice' ? 0.5 : 0.3); ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { const x = wx - ww * 0.8 + rng() * ww * 1.6; ctx.beginPath(); ctx.moveTo(x, top + rng() * 40); ctx.lineTo(x + (rng() - 0.5) * 6, floorY - 10 - rng() * 30); ctx.stroke(); }
    glowAt(ctx, wx, floorY - 8, ww * 3, '#ffffff', 0.25);
    ctx.fillStyle = hexA(T === 'ice' ? '#dff4ff' : '#bff0ff', 0.35);
    ctx.beginPath(); ctx.ellipse(wx, floorY - 4, ww * 2.6, 8 * s, 0, 0, 7); ctx.fill();
    draw(`bt-${T}-feature`, wx, top + 30 * s, s * 0.9, { ay: 1, shade: [L.layers[0], 0.35] });
  }
  if (T === 'lava') {
    glowAt(ctx, w * 0.5, floorY - 20, w * 0.35, '#ff6a1f', 0.45);
    const fx = w * (0.4 + rng() * 0.2);
    const lf = ctx.createLinearGradient(0, h * 0.2, 0, floorY);
    lf.addColorStop(0, 'rgba(255,200,90,.3)'); lf.addColorStop(1, 'rgba(255,120,40,.9)');
    ctx.fillStyle = lf; ctx.beginPath(); ctx.moveTo(fx - 6, h * 0.2); ctx.quadraticCurveTo(fx + 8, h * 0.45, fx - 4, floorY - 16); ctx.lineTo(fx + 14, floorY - 16); ctx.quadraticCurveTo(fx + 20, h * 0.45, fx + 6, h * 0.2); ctx.fill();
  }

  // 3. Távoli kulissza
  curtain(0.3, 0.2, s * 0.75, [L.deep, 0.62], tier * 31 + 1);
  if (T === 'lava') draw('bt-lava-feature', w * 0.5, floorY + 6 * s, s * 1.2, {});
  if (T === 'amethyst') { glowAt(ctx, w * 0.5, floorY - h * 0.2, w * 0.12, L.glow, 0.35); draw('bt-amethyst-feature', w * 0.5, floorY + 2 * s, s * 1.15, { shade: [L.layers[0], 0.15] }); }
  if (T === 'roots') {
    glowAt(ctx, w * 0.5, h * 0.4, w * 0.25, '#ffd36b', 0.15);
    for (let i = 0; i < 4; i++) draw('bt-roots-feature', w * (0.22 + i * 0.19) + (rng() - 0.5) * 40, floorY + 8 * s, s * (0.75 + rng() * 0.2) * (h / 760 > 1 ? 1.2 : 1), { flip: i % 2 === 1, shade: [L.layers[0], 0.3 + (i % 2) * 0.15] });
  }

  // 4. Középső kulissza, róla lógó cseppkövek, tövében a téma díszei
  curtain(0.17, 0.12, s * 0.95, [L.layers[0], 0.42], tier * 31 + 2);
  for (let x = w * 0.12; x < w * 0.88; x += 60 * s + rng() * 90 * s) {
    if (rng() < 0.3) continue;
    const y = h * 0.12 + Math.sin((x / w) * Math.PI) * h * 0.04 + 6 * s;
    draw(`bt-${T}-hang${Math.floor(rng() * 3)}`, x, y, s * (0.8 + rng() * 0.5), { ay: 0.04, flip: rng() < 0.5, shade: [L.layers[0], 0.35] });
  }
  for (const side of [0, 1]) {
    const bx = side ? w * (0.84 + rng() * 0.05) : w * (0.11 + rng() * 0.05);
    glowAt(ctx, bx, floorY - 30 * s, 120 * s, L.glow, T === 'roots' ? 0.12 : 0.25);
    draw(`bt-${T}-stand${Math.floor(rng() * 2)}`, bx + (side ? 60 : -60) * s, floorY + 4 * s, s * 1.1, { flip: !side, shade: [L.layers[1], 0.2] });
    draw(`bt-${T}-deco`, bx, floorY + 6 * s, s * 1.05, { flip: side === 1 });
  }

  // 5. Padló: a széle felé sötétebb, perspektivikusan szórt lapos kövek
  ctx.fillStyle = vgrad(ctx, floorY - 16, h, [[0, L.floor[0]], [1, L.floor[1]]]);
  ctx.beginPath(); ctx.moveTo(-10, h);
  for (let x = -10; x <= w + 26; x += 26) ctx.lineTo(x, floorY - 12 + Math.sin(x / 110) * 8 + rng() * 6);
  ctx.lineTo(w + 10, h); ctx.closePath(); ctx.fill();
  glowAt(ctx, w * 0.5, floorY + 10, w * 0.3, L.glow, 0.12);
  for (let i = 0; i < 22; i++) {
    const t = rng(), y = floorY - 4 + Math.pow(t, 1.4) * (h - floorY), k = 0.45 + ((y - floorY) / (h - floorY)) * 1.1;
    draw(`bt-${T}-floor${Math.floor(rng() * 3)}`, rng() * w, y, s * k, { ay: 0.85, flip: rng() < 0.5, shade: [L.floor[1], 0.45 - t * 0.3] });
  }

  // 6. Közeli kulissza és az előtér sziklái (a sarkokban)
  curtain(0.05, 0.05, s * 1.15, [L.layers[2], 0.55], tier * 31 + 3);
  for (let x = w * 0.06; x < w * 0.94; x += 90 * s + rng() * 120 * s) {
    if (rng() < 0.45) continue;
    draw(`bt-${T}-hang${Math.floor(rng() * 3)}`, x, h * 0.05 + 4 * s, s * (1.2 + rng() * 0.5), { ay: 0.04, flip: rng() < 0.5, shade: [L.layers[2], 0.5] });
  }
  for (const side of [0, 1]) {
    for (let k = 0; k < 3; k++) {
      const x = side ? w - k * 120 * s + 20 * s : k * 120 * s - 20 * s;
      draw(rock(k + side), x, h + 30 * s, s * (1.7 - k * 0.3), { ay: 1, flip: !side, shade: [L.layers[2], 0.45 + k * 0.08] });
    }
  }

  // 7. Fénysáv a padló fölött, vignetta
  const haze = ctx.createLinearGradient(0, floorY - 60, 0, floorY + 40);
  haze.addColorStop(0, hexA(L.glow, 0)); haze.addColorStop(0.5, hexA(L.glow, 0.1)); haze.addColorStop(1, hexA(L.glow, 0));
  ctx.fillStyle = haze; ctx.fillRect(0, floorY - 60, w, 100);
  vignette(ctx, w, h, 0.7);

  scene.textures.addCanvas(key, c);
  return key;
}

/* =====================================================================
   Gyakorlótér a párbajhoz: alkonyi ég, sarkfény, cölöpkerítés, fáklyák
   ===================================================================== */
/** A fáklyák lángjának helye (a csatajelenet ide teszi a pislákoló fényt). */
export function arenaTorches(w, h, hz) {
  const s = Math.max(0.5, Math.min(1.6, h / 760)), floorY = horizonOf(h, hz);
  return [0.12, 0.38, 0.62, 0.88].map((f) => ({ x: w * f, y: floorY - 8 * s - 96 * s }));
}

export function arenaBackdrop(scene, w, h, hz) {
  const key = `arenabg2:${w}x${h}:${horizonOf(h, hz)}`;
  if (scene.textures.exists(key)) return key;
  const rng = mulberry32(2026);
  const c = canvas(w, h), ctx = c.getContext('2d');
  const draw = painter(scene, ctx);
  const s = Math.max(0.5, Math.min(1.6, h / 760));
  const floorY = horizonOf(h, hz);

  ctx.fillStyle = vgrad(ctx, 0, floorY, [[0, '#070b1e'], [0.55, '#1a2350'], [0.85, '#5a3a52'], [1, '#c4683a']]);
  ctx.fillRect(0, 0, w, floorY + 20);
  for (let i = 0; i < 90; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.6})`; ctx.fillRect(rng() * w, rng() * floorY * 0.55, 1.5, 1.5); }
  for (let b = 0; b < 3; b++) {
    ctx.beginPath();
    const y0 = h * (0.12 + b * 0.07);
    ctx.moveTo(0, y0);
    for (let x = 0; x <= w; x += 20) ctx.lineTo(x, y0 + Math.sin(x / 140 + b * 2) * 30 + Math.sin(x / 47) * 8);
    ctx.lineTo(w, y0 + 90); ctx.lineTo(0, y0 + 90); ctx.closePath();
    const g = ctx.createLinearGradient(0, y0, 0, y0 + 90);
    g.addColorStop(0, `rgba(${b === 1 ? '157,123,255' : '79,255,190'},.22)`); g.addColorStop(1, 'rgba(79,255,190,0)');
    ctx.fillStyle = g; ctx.fill();
  }
  // hegyláncok (távol a naplemente színébe olvadva)
  for (const [i, shade, sc, dy] of [[0, ['#3a2f52', 0.62], 1.1, 0], [1, ['#1a1f3c', 0.4], 0.9, 18]]) {
    const pw = 720 * s * sc;
    for (let x = -rng() * pw * 0.5; x < w; x += pw * 0.96) draw(`bt-range-snow${i}`, x, floorY - 4 + dy * s, s * sc, { ax: 0, shade });
  }
  ctx.fillStyle = vgrad(ctx, floorY - 10, h, [[0, '#6a5038'], [1, '#1a120b']]);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w + 30; x += 30) ctx.lineTo(x, floorY - 12 + Math.sin(x / 120) * 5);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  // cölöpkerítés + keresztgerenda
  const posts = [];
  for (let x = -6 * s; x < w + 20 * s; x += 28 * s) posts.push(x);
  for (const x of posts) draw(`bt-post${Math.floor(rng() * 3)}`, x, floorY - 4 * s, s * 0.95, { flip: rng() < 0.5, shade: ['#1a120b', 0.15] });
  for (let x = 0; x < w; x += 236 * s) draw('bt-rail', x, floorY - 62 * s, s, { ax: 0, ay: 0.5 });
  for (const bx of [w * 0.25, w * 0.75]) draw('bt-banner', bx, floorY - 160 * s, s * 0.95, { ay: 0 });
  for (const t of arenaTorches(w, h, hz)) {
    glowAt(ctx, t.x, t.y, 110 * s, '#ffaa50', 0.4);
    draw('bt-torch', t.x, t.y - 16 * s, s, { ay: 0 });
  }
  // a porond kavicsai, fűcsomók
  for (let i = 0; i < 26; i++) {
    const t = rng(), y = floorY + 8 + Math.pow(t, 1.3) * (h - floorY), k = 0.4 + ((y - floorY) / (h - floorY)) * 0.8;
    draw(rng() < 0.6 ? 'bt-pebbles0' : 'bt-tuft0', rng() * w, y, s * k, { flip: rng() < 0.5, shade: ['#1a120b', 0.35 - t * 0.25] });
  }
  vignette(ctx, w, h, 0.65);
  scene.textures.addCanvas(key, c);
  return key;
}

/* =====================================================================
   Szabadtér (kóborló sárkányok, őr-csaták)
   ===================================================================== */
export function fieldBackdrop(scene, w, h, kind = 'meadow', hz) {
  const key = `fieldbg2:${kind}:${w}x${h}:${horizonOf(h, hz)}`;
  if (scene.textures.exists(key)) return key;
  const L = FIELD[kind] || FIELD.meadow;
  const rng = mulberry32(kind.length * 7919);
  const c = canvas(w, h), ctx = c.getContext('2d');
  const draw = painter(scene, ctx);
  const s = Math.max(0.5, Math.min(1.6, h / 760));
  const floorY = horizonOf(h, hz);
  const snow = kind === 'snow', ash = kind === 'ash';

  ctx.fillStyle = vgrad(ctx, 0, floorY, [[0, L.sky[0]], [0.6, L.sky[1]], [1, L.sky[2]]]);
  ctx.fillRect(0, 0, w, floorY + 20);
  for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.5})`; ctx.fillRect(rng() * w, rng() * floorY * 0.5, 1.4, 1.4); }
  if (L.moon) {
    const mx = w * 0.78, my = h * 0.16;
    glowAt(ctx, mx, my, 130 * s, '#e6f0ff', 0.35);
    draw('bt-moon', mx, my, s * 0.75, { ay: 0.5 });
  }
  if (ash) for (let i = 0; i < 8; i++) glowAt(ctx, rng() * w, h * (0.1 + rng() * 0.3), 160, '#ff5a1e', 0.18);

  // két hegylánc: a távolabbi a levegő színébe olvad
  for (const [i, a, sc, dy] of [[0, 0.62, 1.15, -6], [1, 0.38, 0.9, 16]]) {
    const pw = 720 * s * sc;
    for (let x = -rng() * pw * 0.5; x < w; x += pw * 0.96) draw(`bt-range-${L.range}${i}`, x, floorY + dy * s, s * sc, { ax: 0, shade: [L.air, a] });
  }
  if (kind === 'meadow' || kind === 'forest') for (let x = -rng() * 300 * s; x < w; x += 700 * s) draw(kind === 'forest' ? 'bt-hills1' : 'bt-hills0', x, floorY + 4 * s, s, { ax: 0, shade: [L.air, 0.42] });
  if (L.sea) {
    const sy = floorY - 40 * s;
    ctx.fillStyle = vgrad(ctx, sy, floorY, [[0, '#2a5f8f'], [1, '#14304d']]);
    ctx.fillRect(0, sy, w, floorY - sy + 10);
    glowAt(ctx, w * 0.3, sy, w * 0.3, '#ffb070', 0.18);
    ctx.strokeStyle = 'rgba(220,240,255,.35)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 22; i++) { const x = rng() * w, y = sy + 4 + rng() * (floorY - sy - 8); ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 3, x + 20, y); ctx.stroke(); }
  }
  // távoli fasor
  if (!L.sea) {
    const n = kind === 'forest' ? 46 : 20;
    for (let i = 0; i < n; i++) {
      const x = (i / n) * w + rng() * 30, key2 = ash ? `bt-dead${i % 3}` : snow ? `bt-pine-snow${i % 3}` : (kind === 'meadow' && i % 4 === 0) ? `bt-birch${i % 2}` : `bt-pine${i % 3}`;
      draw(key2, x, floorY - 2 * s, s * (0.32 + rng() * 0.12), { shade: [L.air, 0.48], flip: rng() < 0.5 });
    }
  }
  // talaj
  ctx.fillStyle = vgrad(ctx, floorY - 14, h, [[0, L.ground[0]], [1, L.ground[1]]]);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w + 30; x += 30) ctx.lineTo(x, floorY - 12 + Math.sin(x / 110) * 6);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  const scatter = { meadow: ['bt-tuft0', 'bt-fern0', 'bt-pebbles0', 'bt-tuft0', 'bt-bush0'], forest: ['bt-fern0', 'bt-tuft0', 'bt-fern0', 'bt-pebbles0'],
    snow: ['bt-pebbles0', 'bt-pebbles0', 'bt-boulder0s', 'bt-bush-snow0'], ash: ['bt-pebbles0', 'bt-pebbles0', 'bt-bones0', 'bt-pebbles0'], shore: ['bt-pebbles0', 'bt-reeds0', 'bt-pebbles0'] }[kind] || ['bt-tuft0'];
  const items = [];
  for (let i = 0; i < 22; i++) { const t = rng(); items.push([t, floorY + Math.pow(t, 1.3) * (h - floorY), rng() * w, scatter[Math.floor(rng() * scatter.length)]]); }
  items.sort((a, b) => a[1] - b[1]);
  for (const [t, y, x, k] of items) draw(k, x, y, s * (0.3 + ((y - floorY) / (h - floorY)) * 0.6), { flip: x > w / 2, shade: [L.ground[1], 0.4 - t * 0.3] });

  // előtér: fák/kövek a két szélén (keretezés)
  const frame = ash ? ['bt-dead0', 'bt-boulder1', 'bt-dead2'] : L.sea ? ['bt-boulder0', 'bt-reeds0', 'bt-boulder1'] : snow ? ['bt-pine-snow2', 'bt-boulder0s', 'bt-pine-snow1'] : kind === 'forest' ? ['bt-pine2', 'bt-pine1', 'bt-pine0'] : ['bt-pine2', 'bt-boulder0', 'bt-birch1'];
  for (const side of [0, 1]) for (let i = 2; i >= 0; i--) {
    const x = side ? w - 30 * s - i * 70 * s - rng() * 20 * s : 30 * s + i * 70 * s + rng() * 20 * s;
    const k = frame[i], tree = /pine|birch|dead/.test(k);
    draw(k, x, h + 10 * s, s * (tree ? 1.9 - i * 0.3 : 1.4 - i * 0.2), { flip: side === 1, shade: ['#000000', 0.18 + i * 0.06] });
  }
  ctx.fillStyle = hexA(L.accent, 0.05);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(rng() * w, floorY + rng() * 40, 220, 30, 0, 0, 7); ctx.fill(); }
  vignette(ctx, w, h, 0.62);
  scene.textures.addCanvas(key, c);
  return key;
}
