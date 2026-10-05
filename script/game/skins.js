/* =====================================================================
   Sárkánybőrök — minden sárkány egyedi
   ---------------------------------------------------------------------
   A testrész-rajzok (dragons/svg) szürkeárnyalatosak. Eddig egyetlen
   színnel szoroztuk őket, ezért a sárkányok szinte egyformák voltak.
   Most minden sárkány a SAJÁT azonosítójából és elemi összetételéből
   (rules.js: composition) kap „bőrt":

     - kéttónusú színezés: a hát a saját színe, a has elem szerinti világos
     - minta: tigriscsík, sáv, pötty, rozetta, pikkelyrács, szeplő, rúnák
       (abszolút koordinátában — a test, a láb, a fej mintája összefut)
     - térfogat: bal felső fény, jobb alsó árnyék minden részen
     - elemi díszítés: izzó repedés, jégcsillanás, villámér, árnyékpára,
       moha, mérgező folt
     - kiegészítők a körvonalon: háttüske, csontlap, hátvitorla, jégkristály,
       lángsörény, moha, tövis, füstcsóva — és extra szarvak a fejen
     - arányok: kicsit nagyobb/kisebb fej és szárny
     - fajtanév (pl. „Pettyes parázshátú kígyósárkány")

   Minden determinisztikus: ugyanaz a sárkány mindig ugyanúgy néz ki.
   ===================================================================== */
import { composition, mulberry32 } from './rules.js';

const INK = '#0b0f1c';

/* --- Színsegédek --------------------------------------------------------- */
const rgb = (hex) => {
  const n = parseInt(String(hex || '#ff8a3d').replace('#', ''), 16);
  return Number.isNaN(n) ? [255, 138, 61] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** Az oldal színezésével azonos fényesítés (× 1,3), hogy a szürke rajzon ne sötétüljön el. */
const tint = (c) => c.map((v) => Math.round(Math.min(1, (v / 255) * 1.3) * 255));
const hashStr = (s) => { let h = 2166136261; for (let i = 0; i < s.length; i++) { h ^= s.charCodeAt(i); h = Math.imul(h, 16777619); } return h >>> 0; };

const BELLY = { fire: '#ffd08a', frost: '#eaf8ff', storm: '#d6ecff', shadow: '#8a78b0', earth: '#e0cfa4', venom: '#dcff9a' };
const ACCENT = { fire: '#ff7a3d', frost: '#9fe8ff', storm: '#9fd8ff', shadow: '#b18cff', earth: '#c9a27e', venom: '#7dff6a' };
const PATTERNS = ['none', 'stripes', 'bands', 'spots', 'rosettes', 'scales', 'speckle', 'runes'];
const PATTERN_ADJ = { none: '', stripes: 'Tigriscsíkos', bands: 'Sávos', spots: 'Pettyes', rosettes: 'Foltos', scales: 'Pikkelymintás', speckle: 'Szeplős', runes: 'Rúnás' };
const BACK = { fire: 'flames', frost: 'crystals', storm: 'sail', shadow: 'wisps', earth: 'plates', venom: 'thorns' };
const ELEMENT_ADJ = { fire: 'parázshátú', frost: 'dérpikkelyű', storm: 'viharvitorlás', shadow: 'árnyékbőrű', earth: 'kőpáncélú', venom: 'méregtüskés' };
const BACK_ADJ = { spikes: 'tüskéshátú', plates: 'lemezes', sail: 'vitorlás', crystals: 'kristályhátú', flames: 'lángsörényű', moss: 'mohás', thorns: 'tövises', wisps: 'füstsörényű' };
const SHAPE_NOUN = { standard: 'sárkány', stocky: 'páncélsárkány', arched: 'gerincsárkány', serpent: 'kígyósárkány', long: 'lindwurm', skeletal: 'csontsárkány' };
const HORN = {
  fire:   { cols: ['#2a1210', '#5a1f14', '#ff7a3d'], glow: '#ff6a1f' },
  frost:  { cols: ['#bfe8ff', '#e8f8ff', '#ffffff'], glow: '#9fe8ff', clear: true },
  storm:  { cols: ['#6f7890', '#c9d3ea', '#ffffff'], glow: null },
  shadow: { cols: ['#120c1c', '#2e2240', '#7a5cb0'], glow: '#b18cff' },
  earth:  { cols: ['#5a4632', '#9a8466', '#e0d0b0'], glow: null },
  venom:  { cols: ['#1e3a14', '#3f6a2a', '#b6ff5a'], glow: '#7dff6a' },
};

/**
 * A sárkány kinézete — determinisztikus, az azonosítóból és a testrészekből.
 */
export function dragonLook(d, catalog) {
  const comp = composition(d, catalog);
  const seed = hashStr(`${d.id}|${d.fej}|${d.test}|${d.lab}|${d.szarny}|${d.szin}`);
  const rng = mulberry32(seed);
  const prim = comp?.primary || 'earth';
  const bodyEl = comp?.parts.test || prim;
  const headEl = comp?.parts.fej || prim;
  const shape = (s) => (d[s] ? catalog?.[s]?.[d[s]]?.shape : null);
  const bodyShape = shape('test') || 'standard';

  const base = rgb(d.szin);
  const belly = mix(mix(base, [255, 255, 255], 0.45), rgb(BELLY[bodyEl]), 0.55);
  const accent = rgb(ACCENT[prim]);
  // a minta: a testforma is befolyásolja (a kígyótest inkább sávos, a csontváz inkább rúnás…)
  const weights = { none: 1.2, stripes: 2, bands: bodyShape === 'serpent' || bodyShape === 'long' ? 3 : 1.4, spots: 2, rosettes: 1.4, scales: 1.6, speckle: 1.4, runes: prim === 'storm' || prim === 'shadow' || bodyShape === 'skeletal' ? 2.4 : 0.6 };
  let r = rng() * Object.values(weights).reduce((a, b) => a + b, 0), pattern = 'none';
  for (const p of PATTERNS) { r -= weights[p]; if (r <= 0) { pattern = p; break; } }
  const back = rng() < 0.7 ? BACK[bodyEl] : rng() < 0.5 ? 'spikes' : (bodyEl === 'earth' ? 'moss' : 'plates');
  const horns = Math.floor(rng() * 3);                                  // 0–2 extra szarv
  const TAILS = { fire: 'flame', frost: 'crystal', storm: 'fan', shadow: 'blade', earth: 'club', venom: 'stinger' };
  const tail = rng() < 0.6 ? TAILS[bodyEl] : ['club', 'blade', 'spade', 'fan', 'stinger', 'none'][Math.floor(rng() * 6)];
  const HEADGEAR = { fire: 'crest', frost: 'nosehorn', storm: 'frill', shadow: 'crest', earth: 'nosehorn', venom: 'frill' };
  const headgear = rng() < 0.45 ? HEADGEAR[headEl] : ['crest', 'frill', 'whiskers', 'nosehorn', 'none', 'whiskers'][Math.floor(rng() * 6)];
  // testarányok: a kígyótest nyúlánk, a páncélos zömök
  const PROP = { serpent: [1.16, 0.86], long: [1.12, 0.92], stocky: [0.92, 1.1], skeletal: [0.98, 1.06], arched: [1.0, 1.04], standard: [1, 1] }[bodyShape] || [1, 1];
  const wingShape = d.szarny ? catalog?.szarny?.[d.szarny]?.shape : null;
  const look = {
    seed, comp, prim, bodyEl, headEl, bodyShape,
    base, belly, accent,
    patternColor: mix(base, [8, 6, 16], 0.55),
    pattern, back, horns,
    hornStyle: HORN[headEl] || HORN.earth,
    tail, headgear,
    extraWings: wingShape === 'double' || wingShape === 'insect' ? rng() < 0.6 : rng() < 0.16,
    sx: PROP[0] * (0.96 + rng() * 0.08), sy: PROP[1] * (0.96 + rng() * 0.08),
    headScale: 0.92 + rng() * 0.2,
    wingScale: 0.88 + rng() * 0.3,
    density: 0.7 + rng() * 0.6,
  };
  const adj = PATTERN_ADJ[pattern];
  const mid = look.extraWings ? 'négyszárnyú' : rng() < 0.5 ? ELEMENT_ADJ[bodyEl] : BACK_ADJ[back];
  look.species = `${adj ? `${adj} ` : ''}${mid} ${SHAPE_NOUN[bodyShape] || 'sárkány'}`.replace(/^./, (c) => c.toUpperCase());
  return look;
}

/* =====================================================================
   Festés
   ===================================================================== */
/** A textúrák pereme (a rács méretének aránya mindkét oldalon): ide lóghatnak ki a díszek. */
export const SKIN_PAD = 0.12;

/** A rész alfa-maszkja: oszloponként a legfelső és a legalsó telt képpont. */
function silhouette(ctx, N) {
  const o = Math.round(N * SKIN_PAD);
  const a = ctx.getImageData(o, o, N, N).data;
  const top = new Int16Array(N).fill(-1), bot = new Int16Array(N).fill(-1);
  let minX = N, maxX = -1;
  for (let x = 0; x < N; x++) {
    for (let y = 0; y < N; y++) if (a[(y * N + x) * 4 + 3] > 140) { top[x] = y; break; }
    if (top[x] < 0) continue;
    for (let y = N - 1; y >= 0; y--) if (a[(y * N + x) * 4 + 3] > 140) { bot[x] = y; break; }
    minX = Math.min(minX, x); maxX = Math.max(maxX, x);
  }
  return { top, bot, minX, maxX };
}

/** Csak a már meglévő képpontokra rajzol (a rész körvonalán belül). */
function atop(ctx, fn, alpha = 1, op = 'source-atop') {
  ctx.save();
  ctx.globalCompositeOperation = op;
  ctx.globalAlpha = alpha;
  fn();
  ctx.restore();
}

/** Izzó réteg: külön vásznon rajzolva, a rész alakjára vágva, összeadó keveréssel. */
function glow(ctx, N, mask, fn) {
  const c = document.createElement('canvas');
  c.width = c.height = N;
  const g = c.getContext('2d');
  fn(g);
  g.globalCompositeOperation = 'destination-in';
  g.drawImage(mask, 0, 0, N, N);
  ctx.save();
  ctx.globalCompositeOperation = 'lighter';
  ctx.drawImage(c, 0, 0);
  ctx.restore();
}

function drawPattern(ctx, N, look, rng, slot) {
  const u = N / 64;
  const col = look.patternColor;
  const strength = slot === 'szarny' ? 0.38 : slot === 'fej' ? 0.42 : 0.58;
  atop(ctx, () => {
    ctx.fillStyle = css(col); ctx.strokeStyle = css(col); ctx.lineCap = 'round';
    switch (look.pattern) {
      case 'stripes':
        for (let x = 14 * u; x < 60 * u; x += (4.2 + rng() * 1.6) * u * look.density) {
          ctx.lineWidth = (1.1 + rng() * 0.9) * u;
          ctx.beginPath(); ctx.moveTo(x, 10 * u);
          for (let y = 10 * u; y < 62 * u; y += 4 * u) ctx.lineTo(x + Math.sin(y / (5 * u) + x) * 1.6 * u + (y - 10 * u) * 0.35, y);
          ctx.stroke();
        }
        break;
      case 'bands':
        for (let x = 12 * u; x < 62 * u; x += (6 + rng() * 2) * u) {
          ctx.lineWidth = (2.2 + rng() * 1.2) * u;
          ctx.beginPath(); ctx.moveTo(x, 6 * u); ctx.quadraticCurveTo(x - 3 * u, 34 * u, x + 2 * u, 62 * u); ctx.stroke();
        }
        break;
      case 'spots':
        for (let i = 0; i < 46 * look.density; i++) {
          ctx.beginPath(); ctx.arc((8 + rng() * 54) * u, (8 + rng() * 54) * u, (0.6 + rng() * 1.6) * u, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'rosettes':
        for (let i = 0; i < 26 * look.density; i++) {
          const x = (8 + rng() * 54) * u, y = (8 + rng() * 54) * u, r = (1.2 + rng() * 1.4) * u;
          ctx.lineWidth = 0.7 * u;
          ctx.beginPath(); ctx.arc(x, y, r, 0.3, Math.PI * 1.7); ctx.stroke();
          ctx.beginPath(); ctx.arc(x + 0.3 * u, y, r * 0.35, 0, Math.PI * 2); ctx.fill();
        }
        break;
      case 'scales':
        ctx.lineWidth = 0.45 * u;
        for (let y = 4 * u, row = 0; y < 64 * u; y += 2.4 * u, row++) {
          for (let x = (row % 2) * 1.6 * u; x < 64 * u; x += 3.2 * u) {
            ctx.beginPath(); ctx.arc(x, y, 1.6 * u, 0.15, Math.PI - 0.15); ctx.stroke();
          }
        }
        break;
      case 'speckle':
        for (let i = 0; i < 260 * look.density; i++) ctx.fillRect((rng() * 64) * u, (rng() * 64) * u, (0.3 + rng() * 0.5) * u, (0.3 + rng() * 0.5) * u);
        break;
      default:
    }
  }, look.pattern === 'scales' ? strength * 0.7 : strength);
}

/** Rúnajelek (vonalakból) — izzó rétegben. */
function runeMarks(g, N, rng, color) {
  const u = N / 64;
  g.strokeStyle = color; g.lineWidth = 0.8 * u; g.lineCap = 'round';
  g.shadowColor = color; g.shadowBlur = 3 * u;
  for (let i = 0; i < 9; i++) {
    const x = (14 + rng() * 44) * u, y = (14 + rng() * 44) * u, h = (2.2 + rng() * 1.4) * u;
    g.beginPath(); g.moveTo(x, y - h); g.lineTo(x, y + h);
    const k = rng();
    if (k < 0.33) { g.moveTo(x, y - h); g.lineTo(x + h * 0.8, y - h * 0.2); }
    else if (k < 0.66) { g.moveTo(x - h * 0.7, y - h * 0.5); g.lineTo(x + h * 0.7, y + h * 0.3); }
    else { g.moveTo(x, y); g.lineTo(x + h * 0.7, y - h * 0.6); g.moveTo(x, y); g.lineTo(x + h * 0.7, y + h * 0.6); }
    g.stroke();
  }
}

/** Elemi díszítés a rész felületén. */
function drawElement(ctx, N, look, rng, mask, slot) {
  const u = N / 64;
  const el = slot === 'fej' ? look.headEl : look.prim;
  const acc = css(rgb(ACCENT[el]));
  const zig = (g, x, y, n, step, spread) => {
    g.beginPath(); g.moveTo(x, y);
    for (let k = 0; k < n; k++) { x += (rng() - 0.5) * spread * u; y += step * u * (0.6 + rng() * 0.6); g.lineTo(x, y); }
    g.stroke();
  };
  switch (el) {
    case 'fire':
      glow(ctx, N, mask, (g) => {
        g.strokeStyle = acc; g.shadowColor = '#ff5a1a'; g.shadowBlur = 3 * u; g.lineWidth = 0.7 * u;
        for (let i = 0; i < 7; i++) zig(g, (12 + rng() * 48) * u, (14 + rng() * 30) * u, 4, 3, 4);
      });
      break;
    case 'frost':
      atop(ctx, () => {
        ctx.fillStyle = 'rgba(255,255,255,.55)';
        for (let i = 0; i < 18; i++) {
          const x = (8 + rng() * 54) * u, y = (8 + rng() * 54) * u, s = (0.8 + rng() * 1.6) * u;
          ctx.beginPath(); ctx.moveTo(x, y - s); ctx.lineTo(x + s * 0.6, y); ctx.lineTo(x, y + s * 0.4); ctx.closePath(); ctx.fill();
        }
      });
      glow(ctx, N, mask, (g) => {
        g.fillStyle = '#ffffff';
        for (let i = 0; i < 6; i++) { const x = (10 + rng() * 50) * u, y = (10 + rng() * 50) * u; g.fillRect(x - 0.2 * u, y - u, 0.4 * u, 2 * u); g.fillRect(x - u, y - 0.2 * u, 2 * u, 0.4 * u); }
      });
      break;
    case 'storm':
      glow(ctx, N, mask, (g) => {
        g.strokeStyle = acc; g.shadowColor = '#4fd6ff'; g.shadowBlur = 2.5 * u; g.lineWidth = 0.5 * u;
        for (let i = 0; i < 4; i++) zig(g, (14 + rng() * 44) * u, (10 + rng() * 20) * u, 6, 3.5, 6);
      });
      break;
    case 'shadow':
      atop(ctx, () => {
        const g = ctx.createRadialGradient(34 * u, 34 * u, 10 * u, 34 * u, 34 * u, 34 * u);
        g.addColorStop(0, 'rgba(10,6,20,0)'); g.addColorStop(1, 'rgba(10,6,20,.45)');
        ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
      });
      glow(ctx, N, mask, (g) => {
        g.fillStyle = acc; g.shadowColor = acc; g.shadowBlur = 3 * u;
        for (let i = 0; i < 14; i++) { g.beginPath(); g.arc((10 + rng() * 50) * u, (10 + rng() * 50) * u, (0.3 + rng() * 0.5) * u, 0, Math.PI * 2); g.fill(); }
      });
      break;
    case 'earth':
      atop(ctx, () => {
        for (let i = 0; i < 16; i++) {
          ctx.fillStyle = rng() < 0.6 ? 'rgba(96,128,64,.55)' : 'rgba(60,48,36,.35)';
          ctx.beginPath(); ctx.arc((10 + rng() * 50) * u, (10 + rng() * 30) * u, (0.8 + rng() * 1.8) * u, 0, Math.PI * 2); ctx.fill();
        }
      });
      break;
    case 'venom':
      glow(ctx, N, mask, (g) => {
        g.fillStyle = acc; g.shadowColor = acc; g.shadowBlur = 2.5 * u; g.globalAlpha = 0.7;
        for (let i = 0; i < 12; i++) { g.beginPath(); g.arc((10 + rng() * 50) * u, (12 + rng() * 44) * u, (0.5 + rng() * 1.1) * u, 0, Math.PI * 2); g.fill(); }
      });
      break;
    default:
  }
}

/** Ívelt, elvékonyodó szarv vagy tüske. */
function hornShape(ctx, bx, by, tx, ty, w, bend, cols, glowCol, u) {
  const dx = tx - bx, dy = ty - by, len = Math.hypot(dx, dy) || 1;
  const nx = -dy / len, ny = dx / len;
  const cx = bx + dx * 0.5 + nx * len * bend, cy = by + dy * 0.5 + ny * len * bend;
  ctx.beginPath();
  ctx.moveTo(bx + nx * w / 2, by + ny * w / 2);
  ctx.quadraticCurveTo(cx + nx * w * 0.2, cy + ny * w * 0.2, tx, ty);
  ctx.quadraticCurveTo(cx - nx * w * 0.2, cy - ny * w * 0.2, bx - nx * w / 2, by - ny * w / 2);
  ctx.closePath();
  const g = ctx.createLinearGradient(bx, by, tx, ty);
  g.addColorStop(0, cols[0]); g.addColorStop(0.5, cols[1]); g.addColorStop(1, cols[2]);
  ctx.fillStyle = g; ctx.fill();
  ctx.strokeStyle = INK; ctx.lineWidth = Math.max(0.8, 0.45 * u); ctx.stroke();
  if (glowCol) {
    ctx.save(); ctx.shadowColor = glowCol; ctx.shadowBlur = 3 * u;
    ctx.fillStyle = glowCol; ctx.beginPath(); ctx.arc(tx, ty, 0.5 * u, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  }
}

/** Kiegészítők a hát vonalán (a test körvonalából számolva). */
function drawBack(ctx, N, look, rng, sil) {
  const u = N / 64;
  const { top, minX, maxX } = sil;
  if (maxX < 0) return;
  const w = maxX - minX;
  const step = (look.back === 'plates' ? 4.4 : look.back === 'sail' ? 2.6 : 3.4) * u;
  const pts = [];
  // két szakasz: a nyak töve és a farok — a hát közepét úgyis a szárny takarja
  for (const [a, b] of [[0.06, 0.34], [0.62, 0.9]]) {
    const x0 = minX + w * a, x1 = minX + w * b;
    for (let x = x0; x <= x1; x += step) {
      const xi = Math.round(x);
      if (top[xi] < 0) continue;
      const t = (x - x0) / Math.max(1, x1 - x0);
      pts.push({ x: xi, y: top[xi] + 0.6 * u, h: (2.4 + Math.sin(t * Math.PI) * 3 + rng() * 1.2) * u, t, seg: a });
    }
  }
  if (!pts.length) return;
  const dark = css(mix(look.base, [0, 0, 0], 0.45));
  const light = css(mix(look.base, [255, 255, 255], 0.35));
  ctx.save();
  ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (look.back) {
    case 'sail': {
      for (const segPts of [pts.filter((p) => p.seg < 0.5), pts.filter((p) => p.seg > 0.5)]) {
        if (segPts.length < 2) continue;
        ctx.beginPath(); ctx.moveTo(segPts[0].x, segPts[0].y);
        segPts.forEach((p, i) => { const q = segPts[i + 1]; ctx.lineTo(p.x, p.y - p.h * 1.5); if (q) ctx.quadraticCurveTo((p.x + q.x) / 2, Math.min(p.y, q.y) - Math.min(p.h, q.h) * 0.9, q.x, q.y - q.h * 1.5); });
        ctx.lineTo(segPts[segPts.length - 1].x, segPts[segPts.length - 1].y); ctx.closePath();
        const g = ctx.createLinearGradient(0, segPts[0].y - 8 * u, 0, segPts[0].y);
        g.addColorStop(0, css(mix(look.accent, look.base, 0.4), 0.95)); g.addColorStop(1, css(look.base, 0.95));
        ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.5 * u; ctx.stroke();
        ctx.strokeStyle = dark; ctx.lineWidth = 0.4 * u;
        for (const p of segPts) { ctx.beginPath(); ctx.moveTo(p.x, p.y); ctx.lineTo(p.x, p.y - p.h * 1.5); ctx.stroke(); }
      }
      break;
    }
    case 'plates':
      for (const p of pts) {
        ctx.beginPath();
        ctx.moveTo(p.x - 1.6 * u, p.y); ctx.lineTo(p.x - 1.2 * u, p.y - p.h * 0.7); ctx.lineTo(p.x, p.y - p.h * 1.15);
        ctx.lineTo(p.x + 1.2 * u, p.y - p.h * 0.7); ctx.lineTo(p.x + 1.6 * u, p.y); ctx.closePath();
        ctx.fillStyle = dark; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.45 * u; ctx.stroke();
        ctx.strokeStyle = light; ctx.lineWidth = 0.35 * u; ctx.beginPath(); ctx.moveTo(p.x - 1.1 * u, p.y - p.h * 0.65); ctx.lineTo(p.x, p.y - p.h * 1.05); ctx.stroke();
      }
      break;
    case 'crystals':
      for (const p of pts) {
        for (let k = 0; k < 2; k++) {
          const a = -Math.PI / 2 + (k ? 0.35 : -0.15) + (rng() - 0.5) * 0.3, L = p.h * (k ? 0.8 : 1.25);
          const tx = p.x + Math.cos(a) * L, ty = p.y + Math.sin(a) * L;
          ctx.beginPath(); ctx.moveTo(p.x - 0.8 * u, p.y); ctx.lineTo(tx, ty); ctx.lineTo(p.x + 0.8 * u, p.y); ctx.closePath();
          ctx.fillStyle = 'rgba(200,240,255,.85)'; ctx.fill(); ctx.strokeStyle = 'rgba(80,140,190,.9)'; ctx.lineWidth = 0.4 * u; ctx.stroke();
          ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.beginPath(); ctx.moveTo(p.x - 0.3 * u, p.y - 0.3 * u); ctx.lineTo(tx, ty); ctx.stroke();
        }
      }
      break;
    case 'flames':
      ctx.shadowColor = '#ff5a1a'; ctx.shadowBlur = 3 * u;
      for (const p of pts) {
        const lean = 1.4 * u;
        ctx.beginPath(); ctx.moveTo(p.x - 1.3 * u, p.y);
        ctx.quadraticCurveTo(p.x - 1.4 * u, p.y - p.h * 0.8, p.x + lean, p.y - p.h * 1.5);
        ctx.quadraticCurveTo(p.x + 0.2 * u, p.y - p.h * 0.6, p.x + 1.3 * u, p.y); ctx.closePath();
        const g = ctx.createLinearGradient(0, p.y, 0, p.y - p.h * 1.5);
        g.addColorStop(0, '#ff6a1f'); g.addColorStop(0.6, '#ffb347'); g.addColorStop(1, '#fff3a0');
        ctx.fillStyle = g; ctx.fill();
      }
      break;
    case 'moss':
      for (const p of pts) {
        for (let k = 0; k < 3; k++) {
          ctx.fillStyle = ['#4f7a3a', '#6f9a4a', '#3a5a2a'][k];
          ctx.beginPath(); ctx.arc(p.x + (k - 1) * 1.1 * u, p.y - 0.6 * u - rng() * 0.8 * u, (0.9 + rng() * 0.7) * u, 0, Math.PI * 2); ctx.fill();
        }
        if (rng() < 0.3) { ctx.fillStyle = rng() < 0.5 ? '#f2e27a' : '#f6f6f6'; ctx.beginPath(); ctx.arc(p.x, p.y - 1.8 * u, 0.45 * u, 0, Math.PI * 2); ctx.fill(); }
      }
      break;
    case 'thorns':
      for (const p of pts) hornShape(ctx, p.x, p.y + 0.5 * u, p.x + p.h * 0.45, p.y - p.h * 1.05, 1.4 * u, 0.35, ['#14260e', '#2f5a22', '#b6ff5a'], null, u);
      break;
    case 'wisps':
      ctx.globalAlpha = 0.75;
      for (const p of pts) {
        const g = ctx.createLinearGradient(0, p.y, 0, p.y - p.h * 2);
        g.addColorStop(0, css([42, 26, 68], 0.9)); g.addColorStop(1, css([177, 140, 255], 0));
        ctx.strokeStyle = g; ctx.lineWidth = 1.3 * u;
        ctx.beginPath(); ctx.moveTo(p.x, p.y);
        ctx.bezierCurveTo(p.x - 1.5 * u, p.y - p.h * 0.7, p.x + 2 * u, p.y - p.h * 1.2, p.x + 0.8 * u, p.y - p.h * 2); ctx.stroke();
      }
      ctx.globalAlpha = 1;
      break;
    default: // spikes
      for (const p of pts) hornShape(ctx, p.x, p.y + 0.6 * u, p.x + p.h * 0.35, p.y - p.h * 1.2, 1.7 * u, 0.12, ['#8a7a5a', '#cfc3a4', '#f2ead6'], null, u);
  }
  ctx.restore();
}

/** Extra szarvak a fej hátsó felén (a fej balra néz: a hátsó fele jobbra van). */
function drawHorns(ctx, N, look, rng, sil) {
  const u = N / 64;
  const { top, minX, maxX } = sil;
  if (maxX < 0 || !look.horns) return;
  const w = maxX - minX;
  const st = look.hornStyle;
  for (let k = 0; k < look.horns; k++) {
    const x = Math.round(minX + w * (0.62 + k * 0.12 + rng() * 0.06));
    if (top[x] < 0) continue;
    const y = top[x] + 0.8 * u;
    const L = (4.2 + rng() * 2.6 - k * 1.2) * u;
    const ang = -Math.PI / 2 + 0.55 + k * 0.25 + (rng() - 0.5) * 0.2;      // hátra-felfelé
    ctx.save();
    if (st.clear) ctx.globalAlpha = 0.9;
    hornShape(ctx, x, y, x + Math.cos(ang) * L, y + Math.sin(ang) * L, (1.5 - k * 0.3) * u, 0.28, st.cols, st.glow, u);
    ctx.restore();
  }
}

/** Farokvég: a test körvonalának jobb szélső pontján (a farok hegyén). */
function drawTail(ctx, N, look, rng, sil) {
  const u = (N / 64) * 1.55;                                     // jól látható méret
  const g64 = N / 64;
  const { top, bot, maxX } = sil;
  if (maxX < 0 || look.tail === 'none') return;
  const tx = maxX, ty = (top[maxX] + bot[maxX]) / 2;
  const bx = Math.max(0, maxX - Math.round(5 * g64));
  const by = top[bx] >= 0 ? (top[bx] + bot[bx]) / 2 : ty + 2 * u;
  const ang = Math.atan2(ty - by, tx - bx);                       // a farok iránya a hegynél
  const ca = Math.cos(ang), sa = Math.sin(ang);
  const P = (along, side) => [tx + ca * along - sa * side, ty + sa * along + ca * side];
  const dark = css(mix(look.base, [0, 0, 0], 0.5));
  const bone = ['#8a7a5a', '#cfc3a4', '#f2ead6'];
  ctx.save(); ctx.lineJoin = 'round';
  const poly = (pts, fill, stroke = INK) => {
    ctx.beginPath(); pts.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath();
    ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = stroke; ctx.lineWidth = 0.45 * u; ctx.stroke();
  };
  switch (look.tail) {
    case 'club': {                                                 // csontbuzogány tüskékkel
      const [cx, cy] = P(1.4 * u, 0);
      ctx.beginPath(); ctx.arc(cx, cy, 2.3 * u, 0, Math.PI * 2);
      const g = ctx.createRadialGradient(cx - u, cy - u, 0.3 * u, cx, cy, 2.4 * u);
      g.addColorStop(0, '#e8dcc0'); g.addColorStop(1, '#6e634f');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.45 * u; ctx.stroke();
      for (let k = 0; k < 5; k++) { const a = ang - 1.6 + k * 0.8; hornShape(ctx, cx + Math.cos(a) * 2 * u, cy + Math.sin(a) * 2 * u, cx + Math.cos(a) * 3.8 * u, cy + Math.sin(a) * 3.8 * u, 0.9 * u, 0, bone, null, u); }
      break;
    }
    case 'blade':
      poly([P(-0.5 * u, -1.2 * u), P(5.5 * u, -2.6 * u), P(3.2 * u, 0.4 * u), P(-0.5 * u, 1.2 * u)], '#cfd6e6');
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.lineWidth = 0.3 * u; ctx.beginPath(); ctx.moveTo(...P(0, -0.9 * u)); ctx.lineTo(...P(5 * u, -2.3 * u)); ctx.stroke();
      break;
    case 'spade':
      poly([P(-0.3 * u, 0), P(2 * u, -2.4 * u), P(5 * u, 0), P(2 * u, 2.4 * u)], dark);
      break;
    case 'stinger':
      hornShape(ctx, ...P(-0.2 * u, 0), ...P(4.8 * u, 1.6 * u), 1.6 * u, 0.3, ['#14260e', '#3f6a2a', '#b6ff5a'], '#7dff6a', u);
      break;
    case 'fan':                                                     // tollas legyező
      for (let k = -2; k <= 2; k++) {
        const a = ang + k * 0.32, L = (4.6 - Math.abs(k) * 0.5) * u;
        const ex = tx + Math.cos(a) * L, ey = ty + Math.sin(a) * L;
        ctx.beginPath(); ctx.ellipse((tx + ex) / 2, (ty + ey) / 2, L / 2, 0.9 * u, a, 0, Math.PI * 2);
        ctx.fillStyle = css(mix(look.accent, [255, 255, 255], 0.25), 0.95); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.35 * u; ctx.stroke();
        ctx.strokeStyle = dark; ctx.lineWidth = 0.25 * u; ctx.beginPath(); ctx.moveTo(tx, ty); ctx.lineTo(ex, ey); ctx.stroke();
      }
      break;
    case 'crystal':
      for (let k = -1; k <= 1; k++) {
        const a = ang + k * 0.45, L = (4.4 - Math.abs(k) * 1.2) * u;
        poly([[tx - Math.sin(a) * 0.9 * u, ty + Math.cos(a) * 0.9 * u], [tx + Math.cos(a) * L, ty + Math.sin(a) * L], [tx + Math.sin(a) * 0.9 * u, ty - Math.cos(a) * 0.9 * u]], 'rgba(200,240,255,.9)', 'rgba(80,140,190,.95)');
      }
      break;
    case 'flame':
      ctx.shadowColor = '#ff5a1a'; ctx.shadowBlur = 4 * u;
      for (let k = 0; k < 3; k++) {
        const a = ang - 0.5 + k * 0.4, L = (4.8 - k * 0.8) * u;
        ctx.beginPath(); ctx.moveTo(tx, ty - 1.1 * u);
        ctx.quadraticCurveTo(tx + Math.cos(a - 0.4) * L * 0.6, ty + Math.sin(a - 0.4) * L * 0.6, tx + Math.cos(a) * L, ty + Math.sin(a) * L);
        ctx.quadraticCurveTo(tx + Math.cos(a + 0.4) * L * 0.5, ty + Math.sin(a + 0.4) * L * 0.5, tx, ty + 1.1 * u);
        const g = ctx.createLinearGradient(tx, ty, tx + Math.cos(a) * L, ty + Math.sin(a) * L);
        g.addColorStop(0, '#ff6a1f'); g.addColorStop(0.6, '#ffb347'); g.addColorStop(1, '#fff3a0');
        ctx.fillStyle = g; ctx.fill();
      }
      break;
    default:
  }
  ctx.restore();
}

/** Fejdísz: taréj, gallér, bajuszszál vagy orrszarv (a fej balra néz). */
function drawHeadgear(ctx, N, look, rng, sil) {
  const u = N / 64;
  const { top, bot, minX, maxX } = sil;
  if (maxX < 0 || look.headgear === 'none') return;
  const w = maxX - minX;
  const col = (x) => Math.max(minX, Math.min(maxX, Math.round(x)));
  const accent = mix(look.accent, look.base, 0.3);
  ctx.save(); ctx.lineJoin = 'round'; ctx.lineCap = 'round';
  switch (look.headgear) {
    case 'crest': {                                                 // tüskés taréj a koponya tetején
      for (let k = 0; k < 6; k++) {
        const x = col(minX + w * (0.4 + k * 0.08));
        if (top[x] < 0) continue;
        const L = (2.6 + Math.sin((k / 5) * Math.PI) * 2.2) * u;
        hornShape(ctx, x, top[x] + 0.6 * u, x + L * 0.45, top[x] - L, 1.2 * u, 0.15, [css(mix(look.base, [0, 0, 0], 0.4)), css(accent), css(mix(accent, [255, 255, 255], 0.4))], null, u);
      }
      break;
    }
    case 'frill': {                                                 // bordázott gallér a fej mögött
      const x = col(minX + w * 0.88);
      const cy = top[x] >= 0 ? (top[x] + bot[x]) / 2 : 20 * u;
      const R = 6 * u;
      ctx.beginPath(); ctx.moveTo(x - 1.5 * u, cy);
      for (let k = 0; k <= 6; k++) {
        const a = -1.5 + k * 0.5, r = R * (k % 2 ? 0.8 : 1);
        ctx.lineTo(x + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      ctx.closePath();
      const g = ctx.createRadialGradient(x, cy, 0.5 * u, x, cy, R);
      g.addColorStop(0, css(look.base)); g.addColorStop(1, css(accent, 0.9));
      ctx.globalCompositeOperation = 'destination-over';             // a fej mögé
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 0.45 * u; ctx.stroke();
      ctx.strokeStyle = css(mix(look.base, [0, 0, 0], 0.5)); ctx.lineWidth = 0.3 * u;
      for (let k = 0; k <= 6; k++) { const a = -1.5 + k * 0.5; ctx.beginPath(); ctx.moveTo(x, cy); ctx.lineTo(x + Math.cos(a) * R * 0.9, cy + Math.sin(a) * R * 0.9); ctx.stroke(); }
      break;
    }
    case 'whiskers': {                                              // hosszú bajuszszálak az orr alól
      const x = col(minX + w * 0.12);
      const y = bot[x] >= 0 ? bot[x] - 1 * u : 26 * u;
      ctx.strokeStyle = css(mix(look.accent, [255, 255, 255], 0.3)); ctx.lineWidth = 0.55 * u;
      for (const k of [0, 1]) {
        ctx.beginPath(); ctx.moveTo(x, y - k * u);
        ctx.bezierCurveTo(x - 2 * u, y + 4 * u, x + 4 * u, y + 7 * u - k * u, x + 9 * u, y + 5 * u - k * 2 * u);
        ctx.stroke();
      }
      break;
    }
    case 'nosehorn': {                                              // orrszarv
      const x = col(minX + w * 0.16);
      if (top[x] >= 0) hornShape(ctx, x, top[x] + 0.7 * u, x - 1.2 * u, top[x] - 3.6 * u, 1.6 * u, -0.25, look.hornStyle.cols, look.hornStyle.glow, u);
      break;
    }
    default:
  }
  ctx.restore();
}

/**
 * Egy testrész megfestése a saját bőrével.
 * @param ctx  N×N vászon (üres)
 * @param img  a szürkeárnyalatos rész-rajz
 */
export function paintPart(ctx, N, slot, img, look) {
  const u = N / 64;
  // A rács (N×N) a vászon közepén, körben SKIN_PAD perem
  ctx.translate(Math.round(N * SKIN_PAD), Math.round(N * SKIN_PAD));
  const rng = mulberry32(look.seed ^ { fej: 11, test: 22, lab: 33, szarny: 44 }[slot]);
  // 1. a rajz + kéttónusú színezés (hát → has) szorzással
  ctx.drawImage(img, 0, 0, N, N);
  const range = { fej: [10, 30], test: [18, 42], lab: [36, 62], szarny: [8, 40] }[slot] || [10, 50];
  const top = tint(look.base);
  const bottom = slot === 'szarny' ? tint(mix(look.base, look.accent, 0.35))
    : slot === 'lab' ? tint(mix(look.base, look.belly, 0.25)) : tint(look.belly);
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createLinearGradient(0, range[0] * u, 0, range[1] * u);
  g.addColorStop(0, css(top)); g.addColorStop(0.55, css(top)); g.addColorStop(1, css(bottom));
  ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0, N, N);
  ctx.restore();

  // a maszk (a kiegészítők előtt): a rajz körvonala
  const mask = document.createElement('canvas');
  mask.width = mask.height = N;
  mask.getContext('2d').drawImage(img, 0, 0, N, N);

  // 2. minta
  if (look.pattern !== 'none' && look.pattern !== 'runes') drawPattern(ctx, N, look, mulberry32(look.seed), slot);

  // 3. kiegészítők a körvonalon (a fényelés előtt, hogy ők is árnyékot kapjanak)
  if (slot === 'test') { const sil = silhouette(ctx, N); drawBack(ctx, N, look, rng, sil); drawTail(ctx, N, look, rng, sil); }
  if (slot === 'fej') { const sil = silhouette(ctx, N); drawHorns(ctx, N, look, rng, sil); drawHeadgear(ctx, N, look, rng, sil); }

  // 4. térfogat: bal felső fény, jobb alsó árnyék
  atop(ctx, () => {
    const lg = ctx.createLinearGradient(8 * u, 8 * u, 56 * u, 60 * u);
    lg.addColorStop(0, 'rgba(255,248,230,.28)'); lg.addColorStop(0.45, 'rgba(255,255,255,0)');
    lg.addColorStop(0.7, 'rgba(0,0,0,0)'); lg.addColorStop(1, 'rgba(10,8,24,.35)');
    ctx.fillStyle = lg; ctx.fillRect(0, 0, N, N);
  });

  // 5. elemi díszítés és rúnák
  drawElement(ctx, N, look, rng, mask, slot);
  if (look.pattern === 'runes' && slot !== 'szarny') {
    glow(ctx, N, mask, (gc) => runeMarks(gc, N, mulberry32(look.seed + 5), css(look.accent)));
  }
}
