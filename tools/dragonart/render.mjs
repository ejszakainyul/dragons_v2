/* =====================================================================
   Sárkányrészek renderelője — 2,5D „szobrászott" formák, pixelenkénti fény
   ---------------------------------------------------------------------
   Nem körvonalas rajz: minden rész valódi térbeli formákból áll
   (elvékonyodó csövek, ellipszoidok, lapok, kristályprizmák), amelyeket
   oldalnézetből, ortografikusan „lefényképezünk":

     1. minden forma magasságot (z) ad a képpontjaira; az átfedések
        lágy uniót kapnak (a nyak simán nő ki a mellkasból)
     2. a forma helyi koordinátáiban (a cső mentén / keresztben) készül
        a felszíni dombormű: pikkelyek, hasi lemezek, szarvgyűrűk, tollak
     3. a magasságmezőből normálvektor → szórt fény, ég-fény, csillanás,
        peremfény, résárnyék (AO), mélységi vonalak, finom körvonal
     4. két kép készül: a SZÍNEZHETŐ réteg (szürke — az oldal és a játék
        a sárkány saját színével szorozza), és a SAJÁT SZÍNŰ réteg (szarv,
        karom, fog, szem, kristály, láva, fém + a fehér csillanások)

   A rács 64 egység (mint eddig), a csatlakozási pontok változatlanok.
   ===================================================================== */

export const GRID = 64;

/* --- Anyagok ------------------------------------------------------------- */
// tint: a sárkány színe szorozza; különben col a saját szín.
export const MATS = {
  skin:     { tint: true, alb: 0.66, bump: 'scales', amp: 0.13, spec: 0.22, shin: 26, mottle: true },
  smooth:   { tint: true, alb: 0.66, bump: null, spec: 0.26, shin: 30 },
  belly:    { tint: true, alb: 0.92, bump: 'plates', amp: 0.2, spec: 0.14, shin: 20 },
  armor:    { tint: true, alb: 0.5, bump: 'armor', amp: 0.22, spec: 0.42, shin: 46 },
  hide:     { tint: true, alb: 0.6, bump: 'grain', amp: 0.08, spec: 0.12, shin: 16 },
  membrane: { tint: true, alb: 0.58, bump: 'veins', amp: 0.05, spec: 0.07, shin: 12, membrane: true },
  feather:  { tint: true, alb: 0.74, bump: 'feather', amp: 0.12, spec: 0.12, shin: 18 },
  fur:      { tint: true, alb: 0.62, bump: 'strands', amp: 0.16, spec: 0.06, shin: 10 },
  dark:     { tint: true, alb: 0.32, bump: 'scales', amp: 0.1, spec: 0.12, shin: 20 },
  horn:     { col: [222, 208, 178], tip: [92, 76, 60], bump: 'rings', amp: 0.08, spec: 0.32, shin: 36 },
  claw:     { col: [64, 56, 52], tip: [24, 22, 22], spec: 0.55, shin: 60 },
  tooth:    { col: [246, 240, 226], spec: 0.4, shin: 40 },
  bone:     { col: [228, 220, 200], bump: 'grain', amp: 0.08, spec: 0.22, shin: 24 },
  mouth:    { col: [96, 30, 36], spec: 0.2, shin: 20 },
  tongue:   { col: [176, 64, 84], spec: 0.35, shin: 30 },
  crystal:  { col: [176, 228, 255], spec: 1.0, shin: 90, facet: true, glow: [150, 220, 255], glowK: 0.25 },
  amethyst: { col: [196, 150, 255], spec: 1.0, shin: 90, facet: true, glow: [200, 150, 255], glowK: 0.25 },
  lava:     { col: [255, 140, 40], emis: 1, glow: [255, 110, 30], glowK: 0.8 },
  ember:    { col: [255, 196, 90], emis: 1, glow: [255, 150, 50], glowK: 0.6 },
  metal:    { col: [150, 158, 172], bump: 'grain', amp: 0.05, spec: 0.85, shin: 70 },
  gold:     { col: [222, 176, 84], bump: 'grain', amp: 0.04, spec: 0.9, shin: 70 },
  moss:     { col: [104, 150, 72], bump: 'noise', amp: 0.3, spec: 0.05, shin: 8 },
  storm:    { col: [190, 230, 255], emis: 1, glow: [140, 200, 255], glowK: 0.7 },
  eye:      { eye: true, spec: 0.9, shin: 120 },
};

/* --- Kis segédek ----------------------------------------------------------- */
const clamp = (v, a = 0, b = 1) => (v < a ? a : v > b ? b : v);
const lerp = (a, b, t) => a + (b - a) * t;
const smooth = (a, b, x) => { const t = clamp((x - a) / (b - a)); return t * t * (3 - 2 * t); };
function hash(x, y) { let h = (x * 374761393 + y * 668265263) | 0; h = (h ^ (h >>> 13)) * 1274126177; return ((h ^ (h >>> 16)) >>> 0) / 4294967295; }
function vnoise(x, y) {
  const xi = Math.floor(x), yi = Math.floor(y), xf = x - xi, yf = y - yi;
  const u = xf * xf * (3 - 2 * xf), v = yf * yf * (3 - 2 * yf);
  return lerp(lerp(hash(xi, yi), hash(xi + 1, yi), u), lerp(hash(xi, yi + 1), hash(xi + 1, yi + 1), u), v);
}

/** Catmull-Rom mintavételezés. */
function sampleSpine(pts, per = 10) {
  if (pts.length === 1) return [{ x: pts[0][0], y: pts[0][1], k: 0 }];
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = i ? 1 : 0; s <= per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      out.push({
        x: 0.5 * (2 * p1[0] + (-p0[0] + p2[0]) * t + (2 * p0[0] - 5 * p1[0] + 4 * p2[0] - p3[0]) * t2 + (-p0[0] + 3 * p1[0] - 3 * p2[0] + p3[0]) * t3),
        y: 0.5 * (2 * p1[1] + (-p0[1] + p2[1]) * t + (2 * p0[1] - 5 * p1[1] + 4 * p2[1] - p3[1]) * t2 + (-p0[1] + 3 * p1[1] - 3 * p2[1] + p3[1]) * t3),
        k: (i + t) / (pts.length - 1),
      });
    }
  }
  return out;
}
/** Sugárlista interpolálva 0..1 mentén. */
function radAt(r, k) {
  if (!Array.isArray(r)) return r;
  if (r.length === 1) return r[0];
  const f = k * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f));
  return lerp(r[i], r[i + 1], f - i);
}

/* =====================================================================
   A renderelés
   ===================================================================== */
/**
 * @param {object[]} prims  formák: {type, mat, z, zs, smooth, ...}
 * @param {object}   opts   {size: kimeneti méret (px), ss: túlmintavétel}
 * @returns {{base: Uint8ClampedArray, fx: Uint8ClampedArray, size: number}}
 */
export function renderPart(prims, opts = {}) {
  const OUT = opts.size || 320, SS = opts.ss || 2, N = OUT * SS, U = N / GRID;
  const H = new Float32Array(N * N).fill(-1e9);
  const M = new Int16Array(N * N).fill(-1);
  const FA = new Float32Array(N * N).fill(1);
  const TU = new Float32Array(N * N), TV = new Float32Array(N * N), TK = new Float32Array(N * N);
  const tmp = new Float32Array(N * N).fill(-1e9);
  const tu = new Float32Array(N * N), tv = new Float32Array(N * N), tk = new Float32Array(N * N);

  prims.forEach((p, idx) => {
    const zc = p.z || 0, zs = p.zs ?? 1;
    let x0 = N, y0 = N, x1 = -1, y1 = -1;
    const mark = (px, py, z, u, v, k) => {
      const i = py * N + px;
      if (z > tmp[i]) { tmp[i] = z; tu[i] = u; tv[i] = v; tk[i] = k; }
    };
    const box = (ax, ay, bx, by) => {
      ax = Math.max(0, Math.floor(ax * U) - 1); ay = Math.max(0, Math.floor(ay * U) - 1);
      bx = Math.min(N - 1, Math.ceil(bx * U) + 1); by = Math.min(N - 1, Math.ceil(by * U) + 1);
      x0 = Math.min(x0, ax); y0 = Math.min(y0, ay); x1 = Math.max(x1, bx); y1 = Math.max(y1, by);
      return [ax, ay, bx, by];
    };

    if (p.type === 'tube') {
      const sp = sampleSpine(p.pts, p.per || 12);
      let arc = 0;
      for (let s = 0; s < sp.length - 1; s++) {
        const A = sp[s], B = sp[s + 1];
        const rA = radAt(p.r, A.k), rB = radAt(p.r, B.k);
        const dx = B.x - A.x, dy = B.y - A.y, L2 = dx * dx + dy * dy || 1e-6, L = Math.sqrt(L2);
        const rm = Math.max(rA, rB);
        const [ax, ay, bx, by] = box(Math.min(A.x, B.x) - rm, Math.min(A.y, B.y) - rm, Math.max(A.x, B.x) + rm, Math.max(A.y, B.y) + rm);
        const zsA = Array.isArray(zs) ? radAt(zs, A.k) : zs, zsB = Array.isArray(zs) ? radAt(zs, B.k) : zs;
        for (let py = ay; py <= by; py++) for (let px = ax; px <= bx; px++) {
          const X = (px + 0.5) / U, Y = (py + 0.5) / U;
          let t = ((X - A.x) * dx + (Y - A.y) * dy) / L2;
          if ((t < 0 && s === 0 && p.open0) || (t > 1 && s === sp.length - 2 && p.open1)) continue;   // nyitott vég
          const tRaw = t;
          t = clamp(t);
          const cx = A.x + dx * t, cy = A.y + dy * t;
          const d = Math.hypot(X - cx, Y - cy), r = lerp(rA, rB, t);
          if (d >= r || r <= 0) continue;
          // textúra-koordináta: a tengely mentén folytatva (a lekerekített végeken se forduljon körbe)
          const perp = ((X - A.x) * dy - (Y - A.y) * dx) / L;
          const z = zc + Math.sqrt(r * r - d * d) * lerp(zsA, zsB, t);
          mark(px, py, z, arc + tRaw * L, clamp(perp / r, -1, 1), lerp(A.k, B.k, t));
        }
        arc += L;
      }
    } else if (p.type === 'ell') {
      const { x: cx, y: cy, rx, ry } = p, rot = p.rot || 0, rz = p.rz ?? Math.min(rx, ry) * 0.8;
      const c = Math.cos(rot), s = Math.sin(rot), rm = Math.max(rx, ry);
      const [ax, ay, bx, by] = box(cx - rm, cy - rm, cx + rm, cy + rm);
      for (let py = ay; py <= by; py++) for (let px = ax; px <= bx; px++) {
        const X = (px + 0.5) / U - cx, Y = (py + 0.5) / U - cy;
        const lx = X * c + Y * s, ly = -X * s + Y * c;
        const q = (lx / rx) ** 2 + (ly / ry) ** 2;
        if (q >= 1) continue;
        mark(px, py, zc + rz * Math.sqrt(1 - q) * zs, lx, ly, Math.sqrt(q));
      }
    } else if (p.type === 'sheet' || p.type === 'prism') {
      // Lap: sokszög, a szélétől befelé enyhén domborodik. Prizma: gerincvonalig
      // egyenletesen emelkedő két (vagy több) sík lap — kristály, tüske, lemez.
      const poly = p.poly;
      let mx = 1e9, my = 1e9, Mx = -1e9, My = -1e9;
      for (const [x, y] of poly) { mx = Math.min(mx, x); my = Math.min(my, y); Mx = Math.max(Mx, x); My = Math.max(My, y); }
      const [ax, ay, bx, by] = box(mx, my, Mx, My);
      const fall = p.fall || 2.0, bulge = p.bulge ?? 0.8;
      const ridge = p.ridge;   // prizmánál: [[x0,y0],[x1,y1]] a gerinc
      for (let py = ay; py <= by; py++) for (let px = ax; px <= bx; px++) {
        const X = (px + 0.5) / U, Y = (py + 0.5) / U;
        let inside = false, dmin = 1e9;
        for (let i = 0, j = poly.length - 1; i < poly.length; j = i++) {
          const [xi, yi] = poly[i], [xj, yj] = poly[j];
          if ((yi > Y) !== (yj > Y) && X < ((xj - xi) * (Y - yi)) / (yj - yi) + xi) inside = !inside;
          const ex = xj - xi, ey = yj - yi, l2 = ex * ex + ey * ey || 1e-6;
          const t = clamp(((X - xi) * ex + (Y - yi) * ey) / l2);
          dmin = Math.min(dmin, Math.hypot(X - xi - ex * t, Y - yi - ey * t));
        }
        if (!inside) continue;
        let z, u = X, v = Y, k = 0;
        if (p.type === 'prism' && ridge) {
          const [[rx0, ry0], [rx1, ry1]] = ridge;
          const ex = rx1 - rx0, ey = ry1 - ry0, l2 = ex * ex + ey * ey || 1e-6;
          const t = clamp(((X - rx0) * ex + (Y - ry0) * ey) / l2);
          const dr = Math.hypot(X - rx0 - ex * t, Y - ry0 - ey * t);
          z = zc + Math.max(0, (p.h ?? 2.5) * (1 - dr / (dr + dmin + 1e-6)));
          u = t * Math.sqrt(l2); v = dr; k = t;
        } else {
          z = zc + bulge * Math.sqrt(clamp(dmin / fall));
          k = clamp(dmin / fall);
        }
        mark(px, py, z * 1, u, v, k);
      }
    }
    // Összefésülés a közös mezővel: lágy unió (smax), vagy éles (smooth=0)
    const kS = p.smooth ?? 0.9;
    for (let py = y0; py <= y1; py++) for (let px = x0; px <= x1; px++) {
      const i = py * N + px;
      const z = tmp[i];
      if (z < -1e8) continue;
      tmp[i] = -1e9;
      const old = H[i];
      let nz = z;
      if (old > -1e8 && kS > 0 && !(MATS[p.mat]?.col) && !(M[i] >= 0 && MATS[prims[M[i]].mat]?.col)) {
        const h = Math.max(kS - Math.abs(old - z), 0) / kS;
        nz = Math.max(old, z) + h * h * kS * 0.25;
      } else nz = Math.max(old, z);
      if (z >= old) {
        M[i] = idx; TU[i] = tu[i]; TV[i] = tv[i]; TK[i] = tk[i];
        FA[i] = p.fade ? smooth(p.fade[0], p.fade[1], (py + 0.5) / U) : 1;
      }
      H[i] = nz;
    }
  });

  /* --- Felszíni dombormű (a forma helyi koordinátáiban) --- */
  const B = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) {
    const m = M[i];
    if (m < 0) continue;
    const p = prims[m], mat = MATS[p.mat] || MATS.skin;
    let kind = p.bump !== undefined ? p.bump : mat.bump;
    if (p.belly && bellyAt(p, TV[i]) > 0.5) kind = 'plates';
    if (!kind) continue;
    const amp = (p.amp ?? mat.amp ?? 0.1);
    const u = TU[i], v = TV[i];
    const r = p.type === 'tube' ? radAt(p.r, TK[i]) : 1;
    const w = p.type === 'tube' ? v * r * 1.3 : v;         // keresztirányú ív (egységben)
    const sc = p.scale || 1;
    let b = 0;
    switch (kind) {
      case 'scales': {
        // halpikkely: egymásra boruló félkörök (a fenti sor fél cellával eltolva)
        const s = 1.7 * sc, rh = s * 0.62;
        const row = Math.floor(w / rh), fw = w / rh - row;
        let best = -1;
        for (const [dr, off] of [[0, 0], [-1, 0.5], [1, 0.5]]) {
          const rr = row + dr, o2 = (((rr % 2) + 2) % 2) * 0.5;
          const fu = (((u / s + o2) % 1) + 1) % 1;
          const d = Math.hypot((fu - 0.5) * 1.05, (fw - dr - 0.05) * 0.95);
          if (d < 0.78) best = Math.max(best, (1 - d / 0.78) * (dr === 0 ? 1 : 0.92));
        }
        b = (Math.pow(Math.max(0, best), 0.5) - 0.45) * (0.75 + 0.25 * vnoise(u * 0.4, w * 0.4));
        break;
      }
      case 'plates': { const f = ((u / (1.5 * sc)) % 1 + 1) % 1; b = Math.pow(Math.sin(f * Math.PI), 0.35) - 0.6; break; }
      case 'armor': { const f = ((u / (3.2 * sc)) % 1 + 1) % 1; b = (f < 0.12 ? -1 : 0.2) + vnoise(u * 2, w * 2) * 0.4; break; }
      case 'rings': { const f = ((u / 0.9) % 1 + 1) % 1; b = f < 0.18 ? -1 : 0; break; }
      case 'grain': b = vnoise(u * 3.1, w * 3.1) + vnoise(u * 7, w * 7) * 0.5 - 0.75; break;
      case 'noise': b = vnoise(u * 2.2, w * 2.2) * 1.2 + vnoise(u * 6, w * 6) * 0.6 - 0.9; break;
      case 'feather': { const f = ((w * 3.2 + u * 0.8) % 1 + 1) % 1; b = Math.abs(v) < 0.08 ? 0.8 : f * 0.6 - 0.3; break; }
      case 'strands': { b = Math.sin(w * 9 + vnoise(u * 0.7, 3) * 10) * 0.5 + vnoise(u * 2, w * 6) * 0.5 - 0.25; break; }
      case 'veins': b = 0; break;
    }
    B[i] = b * amp;
  }
  for (let i = 0; i < N * N; i++) if (M[i] >= 0) H[i] += B[i];

  /* --- Résárnyék: elmosott magasság mínusz saját magasság --- */
  let hmin = 1e9;
  for (let i = 0; i < N * N; i++) if (M[i] >= 0) hmin = Math.min(hmin, H[i]);
  const Hb = new Float32Array(N * N);
  for (let i = 0; i < N * N; i++) Hb[i] = M[i] >= 0 ? H[i] : hmin - 2;
  boxBlur(Hb, N, Math.round(U * 1.4), 2);

  /* --- Fény --- */
  const base = new Float32Array(N * N * 4), fx = new Float32Array(N * N * 4);
  const L = norm3(-0.55, -0.75, 0.62), Hh = norm3(L[0], L[1], L[2] + 1);
  const at = (x, y) => H[y * N + x];
  const emisMask = new Float32Array(N * N * 4);
  let anyGlow = false;
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x, m = M[i];
    if (m < 0) continue;
    const p = prims[m], mat = MATS[p.mat] || MATS.skin;
    const h = H[i];
    const hl = x > 0 && M[i - 1] >= 0 ? at(x - 1, y) : h - 2.2, hr = x < N - 1 && M[i + 1] >= 0 ? at(x + 1, y) : h - 2.2;
    const hu = y > 0 && M[i - N] >= 0 ? at(x, y - 1) : h - 2.2, hd = y < N - 1 && M[i + N] >= 0 ? at(x, y + 1) : h - 2.2;
    let gx = (hr - hl) * U / 2, gy = (hd - hu) * U / 2;
    // mélységi ugrás (egy elöl lévő forma pereme): ne legyen óriási lejtő
    const jump = Math.max(Math.abs(hr - hl), Math.abs(hd - hu));
    if (mat.facet) { gx = Math.round(gx * 2) / 2; gy = Math.round(gy * 2) / 2; }
    let [nx, ny, nz] = norm3(-clamp(gx, -6, 6), -clamp(gy, -6, 6), 1);
    if (p.type === 'sheet' && !mat.facet) { const k = 0.6; [nx, ny, nz] = norm3(nx * k, ny * k, nz); }

    const ndl = nx * L[0] + ny * L[1] + nz * L[2];
    const wrap = clamp((ndl + 0.3) / 1.3);
    const sky = 0.5 + 0.5 * -ny;                                    // felülről jövő ég-fény
    const ao = 1 - Math.min(Math.max(0, Hb[i] - h), 3) * (mat.membrane || p.type === 'sheet' ? 0.05 : 0.11);
    const depth = clamp(1 + Math.min(0, h) * 0.035, 0.55, 1);      // a hátsó formák sötétebbek
    let light = (0.26 + 0.22 * sky + 0.78 * wrap) * ao * depth;
    if (mat.membrane) light = (0.42 + 0.22 * sky + 0.5 * wrap) * ao * depth + 0.18 * (1 - TK[i]);
    const spec = Math.pow(Math.max(0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]), mat.shin || 20) * (mat.spec || 0) * ao;
    const rim = Math.pow(1 - nz, 3) * clamp(nx * 0.7 - ny * 0.2 + 0.3) * 0.5 * depth;
    // mélységi vonal: egy elöl lévő forma pereme sötét kontúrt kap
    const line = jump > 1.3 ? 0.55 : 1;
    const o = i * 4;

    if (mat.tint) {
      let alb = (p.alb ?? mat.alb);
      if (mat.mottle) alb *= 0.94 + 0.1 * vnoise(x / U * 0.9 + 11, y / U * 0.9 + 3);
      if (p.belly) alb = lerp(alb, 0.95, bellyAt(p, TV[i]));
      const g = clamp(alb * light * line);
      base[o] = base[o + 1] = base[o + 2] = g; base[o + 3] = 1;
      // meleg csillanás és peremfény + hideg, kékes árnyék a saját színű rétegre
      const hi = clamp(spec + rim * 0.5);
      const sh = clamp((1 - wrap) * 0.2 + (1 - ao) * 0.35) * (mat.membrane ? 0.5 : 1);
      const w = hi / (hi + sh + 1e-6);
      fx[o] = lerp(0.16, 1, w); fx[o + 1] = lerp(0.2, 0.96, w); fx[o + 2] = lerp(0.42, 0.88, w); fx[o + 3] = Math.max(hi, sh);
    } else if (mat.eye) {
      const col = p.iris || [255, 176, 40];
      const lx = TU[i] / p.rx, ly = TV[i] / p.ry;                    // -1..1
      const rr = Math.hypot(lx, ly);
      let c = col.map((v) => v / 255 * (1.15 - rr * 0.55));
      const pw = p.pupil === 'round' ? 0.42 : 0.16;
      const inP = p.pupil === 'round' ? rr < 0.42 : Math.abs(lx) < pw * (1 - ly * ly * 0.6) && Math.abs(ly) < 0.92;
      if (inP) c = [0.03, 0.02, 0.02];
      if (rr > 0.86) c = c.map((v) => v * 0.35);                     // sötét perem
      const sp = Math.pow(Math.max(0, nx * Hh[0] + ny * Hh[1] + nz * Hh[2]), 160) * 1.2;
      const dot = Math.hypot(lx + 0.35, ly + 0.4) < 0.2 ? 1 : 0;
      fx[o] = clamp(c[0] + sp + dot); fx[o + 1] = clamp(c[1] + sp + dot); fx[o + 2] = clamp(c[2] + sp + dot); fx[o + 3] = 1;
      if (p.glow) { emisMask[o] = col[0] / 255; emisMask[o + 1] = col[1] / 255; emisMask[o + 2] = col[2] / 255; emisMask[o + 3] = 0.8; anyGlow = true; }
    } else {
      // saját színű anyag (a csúcs felé árnyalva, ha van tip)
      let col = mat.col.map((v) => v / 255);
      const tipCol = p.tip || mat.tip;
      if (tipCol) col = col.map((v, j) => lerp(v, tipCol[j] / 255, smooth(0.35, 1, TK[i])));
      if (p.col) col = p.col.map((v) => v / 255);
      let r, g, b;
      if (mat.emis) {
        const f = 0.75 + 0.25 * vnoise(TU[i] * 3, TV[i] * 3);
        [r, g, b] = col.map((v) => clamp(v * f + 0.25 * f));
        emisMask[o] = (mat.glow || col)[0] / 255; emisMask[o + 1] = (mat.glow || col)[1] / 255; emisMask[o + 2] = (mat.glow || col)[2] / 255; emisMask[o + 3] = mat.glowK ?? 0.6;
        anyGlow = true;
      } else {
        const lt = mat.facet ? (0.45 + 0.75 * wrap) * depth : light;
        [r, g, b] = col.map((v) => clamp(v * lt * line + spec + rim * 0.3));
        if (mat.glow) { emisMask[o] = mat.glow[0] / 255; emisMask[o + 1] = mat.glow[1] / 255; emisMask[o + 2] = mat.glow[2] / 255; emisMask[o + 3] = mat.glowK; anyGlow = true; }
      }
      fx[o] = r; fx[o + 1] = g; fx[o + 2] = b; fx[o + 3] = 1;
    }
  }

  /* --- Finom külső kontúr: a sziluett szélén sötétítés (nem vastag vonal) --- */
  const R = Math.max(1, Math.round(SS * 1.2));
  for (let y = 0; y < N; y++) for (let x = 0; x < N; x++) {
    const i = y * N + x;
    if (M[i] < 0) continue;
    let edge = false;
    for (let dy = -R; dy <= R && !edge; dy++) for (let dx = -R; dx <= R; dx++) {
      const xx = x + dx, yy = y + dy;
      if (xx < 0 || yy < 0 || xx >= N || yy >= N || M[yy * N + xx] < 0) { edge = true; break; }
    }
    if (!edge) continue;
    const o = i * 4;
    if (base[o + 3] > 0) { base[o] *= 0.35; base[o + 1] *= 0.35; base[o + 2] *= 0.35; fx[o + 3] *= 0.3; }
    else { fx[o] *= 0.4; fx[o + 1] *= 0.4; fx[o + 2] *= 0.4; }
  }

  /* --- Izzás (láva, kristály, szem): elmosott fénykoszorú a saját rétegen --- */
  if (anyGlow) {
    const gl = [0, 1, 2, 3].map((c) => { const a = new Float32Array(N * N); for (let i = 0; i < N * N; i++) a[i] = emisMask[i * 4 + c] * emisMask[i * 4 + 3]; return a; });
    for (const a of gl) boxBlur(a, N, Math.round(U * 1.2), 3);
    for (let i = 0; i < N * N; i++) {
      const a = Math.min(1, gl[3][i] * 2.2);
      if (a < 0.003) continue;
      const o = i * 4;
      const cr = gl[0][i] / (gl[3][i] || 1), cg = gl[1][i] / (gl[3][i] || 1), cb = gl[2][i] / (gl[3][i] || 1);
      // a meglévő fölé „rátesszük" (alfa-kompozit)
      const fa = fx[o + 3], na = a * 0.75;
      const outA = na + fa * (1 - na);
      if (outA <= 0) continue;
      fx[o] = (cr * na + fx[o] * fa * (1 - na)) / outA;
      fx[o + 1] = (cg * na + fx[o + 1] * fa * (1 - na)) / outA;
      fx[o + 2] = (cb * na + fx[o + 2] * fa * (1 - na)) / outA;
      fx[o + 3] = outA;
    }
  }

  for (let i = 0; i < N * N; i++) if (FA[i] < 1) { base[i * 4 + 3] *= FA[i]; fx[i * 4 + 3] *= FA[i]; }
  return { base: downsample(base, N, SS), fx: downsample(fx, N, SS), size: OUT };
}

/** Hasoldal aránya (0..1) a forma helyi keresztirányú koordinátájából. */
function bellyAt(p, tv) {
  const v = p.type === 'ell' ? tv / p.ry : tv;
  return smooth(p.belly[0], p.belly[1], v);
}

function norm3(x, y, z) { const l = Math.hypot(x, y, z) || 1; return [x / l, y / l, z / l]; }

/** Egyszerű dobozelmosás (többszöri futtatás ≈ Gauss). */
function boxBlur(a, N, r, passes) {
  if (r < 1) return;
  const t = new Float32Array(N * N);
  for (let p = 0; p < passes; p++) {
    for (let y = 0; y < N; y++) {
      let s = 0; const row = y * N;
      for (let x = -r; x <= r; x++) s += a[row + clamp(x, 0, N - 1)];
      for (let x = 0; x < N; x++) {
        t[row + x] = s / (2 * r + 1);
        s += a[row + Math.min(N - 1, x + r + 1)] - a[row + Math.max(0, x - r)];
      }
    }
    for (let x = 0; x < N; x++) {
      let s = 0;
      for (let y = -r; y <= r; y++) s += t[clamp(y, 0, N - 1) * N + x];
      for (let y = 0; y < N; y++) {
        a[y * N + x] = s / (2 * r + 1);
        s += t[Math.min(N - 1, y + r + 1) * N + x] - t[Math.max(0, y - r) * N + x];
      }
    }
  }
}

/** Túlmintavételezett lebegőpontos RGBA → 8 bites, előszorzott átlagolással. */
function downsample(src, N, SS) {
  const O = N / SS, out = new Uint8ClampedArray(O * O * 4);
  for (let y = 0; y < O; y++) for (let x = 0; x < O; x++) {
    let r = 0, g = 0, b = 0, a = 0;
    for (let dy = 0; dy < SS; dy++) for (let dx = 0; dx < SS; dx++) {
      const i = ((y * SS + dy) * N + x * SS + dx) * 4, al = src[i + 3];
      r += src[i] * al; g += src[i + 1] * al; b += src[i + 2] * al; a += al;
    }
    const o = (y * O + x) * 4, n = SS * SS;
    if (a > 0) { out[o] = (r / a) * 255; out[o + 1] = (g / a) * 255; out[o + 2] = (b / a) * 255; }
    out[o + 3] = (a / n) * 255;
  }
  return out;
}

/* --- PNG kódoló (zlib, soronként a legjobb szűrővel) --------------------- */
import zlib from 'node:zlib';
const CRC = (() => { const t = new Uint32Array(256); for (let n = 0; n < 256; n++) { let c = n; for (let k = 0; k < 8; k++) c = c & 1 ? 0xedb88320 ^ (c >>> 1) : c >>> 1; t[n] = c >>> 0; } return t; })();
function crc32(buf) { let c = 0xffffffff; for (const b of buf) c = CRC[(c ^ b) & 255] ^ (c >>> 8); return (c ^ 0xffffffff) >>> 0; }
function chunk(type, data) {
  const len = Buffer.alloc(4); len.writeUInt32BE(data.length);
  const td = Buffer.concat([Buffer.from(type), data]);
  const crc = Buffer.alloc(4); crc.writeUInt32BE(crc32(td));
  return Buffer.concat([len, td, crc]);
}
export function encodePNG(rgba, w, h) {
  const stride = w * 4, raw = Buffer.alloc((stride + 1) * h);
  const prev = Buffer.alloc(stride);
  for (let y = 0; y < h; y++) {
    const row = Buffer.from(rgba.buffer, rgba.byteOffset + y * stride, stride);
    let best = null, bestSum = Infinity, bestF = 0;
    for (const f of [0, 1, 2, 4]) {
      const line = Buffer.alloc(stride);
      for (let x = 0; x < stride; x++) {
        const a = x >= 4 ? row[x - 4] : 0, b = prev[x], c = x >= 4 ? prev[x - 4] : 0;
        let pr = 0;
        if (f === 1) pr = a; else if (f === 2) pr = b;
        else if (f === 4) { const pp = a + b - c, pa = Math.abs(pp - a), pb = Math.abs(pp - b), pc = Math.abs(pp - c); pr = pa <= pb && pa <= pc ? a : pb <= pc ? b : c; }
        line[x] = (row[x] - pr) & 255;
      }
      let s = 0; for (const v of line) s += v < 128 ? v : 256 - v;
      if (s < bestSum) { bestSum = s; best = line; bestF = f; }
    }
    raw[y * (stride + 1)] = bestF;
    best.copy(raw, y * (stride + 1) + 1);
    row.copy(prev);
  }
  const ihdr = Buffer.alloc(13);
  ihdr.writeUInt32BE(w, 0); ihdr.writeUInt32BE(h, 4); ihdr[8] = 8; ihdr[9] = 6; ihdr[10] = 0; ihdr[11] = 0; ihdr[12] = 0;
  return Buffer.concat([Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]), chunk('IHDR', ihdr), chunk('IDAT', zlib.deflateSync(raw, { level: 9 })), chunk('IEND', Buffer.alloc(0))]);
}
