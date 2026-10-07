/* =====================================================================
   A völgy épületei, helyszínei és alakjai — ugyanazzal a fénymodellel,
   mint a sárkányok. Egység = 2 képpont; a talaj a kép alja.
   A füst, a tűz és a fények helye megegyezik a régi rajzokéval
   (a játék ezekhez igazítja a részecskéket).
   ===================================================================== */
import { tube, ell, sheet, prism, shard, horn } from '../dragonart/lib.mjs';
import { mulberry32 } from './rng.mjs';

const rect = (x0, y0, x1, y1) => [[x0, y0], [x1, y0], [x1, y1], [x0, y1]];
const disc = (cx, cy, r, n = 16, sy = 1) => Array.from({ length: n }, (_, i) => [cx + Math.cos((i / n) * Math.PI * 2) * r, cy + Math.sin((i / n) * Math.PI * 2) * r * sy]);

/** Pajzs: festett korong vas pajzsdudorral. */
function shield(x, y, r, a, b, z = 1.4) {
  return [
    ell(x, y, r, r, 0, a, { z, smooth: 0, rz: 1 }),
    sheet(Array.from({ length: 11 }, (_, i) => [x + Math.sin((i / 10) * Math.PI) * r * 0.94, y - Math.cos((i / 10) * Math.PI) * r * 0.94]), b, { z: z + 1.05, bulge: 0.02, fall: 0.3, smooth: 0 }),
    tube(disc(x, y, r * 0.96, 20).concat([[x + r * 0.96, y]]), 0.45, 'iron', { z: z + 0.9, smooth: 0, per: 2 }),
    ell(x, y, r * 0.32, r * 0.32, 0, 'iron', { z: z + 1.3, smooth: 0 }),
  ];
}
/** Lámpás: vaskeret, izzó üveg. */
function lantern(x, y, z = 3) {
  return [ell(x, y, 1.4, 2, 0, 'window', { z, smooth: 0 }), tube([[x - 1.6, y - 2.4], [x + 1.6, y - 2.4]], 0.4, 'iron', { z: z + 1, smooth: 0 }), tube([[x, y - 2.4], [x, y - 4]], 0.3, 'iron', { z: z + 1, smooth: 0 })];
}
/** Kőalap: egymás mellé rakott, kerekded kövek. */
function stones(x0, x1, y, h, rng, mat = 'rock', z = 2) {
  const out = [];
  for (let x = x0; x < x1;) {
    const w = 3 + rng() * 2.4;
    out.push(ell(x + w / 2, y - h / 2, w / 2 + 0.3, h / 2, 0, rng() < 0.5 ? mat : 'rockWarm', { z, smooth: 0.3, rz: h * 0.5, scale: 2 }));
    x += w;
  }
  return out;
}
/** Emberalak: köpeny, fej, szakáll/csuklya, kéz, kellék. */
function figure(o) {
  const W = o.w / 2, H = o.h / 2, G = H - 0.5, cx = W / 2 - 1;
  const out = [];
  const robe = [[cx - 5.6, G], [cx - 4.2, G - 12], [cx - 3.2, G - 19], [cx + 3.2, G - 19], [cx + 4.2, G - 12], [cx + 5.6, G]];
  out.push(sheet(robe, o.robe, { bulge: 3.4, fall: 3.6, smooth: 0 }));
  out.push(tube([[cx - 4.6, G - 1.2], [cx + 4.6, G - 1.2]], 0.9, o.trim || 'leather', { z: 2.6, smooth: 0 }));
  out.push(tube([[cx - 3, G - 13], [cx + 3, G - 13.4]], 0.7, 'leather', { z: 3.2, smooth: 0 }));
  out.push(ell(cx + 0.4, G - 22.4, 2.8, 3.1, 0, 'skinH', { z: 0.5 }));
  if (o.hood) out.push(sheet([[cx - 3.6, G - 19], [cx - 3.8, G - 24], [cx - 1, G - 27.4], [cx + 2.6, G - 26.6], [cx + 4, G - 22], [cx + 3.6, G - 19]], o.robe, { z: -0.5, bulge: 3, fall: 2, smooth: 0 }));
  if (o.hat) out.push(ell(cx + 0.4, G - 25.2, 3.4, 1.6, 0, o.hat, { z: 1, smooth: 0.4 }), ell(cx + 0.4, G - 24, 4.6, 0.9, 0, o.hat, { z: 0.6, smooth: 0 }));
  if (o.beard) out.push(sheet([[cx - 2.4, G - 21.4], [cx + 3, G - 21.4], [cx + 2, G - 18], [cx + 0.4, G - 15.6], [cx - 1.6, G - 18]], o.beard, { z: 2.6, bulge: 0.8, fall: 1, smooth: 0 }));
  out.push(ell(cx - 1, G - 22.8, 0.5, 0.5, 0, 'dark', { z: 3.4, smooth: 0 }), ell(cx + 1.5, G - 22.8, 0.5, 0.5, 0, 'dark', { z: 3.4, smooth: 0 }));
  out.push(ell(cx + 4.4, G - 12, 1.2, 1.2, 0, 'skinH', { z: 3.8, smooth: 0 }));
  out.push(...(o.item ? o.item(cx, G) : []));
  return out;
}

export function placeSprites() {
  const S = {};

  /* --- Hosszúház: kőalap, deszkafal, pajzsok, csónakgerinc-tető, sárkányfejes oromdíszek --- */
  {
    const W = 130, H = 95, G = H - 1, rng = mulberry32(501);
    const eave = G - 30, ridge = 18;
    const roof = [[3, eave], [17, ridge], [W / 2, ridge + 8], [W - 17, ridge], [W - 3, eave], [W / 2, eave - 9]];
    const roofPts = [];
    for (let i = 0; i <= 20; i++) { const t = i / 20; roofPts.push([17 + (W - 34) * t, ridge + Math.sin(t * Math.PI) * 8]); }
    const eavePts = [];
    for (let i = 20; i >= 0; i--) { const t = i / 20; eavePts.push([3 + (W - 6) * t, eave - Math.sin(t * Math.PI) * 9]); }
    const out = [
      sheet(rect(15, G - 40, W - 15, G - 4), 'wood', { bulge: 0.6, fall: 2, smooth: 0, pw: 2.6 }),
      ...stones(12, W - 12, G, 5, rng, 'rock', 2),
      tube([[16.5, G - 4], [16.5, G - 40]], 1.6, 'beam', { z: 1, smooth: 0 }), tube([[W - 16.5, G - 4], [W - 16.5, G - 40]], 1.6, 'beam', { z: 1, smooth: 0 }),
      // ajtó: résnyire nyitva, izzó belső
      sheet([[W / 2 - 7, G - 4], [W / 2 - 7, G - 20], [W / 2, G - 26], [W / 2 + 7, G - 20], [W / 2 + 7, G - 4]], 'window', { z: 0.4, bulge: 0.1, fall: 1, smooth: 0 }),
      sheet([[W / 2 - 7, G - 4], [W / 2 - 7, G - 20], [W / 2 - 1, G - 25.4], [W / 2 + 2.5, G - 24.4], [W / 2 + 2.5, G - 4]], 'woodDark', { z: 1.2, bulge: 0.3, fall: 1, smooth: 0, pw: 1.8 }),
      tube([[W / 2 - 7, G - 15], [W / 2 + 2, G - 15]], 0.5, 'iron', { z: 1.8, smooth: 0 }), tube([[W / 2 - 7, G - 8], [W / 2 + 2, G - 8]], 0.5, 'iron', { z: 1.8, smooth: 0 }),
      sheet(rect(W / 2 - 11, G - 31, W / 2 + 11, G - 27.4), 'beam', { z: 1.4, bulge: 0.4, fall: 1, smooth: 0 }),
      ...['a', 'b', 'c', 'd', 'e'].map((_, i) => tube([[W / 2 - 8 + i * 4, G - 30.4], [W / 2 - 7 + i * 4, G - 28.2], [W / 2 - 8.6 + i * 4, G - 28.6]], 0.3, 'runeGold', { z: 2.2, smooth: 0, per: 2 })),
      ...shield(31, G - 21, 5, 'clothRed', 'clothWhite'), ...shield(48, G - 21, 5, 'clothBlue', 'clothWhite'),
      ...shield(W - 48, G - 21, 5, 'clothYel', 'woodDark'), ...shield(W - 31, G - 21, 5, 'clothGreen', 'clothWhite'),
      ...lantern(W / 2 - 13, G - 25), ...lantern(W / 2 + 13, G - 25),
      // tető: zsindely, mohafoltok, gerincgerenda, füstnyílás
      sheet([...roofPts, ...eavePts], 'shingle', { z: 3, bulge: 9, fall: 14, smooth: 0, sh: 2.4, sw: 3 }),
      tube(roofPts, 1.6, 'beam', { z: 11.6, smooth: 0, per: 2 }),
      ell(W / 2 + 3, ridge + 13, 4.6, 2, 0, 'dark', { z: 12.6, smooth: 0, rz: 0.3 }), ell(W / 2 + 3, ridge + 13.6, 3, 1, 0, 'window', { z: 12.8, smooth: 0 }),
    ];
    for (let i = 0; i < 12; i++) { const x = 22 + rng() * (W - 44), y = ridge + 14 + rng() * 22; out.push(ell(x, y, 3 + rng() * 4, 1.2 + rng(), 0, 'turf', { z: 11.4 + Math.sin(((x - 17) / (W - 34)) * Math.PI) * 1.4, smooth: 0, rz: 0.8 })); }
    // oromdeszkák sárkányfejjel
    for (const [ex, tx, dir] of [[3, 17, -1], [W - 3, W - 17, 1]]) {
      out.push(tube([[ex, eave], [tx, ridge], [tx + dir * 5, ridge - 5], [tx + dir * 9, ridge - 11]], [1.4, 1.3, 1.1, 0.9], 'paint', { z: 6, smooth: 0 }));
      out.push(ell(tx + dir * 10.4, ridge - 12.6, 2.6, 1.6, dir * -0.4, 'paint', { z: 6.4, smooth: 0 }), ell(tx + dir * 10.2, ridge - 13.4, 0.5, 0.5, 0, 'runeGold', { z: 8, smooth: 0 }));
    }
    // hordó és tűzifa
    out.push(tube([[8, G - 0.5], [8, G - 9]], [3.6, 3.8, 3.6], 'wood', { z: 4, smooth: 0, open1: true, pw: 1.6 }), ell(8, G - 9, 3.4, 1.2, 0, 'woodDark', { z: 7.2, smooth: 0, rz: 0.2 }),
      tube([[4.6, G - 3], [11.4, G - 3]], 0.45, 'iron', { z: 7.8, smooth: 0 }), tube([[4.6, G - 7], [11.4, G - 7]], 0.45, 'iron', { z: 7.8, smooth: 0 }));
    for (let i = 0; i < 6; i++) out.push(ell(W - 16 + (i % 3) * 3.4, G - 1.6 - Math.floor(i / 3) * 3, 1.6, 1.6, 0, 'log', { z: 5, smooth: 0, rz: 1.2 }), ell(W - 16 + (i % 3) * 3.4, G - 1.6 - Math.floor(i / 3) * 3, 0.8, 0.8, 0, 'stem', { z: 6.3, smooth: 0, col: [210, 170, 120] }));
    S.longhouse = { w: 260, h: 190, prims: out, shadow: [W / 2 + 4, G - 1, 60, 6, 0.4] };
  }

  /* --- Kunyhó: gerendaház gyeptetővel, kőkémény --- */
  {
    const W = 60, H = 52, G = H - 1, rng = mulberry32(511);
    const out = [];
    for (let i = 0; i < 6; i++) { const y = G - 2 - i * 3.3; out.push(tube([[6, y], [W - 6, y]], 1.75, 'log', { z: 0, smooth: 0.2 }), ell(5.6, y, 1.7, 1.7, 0, 'stem', { z: 1.2, smooth: 0, col: [200, 160, 110], bump: 'noise', amp: 0.1 }), ell(W - 5.6, y, 1.7, 1.7, 0, 'stem', { z: 1.2, smooth: 0, col: [200, 160, 110], bump: 'noise', amp: 0.1 })); }
    out.push(sheet([[W / 2 - 5, G - 0.5], [W / 2 - 5, G - 12], [W / 2, G - 15.4], [W / 2 + 5, G - 12], [W / 2 + 5, G - 0.5]], 'woodDark', { z: 2.2, bulge: 0.4, fall: 1, smooth: 0, pw: 1.6 }));
    out.push(ell(W / 2 + 3, G - 7, 0.6, 0.6, 0, 'iron', { z: 3, smooth: 0 }));
    out.push(sheet(rect(W / 2 + 9, G - 14, W / 2 + 16, G - 8), 'window', { z: 2.2, bulge: 0.1, fall: 0.5, smooth: 0 }), tube([[W / 2 + 12.5, G - 14], [W / 2 + 12.5, G - 8]], 0.4, 'beam', { z: 2.8, smooth: 0 }), tube([[W / 2 + 9, G - 11], [W / 2 + 16, G - 11]], 0.4, 'beam', { z: 2.8, smooth: 0 }));
    // kémény (kő) a jobb hátsó sarkon
    for (let i = 0; i < 9; i++) out.push(ell(W / 2 + 13 + (i % 2) * 0.6, 7 + i * 2.6, 3, 1.5, 0, i % 2 ? 'rock' : 'rockWarm', { z: -1, smooth: 0.3, scale: 2 }));
    // gyeptető virágokkal
    const top = [];
    for (let i = 0; i <= 14; i++) { const t = i / 14; top.push([2 + (W - 4) * t, G - 20 - Math.sin(t * Math.PI) * 16 + (i % 2) * 0.8]); }
    out.push(sheet([...top, [W - 2, G - 19], [2, G - 19]], 'turf', { z: 2.4, bulge: 5, fall: 8, smooth: 0 }));
    for (let i = 0; i < 10; i++) { const x = 8 + rng() * (W - 16), y = G - 22 - rng() * 10; out.push(ell(x, y, 0.8, 0.8, 0, ['flowerY', 'flowerP', 'flowerW'][i % 3], { z: 7.8, smooth: 0 })); }
    out.push(ell(8, G - 2, 1.6, 1.2, 0, 'mushRed', { z: 4, smooth: 0 }), ell(W - 8, G - 1.6, 1.3, 1, 0, 'mushRed', { z: 4, smooth: 0 }));
    S.hut = { w: 120, h: 104, prims: out, shadow: [W / 2 + 2, G - 0.5, 28, 3.4, 0.4] };
  }

  /* --- Kovácsműhely: kőfal, palatető, izzó kohó, üllő, kémény --- */
  {
    const W = 64, H = 54, G = H - 1;
    const out = [
      sheet(rect(5, G - 26, W - 5, G - 0.5), 'stone', { bulge: 1, fall: 2, smooth: 0, cs: 2.6 }),
      prism([[2, G - 25], [W / 2, 6], [W - 2, G - 25]], [[W / 2, 6], [W / 2, G - 25]], 'slate', { h: 7, z: 1.2, smooth: 0, sh: 2.2, sw: 2.6 }),
      // kémény: x=47.5, csúcs y≈3
      sheet(rect(43.5, 1.5, 51.5, 20), 'stoneDark', { z: 2, bulge: 1.4, fall: 2, smooth: 0, cs: 1.8 }),
      ell(47.5, 2.2, 3.4, 1, 0, 'ember', { z: 3.4, smooth: 0 }),
      // kohó: ívelt nyílás izzással (x≈21, y≈40)
      sheet([[13, G - 4], [13, G - 13], [21, G - 19], [29, G - 13], [29, G - 4]], 'stoneDark', { z: 1.2, bulge: 0.6, fall: 1.4, smooth: 0, cs: 1.6 }),
      sheet([[15.5, G - 4.5], [15.5, G - 12.4], [21, G - 16.4], [26.5, G - 12.4], [26.5, G - 4.5]], 'window', { z: 1.6, bulge: 0.2, fall: 1, smooth: 0 }),
      ell(21, G - 6, 4.6, 1.6, 0, 'ember', { z: 2.2, smooth: 0 }),
      // üllő
      prism([[33, G - 9], [47, G - 9], [45, G - 6.6], [35, G - 6.6]], [[33, G - 8], [47, G - 8]], 'iron', { z: 6, h: 1.2, smooth: 0 }),
      tube([[40, G - 7], [40, G - 2]], [1.6, 2.6], 'iron', { z: 5.4, smooth: 0 }),
      ell(40, G - 1.2, 4, 1.2, 0, 'iron', { z: 5, smooth: 0 }),
      // fogó és kalapács a falon
      tube([[36, G - 22], [36, G - 13]], 0.5, 'beam', { z: 2.6, smooth: 0 }), ell(36, G - 22.6, 2, 1.2, 0, 'iron', { z: 3, smooth: 0 }),
      // vízhordó
      tube([[W - 6, G - 0.5], [W - 6, G - 7]], [3, 3.2, 3], 'wood', { z: 5, smooth: 0, open1: true, pw: 1.4 }), ell(W - 6, G - 7, 2.8, 1, 0, 'water', { z: 8, smooth: 0, rz: 0.1 }),
    ];
    S.forge = { w: 128, h: 108, prims: out, shadow: [W / 2 + 2, G - 0.5, 30, 3.4, 0.4] };
  }

  /* --- Barlang: sziklákból rakott boltív, sötét száj, kőagyarak, rúna a zárókövön --- */
  {
    const W = 75, H = 64, G = H - 1, rng = mulberry32(521);
    const out = [
      sheet([[16, G], [15, G - 20], [22, G - 36], [W / 2, G - 41], [W - 22, G - 36], [W - 15, G - 20], [W - 16, G]], 'dark', { z: -3, bulge: 0.2, fall: 1, smooth: 0 }),
    ];
    const arch = [[8, G - 6, 9, 8], [7, G - 19, 8.4, 7.6], [11, G - 31, 8, 7], [21, G - 40, 8.6, 7], [W / 2, G - 45, 9, 7.4], [W - 21, G - 40, 8.6, 7], [W - 11, G - 31, 8, 7], [W - 7, G - 19, 8.4, 7.6], [W - 8, G - 6, 9, 8]];
    arch.forEach(([x, y, rx, ry], i) => out.push(ell(x, y, rx, ry, (rng() - 0.5) * 0.5, i % 2 ? 'rock' : 'rockWarm', { z: 0, smooth: 1.4, rz: Math.min(rx, ry) * 0.9, scale: 0.8 })));
    for (let i = 0; i < 9; i++) out.push(ell(10 + rng() * (W - 20), G - 46 + rng() * 10, 3 + rng() * 3, 1.2, 0, 'turf', { z: 6 + rng(), smooth: 0, rz: 0.6 }));
    for (const x of [26, 32, 43, 49]) out.push(shard([x, G - 37], [x + (x < W / 2 ? 0.6 : -0.6), G - 30 - (x % 3)], 2.6, 'bone', { z: 1 }));
    for (const x of [22, W - 22]) out.push(shard([x, G], [x + (x < W / 2 ? 0.8 : -0.8), G - 6], 2.8, 'bone', { z: 1 }));
    for (let i = 0; i < 5; i++) { const x = 20 + i * 8 + rng() * 3; out.push(tube([[x, G - 42], [x + 1, G - 36], [x - 0.6, G - 30 + rng() * 4]], [0.45, 0.35, 0.1], 'leaf', { z: 5.4, smooth: 0 })); }
    out.push(tube([[W / 2 - 1.4, G - 49], [W / 2 - 1.4, G - 43]], 0.4, 'rune', { z: 7.4, smooth: 0 }), tube([[W / 2 - 1.4, G - 46], [W / 2 + 1.6, G - 48.4]], 0.4, 'rune', { z: 7.4, smooth: 0 }), tube([[W / 2 - 1.4, G - 46], [W / 2 + 1.6, G - 43.6]], 0.4, 'rune', { z: 7.4, smooth: 0 }));
    S.cave = { w: 150, h: 128, prims: out, shadow: [W / 2 + 3, G - 1, 34, 4, 0.4] };
  }

  /* --- Fészek: font gallyak gyűrűje, szalmás közép --- */
  {
    const W = 48, H = 30, G = H - 1, rng = mulberry32(531);
    const out = [ell(W / 2, G - 8, 18, 5.6, 0, 'straw', { z: -1, rz: 2, smooth: 0 })];
    for (let i = 0; i < 26; i++) {
      const a = (i / 26) * Math.PI * 2, r = 20, x = W / 2 + Math.cos(a) * r, y = G - 8 + Math.sin(a) * 6.4, a2 = a + 0.5 + rng() * 0.3;
      out.push(tube([[x, y], [W / 2 + Math.cos(a2) * r * 1.02, G - 8 + Math.sin(a2) * 6.6]], 1.2 + rng() * 0.5, i % 2 ? 'log' : 'dead', { z: Math.sin(a) * 4 + 3, smooth: 0.4 }));
    }
    S.nest = { w: 96, h: 60, prims: out, shadow: [W / 2 + 2, G - 2, 22, 4, 0.4] };
  }

  /* --- Rúnakő: magas, faragott kő izzó rúnákkal --- */
  {
    const W = 22, H = 39, G = H - 1;
    const out = [
      sheet([[3.6, G], [3, G - 26], [5, G - 34], [W / 2, G - 37], [W - 5, G - 34], [W - 3, G - 26], [W - 3.6, G]], 'rock', { bulge: 4, fall: 5, smooth: 0, scale: 0.8 }),
      ...[[[W / 2 - 1, G - 30], [W / 2 - 1, G - 23]], [[W / 2 - 1, G - 27], [W / 2 + 2.4, G - 29.6]], [[W / 2 - 1, G - 25], [W / 2 + 2.4, G - 27.6]],
        [[W / 2 - 1, G - 20], [W / 2 - 1, G - 13]], [[W / 2 - 1, G - 17], [W / 2 + 2.4, G - 14.6]], [[W / 2 + 1, G - 10], [W / 2 - 1.6, G - 6]], [[W / 2 - 1.6, G - 10], [W / 2 + 1, G - 6]]]
        .map((pts) => tube(pts, 0.45, 'rune', { z: 4.6, smooth: 0, per: 2 })),
      ell(6, G - 1.6, 3, 1.4, 0, 'turf', { z: 3.6, smooth: 0 }), ell(W - 6, G - 1.2, 2.4, 1.2, 0, 'turf', { z: 3.6, smooth: 0 }),
    ];
    S.runestone = { w: 44, h: 78, prims: out, shadow: [W / 2 + 1.5, G - 0.5, 9, 1.8, 0.4] };
  }

  /* --- Menhírek: faragott spirál, moha --- */
  for (let v = 0; v < 3; v++) {
    const W = 17, H = 31, G = H - 1, rng = mulberry32(541 + v);
    const top = 3 + v * 1.6;
    const out = [sheet([[3, G], [2.6 + v, G - 22], [5 + v * 0.6, top + 2], [W / 2, top], [W - 4 - v * 0.4, top + 3], [W - 2.4, G - 20], [W - 3, G]], 'rock', { bulge: 3.4, fall: 4, smooth: 0, scale: 0.9 })];
    const sp = [];
    for (let i = 0; i < 26; i++) { const a = i * 0.5, r = 0.4 + i * 0.16; sp.push([W / 2 + Math.cos(a) * r, G - 17 + Math.sin(a) * r]); }
    out.push(tube(sp, 0.32, 'dark', { z: 3.6, smooth: 0, per: 2, col: [60, 64, 76] }));
    for (let i = 0; i < 4; i++) out.push(ell(4 + rng() * (W - 8), G - 2 - rng() * 8, 1.8, 1.2, 0, 'turf', { z: 3.2, smooth: 0, rz: 0.5 }));
    S[`menhir${v}`] = { w: 34, h: 62, prims: out, shadow: [W / 2 + 1, G - 0.4, 7, 1.4, 0.4] };
  }

  /* --- Láda: deszka, vasalás, arany zár; nyitva: aranyérmék fénnyel --- */
  for (const open of [false, true]) {
    const W = 20, H = 18, G = H - 0.5, rng = mulberry32(551);
    const out = [sheet(rect(2.6, G - 9, W - 2.6, G - 0.5), 'wood', { bulge: 1.4, fall: 2, smooth: 0, pw: 2, dir: 'h' })];
    for (const x of [4.4, W - 4.4]) out.push(tube([[x, G - 0.5], [x, G - 9]], 0.7, 'iron', { z: 1.9, smooth: 0 }));
    if (!open) {
      out.push(sheet([[2.2, G - 9], [2.6, G - 13], [W / 2, G - 15], [W - 2.6, G - 13], [W - 2.2, G - 9]], 'wood', { z: 0.4, bulge: 2, fall: 2.4, smooth: 0, pw: 2, dir: 'h' }));
      out.push(sheet(rect(W / 2 - 1.6, G - 11, W / 2 + 1.6, G - 7), 'gold', { z: 2.6, bulge: 0.3, fall: 0.6, smooth: 0 }), ell(W / 2, G - 9, 0.5, 0.8, 0, 'dark', { z: 3, smooth: 0 }));
    } else {
      out.push(sheet([[2.4, G - 9], [2.2, G - 16], [W / 2, G - 17.6], [W - 2.2, G - 16], [W - 2.4, G - 9]], 'woodDark', { z: -1.6, bulge: 0.8, fall: 2, smooth: 0, pw: 2, dir: 'h' }));
      for (let i = 0; i < 14; i++) out.push(ell(4 + rng() * (W - 8), G - 9.4 - rng() * 1.6, 1, 0.8, 0, 'gold', { z: 2 + rng(), smooth: 0 }));
      out.push(ell(W / 2, G - 10, 5, 2, 0, 'runeGold', { z: 1.6, smooth: 0 }));
    }
    S[open ? 'chest-open' : 'chest'] = { w: 40, h: 36, prims: out, shadow: [W / 2 + 1, G - 0.3, 9, 1.4, 0.45] };
  }

  /* --- Útjelző tábla --- */
  {
    const W = 22, H = 28, G = H - 0.5;
    const out = [
      tube([[W / 2, G], [W / 2, G - 26]], [1.2, 1], 'log', { smooth: 0 }),
      sheet([[3, G - 24], [W - 5, G - 24], [W - 2, G - 21.6], [W - 5, G - 19.4], [3, G - 19.4]], 'wood', { z: 1.4, bulge: 0.6, fall: 1, smooth: 0, pw: 1.6, dir: 'h' }),
      sheet([[W - 3, G - 17], [5, G - 17], [2, G - 14.6], [5, G - 12.4], [W - 3, G - 12.4]], 'woodDark', { z: 1.2, bulge: 0.6, fall: 1, smooth: 0, pw: 1.6, dir: 'h' }),
      ell(W / 2 - 2, G - 1.2, 2.6, 1.2, 0, 'turf', { z: 1.6, smooth: 0 }),
    ];
    S.sign = { w: 44, h: 56, prims: out, shadow: [W / 2 + 1, G - 0.3, 6, 1.2, 0.4] };
  }

  /* --- Tábortűz: kőkör, keresztbe tett hasábok, parázs (a lángot a Phaser adja ~ (13, 8)) --- */
  {
    const W = 26, H = 17, G = H - 0.5, rng = mulberry32(561);
    const out = [ell(W / 2, G - 5, 6.4, 2.2, 0, 'ember', { z: 0.4, smooth: 0 })];
    for (const r of [-0.5, 0.5, 0.05]) { const c = Math.cos(r) * 7, s = Math.sin(r) * 2; out.push(tube([[W / 2 - c, G - 5 - s], [W / 2 + c, G - 5 + s]], 1.4, 'log', { z: 1.6, smooth: 0 })); }
    for (let i = 0; i < 10; i++) { const a = (i / 10) * Math.PI * 2; out.push(ell(W / 2 + Math.cos(a) * 9.6, G - 5.2 + Math.sin(a) * 3.6, 2, 1.5, 0, i % 2 ? 'rock' : 'rockWarm', { z: Math.sin(a) * 3 + 2, smooth: 0, scale: 2 })); }
    S.campfire = { w: 52, h: 34, prims: out, shadow: [W / 2 + 1, G - 2, 12, 2.6, 0.35] };
  }

  /* --- Stég: deszkapadló, cölöpök, kötél, vödör --- */
  {
    const W = 60, H = 20, G = H - 0.5;
    const out = [];
    for (const x of [6, 26, 46]) out.push(tube([[x, 7], [x, G]], 1.6, 'log', { z: -2, smooth: 0 }));
    out.push(sheet(rect(2, 3, W - 2, 10), 'wood', { bulge: 0.8, fall: 1.6, smooth: 0, pw: 2.2 }));
    out.push(tube([[2, 10], [W - 2, 10]], 1.1, 'beam', { z: 0.6, smooth: 0 }));
    out.push(tube([[W - 5, 0.6], [W - 5, 7]], 1.6, 'log', { z: 2, smooth: 0 }));
    for (const r of [3, 2, 1]) out.push(tube(disc(13, 6, r, 14, 0.45).concat([[13 + r, 6]]), 0.55, 'rope', { z: 2.4, smooth: 0, per: 2 }));
    out.push(tube([[W - 12, 2], [W - 12, 6.4]], [2.2, 1.8], 'wood', { z: 2.4, smooth: 0, open1: true, pw: 1.2 }), ell(W - 12, 2, 2, 0.7, 0, 'water', { z: 4.4, smooth: 0 }));
    out.push(ell(35, 5.6, 3, 1, 0.1, 'iron', { z: 2, smooth: 0, col: [150, 176, 190] }));
    S.pier = { w: 120, h: 40, prims: out };
  }

  /* --- Hajó (drakkar): ívelt törzs, sárkányfejes orr, csíkos vitorla, pajzsok --- */
  {
    const W = 110, H = 75, G = H - 6;
    const hull = [];
    for (let i = 0; i <= 16; i++) { const t = i / 16; hull.push([12 + (W - 24) * t, G - 12 + Math.pow(Math.abs(t - 0.5) * 2, 2.4) * -6]); }
    const keel = [];
    for (let i = 16; i >= 0; i--) { const t = i / 16; keel.push([12 + (W - 24) * t, G + 1 - Math.pow(Math.abs(t - 0.5) * 2, 2) * 9]); }
    const out = [
      sheet([...hull, ...keel], 'wood', { bulge: 3, fall: 6, smooth: 0, pw: 2.2, dir: 'h' }),
      tube([[12, G - 18], [7, G - 26], [5, G - 34], [8, G - 38]], [1.6, 1.5, 1.4, 1.2], 'paint', { z: 3, smooth: 0 }), ell(9.6, G - 38.6, 3, 1.8, -0.3, 'paint', { z: 3.4, smooth: 0 }), ell(10, G - 39.4, 0.5, 0.5, 0, 'runeGold', { z: 5, smooth: 0 }),
      tube([[W - 12, G - 18], [W - 7, G - 26], [W - 6, G - 32], [W - 9, G - 34]], [1.6, 1.4, 1.1, 0.6], 'paint', { z: 3, smooth: 0 }),
      tube([[W / 2, G - 12], [W / 2, 4]], 1, 'beam', { z: -1, smooth: 0 }), tube([[W / 2 - 22, 8], [W / 2 + 22, 8]], 0.8, 'beam', { z: 1, smooth: 0 }),
    ];
    for (let i = 0; i < 6; i++) out.push(sheet([[W / 2 - 21 + i * 7, 8.6], [W / 2 - 14 + i * 7, 8.6], [W / 2 - 14.4 + i * 7, G - 20], [W / 2 - 20.6 + i * 7, G - 20]], i % 2 ? 'clothWhite' : 'clothRed', { z: 0.4 + Math.sin(((i + 0.5) / 6) * Math.PI) * 2.4, bulge: 1.2, fall: 3, smooth: 0 }));
    const cols = [['clothRed', 'clothWhite'], ['clothYel', 'woodDark'], ['clothBlue', 'clothWhite'], ['clothGreen', 'clothWhite']];
    for (let i = 0; i < 7; i++) out.push(...shield(26 + i * 9.6, G - 10, 4, cols[i % 4][0], cols[i % 4][1], 4));
    S.drakkar = { w: 220, h: 150, prims: out };
  }

  /* --- Gyakorlótér: döngölt föld, cölöpkerítés, fegyverállvány, célkorong --- */
  {
    const W = 88, H = 60, G = H - 1;
    const out = [sheet(disc(W / 2, G - 13, 39, 28, 0.32), 'dirt', { z: -6, bulge: 0.6, fall: 6, smooth: 0 })];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI, x = W / 2 + Math.cos(a) * 40, y = G - 15 + Math.sin(a) * 13, hh = 15 + (i % 2) * 3;
      out.push(tube([[x, y], [x, y - hh]], [2.2, 2.1], 'log', { z: -4, smooth: 0, open1: true }), prism([[x - 2.2, y - hh], [x, y - hh - 3.6], [x + 2.2, y - hh]], [[x, y - hh - 3.6], [x, y - hh]], 'log', { z: -4, h: 1.6, smooth: 0 }));
    }
    out.push(tube([[W / 2 - 39, G - 29], [W / 2, G - 37], [W / 2 + 39, G - 29]], 1, 'beam', { z: -2, smooth: 0 }));
    out.push(tube([[10, G - 31], [26, G - 31]], 1.2, 'beam', { z: 1, smooth: 0 }), tube([[11, G - 31], [11, G - 13]], 1, 'beam', { z: 1, smooth: 0 }), tube([[25, G - 31], [25, G - 13]], 1, 'beam', { z: 1, smooth: 0 }));
    for (const [x, k] of [[14, 0], [18, 1], [22, 2]]) {
      out.push(tube([[x, G - 13], [x, G - 40]], 0.5, 'beam', { z: 2, smooth: 0 }));
      if (k === 0) out.push(shard([x, G - 40], [x, G - 46], 2, 'iron', { z: 2 }));
      if (k === 1) out.push(sheet([[x, G - 41], [x + 5, G - 43], [x + 4.4, G - 37], [x, G - 38]], 'iron', { z: 2.4, bulge: 0.6, fall: 1, smooth: 0 }));
      if (k === 2) out.push(shard([x, G - 38], [x, G - 47], 1.6, 'iron', { z: 2 }), tube([[x - 2, G - 38], [x + 2, G - 38]], 0.5, 'gold', { z: 2.6, smooth: 0 }));
    }
    const tx = W - 15, ty = G - 30;
    out.push(tube([[tx - 5, G - 13], [tx, ty]], 0.7, 'beam', { z: 0, smooth: 0 }), tube([[tx + 5, G - 13], [tx, ty]], 0.7, 'beam', { z: 0, smooth: 0 }));
    [[7.5, 'clothWhite'], [5.5, 'clothRed'], [3.5, 'clothWhite'], [1.7, 'clothRed']].forEach(([r, m], i) => out.push(ell(tx, ty, r, r, 0, m, { z: 2 + i * 0.6, smooth: 0, rz: 0.6 })));
    out.push(tube([[tx - 2, ty - 1], [tx + 7, ty - 5]], 0.4, 'beam', { z: 5.4, smooth: 0 }));
    S.training = { w: 176, h: 120, prims: out };
  }

  /* --- Szalmabábu-sárkány --- */
  {
    const W = 32, H = 38, G = H - 0.5;
    const out = [
      tube([[W / 2, G], [W / 2, G - 20]], 1.4, 'log', { smooth: 0 }),
      ell(W / 2, G - 19, 9.6, 6.4, 0, 'straw', { z: 1, smooth: 0, rz: 5 }),
      tube([[W / 2 - 9, G - 19], [W / 2, G - 16.4], [W / 2 + 9, G - 19]], 0.6, 'rope', { z: 6, smooth: 0 }),
      tube([[W / 2 - 3, G - 23], [W / 2 - 9, G - 27], [W / 2 - 12, G - 30]], [3.4, 3.4, 2.4], 'sack', { z: 3, smooth: 0.8 }),
      ell(W / 2 - 9, G - 30, 0.9, 0.9, 0, 'paint', { z: 6, smooth: 0 }),
      horn([W / 2 - 6, G - 32], [W / 2 - 2, G - 37], 1.4, -0.2, 'log', { z: 3 }), horn([W / 2 - 3.6, G - 31], [W / 2 + 1.6, G - 34.6], 1.2, -0.2, 'log', { z: 2 }),
    ];
    S.dummy = { w: 64, h: 76, prims: out, shadow: [W / 2 + 1, G - 0.3, 6, 1.2, 0.4] };
  }

  /* --- Lobogó --- */
  S.banner = { w: 34, h: 46, prims: [
    sheet([[1, 1], [16, 1], [16, 22], [8.5, 17], [1, 22]], 'clothRed', { bulge: 1.2, fall: 3, smooth: 0 }),
    tube([[0.4, 0.8], [16.6, 0.8]], 0.6, 'beam', { z: 1.6, smooth: 0 }),
    tube([[8.5, 4], [8.5, 13]], 0.55, 'runeGold', { z: 1.6, smooth: 0 }), tube([[8.5, 4], [6, 7]], 0.55, 'runeGold', { z: 1.6, smooth: 0 }), tube([[8.5, 4], [11, 7]], 0.55, 'runeGold', { z: 1.6, smooth: 0 }),
  ] };

  /* --- Alakok --- */
  S.seer = { w: 44, h: 72, prims: figure({ w: 44, h: 72, robe: 'clothBlue', hood: true, trim: 'gold', item: (cx, G) => [
    tube([[cx + 6.6, G], [cx + 7.4, G - 30]], 0.6, 'beam', { z: 4, smooth: 0 }),
    ell(18.5, 4.5, 1.6, 1.6, 0, 'rune', { z: 5, smooth: 0 }),
  ] }), shadow: [11, 35, 7, 1.4, 0.35] };
  S['npc-fisher'] = { w: 48, h: 64, prims: figure({ w: 48, h: 64, robe: 'clothGreen', hat: 'sack', beard: 'beard', item: (cx, G) => [
    tube([[cx + 4.6, G - 12], [cx + 10, G - 26], [cx + 15, G - 30]], [0.5, 0.35, 0.2], 'beam', { z: 4, smooth: 0 }), tube([[cx + 15, G - 30], [cx + 16, G - 18]], 0.12, 'rope', { z: 4, smooth: 0 }),
  ] }), shadow: [12, 31, 7, 1.4, 0.35] };
  S['npc-merchant'] = { w: 44, h: 64, prims: figure({ w: 44, h: 64, robe: 'clothPurp', hat: 'clothYel', beard: 'beard', trim: 'gold', item: (cx, G) => [
    ell(cx - 6, G - 6, 3.4, 4, 0, 'sack', { z: 2.6, smooth: 0.4 }), tube([[cx - 7.4, G - 10], [cx - 4.6, G - 10]], 0.4, 'rope', { z: 5.6, smooth: 0 }),
  ] }), shadow: [11, 31, 7, 1.4, 0.35] };
  S['npc-skald'] = { w: 44, h: 64, prims: figure({ w: 44, h: 64, robe: 'clothRed', hat: 'iron', beard: 'beard', item: (cx, G) => [
    ell(cx + 4, G - 10, 3, 4.4, 0.3, 'wood', { z: 4.6, smooth: 0, bump: 'grain', rz: 1.4 }), tube([[cx + 5.4, G - 13], [cx + 8.4, G - 20]], 0.6, 'beam', { z: 5, smooth: 0 }),
    ...[0, 1, 2].map((k) => tube([[cx + 3 + k * 0.7, G - 7], [cx + 6.6 + k * 0.6, G - 19]], 0.1, 'gold', { z: 6.2, smooth: 0 })),
  ] }), shadow: [11, 31, 7, 1.4, 0.35] };
  S['npc-wanderer'] = { w: 48, h: 70, prims: figure({ w: 48, h: 70, robe: 'clothDark', hood: true, beard: 'beardGray', item: (cx, G) => [
    tube([[cx + 6.6, G], [cx + 7, G - 28], [cx + 6, G - 31]], 0.6, 'beam', { z: 4, smooth: 0 }), ell(cx - 4.4, G - 21, 1.6, 0.8, 0, 'dark', { z: 3.6, smooth: 0 }),
  ] }), shadow: [12, 34, 7, 1.4, 0.35] };

  /* --- A Fagyóriás trónja: jégkristályok, ülés, hókupac --- */
  {
    const W = 60, H = 64, G = H - 1;
    const out = [];
    [[12, 23, 7, -4], [48, 25, 7, 4], [19, 36, 9, -2], [41, 34, 9, 2], [30, 42, 12, 0]].forEach(([x, h, w, lean], i) => out.push(shard([x, G - 19], [x + lean, G - 19 - h], w, 'ice', { z: -2 + i * 0.3 })));
    out.push(prism(rect(11, G - 22, W - 11, G - 18), [[11, G - 20], [W - 11, G - 20]], 'ice', { z: 3, h: 2, smooth: 0 }));
    out.push(prism(rect(13, G - 18, W - 13, G - 7), [[W / 2, G - 18], [W / 2, G - 7]], 'ice', { z: 2, h: 3, smooth: 0 }));
    out.push(shard([7, G - 6], [5.6, G - 30], 8, 'ice', { z: 5 }), shard([W - 7, G - 6], [W - 5.6, G - 30], 8, 'ice', { z: 5 }));
    out.push(sheet([[2, G], [5, G - 7], [13, G - 6], [22, G - 9], [30, G - 6.4], [40, G - 9], [48, G - 6.4], [55, G - 8], [W - 2, G]], 'snow', { z: 6, bulge: 2, fall: 3, smooth: 0 }));
    out.push(tube([[W / 2 - 1.6, G - 38], [W / 2 - 1.6, G - 28]], 0.5, 'rune', { z: 7, smooth: 0, col: [200, 250, 255] }), tube([[W / 2 - 1.6, G - 36], [W / 2 + 2.4, G - 33], [W / 2 - 1.6, G - 30]], 0.5, 'rune', { z: 7, smooth: 0, col: [200, 250, 255] }));
    S.throne = { w: 120, h: 128, prims: out, shadow: [W / 2 + 3, G - 1, 27, 3.4, 0.35] };
  }

  /* --- Muspell-oltár: bazaltlépcső, láva-erek, vas parázstál szarvakkal (a láng ~ (26, 12)) --- */
  {
    const W = 52, H = 42, G = H - 1, rng = mulberry32(571);
    const out = [
      sheet(rect(3, G - 7, W - 3, G - 0.5), 'stoneDark', { bulge: 1, fall: 1.4, smooth: 0, cs: 2 }),
      sheet(rect(7, G - 12, W - 7, G - 7), 'stoneDark', { z: -0.5, bulge: 1, fall: 1.4, smooth: 0, cs: 2 }),
      sheet([[12, G - 12], [14, G - 27], [W - 14, G - 27], [W - 12, G - 12]], 'basalt', { z: -1, bulge: 2.4, fall: 3, smooth: 0 }),
      sheet(rect(9, G - 31, W - 9, G - 26.6), 'basalt', { z: 0, bulge: 1.2, fall: 1.4, smooth: 0 }),
      ...[[[15, G - 25], [18, G - 21], [16, G - 17], [19, G - 13]], [[W - 15, G - 26], [W - 18, G - 22], [W - 16, G - 18]], [[W / 2 - 2, G - 23], [W / 2 + 1, G - 20], [W / 2 - 1, G - 16]]]
        .map((pts) => tube(pts, 0.5, 'lava', { z: 2.2, smooth: 0, per: 3 })),
      tube([[W / 2 - 9, G - 30.4], [W / 2, G - 26.4], [W / 2 + 9, G - 30.4]], [1.6, 2.6, 1.6], 'iron', { z: 2.8, smooth: 0 }),
      ell(W / 2, 12, 8.6, 2, 0, 'ember', { z: 4.6, smooth: 0 }),
      horn([11, G - 31], [7, G - 41], 2.6, 0.3, 'bone', { z: 2 }), horn([W - 11, G - 31], [W - 7, G - 41], 2.6, -0.3, 'bone', { z: 2 }),
    ];
    for (let i = 0; i < 5; i++) out.push(ell(W / 2 - 6 + rng() * 12, 11.6 + rng(), 0.9, 0.7, 0, 'coal', { z: 5.4, smooth: 0 }));
    S.altar = { w: 104, h: 84, prims: out, shadow: [W / 2 + 2, G - 0.5, 24, 2.6, 0.45] };
  }

  /* --- A Valkűr-kő: tollas kőszárnyak, aranyozott sisak, rúnák --- */
  {
    const W = 48, H = 60, G = H - 1;
    const out = [];
    for (const dir of [-1, 1]) for (let i = 0; i < 7; i++) {
      const a = -1.1 + i * 0.25, ox = W / 2 + dir * 5, oy = 22, L = 17 - i * 1.2;
      const tip = [ox + dir * Math.cos(a) * L, oy + Math.sin(a) * L];
      out.push(sheet([[ox, oy - 1], [(ox + tip[0]) / 2 + dir * 0.4, (oy + tip[1]) / 2 - 1.6], tip, [(ox + tip[0]) / 2, (oy + tip[1]) / 2 + 1.4], [ox, oy + 1]], 'snow', { z: -2 - i * 0.2, bulge: 0.6, fall: 1.2, smooth: 0, col: [214, 220, 232] }));
    }
    out.push(sheet([[W / 2 - 9, G], [W / 2 - 10, 15], [W / 2, 3], [W / 2 + 10, 15], [W / 2 + 9, G]], 'rock', { bulge: 4, fall: 6, smooth: 0, scale: 0.9 }));
    out.push(ell(W / 2, 22, 4, 3.4, 0, 'gold', { z: 5, smooth: 0, rz: 1.6 }), tube([[W / 2 - 4, 22], [W / 2 + 4, 22]], 0.6, 'gold', { z: 5.6, smooth: 0 }));
    out.push(tube([[W / 2, 30], [W / 2, 37]], 0.5, 'runeGold', { z: 4.6, smooth: 0 }), tube([[W / 2, 30], [W / 2 - 2.4, 32.6]], 0.5, 'runeGold', { z: 4.6, smooth: 0 }), tube([[W / 2, 30], [W / 2 + 2.4, 32.6]], 0.5, 'runeGold', { z: 4.6, smooth: 0 }));
    out.push(tube([[W / 2 - 1.2, 41], [W / 2 - 1.2, 48]], 0.5, 'runeGold', { z: 4.4, smooth: 0 }), tube([[W / 2 - 1.2, 41], [W / 2 + 1.8, 43], [W / 2 - 1.2, 45]], 0.5, 'runeGold', { z: 4.4, smooth: 0 }));
    for (let i = 0; i < 6; i++) out.push(ell(W / 2 - 9 + i * 3.6, G - 1, 1.8, 1.1, 0, i % 2 ? 'turf' : 'flowerW', { z: 3.8, smooth: 0 }));
    S.valkstone = { w: 96, h: 120, prims: out, shadow: [W / 2 + 2, G - 0.5, 14, 2, 0.4] };
  }
  return S;
}
