/* =====================================================================
   A* útkeresés rácson — bináris kupaccal
   ---------------------------------------------------------------------
   Két helyen használjuk:
     - a térképgenerátor ezzel vágja az utakat a POI-k között
       (tereptípusonként eltérő költséggel: az erdőn át drága, a vízen
       át hidat kell építeni),
     - a játékos kattintásra/koppintásra ezzel talál oda a célhoz.
   ===================================================================== */

class Heap {
  constructor() { this.a = []; }
  get size() { return this.a.length; }
  push(node, f) {
    const a = this.a;
    a.push([f, node]);
    let i = a.length - 1;
    while (i > 0) {
      const p = (i - 1) >> 1;
      if (a[p][0] <= a[i][0]) break;
      [a[p], a[i]] = [a[i], a[p]];
      i = p;
    }
  }
  pop() {
    const a = this.a;
    const top = a[0];
    const last = a.pop();
    if (a.length) {
      a[0] = last;
      let i = 0;
      for (;;) {
        const l = i * 2 + 1, r = l + 1;
        let m = i;
        if (l < a.length && a[l][0] < a[m][0]) m = l;
        if (r < a.length && a[r][0] < a[m][0]) m = r;
        if (m === i) break;
        [a[m], a[i]] = [a[i], a[m]];
        i = m;
      }
    }
    return top[1];
  }
}

/**
 * @param {number} w, h           a rács mérete
 * @param {(x:number,y:number)=>number} cost  lépésköltség; Infinity = járhatatlan
 * @param {boolean} diagonal      átlós lépés engedélyezése (a játékosnak igen)
 * @returns {Array<[number,number]>|null}  a kiindulópontot NEM tartalmazza
 */
export function findPath(w, h, sx, sy, tx, ty, cost, diagonal = false, maxNodes = 20000) {
  if (sx === tx && sy === ty) return [];
  const idx = (x, y) => y * w + x;
  const g = new Float32Array(w * h).fill(Infinity);
  const from = new Int32Array(w * h).fill(-1);
  const closed = new Uint8Array(w * h);

  const hFn = (x, y) => {
    const dx = Math.abs(x - tx), dy = Math.abs(y - ty);
    return diagonal ? Math.max(dx, dy) + 0.414 * Math.min(dx, dy) : dx + dy;
  };

  const dirs = diagonal
    ? [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]]
    : [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1]];

  const open = new Heap();
  g[idx(sx, sy)] = 0;
  open.push(idx(sx, sy), hFn(sx, sy));
  let visited = 0;

  while (open.size) {
    const cur = open.pop();
    if (closed[cur]) continue;
    closed[cur] = 1;
    if (++visited > maxNodes) return null;

    const cx = cur % w, cy = (cur / w) | 0;
    if (cx === tx && cy === ty) {
      const path = [];
      let n = cur;
      while (n !== idx(sx, sy)) { path.push([n % w, (n / w) | 0]); n = from[n]; }
      return path.reverse();
    }

    for (const [dx, dy, dc] of dirs) {
      const nx = cx + dx, ny = cy + dy;
      if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
      const c = cost(nx, ny);
      if (!isFinite(c)) continue;
      // Átlósan nem lehet sarkot levágni (fák, sziklák között)
      if (dx && dy && (!isFinite(cost(cx + dx, cy)) || !isFinite(cost(cx, cy + dy)))) continue;
      const ni = idx(nx, ny);
      const ng = g[cur] + c * dc;
      if (ng < g[ni]) {
        g[ni] = ng;
        from[ni] = cur;
        open.push(ni, ng + hFn(nx, ny));
      }
    }
  }
  return null;
}
