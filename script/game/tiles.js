/* =====================================================================
   A völgy csempéi — képpontonként, egyszer, indításkor
   ---------------------------------------------------------------------
   Minden csempe varratmentes (a zaj a csempe szélén körbefordul), és
   „domborított": a textúra egy kis magasságmezőből kap fényt (bal felső
   nap), így a fű, a homok, a hó és a szikla térhatású — futás közben
   semmibe sem kerül, mert csak a csempelap egyszeri rajzolása.

   Vidékhatárok: a csempék fölé egy-két ritka SZEGÉLY-réteg kerül
   (Phaser tilemap, csak a látható cellák rajzolódnak). Egy szegélycsempe
   a szomszéd vidék anyaga hullámos, puha széllel, a határ mentén enyhe
   árnyékkal — így a hó, a fű, a homok és a hamu szervesen olvad egymásba.

   Víz: a parti csempékbe homok, nedves sáv, hab és sekély víz rajzolódik,
   a sarkok lekerekítve.
   ===================================================================== */
import { T, TILE } from './world.js';
import { mulberry32 } from './rules.js';

export const TILE_MARGIN = 2;
export const TILE_SPACING = 4;
const S = TILE, COLS = 8;

/* --- Szegélycsempék helye a lapon ------------------------------------- */
const FRINGE_CLASSES = ['sand', 'grass', 'snow', 'ash'];
const FRINGE_BASE = 48;                 // a 6. sortól
const FRINGE_PER = 20;                  // 15 oldal-maszk + 4 sarok (+1 tartalék)
const fringeIdx = (cls, mask) => FRINGE_BASE + FRINGE_CLASSES.indexOf(cls) * FRINGE_PER + mask - 1;
const cornerIdx = (cls, k) => FRINGE_BASE + FRINGE_CLASSES.indexOf(cls) * FRINGE_PER + 15 + k;   // 0 ÉK, 1 DK, 2 DNy, 3 ÉNy
const WATER_CORNER = FRINGE_BASE + FRINGE_CLASSES.length * FRINGE_PER;     // + 0 ÉK, 1 DK, 2 DNy, 3 ÉNy
const TILE_TOTAL = WATER_CORNER + 4;

/* --- Varratmentes zaj ---------------------------------------------------- */
function tileNoise(seed) {
  const rng = mulberry32(seed);
  const tab = new Float32Array(4096);
  for (let i = 0; i < tab.length; i++) tab[i] = rng();
  const mod = (a, p) => ((a % p) + p) % p;
  const lat = (i, j, px, py, o) => tab[(mod(i, px) * 73 + mod(j, py) * 151 + o * 389) & 4095];
  /** értékzaj px × py rácscellával a csempén (egész cellaszám → körbefordul) */
  const n = (x, y, px, py, o) => {
    const u = (x / S) * px, v = (y / S) * py;
    const i = Math.floor(u), j = Math.floor(v);
    const fx = u - i, fy = v - j;
    const sx = fx * fx * (3 - 2 * fx), sy = fy * fy * (3 - 2 * fy);
    const a = lat(i, j, px, py, o), b = lat(i + 1, j, px, py, o), c = lat(i, j + 1, px, py, o), d = lat(i + 1, j + 1, px, py, o);
    return a + (b - a) * sx + (c - a) * sy + (a - b - c + d) * sx * sy;
  };
  /** fraktálzaj: oct oktáv, az alap rácssűrűség bx × by */
  return (x, y, o = 0, oct = 4, bx = 2, by = bx) => {
    let v = 0, a = 1, s = 0, px = bx, py = by;
    for (let k = 0; k < oct; k++) { v += n(x, y, px, py, o + k * 7) * a; s += a; a *= 0.5; px *= 2; py *= 2; }
    return v / s;
  };
}

const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const mix = (c1, c2, t) => [c1[0] + (c2[0] - c1[0]) * t, c1[1] + (c2[1] - c1[1]) * t, c1[2] + (c2[2] - c1[2]) * t];
const smooth = (a, b, t) => { const k = clamp((t - a) / (b - a)); return k * k * (3 - 2 * k); };
const hex = (h) => [parseInt(h.slice(1, 3), 16), parseInt(h.slice(3, 5), 16), parseInt(h.slice(5, 7), 16)];

/**
 * Egy csempe képpontjai: `height(x,y)` a domborzat (0–1), `color(x,y,h)` a szín.
 * A fény a magasság bal-felső → jobb-alsó különbségéből jön (emboss).
 */
function texel(height, color, emboss = 1) {
  const h = new Float32Array(S * S);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) h[y * S + x] = height(x, y);
  const at = (x, y) => h[((y + S) % S) * S + ((x + S) % S)];
  const out = new Uint8ClampedArray(S * S * 4);
  for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
    const hv = h[y * S + x];
    const c = color(x, y, hv);
    const lit = c[3] === -1 ? 1 : 1 + (at(x - 1, y - 1) - at(x + 1, y + 1)) * 1.6 * emboss;
    const [r, g, b] = c;
    const k = (y * S + x) * 4;
    out[k] = r * lit; out[k + 1] = g * lit; out[k + 2] = b * lit; out[k + 3] = 255;
  }
  return out;
}

/* A rajzolt részletek (fűszál, kavics, virág) körbefordulnak a csempe szélén */
function wrapped(ctx, x0, y0, fn) {
  ctx.save();
  ctx.beginPath(); ctx.rect(x0, y0, S, S); ctx.clip();
  for (const ox of [-S, 0, S]) for (const oy of [-S, 0, S]) { ctx.save(); ctx.translate(x0 + ox, y0 + oy); fn(); ctx.restore(); }
  ctx.restore();
}

/* =====================================================================
   A csempelap
   ===================================================================== */
export function buildTileset(scene) {
  const rows = Math.ceil(TILE_TOTAL / COLS);
  const c = document.createElement('canvas');
  c.width = COLS * S; c.height = rows * S;
  const ctx = c.getContext('2d');
  const rng = mulberry32(777);
  const nz = tileNoise(4242);
  const at = (t) => [(t % COLS) * S, Math.floor(t / COLS) * S];
  const put = (t, px) => { const [x, y] = at(t); ctx.putImageData(new ImageData(px, S, S), x, y); return [x, y]; };
  const details = (t, fn) => { const [x, y] = at(t); wrapped(ctx, x, y, fn); };
  const scatter = (n, fn) => { for (let i = 0; i < n; i++) fn(rng() * S, rng() * S, rng(), i); };

  /* --- Fű (három változat), virágos rét, erdei avar --- */
  const grassPx = (o, tone = 0, dark = 0) => texel(
    (x, y) => nz(x, y, o, 3, 3) * 0.75 + nz(x, y, o + 50, 2, 8) * 0.25,
    (x, y, h) => {
      let col = mix(hex('#345c3d'), hex('#578a51'), smooth(0.2, 0.85, h));
      const patch = smooth(0.55, 0.78, nz(x, y, o + 90, 2, 1));
      col = mix(col, hex(tone ? '#7a8f48' : '#4c7d4a'), patch * (tone ? 0.45 : 0.25));
      return dark ? mix(col, hex('#22402b'), dark) : col;
    }, 0.9);
  const blades = (t, n, cols, len = 5) => details(t, () => scatter(n, (x, y, r) => {
    ctx.strokeStyle = cols[(r * cols.length) | 0]; ctx.lineWidth = 1.2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + (r - 0.5) * 3, y - len * 0.6, x + (r - 0.5) * 5, y - len * (0.7 + r * 0.6)); ctx.stroke();
  }));
  put(T.GRASS, grassPx(1));
  blades(T.GRASS, 34, ['#234530', '#2f5a3a', '#76a868', '#8fbf74']);
  put(T.GRASS2, grassPx(11, 1));
  blades(T.GRASS2, 30, ['#2c4a30', '#6f8f4a', '#9cb86a']);
  put(T.FLOWERS, grassPx(21));
  blades(T.FLOWERS, 24, ['#234530', '#76a868']);
  details(T.FLOWERS, () => scatter(7, (x, y, r) => {
    const col = ['#f2e27a', '#f6f6f6', '#c49cff', '#ff9ab8'][(r * 4) | 0];
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.arc(x + 1, y + 1.5, 2.6, 0, 7); ctx.fill();
    ctx.fillStyle = col;
    for (let p = 0; p < 5; p++) { const a = p * 1.2566; ctx.beginPath(); ctx.arc(x + Math.cos(a) * 1.9, y + Math.sin(a) * 1.9, 1.4, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#ffcf5a'; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 7); ctx.fill();
  }));
  put(T.FOREST, grassPx(31, 0, 0.35));
  details(T.FOREST, () => scatter(26, (x, y, r) => {
    ctx.strokeStyle = r < 0.5 ? '#6b4a2e' : '#8a6a3e'; ctx.lineWidth = 1; ctx.lineCap = 'round';
    const a = r * 6.28; ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + Math.cos(a) * 4, y + Math.sin(a) * 4); ctx.stroke();
  }));
  blades(T.FOREST, 12, ['#1d3826', '#4f7a4a']);

  /* --- Ösvény (föld és havas) --- */
  const pebbles = (t, n, cols) => details(t, () => scatter(n, (x, y, r) => {
    const rx = 1.4 + r * 2.2, ry = rx * 0.7;
    ctx.fillStyle = 'rgba(0,0,0,.3)'; ctx.beginPath(); ctx.ellipse(x + 0.8, y + 1, rx, ry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = cols[(r * cols.length) | 0]; ctx.beginPath(); ctx.ellipse(x, y, rx, ry, 0, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(255,255,255,.3)'; ctx.beginPath(); ctx.ellipse(x - rx * 0.3, y - ry * 0.35, rx * 0.45, ry * 0.35, 0, 0, 7); ctx.fill();
  }));
  put(T.PATH, texel((x, y) => nz(x, y, 101, 4, 2) * 0.8 + nz(x, y, 141, 2, 8) * 0.2,
    (x, y, h) => mix(hex('#76583c'), hex('#a3825a'), smooth(0.2, 0.85, h)), 0.9));
  pebbles(T.PATH, 9, ['#8c8a86', '#a39a8a', '#6f6a62']);
  put(T.SNOWPATH, texel((x, y) => nz(x, y, 111, 4, 2),
    (x, y, h) => mix(hex('#9aa6be'), hex('#d2dbea'), smooth(0.2, 0.85, h)), 1.2));
  pebbles(T.SNOWPATH, 4, ['#7d8496', '#9aa1b2']);

  /* --- Homok: szél fodrozta, apró kagylóhéjakkal --- */
  put(T.SAND, texel(
    (x, y) => 0.5 + 0.14 * Math.sin((2 * Math.PI * (x + 2 * y)) / S + nz(x, y, 121, 3, 2) * 4) + (nz(x, y, 131, 3, 2) - 0.5) * 0.5,
    (x, y, h) => mix(hex('#bfa070'), hex('#e6d3a3'), smooth(0.15, 0.85, h)), 0.7));
  details(T.SAND, () => scatter(5, (x, y, r) => {
    ctx.fillStyle = r < 0.5 ? '#f1e6cf' : '#8c7756'; ctx.beginPath(); ctx.arc(x, y, 0.9 + r, 0, 7); ctx.fill();
  }));

  /* --- Hó: puha buckák kékes árnyékkal, csillámmal --- */
  const snowPx = (o) => texel((x, y) => nz(x, y, o, 3, 4),
    (x, y, h) => mix(hex('#dde7f4'), hex('#f8fbff'), smooth(0.25, 0.8, h)), 0.3);
  const sparkle = (t, n) => details(t, () => scatter(n, (x, y) => {
    ctx.fillStyle = '#ffffff'; ctx.fillRect(x - 0.5, y - 1.5, 1, 3); ctx.fillRect(x - 1.5, y - 0.5, 3, 1);
  }));
  put(T.SNOW, snowPx(151)); sparkle(T.SNOW, 4);
  put(T.SNOW2, snowPx(161)); sparkle(T.SNOW2, 3);

  /* --- Hamu: sötét, repedezett, izzó parázs a résekben --- */
  const ashPx = (o) => texel((x, y) => nz(x, y, o, 4, 2) * 0.85 + nz(x, y, o + 4, 2, 8) * 0.15,
    (x, y, h) => mix(hex('#211b1e'), hex('#4f4346'), smooth(0.15, 0.85, h)), 1.2);
  const embers = (t, n) => details(t, () => {
    scatter(n, (x, y, r) => {
      ctx.strokeStyle = 'rgba(255,122,61,.7)'; ctx.shadowColor = '#ff5a1a'; ctx.shadowBlur = 4; ctx.lineWidth = 0.9;
      ctx.beginPath(); ctx.moveTo(x, y);
      let px = x, py = y;
      for (let k = 0; k < 3; k++) { px += (rng() - 0.5) * 10; py += (rng() - 0.3) * 7; ctx.lineTo(px, py); }
      ctx.stroke(); ctx.shadowBlur = 0;
      ctx.fillStyle = r < 0.5 ? '#ffc46b' : '#ff7a3d'; ctx.beginPath(); ctx.arc(x, y, 0.9, 0, 7); ctx.fill();
    });
  });
  put(T.ASH, ashPx(171));
  put(T.ASH2, ashPx(181)); embers(T.ASH2, 1);

  /* --- Barlang előtti kő, jég --- */
  put(T.CAVEFLOOR, texel((x, y) => 1 - Math.abs(nz(x, y, 191, 3, 3) * 2 - 1),
    (x, y, h) => mix(hex('#1c1a22'), hex('#4a4652'), h), 1.0));
  put(T.ICE, texel((x, y) => nz(x, y, 201, 3, 2) * 0.7 + 0.3 * (0.5 + 0.5 * Math.sin((2 * Math.PI * (x - y)) / S * 2)),
    (x, y, h) => mix(hex('#6fa9cf'), hex('#c8ecfa'), smooth(0.15, 0.95, h)), 0.7));
  details(T.ICE, () => {
    ctx.strokeStyle = 'rgba(255,255,255,.75)'; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.moveTo(6, 40); ctx.lineTo(18, 27); ctx.lineTo(31, 31); ctx.lineTo(44, 13); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(18, 27); ctx.lineTo(14, 12); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.35)'; ctx.fillRect(4, 8, 12, 2); ctx.fillRect(26, 38, 14, 2);
  });

  /* --- Hegy: sziklatető és sziklafal, három vidékre --- */
  const ridged = (x, y, o) => 1 - Math.abs(nz(x, y, o, 4, 2) * 2 - 1);
  const rockTop = (o, base, light, cap) => texel((x, y) => ridged(x, y, o) * 0.85 + nz(x, y, o + 3, 2, 8) * 0.15,
    (x, y, h) => {
      let col = mix(hex(base), hex(light), smooth(0.25, 0.9, h));
      if (cap) col = mix(col, hex(cap), smooth(0.55, 0.7, h + nz(x, y, o + 8, 2, 4) * 0.2) * 0.9);
      else col = mix(col, hex('#6f8a4a'), smooth(0.68, 0.8, nz(x, y, o + 13, 3, 3)) * 0.45);       // zuzmó
      return col;
    }, 1.2);
  const cliffFace = (o, top, face, dark, cap) => texel(
    (x, y) => (y < 12 ? ridged(x, y, o) : nz(x, y, o + 5, 3, 1, 6) * 0.7 + nz(x, y, o + 6, 2, 4, 16) * 0.3),
    (x, y, h) => {
      if (y < 12) {
        const c0 = mix(hex(top[0]), hex(top[1]), smooth(0.3, 0.9, h));
        return cap ? mix(c0, hex(cap), y < 7 ? 0.85 : 0.2) : c0;
      }
      const k = (y - 12) / (S - 12);
      let col = mix(hex(face), hex(dark), smooth(0.1, 1, k * 0.8 + (1 - h) * 0.5));
      if (y > S - 6) col = mix(col, [0, 0, 0], 0.35);                                          // a fal tövében árnyék
      if (y < 15) col = mix(col, [255, 255, 255], 0.18);                                        // fénylő perem
      return col;
    }, 1.1);
  put(T.ROCK, rockTop(211, '#4a5068', '#9aa0b6'));
  put(T.ROCK_SNOW, rockTop(221, '#6a7490', '#b4bdd2', '#f2f6fd'));
  put(T.ROCK_ASH, rockTop(231, '#2a2326', '#5e5052'));
  put(T.CLIFF, cliffFace(241, ['#4a5068', '#8d93a8'], '#555b72', '#23263a'));
  put(T.CLIFF_SNOW, cliffFace(251, ['#9aa4bc', '#eef3fb'], '#626c88', '#2f3550', '#f2f6fd'));
  put(T.CLIFF_ASH, cliffFace(261, ['#2a2326', '#5a4c4e'], '#332a2d', '#120d0f'));
  details(T.CLIFF_ASH, () => {
    ctx.strokeStyle = '#ff7a3d'; ctx.shadowColor = '#ff5a1a'; ctx.shadowBlur = 6; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(14, 14); ctx.lineTo(18, 26); ctx.lineTo(15, 40); ctx.stroke();
    ctx.shadowBlur = 0;
  });

  /* --- Víz partéllel (16 maszk: É=1, K=2, D=4, Ny=8) ---
     Homok → nedves sáv → hab → sekély türkiz → mély kék; a part hullámvonala
     a csempe szélén körbefordul, a domború sarkok lekerekítve. */
  const wave = (a, ph) => 2.4 * Math.sin((2 * Math.PI * a) / S * 2 + ph) + 1.3 * Math.sin((2 * Math.PI * a) / S * 5 + ph * 2);
  const smin = (a, b, k = 6) => -k * Math.log(Math.exp(-a / k) + Math.exp(-b / k));
  const sandTex = ctx.getImageData(...at(T.SAND), S, S).data;
  const sandAt = (x, y, k = 1) => { const i = (y * S + x) * 4; return [sandTex[i] * k, sandTex[i + 1] * k, sandTex[i + 2] * k, -1]; };
  /** a part színe a parttól mért távolság (d) szerint; null = mély víz */
  const shore = (x, y, d, deep) => {
    if (d < 8) return sandAt(x, y);                                                         // száraz homok (a homokcsempéből)
    if (d < 10.5) return sandAt(x, y, 0.72);                                                // nedves sáv
    if (d < 13) return mix(hex('#dff4ff'), hex('#f9feff'), nz(x, y, 301, 2, 12));            // hab
    if (d < 26) return mix(hex('#3fa0b4'), deep, smooth(13, 26, d));                         // sekély víz
    return null;
  };
  const waterPx = (mask) => texel(
    (x, y) => nz(x, y, 271, 3, 2) * 0.6 + 0.4 * (0.5 + 0.5 * Math.sin((2 * Math.PI * (x + y * 0.5)) / S * 3 + nz(x, y, 281, 2, 2) * 4)),
    (x, y, h) => {
      const ds = [];
      if (mask & 1) ds.push(y - wave(x, 0.3));
      if (mask & 2) ds.push(S - 1 - x - wave(y, 1.7));
      if (mask & 4) ds.push(S - 1 - y - wave(x, 2.9));
      if (mask & 8) ds.push(x - wave(y, 4.1));
      const d = ds.length ? ds.reduce((a, b) => smin(a, b)) : 99;
      const deep = mix(hex('#173f66'), hex('#2a6a9a'), smooth(0.3, 0.95, h));
      return shore(x, y, d, deep) || deep;
    }, 0.6);
  for (let mask = 0; mask < 16; mask++) put(T.WATER_EDGE + mask, waterPx(mask));
  put(T.WATER, waterPx(0));
  // Homorú partsarok: csak az átlós szomszéd szárazföld — kerek homoknyelv a sarokban, a többi átlátszó
  [[S - 1, 0], [S - 1, S - 1], [0, S - 1], [0, 0]].forEach(([cx, cy], k) => {
    const water = waterPx(0);
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const i = (y * S + x) * 4;
      const ang = Math.atan2(y - cy, x - cx);
      const d = Math.hypot(x - cx, y - cy) - 2 - 1.8 * Math.sin(ang * 4 + k);
      const c = shore(x, y, d, [water[i], water[i + 1], water[i + 2]]);
      if (!c) { water[i + 3] = 0; continue; }
      water[i] = c[0]; water[i + 1] = c[1]; water[i + 2] = c[2];
      water[i + 3] = d < 13 ? 255 : 255 * (1 - smooth(13, 26, d));
    }
    put(WATER_CORNER + k, water);
  });

  /* --- Hidak: deszkák, szegek, kötélkorlát, árnyék a vízen --- */
  const bridge = (t, horizontal) => {
    const [x, y] = put(t, waterPx(0));
    ctx.save();
    ctx.translate(x + S / 2, y + S / 2);
    if (!horizontal) ctx.rotate(Math.PI / 2);
    ctx.fillStyle = 'rgba(0,10,20,.4)'; ctx.fillRect(-S / 2, -11, S, 30);
    for (let i = 0; i < 6; i++) {
      const g = ctx.createLinearGradient(0, -14, 0, 14);
      g.addColorStop(0, i % 2 ? '#9a7650' : '#a8845a'); g.addColorStop(1, i % 2 ? '#6e5236' : '#7a5c3c');
      ctx.fillStyle = g; ctx.fillRect(-S / 2 + i * 8, -14 + (i % 3 === 1 ? 1 : 0), 7, 28);
      ctx.fillStyle = 'rgba(0,0,0,.35)'; ctx.fillRect(-S / 2 + i * 8 + 7, -14, 1, 28);
      ctx.fillStyle = 'rgba(40,30,20,.35)';
      for (let k = 0; k < 3; k++) ctx.fillRect(-S / 2 + i * 8 + 1 + k * 2, -12 + rng() * 22, 1, 4);      // erezet
      ctx.fillStyle = '#3a2e24'; ctx.fillRect(-S / 2 + i * 8 + 3, -12, 1.5, 1.5); ctx.fillRect(-S / 2 + i * 8 + 3, 10, 1.5, 1.5);
    }
    for (const yy of [-17, 13]) {
      ctx.fillStyle = '#4a3422'; ctx.fillRect(-S / 2, yy, S, 4);
      ctx.fillStyle = 'rgba(255,230,190,.25)'; ctx.fillRect(-S / 2, yy, S, 1);
    }
    ctx.restore();
  };
  bridge(T.BRIDGE_H, true);
  bridge(T.BRIDGE_V, false);

  /* --- Köd --- */
  put(T.FOG, texel((x, y) => nz(x, y, 311, 3, 2), (x, y, h) => mix(hex('#05080f'), hex('#0e1428'), h), 0));
  {
    const [x, y] = at(T.FOG_EDGE);
    ctx.fillStyle = 'rgba(7,10,20,.6)'; ctx.fillRect(x, y, S, S);
  }

  /* --- Szegélycsempék: a szomszéd vidék anyaga, hullámos, puha széllel --- */
  const src = {
    grass: ctx.getImageData(...at(T.GRASS), S, S).data,
    sand: ctx.getImageData(...at(T.SAND), S, S).data,
    snow: ctx.getImageData(...at(T.SNOW), S, S).data,
    ash: ctx.getImageData(...at(T.ASH), S, S).data,
  };
  const reach = { grass: 9, sand: 8, snow: 11, ash: 10 };
  const lip = { grass: 0.22, sand: 0.12, snow: 0.28, ash: 0.25 };          // árnyék a perem alatt
  const fringe = (cls, cover) => {
    const px = new Uint8ClampedArray(S * S * 4), sp = src[cls];
    for (let y = 0; y < S; y++) for (let x = 0; x < S; x++) {
      const v = cover(x, y);                                               // > 0: anyag, -3…0: árnyék
      const k = (y * S + x) * 4;
      if (v > 0) {
        const a = clamp(v / 2.2);
        const rim = v < 3 ? 0.82 + v * 0.06 : 1;                          // a szél kicsit sötétebb, domború
        px[k] = sp[k] * rim; px[k + 1] = sp[k + 1] * rim; px[k + 2] = sp[k + 2] * rim; px[k + 3] = 255 * a;
      } else if (v > -3) {
        px[k + 3] = 255 * lip[cls] * (1 + v / 3);                         // fekete, áttetsző: árnyék
      }
    }
    return px;
  };
  for (const cls of FRINGE_CLASSES) {
    const r = reach[cls];
    const side = (m, x, y) => {
      let best = -9;
      if (m & 1) best = Math.max(best, r + wave(x, 0.9) - y);
      if (m & 2) best = Math.max(best, r + wave(y, 2.2) - (S - 1 - x));
      if (m & 4) best = Math.max(best, r + wave(x, 3.4) - (S - 1 - y));
      if (m & 8) best = Math.max(best, r + wave(y, 4.6) - x);
      return best;
    };
    for (let mask = 1; mask < 16; mask++) put(fringeIdx(cls, mask), fringe(cls, (x, y) => side(mask, x, y)));
    const corners = [[S - 1, 0], [S - 1, S - 1], [0, S - 1], [0, 0]];
    corners.forEach(([cx, cy], kk) => put(cornerIdx(cls, kk), fringe(cls, (x, y) => {
      const d = Math.hypot(x - cx, y - cy), a = Math.atan2(y - cy, x - cx);
      return r + 1 + 2 * Math.sin(a * 5 + kk) - d;
    })));
  }

  // Áttétel peremmel: a csempe szélső képpontsorai kifelé ismétlődnek
  const M = TILE_MARGIN, P = TILE_SPACING;
  const out = document.createElement('canvas');
  out.width = COLS * (S + P); out.height = rows * (S + P);
  const o = out.getContext('2d');
  for (let t = 0; t < COLS * rows; t++) {
    const [sx, sy] = at(t);
    const dx = (t % COLS) * (S + P) + M, dy = Math.floor(t / COLS) * (S + P) + M;
    o.drawImage(c, sx, sy, S, S, dx, dy, S, S);
    o.drawImage(c, sx, sy, S, 1, dx, dy - M, S, M);
    o.drawImage(c, sx, sy + S - 1, S, 1, dx, dy + S, S, M);
    o.drawImage(c, sx, sy, 1, S, dx - M, dy, M, S);
    o.drawImage(c, sx + S - 1, sy, 1, S, dx + S, dy, M, S);
    o.drawImage(c, sx, sy, 1, 1, dx - M, dy - M, M, M);
    o.drawImage(c, sx + S - 1, sy, 1, 1, dx + S, dy - M, M, M);
    o.drawImage(c, sx, sy + S - 1, 1, 1, dx - M, dy + S, M, M);
    o.drawImage(c, sx + S - 1, sy + S - 1, 1, 1, dx + S, dy + S, M, M);
  }
  if (scene.textures.exists('tiles')) scene.textures.remove('tiles');
  scene.textures.addCanvas('tiles', out);
  return 'tiles';
}

/* =====================================================================
   Szegélyrétegek: melyik cellára melyik szomszéd anyaga lóg át
   ===================================================================== */
const CLASS_OF = (() => {
  const m = {};
  for (const t of [T.GRASS, T.GRASS2, T.FLOWERS, T.FOREST]) m[t] = 'grass';
  m[T.SAND] = 'sand';
  for (const t of [T.SNOW, T.SNOW2]) m[t] = 'snow';
  for (const t of [T.ASH, T.ASH2]) m[t] = 'ash';
  for (const t of [T.PATH, T.SNOWPATH]) m[t] = 'path';
  m[T.ICE] = 'ice'; m[T.CAVEFLOOR] = 'cave';
  for (const t of [T.ROCK, T.ROCK_SNOW, T.ROCK_ASH]) m[t] = 'rock';
  for (const t of [T.CLIFF, T.CLIFF_SNOW, T.CLIFF_ASH]) m[t] = 'cliff';
  return m;
})();
/** Ki lóg át kire: a magasabb rangú anyag rákúszik az alacsonyabbra. */
const RANK = { ash: 5, snow: 4, grass: 3, sand: 2, path: 1, ice: 0.5, cave: 0.5, rock: 0, cliff: 0 };

/**
 * @returns {number[][][]} legfeljebb 3 réteg (sorok × oszlopok), −1 = üres
 */
export function fringeLayers(world) {
  const { w: W, h: H, ground } = world;
  const cls = (x, y) => (x < 0 || y < 0 || x >= W || y >= H ? null : CLASS_OF[ground[y * W + x]] || null);
  const layers = [0, 1, 2].map(() => Array.from({ length: H }, () => new Array(W).fill(-1)));
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const me = cls(x, y);
    if (me === null) {
      // víz: ha csak az átlós szomszéd szárazföld, homorú partsarok kerül rá
      const g0 = ground[y * W + x];
      if (!(g0 === T.WATER || (g0 >= T.WATER_EDGE && g0 < T.WATER_EDGE + 16))) continue;
      const wet = (xx, yy) => xx < 0 || yy < 0 || xx >= W || yy >= H || cls(xx, yy) === null;
      const sand = (xx, yy) => { const c = cls(xx, yy); return c === 'sand' || c === 'grass' || c === 'path'; };
      let li = 0;
      [[1, -1], [1, 1], [-1, 1], [-1, -1]].forEach(([dx, dy], k) => {
        if (li < 3 && sand(x + dx, y + dy) && wet(x + dx, y) && wet(x, y + dy)) layers[li++][y][x] = WATER_CORNER + k;
      });
      continue;
    }
    const r0 = RANK[me];
    const over = new Map();                                       // anyag → {mask, corners}
    const add = (c) => { if (!over.has(c)) over.set(c, { mask: 0, corners: [] }); return over.get(c); };
    const n = [cls(x, y - 1), cls(x + 1, y), cls(x, y + 1), cls(x - 1, y)];
    n.forEach((c, i) => {
      if (!c || !FRINGE_CLASSES.includes(c) || RANK[c] <= r0) return;
      if (me === 'cliff' && i === 2) return;                      // a sziklafal tövére nem nő rá semmi
      add(c).mask |= 1 << i;
    });
    // átlós szomszéd: csak ha a két oldalsó nem ugyanaz (különben az oldal már takarja)
    const diag = [[1, -1, 0, 1], [1, 1, 1, 2], [-1, 1, 2, 3], [-1, -1, 3, 0]];
    diag.forEach(([dx, dy, a, b], k) => {
      const c = cls(x + dx, y + dy);
      if (!c || !FRINGE_CLASSES.includes(c) || RANK[c] <= r0) return;
      if (n[a] === c || n[b] === c) return;
      add(c).corners.push(k);
    });
    const list = [...over.entries()].sort((a, b) => RANK[a[0]] - RANK[b[0]]);
    const tiles = [];
    for (const [c, { mask, corners }] of list) {
      if (mask) tiles.push(fringeIdx(c, mask));
      for (const k of corners) tiles.push(cornerIdx(c, k));
    }
    tiles.slice(0, 3).forEach((t, i) => { layers[i][y][x] = t; });
  }
  return layers;
}
