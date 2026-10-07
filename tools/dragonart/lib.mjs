/* Építőkockák a részek leírásához (64-es rácson). */
export const tube = (pts, r, mat = 'skin', o = {}) => ({ type: 'tube', pts, r, mat, ...o });
export const ell = (x, y, rx, ry, rot = 0, mat = 'skin', o = {}) => ({ type: 'ell', x, y, rx, ry, rot, mat, ...o });
export const sheet = (poly, mat = 'membrane', o = {}) => ({ type: 'sheet', poly, mat, ...o });
export const prism = (poly, ridge, mat = 'crystal', o = {}) => ({ type: 'prism', poly, ridge, mat, ...o });

/** Ívelt, elvékonyodó szarv/tüske/karom: talp → hegy, $bend a hossz arányában oldalra. */
export function horn(b, t, w, bend = 0, mat = 'horn', o = {}) {
  const dx = t[0] - b[0], dy = t[1] - b[1], L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L, ny = dx / L;
  const m = [b[0] + dx * 0.5 + nx * bend * L, b[1] + dy * 0.5 + ny * bend * L];
  return tube([b, m, t], [w / 2, w * 0.3, 0.12], mat, { smooth: 0, ...o });
}
/** Kristályszilánk prizmaként (két csiszolt lap a gerinc mentén). */
export function shard(b, t, w, mat = 'crystal', o = {}) {
  const dx = t[0] - b[0], dy = t[1] - b[1], L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L * w / 2, ny = dx / L * w / 2;
  const sh = [b[0] + dx * 0.72, b[1] + dy * 0.72];
  return prism([[b[0] + nx, b[1] + ny], [sh[0] + nx, sh[1] + ny], t, [sh[0] - nx, sh[1] - ny], [b[0] - nx, b[1] - ny]], [b, t], mat, { h: w * 0.6, smooth: 0, ...o });
}
/** Lemez/vitorla-tüske: lapos, csúcsos lap (stegoszaurusz-lemez, uszony). */
export function plate(b, t, w, mat = 'armor', o = {}) {
  const dx = t[0] - b[0], dy = t[1] - b[1], L = Math.hypot(dx, dy) || 1;
  const nx = -dy / L * w / 2, ny = dx / L * w / 2;
  const pts = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI;
    const k = Math.sin(a) ** 0.8;
    pts.push([b[0] + dx * (1 - Math.cos(a)) / 2 + nx * k * (i < 5 ? 1 : 1), b[1] + dy * (1 - Math.cos(a)) / 2 + ny * k]);
  }
  for (let i = 9; i > 0; i--) {
    const a = (i / 10) * Math.PI;
    const k = Math.sin(a) ** 0.8 * 0.15;
    pts.push([b[0] + dx * (1 - Math.cos(a)) / 2 - nx * k, b[1] + dy * (1 - Math.cos(a)) / 2 - ny * k]);
  }
  return sheet(pts, mat, { bulge: w * 0.35, fall: w * 0.5, smooth: 0, ...o });
}
/** Fogsor kis kúpokból. */
export function teeth(a, b, n, h, dir = 1, o = {}) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = n > 1 ? i / (n - 1) : 0.5, x = a[0] + (b[0] - a[0]) * f, y = a[1] + (b[1] - a[1]) * f, hh = h * (1 - f * 0.35);
    out.push(tube([[x, y], [x, y + dir * hh]], [0.55, 0.05], 'tooth', { smooth: 0, z: 1.5, ...o }));
  }
  return out;
}
/** Pontok egy négyzetes Bézier mentén (a szárnyhártya íveihez). */
export function qcurve(a, c, b, n = 6) {
  const out = [];
  for (let i = 1; i <= n; i++) {
    const t = i / n, u = 1 - t;
    out.push([u * u * a[0] + 2 * u * t * c[0] + t * t * b[0], u * u * a[1] + 2 * u * t * c[1] + t * t * b[1]]);
  }
  return out;
}
/** Eltolás minden pontra. */
export const shift = (prims, dx, dy, o = {}) => prims.map((p) => {
  const q = { ...p, ...o };
  if (p.pts) q.pts = p.pts.map(([x, y]) => [x + dx, y + dy]);
  if (p.poly) q.poly = p.poly.map(([x, y]) => [x + dx, y + dy]);
  if (p.ridge) q.ridge = p.ridge.map(([x, y]) => [x + dx, y + dy]);
  if (p.type === 'ell') { q.x = p.x + dx; q.y = p.y + dy; }
  return q;
});

/* --- Sziluett-vizsgálat: a hát vonala (a legfelső telt pont oszloponként) --- */
function insideTube(p, X, Y) {
  // durva, de elég: a kontrollpontokon átmenő Catmull-Rom helyett sűrített törött vonal
  const pts = p._sp || (p._sp = densify(p.pts, 8));
  for (let i = 0; i < pts.length - 1; i++) {
    const A = pts[i], B = pts[i + 1];
    const dx = B[0] - A[0], dy = B[1] - A[1], l2 = dx * dx + dy * dy || 1e-6;
    let t = ((X - A[0]) * dx + (Y - A[1]) * dy) / l2; t = Math.max(0, Math.min(1, t));
    const k = (i + t) / (pts.length - 1);
    const r = Array.isArray(p.r) ? lerpArr(p.r, k) : p.r;
    if (Math.hypot(X - A[0] - dx * t, Y - A[1] - dy * t) < r) return true;
  }
  return false;
}
function lerpArr(r, k) { const f = k * (r.length - 1), i = Math.min(r.length - 2, Math.floor(f)); return r[i] + (r[i + 1] - r[i]) * (f - i); }
function densify(pts, per) {
  const out = [];
  for (let i = 0; i < pts.length - 1; i++) {
    const p0 = pts[Math.max(0, i - 1)], p1 = pts[i], p2 = pts[i + 1], p3 = pts[Math.min(pts.length - 1, i + 2)];
    for (let s = i ? 1 : 0; s <= per; s++) {
      const t = s / per, t2 = t * t, t3 = t2 * t;
      out.push([0, 1].map((c) => 0.5 * (2 * p1[c] + (-p0[c] + p2[c]) * t + (2 * p0[c] - 5 * p1[c] + 4 * p2[c] - p3[c]) * t2 + (-p0[c] + 3 * p1[c] - 3 * p2[c] + p3[c]) * t3)));
    }
  }
  return out;
}
export function inside(prims, X, Y) {
  for (const p of prims) {
    if (p.type === 'tube' && insideTube(p, X, Y)) return true;
    if (p.type === 'ell') {
      const c = Math.cos(p.rot || 0), s = Math.sin(p.rot || 0), x = X - p.x, y = Y - p.y;
      const lx = x * c + y * s, ly = -x * s + y * c;
      if ((lx / p.rx) ** 2 + (ly / p.ry) ** 2 < 1) return true;
    }
  }
  return false;
}
/** A hátvonal pontjai x0..x1 között: [{x,y,nx,ny}] (n: kifelé mutató normális). */
export function backline(prims, x0, x1, step = 0.5) {
  const pts = [];
  for (let x = x0; x <= x1; x += step) {
    let y = 0;
    while (y < 64 && !inside(prims, x, y)) y += 0.15;
    if (y < 64) pts.push([x, y]);
  }
  return pts.map((p, i) => {
    const a = pts[Math.max(0, i - 2)], b = pts[Math.min(pts.length - 1, i + 2)];
    const dx = b[0] - a[0], dy = b[1] - a[1], l = Math.hypot(dx, dy) || 1;
    return { x: p[0], y: p[1], nx: dy / l, ny: -dx / l };
  });
}
/** A farok külső íve: sugárirányban a farok gerincéből kifelé (jobb/fel). */
export function along(line, n, f0 = 0, f1 = 1) {
  const out = [];
  for (let i = 0; i < n; i++) {
    const f = f0 + (f1 - f0) * (n > 1 ? i / (n - 1) : 0.5);
    out.push({ ...line[Math.round(f * (line.length - 1))], f: n > 1 ? i / (n - 1) : 0.5 });
  }
  return out;
}
