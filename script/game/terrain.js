/* =====================================================================
   Domborzat — a völgy „3D-s" megjelenése
   ---------------------------------------------------------------------
   A csempés talaj fölé három, alacsony felbontású (csempénként 8 px)
   réteg kerül, lineáris szűréssel a térkép méretére nagyítva — így az
   átmenetek lágyak, és csak néhány százezer képpontot kell kiszámolni:

     relief-tint   a vidékek színe elmosva (lágy partél, nincs „csemperács")
     relief-shade  SZORZÓ réteg: domborzat-árnyékolás (északnyugati nap),
                   vetett árnyék a hegyek mögött, mélyedések sötétje,
                   a víz a parttól távolodva mélyül
     relief-light  ÖSSZEADÓ réteg: a napos lejtők meleg fénye, csillanó hó

   A hegyvidék belsejébe ezen felül árnyalt csúcsok (sprite-ok) kerülnek,
   y szerint rendezve — a hegyek így kiemelkednek a síkból.
   ===================================================================== */
import { B, TILE, makeNoise, fbm } from './world.js';
import { mulberry32 } from './rules.js';
import { TILE_MARGIN, TILE_SPACING } from './art.js';

const RES = 8;                                   // képpont csempénként a rétegekben
const SUN = (() => {                             // északnyugat felől, kb. 40°-os magasságban
  const v = [-0.55, -0.65, 0.6];
  const l = Math.hypot(...v);
  return v.map((x) => x / l);
})();
const SHADOW_COL = [0.36, 0.42, 0.62];           // az árnyék hűvös, kékes

/** Csempénkénti tömb bilineáris mintavétele (a csempeközéppontok között). */
function sampler(arr, W, H) {
  return (u, v) => {
    u = Math.max(0, Math.min(W - 1.001, u - 0.5));
    v = Math.max(0, Math.min(H - 1.001, v - 0.5));
    const x0 = u | 0, y0 = v | 0, fx = u - x0, fy = v - y0;
    const i = y0 * W + x0;
    const a = arr[i], b = arr[i + 1], c = arr[i + W], d = arr[i + W + 1];
    return (a + (b - a) * fx) * (1 - fy) + (c + (d - c) * fx) * fy;
  };
}

/** A csempék átlagszíne a tileset vásznáról. */
function tileColors(scene) {
  const src = scene.textures.get('tiles').getSourceImage();
  const ctx = src.getContext ? src.getContext('2d') : null;
  if (!ctx) return null;
  const cols = 8, S = TILE, M = TILE_MARGIN, P = TILE_SPACING;
  const data = ctx.getImageData(0, 0, src.width, src.height).data;
  const out = [];
  const rows = Math.round(src.height / (S + P));
  for (let t = 0; t < cols * rows; t++) {
    const x0 = (t % cols) * (S + P) + M, y0 = Math.floor(t / cols) * (S + P) + M;
    let r = 0, g = 0, b = 0, n = 0;
    for (let y = y0; y < y0 + S; y += 3) for (let x = x0; x < x0 + S; x += 3) {
      const k = (y * src.width + x) * 4;
      r += data[k]; g += data[k + 1]; b += data[k + 2]; n++;
    }
    out.push([r / n, g / n, b / n]);
  }
  return out;
}

/**
 * A három domborzati réteg textúrája.
 * @returns {{tint:string, shade:string, light:string}} a textúrakulcsok
 */
export function buildRelief(scene, world) {
  const { w: W, h: H, height, biome } = world;
  const PW = W * RES, PH = H * RES;
  const n1 = makeNoise(world.seed + 101), n2 = makeNoise(world.seed + 102), n3 = makeNoise(world.seed + 103);

  const N = W * H;
  const mount = new Float32Array(N), water = new Float32Array(N), snow = new Float32Array(N);
  for (let i = 0; i < N; i++) {
    mount[i] = biome[i] === B.MOUNTAIN ? 1 : 0;
    water[i] = biome[i] === B.WATER || biome[i] === B.BRIDGE ? 1 : 0;
    snow[i] = world.snowy[i] && !world.ashy[i] ? 1 : 0;
  }
  // Tágabb környezet átlagmagassága (a mélyedések árnyékához)
  const wide = new Float32Array(N);
  for (let y = 0; y < H; y++) for (let x = 0; x < W; x++) {
    let s = 0, c = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
      const nx = x + dx, ny = y + dy;
      if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
      s += height[ny * W + nx]; c++;
    }
    wide[y * W + x] = s / c;
  }
  /* Lassan változó zajmezők negyedcsempénként (bilineárisan mintavételezve):
     a torzítás és a nagy foltok — így a drága zajfüggvény jóval ritkábban fut */
  const Q = 4, QW = W * Q, QH = H * Q;
  const warpU = new Float32Array(QW * QH), warpV = new Float32Array(QW * QH), patchF = new Float32Array(QW * QH);
  for (let y = 0; y < QH; y++) for (let x = 0; x < QW; x++) {
    const u = (x + 0.5) / Q, v = (y + 0.5) / Q, k = y * QW + x;
    warpU[k] = (fbm(n3, u * 0.7, v * 0.7, 2) - 0.5) * 1.1;
    warpV[k] = (fbm(n3, u * 0.7 + 40, v * 0.7, 2) - 0.5) * 1.1;
    patchF[k] = 0.92 + fbm(n2, u / 7 + 50, v / 7, 2) * 0.16;
  }
  const quarter = (arr) => { const f = sampler(arr, QW, QH); return (u, v) => f(u * Q, v * Q); };
  const wuAt = quarter(warpU), wvAt = quarter(warpV), patchAt = quarter(patchF);

  const hAt = sampler(height, W, H), mAt = sampler(mount, W, H), wAt = sampler(water, W, H);
  const sAt = sampler(snow, W, H), wideAt = sampler(wide, W, H);

  /* --- Részletes magasság: a hegyekben töredezett gerincek --- */
  const hd = new Float32Array(PW * PH);
  for (let py = 0; py < PH; py++) {
    const v = (py + 0.5) / RES;
    for (let px = 0; px < PW; px++) {
      const u = (px + 0.5) / RES;
      let h = hAt(u, v);
      const m = mAt(u, v);
      if (m > 0.01) {
        // „Gerinces" zaj: 1 − |2n − 1| éles hátakat ad
        const r = 1 - Math.abs(2 * fbm(n1, u * 0.85, v * 0.85, 3) - 1);
        h += m * (r - 0.55) * 1.1;
      }
      h += (n2(u * 1.6, v * 1.6) - 0.5) * 0.05;
      hd[py * PW + px] = h;
    }
  }

  const shade = document.createElement('canvas');
  const light = document.createElement('canvas');
  const tint = document.createElement('canvas');
  for (const c of [shade, light, tint]) { c.width = PW; c.height = PH; }
  const sImg = shade.getContext('2d').createImageData(PW, PH);
  const lImg = light.getContext('2d').createImageData(PW, PH);
  const tImg = tint.getContext('2d').createImageData(PW, PH);
  const sd = sImg.data, ld = lImg.data, td = tImg.data;

  const lxy = Math.hypot(SUN[0], SUN[1]);
  const dirX = SUN[0] / lxy, dirY = SUN[1] / lxy;
  const tanSun = SUN[2] / lxy;
  const STEP = RES * 0.5;                         // fél csempénként lépünk a nap felé
  const K = 1.0;                                  // a lejtők meredekségének szorzója

  const colors = tileColors(scene);
  const tc = colors ? (() => {
    const r = new Float32Array(N), g = new Float32Array(N), b = new Float32Array(N);
    for (let i = 0; i < N; i++) { const c = colors[world.ground[i]] || [60, 100, 70]; r[i] = c[0]; g[i] = c[1]; b[i] = c[2]; }
    return [sampler(r, W, H), sampler(g, W, H), sampler(b, W, H)];
  })() : null;

  for (let py = 0; py < PH; py++) {
    const v = (py + 0.5) / RES;
    for (let px = 0; px < PW; px++) {
      const u = (px + 0.5) / RES;
      const i = py * PW + px;
      const h0 = hd[i];

      // Normálvektor a szomszédos képpontokból
      const xl = px > 0 ? hd[i - 1] : h0, xr = px < PW - 1 ? hd[i + 1] : h0;
      const yu = py > 0 ? hd[i - PW] : h0, yd = py < PH - 1 ? hd[i + PW] : h0;
      const gx = (xr - xl) * RES / 2 * K, gy = (yd - yu) * RES / 2 * K;
      const nl = Math.hypot(gx, gy, 1);
      const diffuse = (-gx * SUN[0] - gy * SUN[1] + SUN[2]) / nl;
      const ratio = Math.max(0.2, Math.min(1.7, diffuse / SUN[2]));

      // Vetett árnyék: mi takarja el a napot?
      let shadow = 0;
      for (let k = 1; k <= 14 && shadow < 1; k++) {
        const sx = Math.round(px + dirX * STEP * k), sy = Math.round(py + dirY * STEP * k);
        if (sx < 0 || sy < 0 || sx >= PW || sy >= PH) break;
        const need = h0 + tanSun * k * 0.5;
        const over = hd[sy * PW + sx] - need;
        if (over > 0) shadow = Math.max(shadow, Math.min(1, over / 0.18));
      }

      const ao = Math.max(0, Math.min(0.32, (wideAt(u, v) - hAt(u, v)) * 0.55));
      let val = Math.min(ratio, 1) * (1 - shadow * 0.4) * (1 - ao);

      // Torzított koordináta: a vidékhatárok és a partvonal ne a csemperácsot kövessék
      const wu = u + wuAt(u, v), wv = v + wvAt(u, v);

      // Víz: a parttól távolodva sötétebb, kékebb
      const wm = wAt(u, v);
      const depth = wm * Math.max(0, Math.min(1, (-hAt(u, v) - 0.04) / 0.3));
      let r = SHADOW_COL[0] + (1 - SHADOW_COL[0]) * val;
      let g = SHADOW_COL[1] + (1 - SHADOW_COL[1]) * val;
      let b = SHADOW_COL[2] + (1 - SHADOW_COL[2]) * val;
      r *= 1 - depth * 0.5; g *= 1 - depth * 0.35; b *= 1 - depth * 0.18;
      sd[i * 4] = r * 255; sd[i * 4 + 1] = g * 255; sd[i * 4 + 2] = b * 255; sd[i * 4 + 3] = 255;

      // Napos lejtő: meleg fény; a havon erősebb csillanás
      const hi = Math.max(0, ratio - 1) * (1 - shadow);
      const sn = sAt(u, v);
      // Hab a partvonalon (a torzított vízmaszk ~0,45-ös szintvonala)
      const shore = wAt(wu, wv);
      const fl = Math.max(0, 1 - Math.abs(shore - 0.42) / 0.09);
      const foam = fl && fl * (0.6 + n2(u * 4, v * 4) * 0.8);
      const amt = hi * (0.34 - sn * 0.22) + foam * 0.22 * (1 - sn);
      ld[i * 4] = Math.min(255, amt * 255); ld[i * 4 + 1] = Math.min(255, amt * 222); ld[i * 4 + 2] = Math.min(255, amt * (170 + sn * 70));
      ld[i * 4 + 3] = 255;

      /* Vidékhatár: a szomszédos vidékek színe hullámos, zajjal torzított
         vonal mentén olvad egymásba. Ahol a kevert szín eltér a csempe
         saját színétől (vagyis határon vagyunk), ott a réteg szinte fedő —
         a csempe belsejében alig látszik, a rajzolt minta megmarad. */
      if (tc) {
        const patch = patchAt(u, v) * (0.94 + n2(u * 3.1 + 7, v * 3.1) * 0.12);
        const r0 = tc[0](wu, wv), g0 = tc[1](wu, wv), b0 = tc[2](wu, wv);
        const own = colors[world.ground[Math.min(H - 1, v | 0) * W + Math.min(W - 1, u | 0)]] || [r0, g0, b0];
        const dist = Math.hypot(r0 - own[0], g0 - own[1], b0 - own[2]);
        td[i * 4] = r0 * patch; td[i * 4 + 1] = g0 * patch; td[i * 4 + 2] = b0 * patch;
        td[i * 4 + 3] = 255 * Math.max(0.14, Math.min(0.95, (dist - 5) / 30));
      }
    }
  }
  shade.getContext('2d').putImageData(sImg, 0, 0);
  light.getContext('2d').putImageData(lImg, 0, 0);
  tint.getContext('2d').putImageData(tImg, 0, 0);
  for (const k of ['relief-shade', 'relief-light', 'relief-tint']) if (scene.textures.exists(k)) scene.textures.remove(k);
  scene.textures.addCanvas('relief-shade', shade);
  scene.textures.addCanvas('relief-light', light);
  if (tc) scene.textures.addCanvas('relief-tint', tint);
  return { shade: 'relief-shade', light: 'relief-light', tint: tc ? 'relief-tint' : null };
}

/* =====================================================================
   Hegycsúcsok
   ===================================================================== */
const PEAK_SIZES = [[112, 92], [150, 118], [88, 70]];
const PEAK_VARIANTS = 3;                          // méretenként ennyi különböző rajz
const PEAK_STYLE = {
  rock: { lit: ['#9aa0b4', '#6a7088'], dark: ['#4d536b', '#2b2f42'], grain: ['rgba(30,34,52,.35)', 'rgba(220,226,240,.18)'], cap: null },
  snow: { lit: ['#a3acc4', '#737d98'], dark: ['#566080', '#333a54'], grain: ['rgba(30,34,52,.3)', 'rgba(230,236,250,.2)'], cap: ['#f6f9ff', '#aebcd8'] },
  ash:  { lit: ['#5e5052', '#3a3133'], dark: ['#2e2628', '#151012'], grain: ['rgba(0,0,0,.4)', 'rgba(255,160,110,.08)'], cap: null, glow: '#ff7a3d' },
};

/**
 * Hegyvonulat-darab 1–3 csúccsal. Minden csúcsnak napos (bal) és
 * árnyékos (jobb) lapja van; rajta sziklarétegek, hó vagy izzó repedés.
 */
function drawPeak(ctx, w, h, style, rng) {
  const base = h - 2;
  // Csúcsok: x és magasság (a középső a legmagasabb)
  const n = 1 + Math.floor(rng() * 3);
  const summits = [];
  for (let i = 0; i < n; i++) {
    const t = n === 1 ? 0.5 : 0.2 + (0.6 * i) / (n - 1) + (rng() - 0.5) * 0.08;
    const main = n === 1 || i === Math.floor(n / 2);
    summits.push({ x: w * t, y: main ? 3 + rng() * 6 : h * (0.28 + rng() * 0.18) });
  }
  // Körvonal: talp → csúcsok és nyergek csipkés szakaszokkal → talp
  const pts = [[0, base]];
  const jag = (x0, y0, x1, y1, k) => {
    for (let s = 1; s < k; s++) {
      const t = s / k;
      pts.push([x0 + (x1 - x0) * t + (rng() - 0.5) * 4, y0 + (y1 - y0) * t + (rng() - 0.35) * 6]);
    }
    pts.push([x1, y1]);
  };
  let px = 0, py = base;
  summits.forEach((sm, i) => {
    jag(px, py, sm.x, sm.y, 4);
    const next = summits[i + 1];
    if (next) {
      const sx = (sm.x + next.x) / 2 + (rng() - 0.5) * 8;
      const sy = Math.max(sm.y, next.y) + h * (0.12 + rng() * 0.1);
      jag(sm.x, sm.y, sx, sy, 3);
      px = sx; py = sy;
    } else { px = sm.x; py = sm.y; }
  });
  jag(px, py, w, base, 4);
  const outline = () => { ctx.beginPath(); pts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.closePath(); };
  const grad = (stops, y0 = 0) => {
    const g = ctx.createLinearGradient(0, y0, 0, base);
    g.addColorStop(0, stops[0]); g.addColorStop(1, stops[1]);
    return g;
  };

  ctx.save();
  outline(); ctx.clip();
  // Az egész tömb árnyékban…
  ctx.fillStyle = grad(style.dark); ctx.fillRect(0, 0, w, h);
  // …a csúcsok bal (északnyugati) oldala napos: a csúcstól a talpig húzott gerinc balra
  const spines = summits.map((sm) => ({ top: sm, foot: sm.x + (rng() * 0.25 + 0.05) * w * 0.4 }));
  spines.forEach(({ top, foot }) => {
    ctx.beginPath();
    ctx.moveTo(top.x, top.y);
    const mid = [top.x + (foot - top.x) * 0.5 + (rng() - 0.5) * 6, top.y + (base - top.y) * 0.5];
    ctx.lineTo(mid[0], mid[1]);
    ctx.lineTo(foot, base);
    ctx.lineTo(Math.max(0, top.x - w * 0.9), base);
    ctx.lineTo(Math.max(0, top.x - w * 0.9), top.y);
    ctx.closePath();
    ctx.fillStyle = grad(style.lit, top.y);
    ctx.fill();
  });
  // Sziklaszemcse: rövid, lejtőirányú vonások és foltok
  for (let i = 0; i < w * h / 55; i++) {
    const x = rng() * w, y = rng() * h;
    ctx.strokeStyle = style.grain[rng() < 0.6 ? 0 : 1];
    ctx.lineWidth = 0.8 + rng() * 1.2;
    const dir = rng() < 0.5 ? -1 : 1;
    ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dir * (3 + rng() * 6), y + 4 + rng() * 8); ctx.stroke();
  }
  // Vízmosások: a csúcsokból lefutó sötét erek
  ctx.strokeStyle = style.grain[0]; ctx.lineCap = 'round';
  spines.forEach(({ top }) => {
    for (let k = 0; k < 3; k++) {
      let x = top.x + (rng() - 0.5) * 18, y = top.y + 8 + rng() * 10;
      ctx.lineWidth = 1.4;
      ctx.beginPath(); ctx.moveTo(x, y);
      while (y < base - 4) { x += (rng() - 0.5) * 7; y += 5 + rng() * 6; ctx.lineTo(x, y); }
      ctx.stroke();
    }
  });
  // Hósapka: a csúcsok körül, csipkés alsó széllel; a napos fele fehérebb
  if (style.cap) {
    summits.forEach((sm, i) => {
      const capH = (base - sm.y) * (0.26 + rng() * 0.14);
      const left = sm.x - capH * 1.2, right = sm.x + capH * 1.25;
      const sp = spines[i].top.x + (spines[i].foot - spines[i].top.x) * 0.35;
      for (const [x0, x1, col] of [[left - 4, sp, style.cap[0]], [sp, right + 4, style.cap[1]]]) {
        ctx.beginPath();
        ctx.moveTo(sm.x, sm.y - 2);
        const steps = 5;
        for (let k = 0; k <= steps; k++) {
          const x = x0 + (x1 - x0) * (k / steps);
          const reach = 1 - Math.abs(x - sm.x) / (capH * 1.3);
          ctx.lineTo(x, sm.y + capH * Math.max(0.15, reach) + (k % 2 ? 5 + rng() * 6 : -rng() * 4));
        }
        ctx.closePath();
        ctx.fillStyle = col; ctx.fill();
      }
    });
  }
  // Izzó repedések a hamuvidéken
  if (style.glow) {
    ctx.strokeStyle = style.glow; ctx.lineWidth = 1.6; ctx.shadowColor = style.glow; ctx.shadowBlur = 6;
    summits.forEach((sm) => {
      let x = sm.x + (rng() - 0.5) * 10, y = sm.y + (base - sm.y) * (0.3 + rng() * 0.2);
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 4; k++) { x += (rng() - 0.5) * 12; y += 6 + rng() * 6; ctx.lineTo(x, Math.min(base - 2, y)); }
      ctx.stroke();
    });
    ctx.shadowBlur = 0;
  }
  // Talp: lágy átmenet a talajba (a domborzati réteg folytatja)
  const fade = ctx.createLinearGradient(0, base - 14, 0, base);
  fade.addColorStop(0, 'rgba(10,14,26,0)'); fade.addColorStop(1, 'rgba(10,14,26,.35)');
  ctx.fillStyle = fade; ctx.fillRect(0, base - 14, w, 14);
  ctx.restore();

  // Halvány gerincfény a napos élen
  ctx.strokeStyle = 'rgba(255,255,255,.28)'; ctx.lineWidth = 1.2;
  spines.forEach(({ top }) => {
    ctx.beginPath(); ctx.moveTo(top.x - 1, top.y + 1); ctx.lineTo(top.x - (base - top.y) * 0.32, top.y + (base - top.y) * 0.4); ctx.stroke();
  });
}

/** A csúcs-textúrák: három vidék × három méret × néhány változat. */
export function buildPeaks(scene) {
  const rng = mulberry32(9090);
  for (const kind of Object.keys(PEAK_STYLE)) {
    PEAK_SIZES.forEach(([w, h], v) => {
      for (let k = 0; k < PEAK_VARIANTS; k++) {
        const key = `peak-${kind}${v}-${k}`;
        if (scene.textures.exists(key)) continue;
        const c = document.createElement('canvas');
        c.width = w; c.height = h;
        drawPeak(c.getContext('2d'), w, h, PEAK_STYLE[kind], rng);
        scene.textures.addCanvas(key, c);
      }
    });
  }
}

/**
 * Hová kerüljön csúcs: a hegyvidék belsejébe, ahol észak felé is hegy van —
 * így a csúcs sosem takar el járható csempét (és a játékost).
 */
export function peakSpots(world) {
  const { w: W, h: H, biome, height } = world;
  const rng = mulberry32(world.seed + 31);
  const mt = (x, y) => x < 0 || y < 0 || x >= W || y >= H || biome[y * W + x] === B.MOUNTAIN;
  const nearPoi = (x, y) => world.pois.some((p) => Math.abs(p.x - x) <= 2 && y - p.y <= 1 && p.y - y <= 5);
  const out = [];
  for (let y = 1; y < H - 1; y++) for (let x = 0; x < W; x++) {
    if (!mt(x, y) || !mt(x, y + 1) || !mt(x, y - 1) || !mt(x, y - 2) || !mt(x - 1, y) || !mt(x + 1, y)) continue;
    if (nearPoi(x, y)) continue;
    const i = y * W + x;
    const hgt = height[i];
    if (rng() > 0.42 + Math.min(0.35, (hgt - 0.9) * 0.25)) continue;
    const big = mt(x, y - 3) && hgt > 1.3 && rng() < 0.45;
    out.push({
      x: x * TILE + TILE / 2 + (rng() - 0.5) * 22,
      y: (y + 1) * TILE - 2 + (rng() - 0.5) * 10,
      kind: world.ashy[i] ? 'ash' : world.snowy[i] || hgt > 2.1 ? 'snow' : 'rock',
      v: big ? 1 : rng() < 0.4 ? 2 : 0,
      k: Math.floor(rng() * PEAK_VARIANTS),
      scale: 0.8 + rng() * 0.4,
    });
  }
  return out;
}
