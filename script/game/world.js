/* =====================================================================
   A völgy — determinisztikus térképgenerátor
   ---------------------------------------------------------------------
   Rögzített maggal fut: mindenkinek ugyanaz a völgy, így a mentett
   állás (felderített terület, legyőzött barlangok) mindig ugyanarra a
   térképre vonatkozik.

   Lépések:
     1. domborzat zajból — a peremen és északon hegyek
     2. vidékek: havas észak, felperzselt hamuverem, tó, tenger
     3. folyó A*-gal (zajos költségmezőn kanyarog, kerüli a helyszíneket)
     4. a barlangok köré hegy, a helyszínek köré tisztás
     5. utak A*-gal a hosszúháztól minden helyszínig — vízen át híd
     6. erdő, sziklák, virágok, gyógyfüvek, rúnakövek
     7. megjelenítési csempék (partél, sziklafal, havas változatok)
   ===================================================================== */
import { mulberry32 } from './rules.js';
import { findPath } from './path.js';

export const TILE  = 48;
export const MAP_W = 80;
export const MAP_H = 60;

/** Megjelenítési csempék (a tileset indexei — lásd art.js). */
export const T = {
  GRASS: 0, GRASS2: 1, FLOWERS: 2, PATH: 3, SAND: 4, WATER: 5, SNOW: 6, SNOW2: 7,
  ROCK: 8, CLIFF: 9, BRIDGE_H: 10, BRIDGE_V: 11, FOREST: 12, ICE: 13, CAVEFLOOR: 14, ASH: 15,
  WATER_EDGE: 16,                 // 16..31: víz + partél (bitmaszk: É=1, K=2, D=4, Ny=8)
  SNOWPATH: 32, ROCK_SNOW: 33, CLIFF_SNOW: 34, ASH2: 35, ROCK_ASH: 36, CLIFF_ASH: 37,
  FOG: 40, FOG_EDGE: 41,
  COUNT: 42,
};

/** Logikai tereptípus. */
export const B = { GRASS: 0, WATER: 1, MOUNTAIN: 2, SNOW: 3, ASH: 4, SAND: 5, PATH: 6, BRIDGE: 7, ICE: 8 };

/** A helyszínek — a koordináta az a csempe, ahová lépve interakció indul. */
export const POIS = [
  { type: 'home', id: 'home', x: 40, y: 48, name: 'Hosszúház' },
  { type: 'trainer', id: 'trainer', x: 53, y: 46, name: 'Gyakorlótér' },
  { type: 'cave', id: 'cave1', tier: 1, x: 23, y: 37 },
  { type: 'cave', id: 'cave2', tier: 2, x: 61, y: 41 },
  { type: 'cave', id: 'cave3', tier: 3, x: 12, y: 22 },
  { type: 'cave', id: 'cave4', tier: 4, x: 66, y: 16 },
  { type: 'cave', id: 'cave5', tier: 5, x: 40, y: 8 },
  { type: 'nest', id: 'nest1', nest: 1, x: 31, y: 29, name: 'Szirtfészek' },
  { type: 'nest', id: 'nest2', nest: 2, x: 53, y: 30, name: 'Fenyvesfészek' },
  { type: 'nest', id: 'nest3', nest: 3, x: 69, y: 51, name: 'Partfészek' },
  { type: 'stone', id: 'stone1', lore: 1, x: 46, y: 43 },
  { type: 'stone', id: 'stone2', lore: 2, x: 20, y: 31 },
  { type: 'stone', id: 'stone3', lore: 3, x: 57, y: 23 },
  { type: 'stone', id: 'stone4', lore: 4, x: 34, y: 16 },
  { type: 'stone', id: 'stone5', lore: 5, x: 73, y: 34 },
];

/* --- Zaj ------------------------------------------------------------ */
function makeNoise(seed) {
  const rng = mulberry32(seed);
  const perm = new Uint16Array(512);
  const vals = new Float32Array(256);
  const p = [...Array(256).keys()];
  for (let i = 255; i > 0; i--) { const j = Math.floor(rng() * (i + 1)); [p[i], p[j]] = [p[j], p[i]]; }
  for (let i = 0; i < 512; i++) perm[i] = p[i & 255];
  for (let i = 0; i < 256; i++) vals[i] = rng();
  const h = (i, j) => vals[perm[(perm[i & 255] + j) & 255]];
  return (x, y) => {
    const xi = Math.floor(x), yi = Math.floor(y);
    const xf = x - xi, yf = y - yi;
    const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
    const a = h(xi, yi), b = h(xi + 1, yi), c = h(xi, yi + 1), d = h(xi + 1, yi + 1);
    return (a + (b - a) * u) * (1 - v) + (c + (d - c) * u) * v;
  };
}
function fbm(n, x, y, oct = 4) {
  let v = 0, a = 1, f = 1, s = 0;
  for (let o = 0; o < oct; o++) { v += n(x * f + o * 17.3, y * f - o * 9.1) * a; s += a; a *= 0.5; f *= 2.03; }
  return v / s;
}
const smooth = (a, b, t) => { const k = Math.max(0, Math.min(1, (t - a) / (b - a))); return k * k * (3 - 2 * k); };

/* =====================================================================
   Generálás
   ===================================================================== */
export function generateWorld(seed = 20260929) {
  const W = MAP_W, H = MAP_H;
  const rng = mulberry32(seed);
  const n1 = makeNoise(seed + 1), n2 = makeNoise(seed + 2), n3 = makeNoise(seed + 3);
  const at = (x, y) => y * W + x;
  const inside = (x, y) => x >= 0 && y >= 0 && x < W && y < H;

  const biome = new Uint8Array(W * H);          // B.*
  const snowy = new Uint8Array(W * H);          // havas vidék (észak)
  const ashy  = new Uint8Array(W * H);          // hamuverem

  /* --- 1–2. Domborzat és vidékek -------------------------------------- */
  for (let y = 0; y < H; y++) {
    for (let x = 0; x < W; x++) {
      const nx = x / W, ny = y / H;
      const edge = Math.max(Math.abs(nx - 0.5) * 2, Math.abs(ny - 0.5) * 2);
      let e = fbm(n1, x / 9, y / 9) * 0.5
            + smooth(0.8, 1.0, edge) * 0.8
            + smooth(0.2, 0, ny) * 0.28;
      const i = at(x, y);
      biome[i] = e > 0.66 ? B.MOUNTAIN : B.GRASS;

      if (y < 19 + fbm(n2, x / 6, 3) * 6) snowy[i] = 1;
      const da = Math.hypot(x - 66, (y - 16) * 1.2);
      if (da < 9 + fbm(n3, x / 4, y / 4) * 4) { ashy[i] = 1; snowy[i] = 0; }

      // Tó délnyugaton, tenger a délkeleti sarokban
      const lake = ((x - 17) / 11) ** 2 + ((y - 47) / 7) ** 2 + (fbm(n2, x / 5, y / 5) - 0.5) * 0.9;
      const sea  = ((x - 80) / 13) ** 2 + ((y - 61) / 10) ** 2 + (fbm(n3, x / 5, y / 5) - 0.5) * 0.7;
      if (lake < 1 && biome[i] !== B.MOUNTAIN) biome[i] = B.WATER;
      if (sea < 1) biome[i] = B.WATER;          // a tenger a hegyeket is elönti
    }
  }

  // A világ pereme mindig hegy
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    if (x < 2 || y < 2 || x >= W - 2 || y >= H - 2) biome[at(x, y)] = B.MOUNTAIN;
  }

  const setB = (x, y, b) => { if (inside(x, y)) biome[at(x, y)] = b; };
  const clearAround = (cx, cy, r) => {
    for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) {
      if (!inside(x, y) || x < 2 || y < 2 || x >= W - 2 || y >= H - 2) continue;
      if (Math.hypot(x - cx, y - cy) <= r + 0.3 && (biome[at(x, y)] === B.MOUNTAIN || biome[at(x, y)] === B.WATER)) {
        biome[at(x, y)] = B.GRASS;
      }
    }
  };

  /* --- 3. Folyó: északról a tóba, kanyarogva ----------------------- */
  const nearPoi = (x, y, r) => POIS.some((p) => Math.abs(p.x - x) <= r && Math.abs(p.y - y) <= r);
  const river = findPath(W, H, 35, 9, 22, 41, (x, y) => {
    if (x < 3 || y < 3 || x >= W - 3 || y >= H - 3) return Infinity;
    if (nearPoi(x, y, 3)) return 40;
    return 1 + fbm(n2, x / 4 + 30, y / 4) * 9;          // zajos mező → kanyargó meder
  }) || [];
  for (const [x, y] of [[35, 9], ...river]) {
    setB(x, y, B.WATER);
    if (rng() < 0.35 && !nearPoi(x + 1, y, 2)) setB(x + 1, y, B.WATER);
  }

  /* --- 4. Barlangok hegyfalba, helyszínek köré tisztás --------------- */
  for (const p of POIS) {
    if (p.type === 'cave') {
      // Ív a bejárat fölött: ez adja a sziklafalat, amibe a barlang nyílik
      for (let dy = -4; dy <= -1; dy++) {
        const half = 2 + (-dy);
        for (let dx = -half; dx <= half; dx++) setB(p.x + dx, p.y + dy, B.MOUNTAIN);
      }
      for (let dy = 0; dy <= 2; dy++) for (let dx = -1; dx <= 1; dx++) {
        const b = biome[at(p.x + dx, p.y + dy)];
        if (b === B.MOUNTAIN || b === B.WATER) setB(p.x + dx, p.y + dy, B.GRASS);
      }
    } else {
      clearAround(p.x, p.y, p.type === 'home' ? 5 : p.type === 'trainer' ? 3 : 2);
    }
  }

  /* --- 5. Utak a hosszúháztól ---------------------------------------- */
  const home = POIS[0];
  const pathMark = new Uint8Array(W * H);
  const approach = (p) => (p.type === 'cave' ? [p.x, p.y + 1] : p.type === 'home' ? [p.x, p.y + 1] : [p.x, p.y + 1]);
  const [hx, hy] = approach(home);

  const roadCost = (target) => (x, y) => {
    const i = at(x, y);
    if (x === target[0] && y === target[1]) return 1;
    const b = biome[i];
    if (b === B.MOUNTAIN) return Infinity;
    if (pathMark[i]) return 0.55;                       // a meglévő utakba torkolljon
    if (b === B.WATER) return snowy[i] ? 1.5 : 14;      // befagyott víz / híd kell
    if (nearPoi(x, y, 0)) return 6;
    // Erős zaj a költségben: így az út kanyarog, nem derékszögben tör meg
    return 1 + fbm(n1, x / 4 + 11, y / 4) * 2.8 + (snowy[i] ? 0.4 : 0);
  };

  // A távolabbiakkal kezdünk: így a közelebbiek a már kész utakba csatlakoznak
  const targets = POIS.slice(1).sort((a, b) => Math.hypot(b.x - hx, b.y - hy) - Math.hypot(a.x - hx, a.y - hy));
  for (const p of targets) {
    const [tx, ty] = approach(p);
    const route = findPath(W, H, hx, hy, tx, ty, roadCost([tx, ty]));
    if (!route) continue;
    let prev = [hx, hy];
    for (const [x, y] of [[hx, hy], ...route]) {
      const i = at(x, y);
      if (biome[i] === B.WATER && !snowy[i]) {
        biome[i] = B.BRIDGE;
        pathMark[i] = x !== prev[0] ? 1 : 2;           // 1 = vízszintes, 2 = függőleges híd
      } else {
        pathMark[i] = pathMark[i] || 1;
        if (biome[i] !== B.WATER) biome[i] = B.PATH;
      }
      prev = [x, y];
    }
  }

  // Befagyott víz: az északi vidéken a víz jég, járható
  for (let i = 0; i < W * H; i++) if (biome[i] === B.WATER && snowy[i]) biome[i] = B.ICE;

  // Homokos part a víz mentén (nem havas vidéken)
  const isWater = (x, y) => inside(x, y) && (biome[at(x, y)] === B.WATER || biome[at(x, y)] === B.BRIDGE);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    if (biome[i] !== B.GRASS || snowy[i] || ashy[i]) continue;
    if (isWater(x + 1, y) || isWater(x - 1, y) || isWater(x, y + 1) || isWater(x, y - 1)) biome[i] = B.SAND;
  }

  /* --- 6. Tárgyak ----------------------------------------------------- */
  const blocked = new Uint8Array(W * H);
  const occupied = new Uint8Array(W * H);
  for (let i = 0; i < W * H; i++) {
    if (biome[i] === B.MOUNTAIN || biome[i] === B.WATER) blocked[i] = 1;
  }

  // Helyszínek teste
  for (const p of POIS) {
    if (p.type === 'home') {
      for (let y = p.y - 3; y <= p.y - 1; y++) for (let x = p.x - 2; x <= p.x + 2; x++) { blocked[at(x, y)] = 1; occupied[at(x, y)] = 1; }
      occupied[at(p.x, p.y)] = 1;
    } else if (p.type === 'cave') {
      occupied[at(p.x, p.y)] = 1;
    } else if (p.type === 'trainer') {
      // A karám közepe foglalt (bábu, fegyverállvány); a bejárat alul szabad
      for (let x = p.x - 1; x <= p.x + 1; x++) { blocked[at(x, p.y)] = 1; occupied[at(x, p.y)] = 1; }
      occupied[at(p.x, p.y + 1)] = 1;
    } else {
      blocked[at(p.x, p.y)] = 1;
      occupied[at(p.x, p.y)] = 1;
    }
  }

  const nearRoad = (x, y, r) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) {
      if (inside(x + dx, y + dy) && (pathMark[at(x + dx, y + dy)] || occupied[at(x + dx, y + dy)])) return true;
    }
    return false;
  };
  const land = (b) => b === B.GRASS || b === B.SAND;

  const trees = [];
  const boulders = [];
  for (let y = 2; y < H - 2; y++) for (let x = 2; x < W - 2; x++) {
    const i = at(x, y);
    const b = biome[i];
    if (!(b === B.GRASS) || nearRoad(x, y, 1) || nearPoi(x, y, 2)) continue;
    const forest = fbm(n3, x / 7 + 40, y / 7);
    if ((forest > 0.55 && rng() < 0.72) || rng() < 0.03) {
      const kind = ashy[i] ? 'dead' : snowy[i] ? 'pine-snow' : (rng() < 0.12 ? 'birch' : 'pine');
      trees.push({ x, y, kind, v: Math.floor(rng() * 3) });
      blocked[i] = 1;
    } else if (rng() < 0.012) {
      boulders.push({ x, y, v: Math.floor(rng() * 2), snow: !!snowy[i] });
      blocked[i] = 1;
    }
  }

  // Elérhető csempék (a hosszúháztól) — ide kerülhet gyógyfű
  const reach = new Uint8Array(W * H);
  const queue = [[hx, hy]];
  reach[at(hx, hy)] = 1;
  while (queue.length) {
    const [x, y] = queue.pop();
    for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
      const nx = x + dx, ny = y + dy;
      if (!inside(nx, ny) || reach[at(nx, ny)] || blocked[at(nx, ny)]) continue;
      reach[at(nx, ny)] = 1;
      queue.push([nx, ny]);
    }
  }

  const herbs = [];
  let guard = 0;
  while (herbs.length < 18 && guard++ < 5000) {
    const x = 3 + Math.floor(rng() * (W - 6)), y = 3 + Math.floor(rng() * (H - 6));
    const i = at(x, y);
    if (!reach[i] || pathMark[i] || occupied[i] || !land(biome[i]) && biome[i] !== B.GRASS) continue;
    if (Math.hypot(x - home.x, y - home.y) < 7) continue;
    if (herbs.some((h) => Math.abs(h.x - x) + Math.abs(h.y - y) < 6)) continue;
    herbs.push({ x, y, key: `${x},${y}` });
    occupied[i] = 1;
  }

  /* --- 7. Megjelenítési csempék ------------------------------------ */
  const ground = new Uint16Array(W * H);
  const isMountain = (x, y) => !inside(x, y) || biome[at(x, y)] === B.MOUNTAIN;
  const waterish = (x, y) => !inside(x, y) || biome[at(x, y)] === B.WATER || biome[at(x, y)] === B.BRIDGE;

  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    const i = at(x, y);
    const r = rng();
    let t;
    switch (biome[i]) {
      case B.MOUNTAIN: {
        const face = !isMountain(x, y + 1);           // délre nyitott: sziklafal látszik
        t = ashy[i] ? (face ? T.CLIFF_ASH : T.ROCK_ASH)
          : snowy[i] ? (face ? T.CLIFF_SNOW : T.ROCK_SNOW)
          : (face ? T.CLIFF : T.ROCK);
        break;
      }
      case B.WATER: {
        let mask = 0;
        if (!waterish(x, y - 1)) mask |= 1;
        if (!waterish(x + 1, y)) mask |= 2;
        if (!waterish(x, y + 1)) mask |= 4;
        if (!waterish(x - 1, y)) mask |= 8;
        t = T.WATER_EDGE + mask;
        break;
      }
      case B.ICE:    t = T.ICE; break;
      case B.BRIDGE: t = pathMark[i] === 2 ? T.BRIDGE_V : T.BRIDGE_H; break;
      case B.PATH:   t = snowy[i] ? T.SNOWPATH : T.PATH; break;
      case B.SAND:   t = T.SAND; break;
      default:
        if (ashy[i])       t = r < 0.4 ? T.ASH2 : T.ASH;
        else if (snowy[i]) t = r < 0.35 ? T.SNOW2 : T.SNOW;
        else               t = r < 0.1 ? T.FLOWERS : r < 0.4 ? T.GRASS2 : T.GRASS;
    }
    ground[i] = t;
  }
  // Barlangbejárat előtti sötét föld és az erdő alatti avar
  for (const p of POIS) if (p.type === 'cave') ground[at(p.x, p.y)] = T.CAVEFLOOR;
  for (const tr of trees) {
    const i = at(tr.x, tr.y);
    if (!snowy[i] && !ashy[i]) ground[i] = T.FOREST;
  }

  /* --- 8. Apró díszek (átjárhatók) ------------------------------------
     Saját véletlenforrással, a végén: így a fenti terep pontosan ugyanaz
     marad, mint korábban (a mentett köd és gyógyfüvek erre hivatkoznak). */
  const drng = mulberry32(seed + 7);
  const treeAt = new Uint8Array(W * H);
  for (const t of trees) treeAt[at(t.x, t.y)] = 1;
  const nearTrees = (x, y) => {
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (inside(x + dx, y + dy) && treeAt[at(x + dx, y + dy)]) n++;
    return n;
  };
  const decor = [];
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    const i = at(x, y);
    const b = biome[i];
    if (blocked[i] || occupied[i] || pathMark[i] || nearPoi(x, y, 1)) continue;
    if (b !== B.GRASS && b !== B.SAND) continue;
    const r = drng();
    const wet = isWater(x + 1, y) || isWater(x - 1, y) || isWater(x, y + 1) || isWater(x, y - 1);
    const woods = nearTrees(x, y);
    let kind = null;
    if (ashy[i]) kind = r < 0.05 ? 'bones' : r < 0.085 ? 'vent' : r < 0.12 ? 'pebbles' : null;
    else if (snowy[i]) kind = r < 0.05 ? 'crystal' : r < 0.09 ? 'bush-snow' : r < 0.11 ? 'pebbles' : null;
    else if (wet) kind = r < 0.35 ? 'reeds' : r < 0.4 ? 'pebbles' : null;
    else if (woods >= 3) kind = r < 0.1 ? 'mushroom' : r < 0.2 ? 'bush' : r < 0.24 ? 'stump' : r < 0.32 ? 'fern' : null;
    else kind = r < 0.035 ? 'bush' : r < 0.1 ? 'tuft' : r < 0.115 ? 'pebbles' : r < 0.12 ? 'stump' : null;
    if (kind) decor.push({ x, y, kind, v: Math.floor(drng() * 3), ox: (drng() - 0.5) * 22, oy: (drng() - 0.5) * 14 });
  }

  // Úthálózat-csomópontok (útjelző táblákhoz): legalább három út-szomszéd
  const isRoad = (x, y) => inside(x, y) && (biome[at(x, y)] === B.PATH || biome[at(x, y)] === B.BRIDGE);
  const junctions = [];
  for (let y = 3; y < H - 3; y++) for (let x = 3; x < W - 3; x++) {
    if (!isRoad(x, y)) continue;
    const n = [[1, 0], [-1, 0], [0, 1], [0, -1]].filter(([dx, dy]) => isRoad(x + dx, y + dy)).length;
    if (n >= 3) junctions.push({ x, y });
  }

  return {
    w: W, h: H, tile: TILE, seed,
    ground, biome, blocked, snowy, ashy, reach, occupied,
    trees, boulders, herbs, decor, junctions, treeAt,
    pois: POIS.map((p) => ({ ...p })),
    start: { x: home.x, y: home.y + 1 },
  };
}
