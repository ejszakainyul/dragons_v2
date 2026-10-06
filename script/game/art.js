/* =====================================================================
   Grafika — minden kóddal rajzolva, indításkor
   ---------------------------------------------------------------------
   Nincs letöltendő sprite-lap: a csempék, fák, épületek és effektek
   vásznon készülnek, egyszer, és textúraként kerülnek a Phaserbe.

   Egységes stílus a sárkány-rajzokkal: vastag sötét körvonal (INK),
   lágy átmenetes árnyalás, bal-felső fény.

   A sárkányok a meglévő SVG testrészekből készülnek, pontosan úgy
   színezve, mint az oldal többi részén (szürkeárnyalat × szín × 1.3).
   ===================================================================== */
import { TILE } from './world.js';
import { mulberry32, SLOTS } from './rules.js';
import { dragonLook, paintPart, SKIN_PAD } from './skins.js';

const INK = '#0b0f1c';

/* =====================================================================
   Segédek
   ===================================================================== */
function canvas(w, h) {
  const c = document.createElement('canvas');
  c.width = w; c.height = h;
  return c;
}

/*
 * Varratmentes csempék: amíg CELL be van állítva (a tileset rajzolásakor),
 * minden apró elem a csempe szélén „körbefordul" (a túloldalon is
 * megjelenik), és nem lóg át a szomszéd csempébe. Így a csempék
 * határán nincs elvágott pötty, szaggatott csík.
 */
let CELL = null;
function wrapDraw(ctx, fn) {
  if (!CELL) { fn(); return; }
  const { x, y, s } = CELL;
  ctx.save();
  ctx.beginPath(); ctx.rect(x, y, s, s); ctx.clip();
  for (const ox of [-s, 0, s]) for (const oy of [-s, 0, s]) {
    ctx.save(); ctx.translate(ox, oy); fn(); ctx.restore();
  }
  ctx.restore();
}

function speckle(ctx, x, y, w, h, colors, count, rng, rMin = 0.8, rMax = 1.8) {
  for (let i = 0; i < count; i++) {
    const col = colors[(rng() * colors.length) | 0];
    const px = x + rng() * w, py = y + rng() * h, r = rMin + rng() * (rMax - rMin);
    wrapDraw(ctx, () => {
      ctx.fillStyle = col;
      ctx.beginPath();
      ctx.arc(px, py, r, 0, Math.PI * 2);
      ctx.fill();
    });
  }
}

function blades(ctx, x, y, w, h, color, count, rng, len = 5) {
  for (let i = 0; i < count; i++) {
    const bx = x + rng() * w, by = y + rng() * h;
    const tx = bx + (rng() - 0.5) * 3, ty = by - len * (0.6 + rng() * 0.6);
    wrapDraw(ctx, () => {
      ctx.strokeStyle = color;
      ctx.lineWidth = 1.2;
      ctx.lineCap = 'round';
      ctx.beginPath();
      ctx.moveTo(bx, by);
      ctx.lineTo(tx, ty);
      ctx.stroke();
    });
  }
}

const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);

function vgrad(ctx, y0, y1, stops) {
  const g = ctx.createLinearGradient(0, y0, 0, y1);
  stops.forEach(([o, c]) => g.addColorStop(o, c));
  return g;
}

/* =====================================================================
   Csempék
   ===================================================================== */
// A csempék a tiles.js-ben készülnek (képpontonként, domborított textúrával, szegélycsempékkel)
export { buildTileset, TILE_MARGIN, TILE_SPACING } from './tiles.js';

/* =====================================================================
   Tárgyak: fák, sziklák, épületek, helyszínek
   ===================================================================== */
/* =====================================================================
   Anyag-segédek (talajárnyék, deszka, faragott kő, lámpás) — a tárgyakhoz
   ===================================================================== */
function materials(rng) {
  /** Puha talajárnyék a tárgy alá (a nap bal-felülről süt: kissé jobbra tolva). */
  const contact = (ctx, cx, cy, rx, ry, a = 0.4) => {
    ctx.save();
    ctx.translate(cx, cy); ctx.scale(1, ry / rx);
    const g = ctx.createRadialGradient(0, 0, 1, 0, 0, rx);
    g.addColorStop(0, `rgba(0,0,0,${a})`); g.addColorStop(0.6, `rgba(0,0,0,${a * 0.55})`); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(0, 0, rx, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
  };
  /* --- Anyag-segédek a helyekhez: deszka erezettel, faragott kő, gyep --- */
  const planks = (ctx, x, y, w, h, { vertical = true, cols = ['#7a5534', '#6b4a2e', '#86603c'], step = 10 } = {}) => {
    ctx.save(); ctx.beginPath(); ctx.rect(x, y, w, h); ctx.clip();
    const n = Math.ceil((vertical ? w : h) / step);
    for (let i = 0; i < n; i++) {
      const c = cols[i % cols.length];
      const px = vertical ? x + i * step : x, py = vertical ? y : y + i * step;
      const pw = vertical ? step : w, ph = vertical ? h : step;
      const g = vertical ? ctx.createLinearGradient(px, 0, px + pw, 0) : ctx.createLinearGradient(0, py, 0, py + ph);
      g.addColorStop(0, c); g.addColorStop(1, 'rgba(0,0,0,.18)');
      ctx.fillStyle = c; ctx.fillRect(px, py, pw, ph);
      ctx.fillStyle = g; ctx.fillRect(px, py, pw, ph);
      ctx.strokeStyle = 'rgba(30,18,8,.35)'; ctx.lineWidth = 0.8;
      for (let k = 0; k < 3; k++) {                                     // erezet
        ctx.beginPath();
        if (vertical) { const gx = px + 2 + rng() * (pw - 4); ctx.moveTo(gx, py); ctx.bezierCurveTo(gx + 2, py + ph * 0.3, gx - 2, py + ph * 0.6, gx + 1, py + ph); }
        else { const gy = py + 2 + rng() * (ph - 4); ctx.moveTo(px, gy); ctx.bezierCurveTo(px + pw * 0.3, gy + 1.5, px + pw * 0.6, gy - 1.5, px + pw, gy); }
        ctx.stroke();
      }
      if (rng() < 0.4) { ctx.fillStyle = 'rgba(30,18,8,.5)'; ctx.beginPath(); ctx.ellipse(px + pw / 2, py + ph * (0.2 + rng() * 0.6), 1.4, 2.2, 0, 0, 7); ctx.fill(); }   // göcs
      ctx.fillStyle = 'rgba(0,0,0,.4)'; vertical ? ctx.fillRect(px + pw - 1, py, 1, ph) : ctx.fillRect(px, py + ph - 1, pw, 1);
    }
    ctx.restore();
  };
  const stone = (ctx, x, y, w, h, base = [118, 124, 142]) => {
    const r = Math.min(w, h) * 0.3;
    ctx.beginPath(); ctx.roundRect(x, y, w, h, r);
    const g = ctx.createLinearGradient(x, y, x + w * 0.6, y + h);
    const c = base.map((v) => Math.round(v * (0.85 + rng() * 0.3)));
    g.addColorStop(0, `rgb(${c.map((v) => Math.min(255, v + 40)).join(',')})`); g.addColorStop(1, `rgb(${c.map((v) => Math.round(v * 0.6)).join(',')})`);
    ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = 'rgba(12,14,24,.85)'; ctx.lineWidth = 1.2; ctx.stroke();
    if (rng() < 0.35) { ctx.fillStyle = 'rgba(110,150,80,.55)'; ctx.beginPath(); ctx.ellipse(x + w * 0.35, y + 2, w * 0.25, 1.6, 0, 0, 7); ctx.fill(); }   // moha
  };
  const lantern = (ctx, x, y) => {
    const g = ctx.createRadialGradient(x, y, 1, x, y, 16);
    g.addColorStop(0, 'rgba(255,200,110,.55)'); g.addColorStop(1, 'rgba(255,200,110,0)');
    ctx.fillStyle = g; ctx.fillRect(x - 16, y - 16, 32, 32);
    ctx.fillStyle = '#2a2018'; ctx.fillRect(x - 3.5, y - 5, 7, 10);
    ctx.fillStyle = '#ffd890'; ctx.fillRect(x - 2.2, y - 3.5, 4.4, 7);
    ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.strokeRect(x - 3.5, y - 5, 7, 10);
  };

  return { contact, planks, stone, lantern };
}

export function buildSprites(scene) {
  // Minden tárgy egységes utólagos árnyalást kap (finish): fényes perem bal
  // felül, árnyékos jobb alul, enyhe térfogat-átmenet és anyagszemcse.
  // A már árnyalt fák, sziklák és az effektek kimaradnak.
  const NO_FINISH = /^(fx-|eyes$|shadow$|raven|pine|birch|dead|boulder)/;
  const add = (key, w, h, draw, opts = {}) => {
    if (scene.textures.exists(key)) return;
    const c = canvas(w, h);
    const ctx = c.getContext('2d');
    draw(ctx, w, h);
    if (!NO_FINISH.test(key) && opts.finish !== false) finish(c);
    if (opts.after) { ctx.save(); opts.after(ctx, w, h); ctx.restore(); }
    scene.textures.addCanvas(key, c);
  };
  const finish = (c) => {
    const w = c.width, h = c.height, ctx = c.getContext('2d');
    // a tömör körvonal (a puha árnyék és fény nem számít bele)
    const solid = canvas(w, h);
    const sx = solid.getContext('2d');
    const id = ctx.getImageData(0, 0, w, h);
    const md = sx.createImageData(w, h);
    for (let i = 3; i < id.data.length; i += 4) md.data[i] = id.data[i] > 150 ? 255 : 0;
    sx.putImageData(md, 0, 0);
    const overlay = (paint) => {
      const t = canvas(w, h); const g = t.getContext('2d');
      paint(g);
      g.globalCompositeOperation = 'destination-in'; g.drawImage(solid, 0, 0);
      ctx.drawImage(t, 0, 0);
    };
    const rim = (dx, dy, color, alpha) => overlay((g) => {
      g.drawImage(solid, 0, 0); g.globalCompositeOperation = 'source-in'; g.fillStyle = color; g.fillRect(0, 0, w, h);
      g.globalCompositeOperation = 'destination-out'; g.drawImage(solid, dx, dy);
      g.globalCompositeOperation = 'source-over'; g.globalAlpha = 1;
      g.globalCompositeOperation = 'destination-in'; g.fillStyle = `rgba(0,0,0,${alpha})`; g.fillRect(0, 0, w, h);
    });
    rim(1.5, 1.5, '#fff4dc', 0.4);
    rim(-1.5, -1.5, '#0a0c18', 0.35);
    overlay((g) => {
      const lg = g.createLinearGradient(0, 0, w, h);
      lg.addColorStop(0, 'rgba(255,246,224,.12)'); lg.addColorStop(0.5, 'rgba(255,255,255,0)'); lg.addColorStop(1, 'rgba(10,8,24,.2)');
      g.fillStyle = lg; g.fillRect(0, 0, w, h);
      for (let i = 0; i < (w * h) / 26; i++) {
        g.fillStyle = rng() < 0.5 ? 'rgba(0,0,0,.07)' : 'rgba(255,255,255,.06)';
        g.fillRect(rng() * w, rng() * h, 1, 1);
      }
    });
  };
  const rng = mulberry32(4242);
  const { contact, planks, stone, lantern } = materials(rng);


  /* --- Fenyő (3 változat + havas): rétegzett ágak, tűlevél-textúra, bal felső fény --- */
  const pine = (ctx, w, h, snow, v) => {
    const cx = w / 2;
    contact(ctx, cx + 7, h - 7, 25, 7);
    const tg = ctx.createLinearGradient(cx - 4, 0, cx + 4, 0);
    tg.addColorStop(0, '#6b4a2e'); tg.addColorStop(1, '#3a2616');
    ctx.fillStyle = tg; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.fillRect(cx - 3.5, h - 22, 7, 15); ctx.strokeRect(cx - 3.5, h - 22, 7, 15);
    const tiers = 4 + (v % 2);
    const shapes = [];
    for (let i = 0; i < tiers; i++) {
      const top = 4 + i * ((h - 40) / tiers);
      const bot = top + (h - 34) / tiers + 13;
      const half = 8 + i * (w * 0.42 - 8) / (tiers - 1);
      // ágvégek: cikk-cakk a két oldalon, lelógó hegyekkel
      const pts = [[cx, top]];
      for (let k = 1; k <= 3; k++) {
        const t = k / 3;
        pts.push([cx + half * t * 0.72, top + (bot - top) * t - 3]);
        pts.push([cx + half * t + 1.5, top + (bot - top) * t + 1]);
      }
      const right = pts.slice(1);
      const left = right.map(([x, y]) => [2 * cx - x, y]).reverse();
      shapes.push({ top, bot, half, pts: [[cx, top], ...right, ...left] });
    }
    for (const { top, bot, half, pts } of shapes) {
      const path = () => {
        ctx.beginPath(); ctx.moveTo(...pts[0]);
        const r = pts.slice(1, 7), l = pts.slice(7);
        r.forEach((p) => ctx.lineTo(...p));
        ctx.quadraticCurveTo(cx, bot - 4, l[0][0], l[0][1]);
        l.slice(1).forEach((p) => ctx.lineTo(...p));
        ctx.closePath();
      };
      path();
      const g = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
      g.addColorStop(0, '#5f9d60'); g.addColorStop(0.45, '#2f6a3c'); g.addColorStop(1, '#14341f');
      ctx.fillStyle = g; ctx.fill();
      ctx.save(); path(); ctx.clip();
      // az ág alja árnyékosabb
      const sh = ctx.createLinearGradient(0, top, 0, bot);
      sh.addColorStop(0, 'rgba(0,0,0,0)'); sh.addColorStop(1, 'rgba(0,20,10,.35)');
      ctx.fillStyle = sh; ctx.fillRect(cx - half - 4, top, half * 2 + 8, bot - top + 4);
      // tűlevelek
      ctx.lineCap = 'round'; ctx.lineWidth = 1;
      for (let k = 0; k < 34; k++) {
        const x = cx + (rng() - 0.5) * half * 2, y = top + rng() * (bot - top);
        ctx.strokeStyle = x < cx ? (rng() < 0.6 ? 'rgba(170,225,150,.55)' : 'rgba(30,70,40,.5)') : 'rgba(8,24,14,.5)';
        const dir = x < cx ? -1 : 1;
        ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + dir * 3, y + 3); ctx.stroke();
      }
      ctx.restore();
      path(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      if (snow) {
        ctx.save(); path(); ctx.clip();
        ctx.beginPath(); ctx.moveTo(cx, top - 2);
        const steps = 6;
        for (let k = 0; k <= steps; k++) {
          const t = k / steps, x = cx - half * 0.85 + half * 1.7 * t;
          const y = top + (bot - top) * (0.32 + Math.abs(t - 0.5) * 0.5) + (k % 2 ? 3 : -1);
          ctx.lineTo(x, y);
        }
        ctx.closePath();
        const sg = ctx.createLinearGradient(cx - half, 0, cx + half, 0);
        sg.addColorStop(0, '#ffffff'); sg.addColorStop(0.55, '#eef4fc'); sg.addColorStop(1, '#b8c8e4');
        ctx.fillStyle = sg; ctx.fill();
        ctx.restore();
      }
    }
  };
  for (let v = 0; v < 3; v++) {
    add(`pine${v}`, 64, 90 + v * 10, (ctx, w, h) => pine(ctx, w, h, false, v));
    add(`pine-snow${v}`, 64, 90 + v * 10, (ctx, w, h) => pine(ctx, w, h, true, v));
  }

  /* --- Nyírfa: fehér, foltos törzs, fényben fürdő levélcsomók --- */
  for (let v = 0; v < 3; v++) add(`birch${v}`, 60, 92, (ctx, w, h) => {
    const cx = w / 2;
    contact(ctx, cx + 7, h - 6, 22, 6);
    const tg = ctx.createLinearGradient(cx - 4, 0, cx + 4, 0);
    tg.addColorStop(0, '#fbf8ef'); tg.addColorStop(1, '#b5b0a2');
    ctx.fillStyle = tg; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
    ctx.beginPath(); ctx.moveTo(cx - 4, h - 6); ctx.quadraticCurveTo(cx - 6 + v * 2, h * 0.6, cx - 2, 34); ctx.lineTo(cx + 3, 34);
    ctx.quadraticCurveTo(cx - 1 + v * 2, h * 0.6, cx + 4, h - 6); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#20232a';
    for (let i = 0; i < 6; i++) ctx.fillRect(cx - 3 + (i % 2) * 3, 42 + i * 7 + rng() * 3, 2 + rng() * 2, 1.4);
    // levélcsomók: hátul sötétebbek, elöl és bal felül világosak
    const blobs = [];
    for (let i = 0; i < 16; i++) {
      const a = rng() * Math.PI * 2, r = rng();
      blobs.push([cx + Math.cos(a) * 17 * r, 26 + Math.sin(a) * 15 * r, 6 + rng() * 5]);
    }
    blobs.sort((p, q) => p[1] - q[1] + (q[0] - p[0]) * 0.3);
    for (const [x, y, r] of blobs) {
      const g = ctx.createRadialGradient(x - r * 0.4, y - r * 0.4, 1, x, y, r);
      const lit = clamp01((cx + 10 - x) / 30) * 0.6 + clamp01((40 - y) / 30) * 0.4;
      g.addColorStop(0, lit > 0.45 ? '#e2ee8c' : '#a9c45e'); g.addColorStop(0.6, '#6f9a3c'); g.addColorStop(1, '#3a5f26');
      ctx.fillStyle = g; ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI * 2); ctx.fill();
      ctx.strokeStyle = 'rgba(20,40,16,.55)'; ctx.lineWidth = 1; ctx.stroke();
    }
    speckle(ctx, cx - 18, 12, 36, 28, ['#f2f8b0', '#5a8a30'], 14, rng, 0.8, 1.6);
  });

  /* --- Holt fa (hamuverem) --- */
  for (let v = 0; v < 3; v++) add(`dead${v}`, 56, 80, (ctx, w, h) => {
    contact(ctx, w / 2 + 6, h - 4, 18, 5, 0.35);
    ctx.strokeStyle = INK; ctx.lineCap = 'round';
    const branch = (x, y, len, ang, width) => {
      if (len < 6) return;
      const x2 = x + Math.cos(ang) * len, y2 = y + Math.sin(ang) * len;
      ctx.lineWidth = width + 2; ctx.strokeStyle = INK;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.lineWidth = width; ctx.strokeStyle = '#3a3033';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x2, y2); ctx.stroke();
      ctx.lineWidth = Math.max(0.8, width * 0.35); ctx.strokeStyle = 'rgba(160,140,140,.35)';
      ctx.beginPath(); ctx.moveTo(x - 1, y); ctx.lineTo(x2 - 1, y2); ctx.stroke();
      branch(x2, y2, len * 0.66, ang - 0.5 - rng() * 0.3, width * 0.7);
      branch(x2, y2, len * 0.6, ang + 0.45 + rng() * 0.3, width * 0.7);
    };
    branch(w / 2, h - 4, 30, -Math.PI / 2 + (rng() - 0.5) * 0.2, 6);
    ctx.save(); ctx.shadowColor = '#ff5a1a'; ctx.shadowBlur = 5;
    speckle(ctx, w / 2 - 6, h - 22, 12, 16, ['#ff7a3d', '#ffc46b'], 3, rng, 0.8, 1.4);
    ctx.restore();
  });

  /* --- Sziklák: lapos oldalak (fény, félárnyék, árnyék), moha vagy hó a tetején --- */
  for (let v = 0; v < 2; v++) for (const snow of [false, true]) add(`boulder${v}${snow ? 's' : ''}`, 56, 46, (ctx, w, h) => {
    contact(ctx, w / 2 + 5, h - 6, 25, 7, 0.45);
    const cx = w / 2 - 2, base = h - 8;
    const outline = [];
    const n = 9;
    for (let i = 0; i <= n; i++) {
      const a = Math.PI + (Math.PI * i) / n;
      const r = (w / 2 - 6) * (0.82 + rng() * 0.22);
      outline.push([cx + Math.cos(a) * r, base + Math.sin(a) * r * (0.78 + v * 0.1)]);
    }
    const body = () => { ctx.beginPath(); outline.forEach((p, i) => (i ? ctx.lineTo(...p) : ctx.moveTo(...p))); ctx.closePath(); };
    body();
    ctx.fillStyle = vgrad(ctx, 6, h, [[0, '#7c8298'], [1, '#3b4054']]); ctx.fill();
    ctx.save(); body(); ctx.clip();
    // tető-lap (napos) és bal oldali lap (félárnyék)
    const peak = outline[Math.floor(n * 0.45)];
    ctx.fillStyle = '#a3a9bd';
    ctx.beginPath(); ctx.moveTo(outline[1][0], outline[1][1]); ctx.lineTo(peak[0], peak[1] - 2); ctx.lineTo(outline[n - 2][0], outline[n - 2][1]);
    ctx.lineTo(cx + 6, base - 14); ctx.closePath(); ctx.fill();
    ctx.fillStyle = '#8a90a6';
    ctx.beginPath(); ctx.moveTo(outline[0][0], outline[0][1]); ctx.lineTo(outline[1][0], outline[1][1]); ctx.lineTo(cx + 6, base - 14); ctx.lineTo(cx - 2, base); ctx.closePath(); ctx.fill();
    // repedések
    ctx.strokeStyle = 'rgba(20,22,34,.6)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(cx + 6, base - 14); ctx.lineTo(cx + 12, base - 6); ctx.lineTo(cx + 10, base); ctx.stroke();
    if (snow) {
      ctx.fillStyle = '#f4f8ff';
      ctx.beginPath(); ctx.ellipse(peak[0] - 3, peak[1] + 5, 16, 6, -0.1, 0, Math.PI * 2); ctx.fill();
      ctx.fillStyle = '#c4d2ea'; ctx.beginPath(); ctx.ellipse(peak[0] + 6, peak[1] + 8, 8, 3, 0, 0, Math.PI * 2); ctx.fill();
    } else {
      speckle(ctx, cx - 14, peak[1], 22, 10, ['#6f8a4a', '#8fa85a', '#56703c'], 12, rng, 1.2, 2.6);
    }
    // a talajjal találkozó perem sötétebb
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.fillRect(0, base - 4, w, 6);
    ctx.restore();
    body(); ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(outline[1][0] + 1, outline[1][1] + 1); ctx.lineTo(peak[0], peak[1] - 1); ctx.stroke();
  });

  /* --- Árnyék-ellipszis --- */
  add('shadow', 64, 24, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 2, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(0,0,0,.5)'); g.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = g; ctx.scale(1, h / w); ctx.beginPath(); ctx.arc(w / 2, w / 2, w / 2, 0, 7); ctx.fill();
  });

  /* --- Hosszúház: kőalap, erezett deszkafal, festett pajzsok, zsindelyes
         ívelt tető mohával, sárkányfejes oromdíszek, lámpások az ajtónál --- */
  add('longhouse', 260, 190, (ctx, w, h) => {
    const base = h - 18;
    contact(ctx, w / 2 + 10, base + 6, w * 0.5, 14, 0.4);
    ctx.lineJoin = 'round';
    // Fal (deszkák) és sarokoszlopok
    ctx.save();
    ctx.beginPath(); ctx.moveTo(30, base - 8); ctx.lineTo(34, base - 72); ctx.lineTo(w - 34, base - 72); ctx.lineTo(w - 30, base - 8); ctx.closePath(); ctx.clip();
    planks(ctx, 28, base - 74, w - 56, 70, { cols: ['#7a5534', '#6e4b2e', '#83593a'], step: 11 });
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(30, base - 8); ctx.lineTo(34, base - 72); ctx.lineTo(w - 34, base - 72); ctx.lineTo(w - 30, base - 8); ctx.closePath(); ctx.stroke();
    for (const x of [34, w - 40]) { planks(ctx, x - 2, base - 74, 8, 68, { cols: ['#5a3d24'], step: 8 }); ctx.strokeRect(x - 2, base - 74, 8, 68); }
    // Kőalap
    for (let x = 22; x < w - 26; x += 14 + rng() * 6) stone(ctx, x, base - 10 + rng() * 2, 14 + rng() * 6, 14);
    // Pajzsok: festett mezők, vas pajzsdudor
    const shield = (sx, sy, a, b, split) => {
      ctx.save(); ctx.translate(sx, sy);
      ctx.beginPath(); ctx.arc(0, 0, 11, 0, 7); ctx.fillStyle = a; ctx.fill();
      ctx.fillStyle = b;
      if (split === 'half') { ctx.beginPath(); ctx.arc(0, 0, 11, -Math.PI / 2, Math.PI / 2); ctx.fill(); }
      else if (split === 'quarter') { for (const q of [0, Math.PI]) { ctx.beginPath(); ctx.moveTo(0, 0); ctx.arc(0, 0, 11, q, q + Math.PI / 2); ctx.fill(); } }
      else { ctx.beginPath(); ctx.moveTo(-11, -2); ctx.lineTo(11, -2); ctx.lineTo(11, 2); ctx.lineTo(-11, 2); ctx.fill(); }
      ctx.strokeStyle = '#3a3a3a'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(0, 0, 10.5, 0, 7); ctx.stroke();
      const bg = ctx.createRadialGradient(-1, -1, 0.5, 0, 0, 4);
      bg.addColorStop(0, '#f2f4fa'); bg.addColorStop(1, '#6a7088');
      ctx.fillStyle = bg; ctx.beginPath(); ctx.arc(0, 0, 3.6, 0, 7); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.arc(0, 0, 11.5, 0, 7); ctx.stroke();
      ctx.restore();
    };
    shield(62, base - 42, '#b8392f', '#e8dcc0', 'half');
    shield(96, base - 42, '#2f5fa8', '#e8dcc0', 'quarter');
    shield(w - 96, base - 42, '#e8b84a', '#3a2a1a', 'band');
    shield(w - 62, base - 42, '#2f7a4a', '#e8dcc0', 'half');
    // Ajtó: résnyire nyitva, izzó belsővel; vas pántok; faragott szemöldökfa rúnákkal
    const dx = w / 2;
    const glowIn = ctx.createLinearGradient(0, base - 54, 0, base);
    glowIn.addColorStop(0, '#ffd890'); glowIn.addColorStop(1, '#ff7a2c');
    ctx.fillStyle = glowIn;
    ctx.beginPath(); ctx.moveTo(dx - 15, base - 8); ctx.lineTo(dx - 15, base - 42); ctx.quadraticCurveTo(dx, base - 56, dx + 15, base - 42); ctx.lineTo(dx + 15, base - 8); ctx.closePath(); ctx.fill();
    ctx.save(); ctx.clip();
    planks(ctx, dx - 15, base - 56, 18, 50, { cols: ['#5a3d24', '#4f3420'], step: 6 });
    ctx.fillStyle = '#2a2a30'; ctx.fillRect(dx - 15, base - 40, 18, 2.5); ctx.fillRect(dx - 15, base - 22, 18, 2.5);
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2;
    ctx.beginPath(); ctx.moveTo(dx - 15, base - 8); ctx.lineTo(dx - 15, base - 42); ctx.quadraticCurveTo(dx, base - 56, dx + 15, base - 42); ctx.lineTo(dx + 15, base - 8); ctx.stroke();
    planks(ctx, dx - 22, base - 64, 44, 7, { vertical: false, cols: ['#5a3d24'], step: 7 });
    ctx.strokeRect(dx - 22, base - 64, 44, 7);
    ['a', 'th', 'r', 'o', 'k'].forEach((k, i) => drawRunes(ctx, [k], dx - 18 + i * 7.5, base - 63, 5.5, 0, '#ffcf7a'));
    lantern(ctx, dx - 26, base - 50); lantern(ctx, dx + 26, base - 50);
    // Tető: csónakgerinc-ívű nyeregtető (a vége magasabb), zsindelysorok
    // a hajláshoz igazítva, mohafoltok, gerincgerenda, füstnyílás
    const ridgeY = 36, ridgeSag = 9, eaveY = base - 58, eaveLift = 10;
    const roof = () => {
      ctx.beginPath();
      ctx.moveTo(6, eaveY); ctx.lineTo(34, ridgeY);
      ctx.quadraticCurveTo(w / 2, ridgeY + ridgeSag * 2, w - 34, ridgeY);
      ctx.lineTo(w - 6, eaveY);
      ctx.quadraticCurveTo(w / 2, eaveY - eaveLift * 2, 6, eaveY); ctx.closePath();
    };
    roof();
    ctx.fillStyle = vgrad(ctx, ridgeY, eaveY, [[0, '#4a3a2c'], [1, '#2a2018']]); ctx.fill();
    ctx.save(); roof(); ctx.clip();
    const bow = (x) => 1 - ((x - w / 2) / (w / 2)) ** 2;          // 1 középen, 0 a széleken
    for (let row = 0; row < 10; row++) {
      const t = row / 9;
      for (let x = -8 + (row % 2) * 7; x < w + 8; x += 14) {
        const yy = ridgeY - 4 + (eaveY - ridgeY) * t + bow(x + 7) * (ridgeSag * (1 - t) - eaveLift * t);
        const sh = ctx.createLinearGradient(0, yy, 0, yy + 13);
        const tone = (0.8 + rng() * 0.3) * (1.1 - t * 0.25);
        sh.addColorStop(0, `rgb(${Math.round(118 * tone)},${Math.round(90 * tone)},${Math.round(60 * tone)})`); sh.addColorStop(1, `rgb(${Math.round(58 * tone)},${Math.round(42 * tone)},${Math.round(28 * tone)})`);
        ctx.fillStyle = sh; ctx.beginPath(); ctx.roundRect(x, yy, 13, 14, [0, 0, 6, 6]); ctx.fill();
        ctx.strokeStyle = 'rgba(20,12,6,.6)'; ctx.lineWidth = 0.8; ctx.stroke();
      }
    }
    // Gyepfoltok és moha a tetőn (a gerinc közelében sűrűbben)
    for (let i = 0; i < 16; i++) {
      const mx = 30 + rng() * (w - 60), my = ridgeY + 10 + rng() * (eaveY - ridgeY - 26) + bow(mx) * ridgeSag;
      ctx.fillStyle = `rgba(${84 + rng() * 30},${124 + rng() * 34},${62 + rng() * 16},.62)`;
      ctx.beginPath(); ctx.ellipse(mx, my, 6 + rng() * 11, 2.5 + rng() * 3, 0, 0, 7); ctx.fill();
      ctx.fillStyle = 'rgba(190,220,140,.35)'; ctx.beginPath(); ctx.ellipse(mx - 2, my - 1.2, 3 + rng() * 4, 1.2, 0, 0, 7); ctx.fill();
    }
    // Fény: bal felől napos, jobbra és az eresz felé sötétedik
    const sun = ctx.createLinearGradient(0, 0, w, 0);
    sun.addColorStop(0, 'rgba(255,236,200,.16)'); sun.addColorStop(0.55, 'rgba(0,0,0,0)'); sun.addColorStop(1, 'rgba(0,0,0,.22)');
    ctx.fillStyle = sun; ctx.fillRect(0, 0, w, h);
    const eave = ctx.createLinearGradient(0, eaveY - 18, 0, eaveY);
    eave.addColorStop(0, 'rgba(0,0,0,0)'); eave.addColorStop(1, 'rgba(0,0,0,.35)');
    ctx.fillStyle = eave; ctx.fillRect(0, eaveY - 18, w, 18);
    ctx.restore();
    roof(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    // Eresz alatti árnyék a falon
    ctx.save();
    ctx.beginPath(); ctx.moveTo(30, eaveY); ctx.quadraticCurveTo(w / 2, eaveY - eaveLift * 2, w - 30, eaveY); ctx.lineTo(w - 30, eaveY + 8); ctx.quadraticCurveTo(w / 2, eaveY - eaveLift * 2 + 8, 30, eaveY + 8); ctx.closePath();
    ctx.fillStyle = 'rgba(0,0,0,.28)'; ctx.fill();
    ctx.restore();
    // Gerincgerenda a tető tetején
    ctx.lineCap = 'round';
    ctx.strokeStyle = INK; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(32, ridgeY + 1); ctx.quadraticCurveTo(w / 2, ridgeY + ridgeSag * 2 + 1, w - 32, ridgeY + 1); ctx.stroke();
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 4.5; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,220,170,.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(34, ridgeY - 0.5); ctx.quadraticCurveTo(w / 2, ridgeY + ridgeSag * 2 - 0.5, w - 34, ridgeY - 0.5); ctx.stroke();
    // Füstnyílás a gerinc alatt, belül halvány parázsfény
    const sy = ridgeY + ridgeSag + 9;
    ctx.fillStyle = '#120c08'; ctx.beginPath(); ctx.ellipse(w / 2 + 6, sy, 10, 4.5, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = 'rgba(255,150,70,.4)'; ctx.beginPath(); ctx.ellipse(w / 2 + 6, sy + 1, 6, 2, 0, 0, 7); ctx.fill();
    // Faragott oromdeszkák: a tető élén futnak, a gerinc fölött keresztezik
    // egymást és sárkányfejben végződnek (vörös-arany festéssel)
    for (const [ex, tx, dir] of [[6, 34, -1], [w - 6, w - 34, 1]]) {
      const tipX = tx + dir * 20, tipY = ridgeY - 22;
      const board = () => { ctx.beginPath(); ctx.moveTo(ex, eaveY); ctx.lineTo(tx, ridgeY); ctx.quadraticCurveTo(tx + dir * 10, ridgeY - 8, tipX, tipY); };
      ctx.lineCap = 'round'; ctx.lineJoin = 'round';
      board(); ctx.strokeStyle = INK; ctx.lineWidth = 7.5; ctx.stroke();
      board(); ctx.strokeStyle = '#8a3a22'; ctx.lineWidth = 4.5; ctx.stroke();
      board(); ctx.strokeStyle = '#e8b84a'; ctx.lineWidth = 1.1; ctx.setLineDash([3, 3]); ctx.stroke(); ctx.setLineDash([]);
      ctx.save(); ctx.translate(tipX, tipY); ctx.scale(dir, 1); ctx.rotate(-0.25);
      ctx.fillStyle = '#8a3a22'; ctx.strokeStyle = INK; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(-5, 4); ctx.quadraticCurveTo(-1, -7, 11, -3); ctx.lineTo(5, 1); ctx.lineTo(11, 5); ctx.quadraticCurveTo(1, 9, -5, 4); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(-3, -2); ctx.lineTo(-8, -9); ctx.lineTo(0, -4); ctx.fill(); ctx.stroke();     // fül/szarv
      ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.arc(3, -1.5, 1.3, 0, 7); ctx.fill();
      ctx.restore();
    }
    // Hordó és tűzifa a fal mellett
    ctx.save(); ctx.translate(18, base - 4);
    ctx.fillStyle = vgrad(ctx, -18, 0, [[0, '#8a6844'], [1, '#5a3d24']]); ctx.beginPath(); ctx.roundRect(-8, -18, 16, 18, 4); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(-8, -14, 16, 2); ctx.fillRect(-8, -5, 16, 2);
    ctx.restore();
    for (let i = 0; i < 6; i++) {
      const lx = w - 34 + (i % 3) * 7, ly = base - 4 - Math.floor(i / 3) * 6;
      ctx.fillStyle = '#7a5534'; ctx.beginPath(); ctx.arc(lx, ly, 3.3, 0, 7); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1; ctx.stroke();
      ctx.fillStyle = '#c9a27e'; ctx.beginPath(); ctx.arc(lx, ly, 1.6, 0, 7); ctx.fill();
    }
  }, { after: (ctx, w, h) => {
    const base = h - 18;
    const glow = ctx.createRadialGradient(w / 2, base, 8, w / 2, base, 110);
    glow.addColorStop(0, 'rgba(255,160,70,.3)'); glow.addColorStop(1, 'rgba(255,160,70,0)');
    ctx.globalCompositeOperation = 'destination-over'; ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
  } });

  /* --- Barlang: egymásra dőlt, árnyalt sziklákból boltív, mohával és
         indákkal, kőagyarakkal, halvány rúnákkal a zárókövön --- */
  add('cave', 150, 128, (ctx, w, h) => {
    contact(ctx, w / 2 + 6, h - 6, w * 0.48, 10, 0.35);
    // Mély száj: sötét, a peremén kicsit világosabb
    const mouthPath = () => { ctx.beginPath(); ctx.moveTo(30, h); ctx.quadraticCurveTo(26, 42, w / 2, 36); ctx.quadraticCurveTo(w - 26, 42, w - 30, h); ctx.closePath(); };
    mouthPath();
    const m = ctx.createRadialGradient(w / 2, h - 18, 4, w / 2, h - 34, 66);
    m.addColorStop(0, '#000'); m.addColorStop(0.65, '#06050b'); m.addColorStop(1, '#24202e');
    ctx.fillStyle = m; ctx.fill();
    // Boltív sziklákból (hátulról előre, a nagyobbak alul)
    const rocks = [];
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (Math.PI * i) / 10;
      const rx = w / 2 + Math.cos(a) * 54, ry = 100 + Math.sin(a) * 66;
      const s = i === 5 ? 30 : 22 + rng() * 8 + (i < 2 || i > 8 ? 6 : 0);
      rocks.push([rx, ry, s]);
    }
    rocks.sort((a, b) => a[1] - b[1]);
    for (const [rx, ry, s] of rocks) stone(ctx, rx - s / 2, ry - s / 2, s, s * (0.8 + rng() * 0.3), [104, 110, 132]);
    // Zárókő rúnával
    ctx.save(); ctx.shadowColor = '#7cf6ff'; ctx.shadowBlur = 6;
    drawRunes(ctx, ['o'], w / 2 - 5, 34 - 12, 12, 0, 'rgba(160,240,255,.85)');
    ctx.restore();
    // Kőagyarak a száj peremén (árnyalt)
    const fang = (x, y, len, down) => {
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x, y + (down ? len : -len)); ctx.lineTo(x + 5, y); ctx.closePath();
      const g = ctx.createLinearGradient(x - 5, 0, x + 5, 0);
      g.addColorStop(0, '#e2e6f0'); g.addColorStop(1, '#8a90a6');
      ctx.fillStyle = g; ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    };
    for (const [x, len] of [[46, 15], [60, 10], [w / 2, 19], [w - 60, 11], [w - 46, 14]]) fang(x, 44 + (x === w / 2 ? -6 : 0), len, true);
    for (const [x, len] of [[40, 13], [w - 40, 13]]) fang(x, h, len, false);
    // Lelógó indák és moha a boltív tetején
    ctx.lineCap = 'round';
    for (let i = 0; i < 7; i++) {
      const x = 34 + rng() * (w - 68), y0 = 30 + rng() * 10, L = 10 + rng() * 22;
      ctx.strokeStyle = '#2f5a2a'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, y0); ctx.quadraticCurveTo(x + 4, y0 + L / 2, x - 1, y0 + L); ctx.stroke();
      ctx.fillStyle = '#5c8f4a'; for (let k = 4; k < L; k += 5) { ctx.beginPath(); ctx.ellipse(x + 1.5, y0 + k, 2, 1.2, 0.6, 0, 7); ctx.fill(); }
    }
    speckle(ctx, 20, 6, w - 40, 22, ['#4f7a3a', '#6f9a4a', '#3a5a2a'], 26, rng, 1.5, 3.5);
  });

  /* --- Szemek a barlang mélyén (tintázható) --- */
  add('eyes', 40, 12, (ctx) => {
    for (const x of [8, 32]) {
      const g = ctx.createRadialGradient(x, 6, 0, x, 6, 6);
      g.addColorStop(0, '#fff'); g.addColorStop(0.4, '#fff'); g.addColorStop(1, 'rgba(255,255,255,0)');
      ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(x, 6, 6, 3.5, 0, 0, 7); ctx.fill();
    }
  });

  /* --- Fészek: hátsó perem, pihés belső, elülső perem; tollak, csontok --- */
  add('nest', 96, 60, (ctx, w, h) => {
    contact(ctx, w / 2 + 4, h - 9, 44, 11, 0.4);
    const twig = (x, y, a, len, col) => {
      const dx = Math.cos(a) * len, dy = Math.sin(a) * len * 0.4;
      ctx.strokeStyle = INK; ctx.lineWidth = 3.2; ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      ctx.strokeStyle = col; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x - dx, y - dy); ctx.lineTo(x + dx, y + dy); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,230,190,.35)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.moveTo(x - dx, y - dy - 0.6); ctx.lineTo(x + dx, y + dy - 0.6); ctx.stroke();
    };
    const cols = ['#7a5534', '#9a7048', '#5a3d24', '#8a6a3e'];
    ctx.lineCap = 'round';
    for (let i = 0; i < 40; i++) {                                    // hátsó perem
      const a = Math.PI + rng() * Math.PI, r = 30 + rng() * 10;
      twig(w / 2 + Math.cos(a) * r, h - 22 + Math.sin(a) * r * 0.36, a + 1.57 + (rng() - 0.5) * 0.6, 7 + rng() * 7, cols[(rng() * 4) | 0]);
    }
    const down = ctx.createRadialGradient(w / 2, h - 24, 2, w / 2, h - 22, 30);
    down.addColorStop(0, '#fff8ea'); down.addColorStop(1, '#cdbfa4');
    ctx.fillStyle = down; ctx.beginPath(); ctx.ellipse(w / 2, h - 22, 30, 10, 0, 0, 7); ctx.fill();
    for (let i = 0; i < 4; i++) {                                     // tollak
      const x = w / 2 - 20 + rng() * 40, y = h - 26 + rng() * 6, a = -0.6 + rng() * 1.2;
      ctx.save(); ctx.translate(x, y); ctx.rotate(a);
      ctx.fillStyle = ['#e8e4d8', '#c9a27e', '#9fb3d8'][i % 3]; ctx.beginPath(); ctx.ellipse(0, 0, 6, 2, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 0.6; ctx.beginPath(); ctx.moveTo(-6, 0); ctx.lineTo(6, 0); ctx.stroke();
      ctx.restore();
    }
    for (let i = 0; i < 46; i++) {                                    // elülső perem
      const a = rng() * Math.PI, r = 31 + rng() * 11;
      twig(w / 2 + Math.cos(a) * r, h - 20 + Math.sin(a) * r * 0.36, a + 1.57 + (rng() - 0.5) * 0.6, 7 + rng() * 8, cols[(rng() * 4) | 0]);
    }
    ctx.fillStyle = '#efe6cf'; ctx.strokeStyle = INK; ctx.lineWidth = 1.2;            // egy régi csont a peremen
    ctx.beginPath(); ctx.roundRect(w - 26, h - 14, 14, 3, 1.5); ctx.fill(); ctx.stroke();
    for (const ex of [w - 26, w - 12]) { ctx.beginPath(); ctx.arc(ex, h - 13.5, 2.2, 0, 7); ctx.fill(); ctx.stroke(); }
  });

  /* --- Tojás (fehér — a Phaser tintázza a szülők színére) --- */
  add('egg', 30, 38, (ctx, w, h) => {
    ctx.fillStyle = vgrad(ctx, 0, h, [[0, '#ffffff'], [1, '#b9bccb']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 2, w / 2 - 3, h / 2 - 3, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = 'rgba(0,0,0,.18)';
    for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(8 + rng() * 14, 10 + rng() * 20, 2.5, 1.6, rng(), 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.ellipse(10, 12, 3, 6, -0.4, 0, 7); ctx.fill();
  });

  /* --- Rúnakő: mállott álló kő, faragott kígyószalag izzó rúnákkal, zuzmó --- */
  add('runestone', 44, 78, (ctx, w, h) => {
    contact(ctx, w / 2 + 4, h - 4, 20, 5, 0.4);
    const shape = () => { ctx.beginPath(); ctx.moveTo(6, h - 3); ctx.lineTo(4, 24); ctx.quadraticCurveTo(w / 2 - 2, -4, w - 4, 20); ctx.lineTo(w - 6, h - 3); ctx.closePath(); };
    shape();
    const g = ctx.createLinearGradient(0, 0, w, h);
    g.addColorStop(0, '#9aa2b8'); g.addColorStop(0.5, '#6e778f'); g.addColorStop(1, '#3a4054');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); shape(); ctx.clip();
    speckle(ctx, 0, 0, w, h, ['rgba(0,0,0,.18)', 'rgba(255,255,255,.12)'], 60, rng, 0.6, 1.6);
    // faragott kígyószalag a perem mentén
    ctx.strokeStyle = 'rgba(20,24,36,.55)'; ctx.lineWidth = 5;
    ctx.beginPath(); ctx.moveTo(11, h - 8); ctx.lineTo(10, 26); ctx.quadraticCurveTo(w / 2 - 2, 4, w - 10, 24); ctx.lineTo(w - 11, h - 8); ctx.stroke();
    ctx.strokeStyle = 'rgba(200,210,230,.35)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.moveTo(10, h - 8); ctx.lineTo(9, 26); ctx.quadraticCurveTo(w / 2 - 2, 3, w - 11, 23); ctx.stroke();
    // zuzmó és moha a tövénél
    speckle(ctx, 4, h - 22, w - 8, 18, ['#6f8a4a', '#8fa85a', '#c9c25a'], 24, rng, 1, 2.6);
    ctx.restore();
    shape(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.save(); ctx.shadowColor = '#4fffe0'; ctx.shadowBlur = 5;
    drawRunes(ctx, ['f', 'u', 'th', 'a', 'r'], w / 2 - 4, 22, 9, 12, '#7cffea');
    ctx.restore();
  });

  /* --- Gyógyfű --- */
  add('herb', 30, 30, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, 15);
    g.addColorStop(0, 'rgba(160,255,200,.45)'); g.addColorStop(1, 'rgba(160,255,200,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#2f6b3a'; ctx.lineWidth = 2;
    for (const a of [-0.5, 0, 0.5]) { ctx.beginPath(); ctx.moveTo(w / 2, h - 4); ctx.quadraticCurveTo(w / 2 + a * 10, h / 2, w / 2 + a * 14, 9); ctx.stroke(); }
    for (const [x, y] of [[w / 2 - 7, 9], [w / 2, 7], [w / 2 + 7, 9]]) {
      ctx.fillStyle = '#b58cff'; ctx.beginPath(); ctx.arc(x, y, 3.2, 0, 7); ctx.fill();
      ctx.fillStyle = '#fff3b0'; ctx.beginPath(); ctx.arc(x, y, 1.1, 0, 7); ctx.fill();
    }
  });

  /* --- Effekt-textúrák --- */
  add('fx-dot', 32, 32, (ctx) => {
    const g = ctx.createRadialGradient(16, 16, 0, 16, 16, 16);
    g.addColorStop(0, 'rgba(255,255,255,1)'); g.addColorStop(0.35, 'rgba(255,255,255,.7)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 32, 32);
  });
  add('fx-spark', 24, 6, (ctx) => {
    const g = ctx.createLinearGradient(0, 0, 24, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.7, 'rgba(255,255,255,1)'); g.addColorStop(1, 'rgba(255,255,255,.2)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(12, 3, 12, 3, 0, 0, 7); ctx.fill();
  });
  add('fx-shard', 12, 22, (ctx) => {
    ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.moveTo(6, 0); ctx.lineTo(12, 11); ctx.lineTo(6, 22); ctx.lineTo(0, 11); ctx.closePath(); ctx.fill();
  });
  add('fx-ring', 128, 128, (ctx) => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 6; ctx.shadowColor = '#fff'; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(64, 64, 54, 0, 7); ctx.stroke();
  });
  add('fx-smoke', 48, 48, (ctx) => {
    const g = ctx.createRadialGradient(24, 24, 2, 24, 24, 24);
    g.addColorStop(0, 'rgba(200,205,220,.55)'); g.addColorStop(1, 'rgba(200,205,220,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, 48, 48);
  });
  add('fx-bubble', 20, 20, (ctx) => {
    ctx.strokeStyle = '#fff'; ctx.lineWidth = 2; ctx.beginPath(); ctx.arc(10, 10, 7, 0, 7); ctx.stroke();
    ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.arc(7, 7, 2, 0, 7); ctx.fill();
  });
  // Gungnir: rúnás nyél, izzó dárdahegy (jobbra mutat)
  add('fx-spear', 220, 30, (ctx, w, h) => {
    ctx.shadowColor = '#c9f0ff'; ctx.shadowBlur = 8;
    ctx.fillStyle = '#e8f6ff';
    ctx.fillRect(8, h / 2 - 2.5, w - 52, 5);
    ctx.beginPath(); ctx.moveTo(w - 46, h / 2 - 9); ctx.lineTo(w - 2, h / 2); ctx.lineTo(w - 46, h / 2 + 9); ctx.lineTo(w - 40, h / 2); ctx.closePath(); ctx.fill();
    ctx.shadowBlur = 0;
    ctx.fillStyle = '#7ce7ff';
    for (let x = 30; x < w - 60; x += 18) { ctx.fillRect(x, h / 2 - 4, 2, 8); ctx.fillRect(x + 4, h / 2 - 1, 6, 2); }
    ctx.fillStyle = '#d9b45a'; ctx.fillRect(w - 52, h / 2 - 5, 6, 10);
  });
  // Négyágú csillag (kábulat, varázsfény)
  add('fx-star', 24, 24, (ctx) => {
    ctx.fillStyle = '#fff'; ctx.shadowColor = '#fff'; ctx.shadowBlur = 4;
    ctx.beginPath();
    for (let i = 0; i < 8; i++) {
      const r = i % 2 ? 3 : 11, a = (i * Math.PI) / 4 - Math.PI / 2;
      ctx.lineTo(12 + Math.cos(a) * r, 12 + Math.sin(a) * r);
    }
    ctx.closePath(); ctx.fill();
  });
  // Hatszöges pajzsbuborék (Pajzsfal)
  add('fx-ward', 128, 128, (ctx) => {
    const g = ctx.createRadialGradient(64, 64, 30, 64, 64, 62);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.8, 'rgba(255,255,255,.18)'); g.addColorStop(1, 'rgba(255,255,255,.6)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(64, 64, 62, 0, 7); ctx.fill();
    ctx.save(); ctx.beginPath(); ctx.arc(64, 64, 61, 0, 7); ctx.clip();
    ctx.strokeStyle = 'rgba(255,255,255,.35)'; ctx.lineWidth = 1.5;
    const r = 11, hw = r * Math.sqrt(3);
    for (let row = -1; row < 9; row++) for (let col = -1; col < 8; col++) {
      const cx = col * hw + (row % 2 ? hw / 2 : 0), cy = row * r * 1.5;
      ctx.beginPath();
      for (let k = 0; k < 6; k++) { const a = Math.PI / 6 + (k * Math.PI) / 3; ctx.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r); }
      ctx.closePath(); ctx.stroke();
    }
    ctx.restore();
    ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.arc(64, 64, 61, 0, 7); ctx.stroke();
  });
  // Rúnakör (technikák, kórus, szintlépés) — a rúnák vonalakból, mint a köveken
  add('fx-runecircle', 192, 192, (ctx) => {
    ctx.strokeStyle = '#fff'; ctx.lineCap = 'round';
    ctx.lineWidth = 3; ctx.beginPath(); ctx.arc(96, 96, 88, 0, 7); ctx.stroke();
    ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(96, 96, 70, 0, 7); ctx.stroke();
    ctx.setLineDash([4, 7]); ctx.beginPath(); ctx.arc(96, 96, 52, 0, 7); ctx.stroke(); ctx.setLineDash([]);
    const keys = Object.keys(RUNE_LINES);
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2;
      ctx.save();
      ctx.translate(96 + Math.cos(a) * 79, 96 + Math.sin(a) * 79);
      ctx.rotate(a + Math.PI / 2);
      ctx.lineWidth = 1.8;
      for (const poly of RUNE_LINES[keys[i % keys.length]]) {
        ctx.beginPath();
        poly.forEach(([px, py], j) => (j ? ctx.lineTo(px - 3, py - 5) : ctx.moveTo(px - 3, py - 5)));
        ctx.stroke();
      }
      ctx.restore();
    }
    // Hatágú csillag középen
    ctx.lineWidth = 1.5; ctx.beginPath();
    for (let i = 0; i <= 6; i++) { const a = (i * 2 * Math.PI * 2) / 6 - Math.PI / 2; ctx.lineTo(96 + Math.cos(a) * 50, 96 + Math.sin(a) * 50); }
    ctx.stroke();
  });
  // Fénysugár (a barlang mennyezetéről, a kórusnál)
  add('fx-shaft', 64, 256, (ctx, w, h) => {
    const g = ctx.createLinearGradient(0, 0, w, 0);
    g.addColorStop(0, 'rgba(255,255,255,0)'); g.addColorStop(0.5, 'rgba(255,255,255,.55)'); g.addColorStop(1, 'rgba(255,255,255,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.globalCompositeOperation = 'destination-in';
    const v = ctx.createLinearGradient(0, 0, 0, h);
    v.addColorStop(0, 'rgba(0,0,0,1)'); v.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);
  });
  // Felhőárnyék a völgy fölött
  add('fx-cloud', 256, 160, (ctx, w, h) => {
    for (const [x, y, r] of [[80, 86, 62], [140, 70, 70], [190, 92, 52], [120, 104, 56]]) {
      const g = ctx.createRadialGradient(x, y, 4, x, y, r);
      g.addColorStop(0, 'rgba(8,12,30,.55)'); g.addColorStop(1, 'rgba(8,12,30,0)');
      ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    }
  });
  // Küldetésjel: aranyló rúnapajzs felkiáltójellel
  add('fx-quest', 40, 52, (ctx, w) => {
    ctx.shadowColor = '#ffb347'; ctx.shadowBlur = 10;
    ctx.fillStyle = vgrad(ctx, 2, 46, [[0, '#fff1b8'], [1, '#ff9a3d']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 3;
    ctx.beginPath(); ctx.moveTo(w / 2, 2); ctx.lineTo(w - 4, 14); ctx.lineTo(w - 7, 32); ctx.lineTo(w / 2, 48); ctx.lineTo(7, 32); ctx.lineTo(4, 14); ctx.closePath();
    ctx.fill(); ctx.shadowBlur = 0; ctx.stroke();
    ctx.fillStyle = INK; ctx.beginPath(); ctx.roundRect(w / 2 - 3, 11, 6, 19, 3); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2, 37, 3.6, 0, 7); ctx.fill();
  });

  /* --- Gyakorlótér: cölöpkerítés, fegyverállvány, célkorong --- */
  add('training', 176, 120, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Döngölt föld a karámban
    ctx.fillStyle = 'rgba(0,0,0,.25)'; ctx.beginPath(); ctx.ellipse(w / 2, h - 22, 84, 26, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#8a6d4c'; ctx.beginPath(); ctx.ellipse(w / 2, h - 26, 78, 22, 0, 0, 7); ctx.fill();
    speckle(ctx, w / 2 - 70, h - 44, 140, 34, ['#7a5f41', '#9c7d58'], 40, rng, 0.8, 2);
    // Hátsó cölöpsor (félkör)
    const stake = (x, y, hh) => {
      ctx.fillStyle = vgrad(ctx, y - hh, y, [[0, '#9a7048'], [1, '#5a3d24']]);
      ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x - 5, y); ctx.lineTo(x - 5, y - hh + 6); ctx.lineTo(x, y - hh); ctx.lineTo(x + 5, y - hh + 6); ctx.lineTo(x + 5, y); ctx.closePath();
      ctx.fill(); ctx.stroke();
    };
    for (let i = 0; i <= 10; i++) {
      const a = Math.PI + (i / 10) * Math.PI;
      stake(w / 2 + Math.cos(a) * 80, h - 30 + Math.sin(a) * 26, 30 + (i % 2) * 6);
    }
    // Keresztgerenda
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 4;
    ctx.beginPath(); ctx.ellipse(w / 2, h - 44, 80, 26, 0, Math.PI * 1.04, Math.PI * 1.96); ctx.stroke();
    // Fegyverállvány bal oldalt
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = '#6b4a2e';
    ctx.fillRect(18, h - 62, 34, 6); ctx.strokeRect(18, h - 62, 34, 6);
    ctx.fillRect(20, h - 62, 5, 36); ctx.strokeRect(20, h - 62, 5, 36);
    ctx.fillRect(45, h - 62, 5, 36); ctx.strokeRect(45, h - 62, 5, 36);
    for (const [x, kind] of [[28, 'spear'], [36, 'axe'], [43, 'sword']]) {
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.beginPath(); ctx.moveTo(x, h - 30); ctx.lineTo(x, h - 84); ctx.stroke();
      ctx.strokeStyle = '#a07850'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, h - 30); ctx.lineTo(x, h - 84); ctx.stroke();
      ctx.fillStyle = '#c9d3ea'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
      ctx.beginPath();
      if (kind === 'spear') { ctx.moveTo(x - 3, h - 84); ctx.lineTo(x, h - 96); ctx.lineTo(x + 3, h - 84); }
      else if (kind === 'axe') { ctx.moveTo(x, h - 82); ctx.quadraticCurveTo(x + 10, h - 86, x + 9, h - 74); ctx.lineTo(x, h - 76); }
      else { ctx.moveTo(x - 2, h - 84); ctx.lineTo(x, h - 98); ctx.lineTo(x + 2, h - 84); }
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Célkorong jobb oldalt
    const tx = w - 30, ty = h - 62;
    ctx.fillStyle = '#6b4a2e'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(tx - 10, h - 26); ctx.lineTo(tx, ty); ctx.lineTo(tx + 10, h - 26); ctx.stroke();
    for (const [r, c] of [[15, '#e8dcc4'], [11, '#b8392f'], [7, '#e8dcc4'], [3.5, '#b8392f']]) {
      ctx.fillStyle = c; ctx.beginPath(); ctx.arc(tx, ty, r, 0, 7); ctx.fill(); if (r === 15) ctx.stroke();
    }
    ctx.strokeStyle = '#4a3322'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(tx - 4, ty - 2); ctx.lineTo(tx + 14, ty - 10); ctx.stroke();
  });
  // Szalmabábu-sárkány (külön kép: imbolyog)
  add('dummy', 64, 76, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round';
    ctx.fillStyle = '#5a3d24'; ctx.fillRect(w / 2 - 3, 34, 6, h - 36); ctx.strokeRect(w / 2 - 3, 34, 6, h - 36);
    // Test: szalmabála
    ctx.fillStyle = vgrad(ctx, 20, 52, [[0, '#e8cf7a'], [1, '#b8953f']]);
    ctx.beginPath(); ctx.ellipse(w / 2, 38, 20, 13, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,20,.6)'; ctx.lineWidth = 1;
    for (let i = -14; i <= 14; i += 5) { ctx.beginPath(); ctx.moveTo(w / 2 + i, 28); ctx.lineTo(w / 2 + i * 1.1, 49); ctx.stroke(); }
    // Fej: zsák, festett szemek
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5;
    ctx.fillStyle = vgrad(ctx, 6, 28, [[0, '#d9c7a1'], [1, '#a8946a']]);
    ctx.beginPath(); ctx.moveTo(w / 2 - 6, 30); ctx.quadraticCurveTo(w / 2 - 22, 22, w / 2 - 24, 14); ctx.quadraticCurveTo(w / 2 - 8, 4, w / 2 + 6, 14); ctx.quadraticCurveTo(w / 2 + 8, 24, w / 2 + 2, 30); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b8392f'; ctx.beginPath(); ctx.arc(w / 2 - 10, 14, 2.2, 0, 7); ctx.fill();
    ctx.strokeStyle = '#b8392f'; ctx.lineWidth = 1.6; ctx.beginPath(); ctx.moveTo(w / 2 - 20, 18); ctx.lineTo(w / 2 - 12, 20); ctx.stroke();
    // Szarvak: két ág
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 3; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(w / 2 - 2, 10); ctx.lineTo(w / 2 + 6, 1); ctx.moveTo(w / 2 + 3, 13); ctx.lineTo(w / 2 + 12, 6); ctx.stroke();
    // Kötél
    ctx.strokeStyle = '#7a5534'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(w / 2 - 18, 36); ctx.quadraticCurveTo(w / 2, 42, w / 2 + 18, 36); ctx.stroke();
  });
  // Lobogó a karám fölött (a Phaser lengeti)
  add('banner', 34, 46, (ctx) => {
    ctx.fillStyle = vgrad(ctx, 0, 46, [[0, '#c0392b'], [1, '#7a1f17']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(1, 2); ctx.lineTo(32, 2); ctx.lineTo(32, 44); ctx.lineTo(16, 34); ctx.lineTo(1, 44); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawRunes(ctx, ['t'], 13, 9, 14, 0, '#ffd08a');
  });

  /* --- A Völva: csuklyás alak bottal, a hosszúház ajtaja mellett --- */
  add('seer', 44, 72, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
    // Bot, izzó kővel
    ctx.strokeStyle = INK; ctx.lineWidth = 4.5; ctx.beginPath(); ctx.moveTo(34, h - 2); ctx.lineTo(37, 10); ctx.stroke();
    ctx.strokeStyle = '#8a6844'; ctx.lineWidth = 2.5; ctx.beginPath(); ctx.moveTo(34, h - 2); ctx.lineTo(37, 10); ctx.stroke();
    const g = ctx.createRadialGradient(37, 9, 0, 37, 9, 9);
    g.addColorStop(0, '#e8fffb'); g.addColorStop(0.4, '#4fffe0'); g.addColorStop(1, 'rgba(79,255,224,0)');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(37, 9, 9, 0, 7); ctx.fill();
    // Köpeny
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = vgrad(ctx, 14, h, [[0, '#2f3f78'], [1, '#18204a']]);
    ctx.beginPath(); ctx.moveTo(19, 12); ctx.quadraticCurveTo(6, 26, 5, h - 2); ctx.lineTo(33, h - 2); ctx.quadraticCurveTo(32, 26, 25, 12); ctx.closePath(); ctx.fill(); ctx.stroke();
    // Csuklya
    ctx.fillStyle = '#26336a';
    ctx.beginPath(); ctx.moveTo(22, 2); ctx.quadraticCurveTo(10, 6, 11, 22); ctx.lineTo(31, 22); ctx.quadraticCurveTo(33, 6, 22, 2); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#05070f'; ctx.beginPath(); ctx.ellipse(21.5, 15, 6, 6.5, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#9ffcf0'; ctx.fillRect(18, 14, 2, 2); ctx.fillRect(23, 14, 2, 2);
    // Arany rúnaszegély
    ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 1.4;
    ctx.beginPath(); ctx.moveTo(8, h - 8); ctx.lineTo(32, h - 8); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(22, 24); ctx.lineTo(20, h - 9); ctx.stroke();
    // Kéz a boton
    ctx.fillStyle = '#c9a27e'; ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.arc(35, 36, 3, 0, 7); ctx.fill(); ctx.stroke();
  });

  /* --- Holló (a völgy fölött átrepülő Huginn) — szárny fel/le, két képkocka --- */
  for (const [key, up] of [['raven0', true], ['raven1', false]]) add(key, 56, 36, (ctx, w, h) => {
    ctx.fillStyle = '#0d1020'; ctx.strokeStyle = '#2a3150'; ctx.lineWidth = 1.2;
    const wy = up ? 2 : h - 4;
    // Szárnyak
    for (const dir of [-1, 1]) {
      ctx.beginPath(); ctx.moveTo(w / 2, h / 2);
      ctx.quadraticCurveTo(w / 2 + dir * 12, up ? 6 : h - 6, w / 2 + dir * 27, wy);
      ctx.lineTo(w / 2 + dir * 20, h / 2 + (up ? -2 : 4));
      ctx.lineTo(w / 2 + dir * 24, h / 2 + (up ? 2 : 8) - (up ? 0 : 2));
      ctx.quadraticCurveTo(w / 2 + dir * 10, h / 2 + 4, w / 2, h / 2 + 3);
      ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Test, fej, csőr
    ctx.beginPath(); ctx.ellipse(w / 2, h / 2 + 2, 5, 9, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.arc(w / 2, h / 2 - 7, 4.2, 0, 7); ctx.fill();
    ctx.fillStyle = '#3a3f55'; ctx.beginPath(); ctx.moveTo(w / 2 - 1.5, h / 2 - 10); ctx.lineTo(w / 2, h / 2 - 16); ctx.lineTo(w / 2 + 1.5, h / 2 - 10); ctx.fill();
    ctx.fillStyle = '#0d1020'; ctx.beginPath(); ctx.moveTo(w / 2 - 4, h / 2 + 9); ctx.lineTo(w / 2, h / 2 + 16); ctx.lineTo(w / 2 + 4, h / 2 + 9); ctx.fill();
  });

  buildDecorSprites(add, rng);
  buildPlaceSprites(add, rng);
}

/* =====================================================================
   Apró díszek a völgyben (átjárhatók)
   ===================================================================== */
function buildDecorSprites(add, rng) {
  // Bokor (és havas változat)
  for (let v = 0; v < 3; v++) for (const snow of [false, true]) add(`bush${snow ? '-snow' : ''}${v}`, 44, 34, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    const blobs = [[w / 2, h - 13, 13], [w / 2 - 11, h - 10, 9], [w / 2 + 11, h - 10, 9], [w / 2 + (v - 1) * 4, h - 20, 8]];
    for (const [x, y, r] of blobs) {
      ctx.fillStyle = vgrad(ctx, y - r, y + r, snow ? [[0, '#5f8a6a'], [1, '#2f4a3a']] : [[0, ['#5f9a4a', '#6aa35a', '#4f8a5a'][v]], [1, '#2a4a2a']]);
      ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); ctx.stroke();
    }
    if (snow) { ctx.fillStyle = '#eef4fc'; for (const [x, y, r] of blobs) { ctx.beginPath(); ctx.ellipse(x - 1, y - r + 3, r * 0.7, 3, 0, 0, 7); ctx.fill(); } }
    else if (v === 2) { for (let i = 0; i < 5; i++) { ctx.fillStyle = '#e04a4a'; ctx.beginPath(); ctx.arc(8 + rng() * (w - 16), h - 22 + rng() * 14, 2, 0, 7); ctx.fill(); } }
    else speckle(ctx, 6, h - 28, w - 12, 20, ['rgba(200,255,170,.35)'], 6, rng, 1, 2);
  });
  // Fűcsomó
  for (let v = 0; v < 3; v++) add(`tuft${v}`, 28, 20, (ctx, w, h) => {
    blades(ctx, 4, h - 2, w - 8, 2, '#2c5236', 9, rng, 12);
    blades(ctx, 6, h - 2, w - 12, 2, ['#7fb06a', '#8fbf6a', '#6aa35a'][v], 6, rng, 10);
  });
  // Páfrány
  for (let v = 0; v < 3; v++) add(`fern${v}`, 40, 30, (ctx, w, h) => {
    ctx.strokeStyle = '#2f6b3a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    for (let f = -2; f <= 2; f++) {
      const a = -Math.PI / 2 + f * 0.45;
      const ex = w / 2 + Math.cos(a) * 18, ey = h - 2 + Math.sin(a) * 22;
      ctx.beginPath(); ctx.moveTo(w / 2, h - 2); ctx.quadraticCurveTo(w / 2 + f * 3, h - 14, ex, ey); ctx.stroke();
      ctx.strokeStyle = '#4f9a4a'; ctx.lineWidth = 1.2;
      for (let k = 0.3; k < 1; k += 0.15) {
        const px = w / 2 + (ex - w / 2) * k, py = h - 2 + (ey - h + 2) * k;
        ctx.beginPath(); ctx.moveTo(px, py); ctx.lineTo(px + 4, py - 2); ctx.moveTo(px, py); ctx.lineTo(px - 4, py - 2); ctx.stroke();
      }
      ctx.strokeStyle = '#2f6b3a'; ctx.lineWidth = 2;
    }
  });
  // Galóca-csoport
  for (let v = 0; v < 3; v++) add(`mushroom${v}`, 32, 26, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
    const caps = [[w / 2 - 6, h - 4, 7], [w / 2 + 6, h - 3, 5], [w / 2 + 1, h - 2, 4]].slice(0, 2 + (v % 2));
    for (const [x, y, r] of caps) {
      ctx.fillStyle = '#e8dcc4'; ctx.fillRect(x - 1.5, y - r - 2, 3, r + 2); ctx.strokeRect(x - 1.5, y - r - 2, 3, r + 2);
      ctx.fillStyle = v === 2 ? '#c9a24a' : '#d23a2a';
      ctx.beginPath(); ctx.ellipse(x, y - r - 2, r, r * 0.65, 0, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#fff'; for (let i = 0; i < 3; i++) { ctx.beginPath(); ctx.arc(x - r * 0.5 + i * r * 0.5, y - r - 4 - (i % 2), 1.1, 0, 7); ctx.fill(); }
    }
  });
  // Nád a vízparton
  for (let v = 0; v < 3; v++) add(`reeds${v}`, 30, 40, (ctx, w, h) => {
    ctx.lineCap = 'round';
    for (let i = 0; i < 6; i++) {
      const x = 5 + i * 4 + rng() * 2, top = 8 + rng() * 12;
      ctx.strokeStyle = '#3f6c3a'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, h - 2); ctx.quadraticCurveTo(x + (rng() - 0.5) * 6, (h + top) / 2, x + (rng() - 0.5) * 4, top); ctx.stroke();
      if (i % 2 === v % 2) { ctx.fillStyle = '#6b4a2e'; ctx.beginPath(); ctx.ellipse(x, top + 4, 2, 5, 0, 0, 7); ctx.fill(); }
    }
  });
  // Tönk
  for (let v = 0; v < 3; v++) add(`stump${v}`, 34, 28, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = vgrad(ctx, 8, h, [[0, '#7a5534'], [1, '#4a3322']]);
    ctx.beginPath(); ctx.moveTo(6, h - 3); ctx.lineTo(8, 10); ctx.lineTo(w - 8, 10); ctx.lineTo(w - 6, h - 3); ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#c9a27e'; ctx.beginPath(); ctx.ellipse(w / 2, 10, w / 2 - 8, 5, 0, 0, 7); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.lineWidth = 1;
    for (const r of [2, 5, 8]) { ctx.beginPath(); ctx.ellipse(w / 2, 10, r, r * 0.4, 0, 0, 7); ctx.stroke(); }
    if (v === 1) { ctx.fillStyle = '#d23a2a'; ctx.beginPath(); ctx.ellipse(w - 8, h - 8, 4, 2.5, 0, Math.PI, 0); ctx.fill(); }
    if (v === 2) { ctx.fillStyle = '#4f8a5a'; speckle(ctx, 8, 12, w - 16, 8, ['#4f8a5a', '#6aa35a'], 8, rng, 1, 2); }
  });
  // Kavicsok
  for (let v = 0; v < 3; v++) add(`pebbles${v}`, 30, 16, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.2;
    for (let i = 0; i < 3 + v; i++) {
      const x = 5 + rng() * (w - 10), y = h - 4 - rng() * 6, r = 2 + rng() * 3;
      ctx.fillStyle = ['#8a90a6', '#6f7690', '#a0a6ba'][i % 3];
      ctx.beginPath(); ctx.ellipse(x, y, r * 1.3, r, 0, 0, 7); ctx.fill(); ctx.stroke();
    }
  });
  // Csontok a hamuban
  for (let v = 0; v < 3; v++) add(`bones${v}`, 44, 26, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.fillStyle = '#d9d0bd';
    if (v === 0) {
      // Bordakosár
      for (let i = 0; i < 4; i++) { ctx.beginPath(); ctx.ellipse(12 + i * 7, h - 6, 3, 9, 0, Math.PI, 0); ctx.lineWidth = 3; ctx.strokeStyle = INK; ctx.stroke(); ctx.lineWidth = 1.6; ctx.strokeStyle = '#d9d0bd'; ctx.stroke(); }
      ctx.fillRect(8, h - 7, 30, 3);
    } else {
      // Koponya
      ctx.beginPath(); ctx.ellipse(w / 2, h - 10, 11, 8, 0, 0, 7); ctx.fill(); ctx.stroke();
      ctx.beginPath(); ctx.moveTo(w / 2 + 6, h - 6); ctx.lineTo(w / 2 + 18, h - 4); ctx.lineTo(w / 2 + 6, h - 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#2a2326'; ctx.beginPath(); ctx.arc(w / 2 + 2, h - 12, 2.5, 0, 7); ctx.fill();
      if (v === 2) { ctx.strokeStyle = '#d9d0bd'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w / 2 - 8, h - 16); ctx.quadraticCurveTo(w / 2 - 14, h - 26, w / 2 - 4, h - 24); ctx.stroke(); }
    }
  });
  // Izzó repedés (lávanyílás) — a völgy pulzáló fényt tesz rá
  for (let v = 0; v < 3; v++) add(`vent${v}`, 40, 22, (ctx, w, h) => {
    const g = ctx.createRadialGradient(w / 2, h / 2, 1, w / 2, h / 2, w / 2);
    g.addColorStop(0, 'rgba(255,140,60,.55)'); g.addColorStop(1, 'rgba(255,90,30,0)');
    ctx.fillStyle = g; ctx.fillRect(0, 0, w, h);
    ctx.strokeStyle = '#ffb35a'; ctx.lineWidth = 2; ctx.lineCap = 'round';
    ctx.beginPath(); ctx.moveTo(6, h / 2 + 2);
    for (let i = 1; i <= 5; i++) ctx.lineTo(6 + i * (w - 12) / 5, h / 2 + (rng() - 0.5) * 8);
    ctx.stroke();
    ctx.strokeStyle = '#fff3c4'; ctx.lineWidth = 0.8; ctx.stroke();
  });
  // Jégkristály
  for (let v = 0; v < 3; v++) add(`crystal${v}`, 30, 40, (ctx, w, h) => {
    ctx.strokeStyle = '#3a5a7a'; ctx.lineWidth = 1.5;
    const spikes = [[w / 2, h - 2, 7, 30], [w / 2 - 8, h - 2, 5, 18], [w / 2 + 8, h - 2, 5, 22]];
    for (const [x, y, hw, hh] of spikes) {
      ctx.fillStyle = vgrad(ctx, y - hh, y, [[0, '#e8fffb'], [1, '#6fb8e0']]);
      ctx.beginPath(); ctx.moveTo(x - hw, y); ctx.lineTo(x - hw * 0.6, y - hh * 0.7); ctx.lineTo(x, y - hh); ctx.lineTo(x + hw * 0.6, y - hh * 0.7); ctx.lineTo(x + hw, y); ctx.closePath(); ctx.fill(); ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.8)'; ctx.beginPath(); ctx.moveTo(x - 1, y - 3); ctx.lineTo(x - 1, y - hh + 4); ctx.stroke(); ctx.strokeStyle = '#3a5a7a';
    }
  });
}

/* =====================================================================
   A völgy helyei: tanítók, emberek, ládák, kőkör, hajó
   ===================================================================== */
/** Egész alakos emberke (40×64): köpeny, fej, fejfedő, kellék. */
function figure(ctx, w, h, o) {
  ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.lineJoin = 'round';
  const cx = w / 2;
  // Köpeny
  ctx.fillStyle = vgrad(ctx, 22, h, [[0, o.robe], [1, o.robe2 || o.robe]]);
  ctx.beginPath(); ctx.moveTo(cx - 6, 24); ctx.quadraticCurveTo(cx - 15, 40, cx - 14, h - 2); ctx.lineTo(cx + 14, h - 2); ctx.quadraticCurveTo(cx + 15, 40, cx + 6, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
  if (o.belt) { ctx.fillStyle = o.belt; ctx.fillRect(cx - 12, 42, 24, 3); }
  // Fej
  ctx.fillStyle = o.skin || '#d9a37e';
  ctx.beginPath(); ctx.arc(cx, 17, 8, 0, 7); ctx.fill(); ctx.stroke();
  if (o.beard) { ctx.fillStyle = o.beard; ctx.beginPath(); ctx.moveTo(cx - 7, 18); ctx.quadraticCurveTo(cx, 34 + (o.beardLen || 0), cx + 7, 18); ctx.quadraticCurveTo(cx, 23, cx - 7, 18); ctx.fill(); ctx.stroke(); }
  ctx.fillStyle = INK; ctx.fillRect(cx - 4, 16, 2, 2); ctx.fillRect(cx + 2, 16, 2, 2);
  if (o.patch) { ctx.fillStyle = INK; ctx.fillRect(cx + 1, 14, 5, 4); }
  // Fejfedő
  ctx.fillStyle = o.hatColor || '#3a3f55';
  switch (o.hat) {
    case 'hood': ctx.beginPath(); ctx.moveTo(cx, 4); ctx.quadraticCurveTo(cx - 13, 8, cx - 10, 26); ctx.lineTo(cx - 6, 24); ctx.quadraticCurveTo(cx - 7, 12, cx, 10); ctx.quadraticCurveTo(cx + 7, 12, cx + 6, 24); ctx.lineTo(cx + 10, 26); ctx.quadraticCurveTo(cx + 13, 8, cx, 4); ctx.fill(); ctx.stroke(); break;
    case 'helmet': ctx.beginPath(); ctx.arc(cx, 15, 9, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); ctx.fillRect(cx - 1, 14, 2, 6); break;
    case 'wide': ctx.beginPath(); ctx.ellipse(cx, 11, 15, 3.5, 0, 0, 7); ctx.fill(); ctx.stroke(); ctx.beginPath(); ctx.moveTo(cx - 7, 10); ctx.quadraticCurveTo(cx - 4, -2, cx + 4, 1); ctx.quadraticCurveTo(cx + 8, 4, cx + 7, 10); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'beanie': ctx.beginPath(); ctx.arc(cx, 14, 8.5, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke(); break;
    case 'scarf': ctx.beginPath(); ctx.arc(cx, 16, 10, Math.PI * 1.05, -0.05); ctx.quadraticCurveTo(cx + 9, 24, cx + 6, 26); ctx.lineTo(cx - 6, 26); ctx.quadraticCurveTo(cx - 9, 24, cx - 10, 15); ctx.fill(); ctx.stroke(); break;
    default: ctx.fillStyle = o.hair || '#d9a03a'; ctx.beginPath(); ctx.arc(cx, 14, 8.5, Math.PI, 0); ctx.closePath(); ctx.fill(); ctx.stroke();
  }
  o.extra?.(ctx, cx, h);
}

function buildPlaceSprites(add, rng) {
  const { contact, planks, stone } = materials(rng);
  // --- Emberek ---
  add('npc-fisher', 48, 64, (ctx, w, h) => figure(ctx, w, h, {
    robe: '#3a5a7a', robe2: '#22344a', beard: '#6b4a2e', hat: 'beanie', hatColor: '#b8392f', belt: '#6b4a2e',
    extra: (c) => { c.strokeStyle = '#6b4a2e'; c.lineWidth = 2.5; c.beginPath(); c.moveTo(w / 2 + 8, 40); c.lineTo(w - 2, 4); c.stroke(); c.strokeStyle = 'rgba(255,255,255,.7)'; c.lineWidth = 0.8; c.beginPath(); c.moveTo(w - 2, 4); c.lineTo(w - 1, 30); c.stroke(); },
  }));
  add('npc-merchant', 44, 64, (ctx, w, h) => figure(ctx, w, h, {
    robe: '#6a2a5a', robe2: '#3a1430', hat: 'scarf', hatColor: '#2f6fb8', belt: '#ffd36b', skin: '#e6b48f',
    extra: (c) => { c.fillStyle = '#ffd36b'; c.beginPath(); c.arc(w / 2 + 12, 44, 5, 0, 7); c.fill(); c.strokeStyle = INK; c.lineWidth = 1.5; c.stroke(); },
  }));
  add('npc-skald', 44, 64, (ctx, w, h) => figure(ctx, w, h, {
    robe: '#5a3a8a', robe2: '#2e1f4a', hat: 'none', hair: '#d9a03a', beard: '#d9a03a', beardLen: -8,
    extra: (c) => { c.strokeStyle = '#d9b45a'; c.lineWidth = 2; c.beginPath(); c.moveTo(w / 2 - 14, 46); c.quadraticCurveTo(w / 2 - 18, 32, w / 2 - 10, 30); c.moveTo(w / 2 - 6, 46); c.quadraticCurveTo(w / 2 - 2, 32, w / 2 - 10, 30); c.stroke(); },
  }));
  add('npc-wanderer', 48, 70, (ctx, w, h) => figure(ctx, w, h, {
    robe: '#3a4560', robe2: '#1c2236', hat: 'wide', hatColor: '#2a2f45', beard: '#c9ccd6', beardLen: 8, patch: true, skin: '#c9a284',
    extra: (c) => {
      c.strokeStyle = INK; c.lineWidth = 4; c.beginPath(); c.moveTo(w / 2 + 13, h - 2); c.lineTo(w / 2 + 16, 2); c.stroke();
      c.strokeStyle = '#8a6844'; c.lineWidth = 2; c.stroke();
      c.fillStyle = '#c9d3ea'; c.beginPath(); c.moveTo(w / 2 + 14, 4); c.lineTo(w / 2 + 16, -6); c.lineTo(w / 2 + 18, 4); c.fill();
    },
  }));

  add('hut', 120, 104, (ctx, w, h) => {
    contact(ctx, w / 2 + 6, h - 6, w * 0.46, 9, 0.4);
    ctx.lineJoin = 'round';
    // Gerendafal: vízszintes rönkök kerek végekkel
    for (let y = 50, i = 0; y < h - 8; y += 9, i++) {
      const g = ctx.createLinearGradient(0, y, 0, y + 9);
      g.addColorStop(0, '#8a6440'); g.addColorStop(0.5, '#6b4a2e'); g.addColorStop(1, '#3f2a18');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(16 - (i % 2) * 2, y, w - 32 + (i % 2) * 4, 9, 4.5); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      for (const ex of [16 - (i % 2) * 2, w - 16 + (i % 2) * 2]) {
        ctx.fillStyle = '#c9a27e'; ctx.beginPath(); ctx.arc(ex, y + 4.5, 4, 0, 7); ctx.fill(); ctx.stroke();
        ctx.strokeStyle = 'rgba(90,60,30,.6)'; ctx.lineWidth = 0.7; ctx.beginPath(); ctx.arc(ex, y + 4.5, 2, 0, 7); ctx.stroke();
      }
    }
    // Ajtó (meleg fény) és ablak spalettákkal
    const lit = vgrad(ctx, 62, h - 8, [[0, '#ffd890'], [1, '#ff8a3d']]);
    ctx.fillStyle = lit; ctx.beginPath(); ctx.roundRect(w / 2 - 11, 62, 22, h - 70, [10, 10, 0, 0]); ctx.fill();
    ctx.save(); ctx.clip(); planks(ctx, w / 2 - 11, 62, 12, h - 70, { cols: ['#5a3d24', '#4f3420'], step: 6 }); ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.beginPath(); ctx.roundRect(w / 2 - 11, 62, 22, h - 70, [10, 10, 0, 0]); ctx.stroke();
    ctx.fillStyle = lit; ctx.fillRect(w - 42, 58, 16, 13); ctx.strokeRect(w - 42, 58, 16, 13);
    ctx.fillStyle = INK; ctx.fillRect(w - 34.5, 58, 1.5, 13); ctx.fillRect(w - 42, 64, 16, 1.5);
    planks(ctx, w - 48, 57, 6, 15, { cols: ['#3f6a8a'], step: 6 }); planks(ctx, w - 26, 57, 6, 15, { cols: ['#3f6a8a'], step: 6 });
    // Kémény kövekből
    for (let y = 10; y < 40; y += 6) for (let x = w - 38; x < w - 24; x += 7) stone(ctx, x + ((y / 6) % 2) * 2, y, 7, 6, [110, 112, 126]);
    // Gyeptető: vastag, domború, fűvel és virágokkal
    const roof = () => { ctx.beginPath(); ctx.moveTo(4, 56); ctx.quadraticCurveTo(w / 2, -8, w - 4, 56); ctx.quadraticCurveTo(w / 2, 46, 4, 56); ctx.closePath(); };
    roof();
    ctx.fillStyle = vgrad(ctx, 8, 56, [[0, '#7ab65e'], [0.6, '#4a7d3a'], [1, '#2a4a24']]); ctx.fill();
    ctx.save(); roof(); ctx.clip();
    speckle(ctx, 4, 8, w - 8, 48, ['#9fd07a', '#5f9a48', '#3f6a30'], 90, rng, 1, 2.4);
    blades(ctx, 8, 14, w - 16, 40, '#a8d880', 40, rng, 6);
    for (let i = 0; i < 8; i++) { ctx.fillStyle = ['#f2e27a', '#f6f6f6', '#ff9ab8'][i % 3]; ctx.beginPath(); ctx.arc(14 + rng() * (w - 28), 20 + rng() * 26, 1.6, 0, 7); ctx.fill(); }
    ctx.fillStyle = 'rgba(60,40,20,.55)'; ctx.fillRect(0, 50, w, 8);                      // a gyep alatti földréteg
    ctx.restore();
    roof(); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
    // Gyógynövény-csokrok az eresz alatt, gombák a fal tövében
    for (const x of [24, 34, w - 52]) {
      ctx.strokeStyle = '#4a7a3a'; ctx.lineWidth = 1.5; ctx.beginPath(); ctx.moveTo(x, 54); ctx.lineTo(x, 64); ctx.stroke();
      ctx.fillStyle = '#b58cff'; ctx.beginPath(); ctx.arc(x, 65, 3, 0, 7); ctx.fill();
      ctx.fillStyle = '#6fbf5a'; ctx.beginPath(); ctx.ellipse(x - 2, 62, 2.5, 1.2, -0.5, 0, 7); ctx.fill();
    }
    for (const [x, r] of [[10, 5], [w - 10, 4], [w - 17, 3]]) {
      ctx.fillStyle = '#efe6cf'; ctx.fillRect(x - 1, h - 11, 2, 7);
      const cap = ctx.createRadialGradient(x - r * 0.3, h - 12, 0.5, x, h - 11, r);
      cap.addColorStop(0, '#ff6a50'); cap.addColorStop(1, '#a8231a');
      ctx.fillStyle = cap; ctx.beginPath(); ctx.ellipse(x, h - 11, r, r * 0.7, 0, Math.PI, 0); ctx.fill();
      ctx.fillStyle = '#fff'; ctx.beginPath(); ctx.arc(x - r * 0.3, h - 12.5, 0.8, 0, 7); ctx.fill();
    }
  });

  // --- Brokk kovácsműhelye: faragott kőfal, palatető, kohó, üllő, szerszámok ---
  add('forge', 128, 108, (ctx, w, h) => {
    contact(ctx, w / 2 + 6, h - 5, w * 0.48, 9, 0.4);
    ctx.lineJoin = 'round';
    // Kőfal faragott tömbökből
    ctx.fillStyle = '#3a3f52'; ctx.fillRect(14, 40, w - 28, h - 46);
    for (let y = 40, row = 0; y < h - 8; y += 11, row++) {
      for (let x = 14 + (row % 2 ? -8 : 0); x < w - 14; x += 18) {
        const x0 = Math.max(14, x), x1 = Math.min(w - 14, x + 17);
        if (x1 - x0 > 3) stone(ctx, x0, y, x1 - x0, 10, [124, 130, 150]);
      }
    }
    ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.strokeRect(14, 40, w - 28, h - 46);
    // Kémény parázsfénnyel
    for (let y = 2; y < 34; y += 7) for (let x = w - 42; x < w - 26; x += 8) stone(ctx, x + ((y / 7) % 2) * 2, y, 8, 7, [104, 108, 124]);
    ctx.fillStyle = 'rgba(255,140,60,.55)'; ctx.beginPath(); ctx.ellipse(w - 34, 3, 6, 2, 0, 0, 7); ctx.fill();
    // Palatető: soronként eltolt lapok
    const roof = () => { ctx.beginPath(); ctx.moveTo(4, 46); ctx.lineTo(w / 2, 8); ctx.lineTo(w - 4, 46); ctx.closePath(); };
    roof(); ctx.fillStyle = '#2a2b3e'; ctx.fill();
    ctx.save(); roof(); ctx.clip();
    for (let y = 8, row = 0; y < 48; y += 6, row++) for (let x = (row % 2) * 5; x < w; x += 10) {
      const t = 0.8 + rng() * 0.35;
      ctx.fillStyle = `rgb(${Math.round(70 * t)},${Math.round(72 * t)},${Math.round(98 * t)})`; ctx.beginPath(); ctx.roundRect(x, y, 9.5, 7, [0, 0, 3, 3]); ctx.fill();
      ctx.strokeStyle = 'rgba(10,10,20,.6)'; ctx.lineWidth = 0.7; ctx.stroke();
    }
    ctx.restore();
    roof(); ctx.strokeStyle = INK; ctx.lineWidth = 2.2; ctx.stroke();
    // Kohó: izzó száj, kőkeret
    const g = ctx.createRadialGradient(42, h - 24, 2, 42, h - 24, 18);
    g.addColorStop(0, '#fff3c4'); g.addColorStop(0.4, '#ff8a3d'); g.addColorStop(1, '#5a1a0a');
    ctx.fillStyle = g; ctx.beginPath(); ctx.arc(42, h - 24, 14, Math.PI, 0); ctx.lineTo(56, h - 8); ctx.lineTo(28, h - 8); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    for (let i = 0; i < 7; i++) { const a = Math.PI + (i / 6) * Math.PI; stone(ctx, 42 + Math.cos(a) * 17 - 4, h - 24 + Math.sin(a) * 17 - 4, 8, 8, [96, 98, 112]); }
    // Üllő acélfénnyel, kalapács
    const anvil = () => { ctx.beginPath(); ctx.moveTo(w - 62, h - 30); ctx.lineTo(w - 20, h - 30); ctx.lineTo(w - 30, h - 22); ctx.lineTo(w - 36, h - 22); ctx.lineTo(w - 34, h - 8); ctx.lineTo(w - 50, h - 8); ctx.lineTo(w - 48, h - 22); ctx.lineTo(w - 54, h - 22); ctx.closePath(); };
    anvil(); ctx.fillStyle = vgrad(ctx, h - 30, h - 8, [[0, '#6a7088'], [1, '#22263a']]); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.55)'; ctx.lineWidth = 1.2; ctx.beginPath(); ctx.moveTo(w - 60, h - 29); ctx.lineTo(w - 22, h - 29); ctx.stroke();
    ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 3; ctx.beginPath(); ctx.moveTo(w - 44, h - 31); ctx.lineTo(w - 30, h - 44); ctx.stroke();
    ctx.fillStyle = '#8a90a6'; ctx.fillRect(w - 35, h - 51, 11, 7); ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.strokeRect(w - 35, h - 51, 11, 7);
    // Vízes hordó, szerszámok a falon
    ctx.fillStyle = vgrad(ctx, h - 22, h - 6, [[0, '#8a6844'], [1, '#4f3420']]); ctx.beginPath(); ctx.roundRect(w - 20, h - 22, 13, 16, 3); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
    ctx.fillStyle = '#3f8fb8'; ctx.beginPath(); ctx.ellipse(w - 13.5, h - 21, 5, 1.6, 0, 0, 7); ctx.fill();
    for (const [x, len] of [[70, 18], [78, 14]]) { ctx.strokeStyle = '#5a3d24'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(x, 50); ctx.lineTo(x, 50 + len); ctx.stroke(); ctx.fillStyle = '#9aa0b6'; ctx.fillRect(x - 3, 48, 6, 4); }
    drawRunes(ctx, ['th'], w / 2 - 3, 18, 12, 0, '#ffb35a');
  });

  /* --- A Fagyóriás trónja: csiszolt jégkristályokból nőtt szék. Minden
         kristálynak napos és árnyékos lapja van; zúzmarás hókupac a talpánál,
         jégcsapok az ülés peremén, a támlán derengő rúna --- */
  add('throne', 120, 128, (ctx, w, h) => {
    contact(ctx, w / 2 + 6, h - 7, w * 0.46, 9, 0.35);
    ctx.lineJoin = 'round';
    const crystal = (x, y, cw, ch, lean = 0) => {
      const tipX = x + lean, tipY = y - ch, mid = x + cw * 0.08 + lean * 0.5;
      const sh = y - ch + cw * 0.85;
      const lx = x - cw / 2 + lean * 0.6, rx = x + cw / 2 + lean * 0.6;
      ctx.beginPath(); ctx.moveTo(x - cw / 2, y); ctx.lineTo(lx, sh); ctx.lineTo(tipX, tipY); ctx.lineTo(mid, sh + 3); ctx.lineTo(mid, y); ctx.closePath();
      ctx.fillStyle = vgrad(ctx, tipY, y, [[0, '#f6fffe'], [0.45, '#bfeaf8'], [1, '#6aa6cc']]); ctx.fill();
      ctx.beginPath(); ctx.moveTo(mid, y); ctx.lineTo(mid, sh + 3); ctx.lineTo(tipX, tipY); ctx.lineTo(rx, sh); ctx.lineTo(x + cw / 2, y); ctx.closePath();
      ctx.fillStyle = vgrad(ctx, tipY, y, [[0, '#9fd6ef'], [0.55, '#5a96c4'], [1, '#2c5986']]); ctx.fill();
      // belső repedések
      ctx.strokeStyle = 'rgba(255,255,255,.45)'; ctx.lineWidth = 0.8;
      for (let k = 0; k < 2; k++) {
        const cy = sh + (y - sh) * (0.25 + rng() * 0.5);
        ctx.beginPath(); ctx.moveTo(mid + (rng() - 0.5) * cw * 0.6, cy); ctx.lineTo(mid + (rng() - 0.5) * cw * 0.8, cy + 6 + rng() * 8); ctx.stroke();
      }
      ctx.beginPath(); ctx.moveTo(x - cw / 2, y); ctx.lineTo(lx, sh); ctx.lineTo(tipX, tipY); ctx.lineTo(rx, sh); ctx.lineTo(x + cw / 2, y);
      ctx.strokeStyle = '#1d3a5a'; ctx.lineWidth = 2; ctx.stroke();
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1.2;
      ctx.beginPath(); ctx.moveTo(tipX, tipY + 3); ctx.lineTo(mid, sh + 4); ctx.lineTo(mid, y - 3); ctx.stroke();
    };
    // Támla: kifelé dőlő kristálykoszorú, a közepén a legmagasabb
    for (const [x, cw, ch, lean] of [[24, 14, 46, -8], [96, 14, 50, 8], [38, 18, 72, -4], [82, 18, 68, 4], [60, 24, 84, 0]]) crystal(x, h - 40, cw, ch, lean);
    // Derengő rúna a középső kristályon
    const rg = ctx.createRadialGradient(w / 2, 56, 2, w / 2, 56, 18);
    rg.addColorStop(0, 'rgba(200,255,255,.7)'); rg.addColorStop(1, 'rgba(160,230,255,0)');
    ctx.fillStyle = rg; ctx.fillRect(w / 2 - 18, 38, 36, 36);
    drawRunes(ctx, ['th'], w / 2 - 3, 47, 18, 0, '#e8ffff');
    // Ülés: felső lap (világos) + elülső lap, csiszolt éllel
    ctx.beginPath(); ctx.moveTo(20, h - 44); ctx.lineTo(100, h - 44); ctx.lineTo(94, h - 36); ctx.lineTo(26, h - 36); ctx.closePath();
    ctx.fillStyle = vgrad(ctx, h - 44, h - 36, [[0, '#f4fffe'], [1, '#bfe6f6']]); ctx.fill();
    ctx.strokeStyle = '#1d3a5a'; ctx.lineWidth = 2; ctx.stroke();
    ctx.beginPath(); ctx.moveTo(26, h - 36); ctx.lineTo(94, h - 36); ctx.lineTo(92, h - 14); ctx.lineTo(28, h - 14); ctx.closePath();
    const front = ctx.createLinearGradient(26, 0, 94, 0);
    front.addColorStop(0, '#9fd6ef'); front.addColorStop(0.5, '#6aa6cc'); front.addColorStop(1, '#2f5f8e');
    ctx.fillStyle = front; ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(255,255,255,.4)'; ctx.lineWidth = 1;
    for (const x of [44, 60, 76]) { ctx.beginPath(); ctx.moveTo(x, h - 35); ctx.lineTo(x + (rng() - 0.5) * 6, h - 16); ctx.stroke(); }
    // Jégcsapok az ülés peremén
    ctx.fillStyle = '#d8f4fc'; ctx.strokeStyle = '#1d3a5a'; ctx.lineWidth = 1;
    for (let x = 30; x < 92; x += 6 + rng() * 5) {
      const len = 4 + rng() * 7;
      ctx.beginPath(); ctx.moveTo(x - 2, h - 15); ctx.lineTo(x, h - 15 + len); ctx.lineTo(x + 2, h - 15); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    // Karfák: zömök kristályok
    crystal(14, h - 12, 18, 52, -3);
    crystal(106, h - 12, 18, 52, 3);
    // Zúzmarás hókupac a talpnál
    const snow = () => { ctx.beginPath(); ctx.moveTo(4, h - 4); ctx.quadraticCurveTo(10, h - 18, 26, h - 14); ctx.quadraticCurveTo(44, h - 20, 60, h - 13); ctx.quadraticCurveTo(80, h - 19, 96, h - 13); ctx.quadraticCurveTo(112, h - 17, w - 4, h - 4); ctx.closePath(); };
    snow(); ctx.fillStyle = vgrad(ctx, h - 20, h - 4, [[0, '#ffffff'], [1, '#b8c8e0']]); ctx.fill();
    ctx.strokeStyle = 'rgba(40,60,90,.7)'; ctx.lineWidth = 1.4; ctx.stroke();
    // Csillámok
    for (let i = 0; i < 9; i++) {
      const x = 10 + rng() * (w - 20), y = 8 + rng() * (h - 30), r = 1.5 + rng() * 2.5;
      ctx.strokeStyle = 'rgba(255,255,255,.9)'; ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x - r, y); ctx.lineTo(x + r, y); ctx.moveTo(x, y - r); ctx.lineTo(x, y + r); ctx.stroke();
    }
  });

  /* --- Muspell-oltár: bazaltlépcsőn álló fekete kőtömb faragott
         kerettel, izzó láva-erekkel és rúnával, a tetején vas parázstál
         szarvakkal (a lángot a Phaser adja) --- */
  add('altar', 104, 84, (ctx, w, h) => {
    ctx.lineJoin = 'round';
    const glow = ctx.createRadialGradient(w / 2, 30, 4, w / 2, 30, 62);
    glow.addColorStop(0, 'rgba(255,120,40,.42)'); glow.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    contact(ctx, w / 2 + 4, h - 5, w * 0.46, 7, 0.45);
    // Bazaltlépcső: két sor faragott kő
    for (let x = 6; x < w - 14;) { const sw = Math.min(13 + rng() * 5, w - 6 - x); stone(ctx, x, h - 15, sw, 12, [62, 54, 58]); x += sw - 1; }
    for (let x = 14; x < w - 22;) { const sw = Math.min(12 + rng() * 5, w - 14 - x); stone(ctx, x, h - 25, sw, 11, [70, 60, 64]); x += sw - 1; }
    // Oltárkő: balról napos, jobbra sötétedő tömb
    const block = () => { ctx.beginPath(); ctx.moveTo(24, h - 24); ctx.lineTo(28, 36); ctx.lineTo(w - 28, 36); ctx.lineTo(w - 24, h - 24); ctx.closePath(); };
    block();
    const bg = ctx.createLinearGradient(24, 0, w - 24, 0);
    bg.addColorStop(0, '#5a4c50'); bg.addColorStop(0.45, '#3a3033'); bg.addColorStop(1, '#1a1517');
    ctx.fillStyle = bg; ctx.fill();
    ctx.save(); block(); ctx.clip();
    speckle(ctx, 24, 36, w - 48, h - 60, ['rgba(0,0,0,.35)', 'rgba(255,220,200,.08)'], 40, rng, 0.6, 1.6);
    // Faragott keret
    ctx.strokeStyle = 'rgba(0,0,0,.55)'; ctx.lineWidth = 2; ctx.strokeRect(33, 41, w - 66, h - 70);
    ctx.strokeStyle = 'rgba(255,200,170,.18)'; ctx.lineWidth = 1; ctx.strokeRect(34.5, 42.5, w - 66, h - 70);
    // Láva-erek: izzó, elágazó repedések
    ctx.shadowColor = '#ff6a1f'; ctx.shadowBlur = 6; ctx.lineCap = 'round';
    for (const [x0, y0] of [[30, 40], [w - 32, 38], [36, h - 30], [w - 40, h - 32]]) {
      let x = x0, y = y0;
      ctx.strokeStyle = '#ff8a3d'; ctx.lineWidth = 1.6;
      ctx.beginPath(); ctx.moveTo(x, y);
      for (let k = 0; k < 3; k++) { x += (x0 < w / 2 ? 1 : -1) * (2 + rng() * 5); y += (y0 < h / 2 ? 1 : -1) * (3 + rng() * 5); ctx.lineTo(x, y); }
      ctx.stroke();
    }
    ctx.restore();
    block(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    // Izzó rúna középen, glóriával
    const rg = ctx.createRadialGradient(w / 2, 52, 1, w / 2, 52, 14);
    rg.addColorStop(0, 'rgba(255,150,60,.65)'); rg.addColorStop(1, 'rgba(255,120,40,0)');
    ctx.fillStyle = rg; ctx.fillRect(w / 2 - 14, 38, 28, 28);
    drawRunes(ctx, ['k'], w / 2 - 3, 44, 16, 0, '#ffb35a');
    // Fedőlap
    ctx.beginPath(); ctx.roundRect(18, 28, w - 36, 10, 3);
    ctx.fillStyle = vgrad(ctx, 28, 38, [[0, '#6e5c60'], [1, '#2e2628']]); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
    ctx.strokeStyle = 'rgba(255,190,140,.3)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(21, 29.5); ctx.lineTo(w - 21, 29.5); ctx.stroke();
    // Csavart szarvak a fedőlap sarkain
    for (const dir of [-1, 1]) {
      const x = w / 2 + dir * (w / 2 - 22);
      ctx.save(); ctx.translate(x, 29); ctx.scale(dir, 1);
      ctx.beginPath(); ctx.moveTo(-3, 0); ctx.quadraticCurveTo(10, -4, 12, -16); ctx.quadraticCurveTo(13, -22, 8, -24); ctx.quadraticCurveTo(10, -16, 4, -8); ctx.quadraticCurveTo(0, -4, 3, 0); ctx.closePath();
      ctx.fillStyle = vgrad(ctx, -24, 0, [[0, '#f2e6c8'], [1, '#9a8660']]); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.strokeStyle = 'rgba(80,60,30,.6)'; ctx.lineWidth = 0.8;
      for (const t of [-6, -11, -16]) { ctx.beginPath(); ctx.moveTo(4 + t * -0.3, t); ctx.lineTo(10 + t * -0.1, t - 2); ctx.stroke(); }
      ctx.restore();
    }
    // Vas parázstál: perem, izzó parázs, szegecsek
    ctx.fillStyle = vgrad(ctx, 18, 32, [[0, '#4a4248'], [1, '#141012']]); ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(w / 2 - 19, 24); ctx.quadraticCurveTo(w / 2 - 16, 33, w / 2, 33); ctx.quadraticCurveTo(w / 2 + 16, 33, w / 2 + 19, 24); ctx.closePath(); ctx.fill(); ctx.stroke();
    const emb = ctx.createRadialGradient(w / 2, 24, 1, w / 2, 24, 16);
    emb.addColorStop(0, '#fff3b0'); emb.addColorStop(0.45, '#ffb35a'); emb.addColorStop(1, '#c2410c');
    ctx.fillStyle = emb; ctx.beginPath(); ctx.ellipse(w / 2, 24, 17, 4, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
    for (let i = 0; i < 7; i++) { ctx.fillStyle = rng() < 0.5 ? '#2a1a12' : '#ffe08a'; ctx.beginPath(); ctx.arc(w / 2 - 12 + rng() * 24, 23 + rng() * 2.5, 1 + rng() * 1.3, 0, 7); ctx.fill(); }
    ctx.fillStyle = '#9aa0b0'; for (const x of [-12, 0, 12]) { ctx.beginPath(); ctx.arc(w / 2 + x, 29.5, 1.2, 0, 7); ctx.fill(); }
    // Megolvadt láva csorgása a lépcsőn
    ctx.shadowColor = '#ff6a1f'; ctx.shadowBlur = 5; ctx.fillStyle = '#ff7a2c';
    ctx.beginPath(); ctx.ellipse(w - 30, h - 13, 6, 1.6, 0, 0, 7); ctx.fill();
    ctx.beginPath(); ctx.ellipse(30, h - 3, 5, 1.3, 0, 0, 7); ctx.fill();
    ctx.shadowBlur = 0;
  });

  /* --- A Valkűr-kő: magas, faragott rúnakő tollas szárnyakkal; a kő
         peremén körbefutó kígyószalag (mint a valódi rúnakövökön),
         aranyozott sisak-dombormű, moha és virágok a tövénél --- */
  add('valkstone', 96, 120, (ctx, w, h) => {
    ctx.lineJoin = 'round';
    const glow = ctx.createRadialGradient(w / 2, 50, 4, w / 2, 50, 56);
    glow.addColorStop(0, 'rgba(255,243,196,.35)'); glow.addColorStop(1, 'rgba(255,243,196,0)');
    ctx.fillStyle = glow; ctx.fillRect(0, 0, w, h);
    contact(ctx, w / 2 + 4, h - 4, 30, 6, 0.4);
    // Tollas szárnyak: két tollsor legyezőben (hátsó sötétebb, hosszabb)
    const feather = (x, y, ang, len, wid, fill) => {
      ctx.save(); ctx.translate(x, y); ctx.rotate(ang);
      ctx.beginPath(); ctx.moveTo(0, 0); ctx.quadraticCurveTo(len * 0.5, -wid, len, 0); ctx.quadraticCurveTo(len * 0.5, wid * 0.8, 0, 0);
      ctx.fillStyle = fill; ctx.fill(); ctx.strokeStyle = 'rgba(30,34,52,.9)'; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.strokeStyle = 'rgba(120,128,160,.6)'; ctx.lineWidth = 0.8; ctx.beginPath(); ctx.moveTo(2, 0); ctx.lineTo(len - 3, 0); ctx.stroke();
      ctx.restore();
    };
    for (const dir of [-1, 1]) {
      const ox = w / 2 + dir * 12, oy = 44;
      for (const [rowLen, rowWid, fill, n] of [[40, 6, vgrad(ctx, 0, 90, [[0, '#cfd6e6'], [1, '#8f97ae']]), 7], [28, 5.5, vgrad(ctx, 0, 90, [[0, '#ffffff'], [1, '#d6dcea']]), 6]]) {
        for (let i = 0; i < n; i++) {
          const t = i / (n - 1);
          const a = -1.05 + t * 1.6;                                   // felfelé-kifelé → lefelé
          const ang = dir > 0 ? a : Math.PI - a;
          feather(ox, oy + t * 14, ang, rowLen * (1 - t * 0.35), rowWid, fill);
        }
      }
      // Szárnycsont: aranyozott ív
      ctx.strokeStyle = INK; ctx.lineWidth = 4; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(ox, oy + 4); ctx.quadraticCurveTo(ox + dir * 16, oy - 22, ox + dir * 30, oy - 30); ctx.stroke();
      ctx.strokeStyle = '#d9b45a'; ctx.lineWidth = 2; ctx.stroke();
    }
    // Kőtömb: napos bal él, árnyékos jobb, szemcsés felület
    const slab = () => { ctx.beginPath(); ctx.moveTo(w / 2 - 18, h - 4); ctx.lineTo(w / 2 - 20, 30); ctx.quadraticCurveTo(w / 2, 2, w / 2 + 20, 30); ctx.lineTo(w / 2 + 18, h - 4); ctx.closePath(); };
    slab();
    const sg = ctx.createLinearGradient(w / 2 - 20, 0, w / 2 + 20, 0);
    sg.addColorStop(0, '#b8c0d4'); sg.addColorStop(0.5, '#8a92aa'); sg.addColorStop(1, '#4f566e');
    ctx.fillStyle = sg; ctx.fill();
    ctx.save(); slab(); ctx.clip();
    speckle(ctx, 0, 0, w, h, ['rgba(20,24,40,.25)', 'rgba(255,255,255,.16)'], 70, rng, 0.6, 1.6);
    const shade = ctx.createLinearGradient(0, h - 30, 0, h);
    shade.addColorStop(0, 'rgba(0,0,0,0)'); shade.addColorStop(1, 'rgba(0,0,0,.3)');
    ctx.fillStyle = shade; ctx.fillRect(0, h - 30, w, 30);
    ctx.restore();
    slab(); ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.stroke();
    // Kígyószalag a perem mentén: bevésett árok + világos szalag, alul fejjel
    const band = () => { ctx.beginPath(); ctx.moveTo(w / 2 - 12, h - 10); ctx.lineTo(w / 2 - 14, 32); ctx.quadraticCurveTo(w / 2, 11, w / 2 + 14, 32); ctx.lineTo(w / 2 + 12, h - 14); };
    band(); ctx.strokeStyle = 'rgba(30,34,52,.6)'; ctx.lineWidth = 6; ctx.lineCap = 'round'; ctx.stroke();
    band(); ctx.strokeStyle = '#d8dceb'; ctx.lineWidth = 3; ctx.stroke();
    band(); ctx.strokeStyle = 'rgba(184,57,47,.75)'; ctx.lineWidth = 1; ctx.setLineDash([2, 3]); ctx.stroke(); ctx.setLineDash([]);
    ctx.fillStyle = '#d8dceb'; ctx.strokeStyle = 'rgba(30,34,52,.8)'; ctx.lineWidth = 1.2;
    ctx.beginPath(); ctx.ellipse(w / 2 - 6, h - 10, 6, 3.4, 0, 0, 7); ctx.fill(); ctx.stroke();       // kígyófej
    ctx.fillStyle = '#b8392f'; ctx.beginPath(); ctx.arc(w / 2 - 8, h - 11, 0.9, 0, 7); ctx.fill();
    // Aranyozott valkűr-sisak domborműve
    ctx.fillStyle = vgrad(ctx, 36, 48, [[0, '#ffe7a0'], [1, '#b8862f']]); ctx.strokeStyle = INK; ctx.lineWidth = 1.8;
    ctx.beginPath(); ctx.arc(w / 2, 47, 8, Math.PI, 0); ctx.lineTo(w / 2 + 9, 49); ctx.lineTo(w / 2 - 9, 49); ctx.closePath(); ctx.fill(); ctx.stroke();
    for (const dir of [-1, 1]) {                                        // sisakszárnyacskák
      ctx.beginPath(); ctx.moveTo(w / 2 + dir * 7, 42); ctx.quadraticCurveTo(w / 2 + dir * 15, 34, w / 2 + dir * 13, 30); ctx.quadraticCurveTo(w / 2 + dir * 10, 37, w / 2 + dir * 5, 40); ctx.closePath(); ctx.fill(); ctx.stroke();
    }
    ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.fillRect(w / 2 - 1, 40, 2, 9);
    drawRunes(ctx, ['t', 'a'], w / 2 - 3, 60, 10, 14, '#fff3c4');
    // Moha és apró virágok a tövénél
    for (let i = 0; i < 6; i++) { ctx.fillStyle = `rgba(${80 + rng() * 30},${130 + rng() * 30},70,.85)`; ctx.beginPath(); ctx.ellipse(w / 2 - 20 + rng() * 40, h - 5 - rng() * 4, 4 + rng() * 4, 2.2, 0, 0, 7); ctx.fill(); }
    for (let i = 0; i < 5; i++) { ctx.fillStyle = ['#fff3c4', '#e8b8f0', '#ffffff'][i % 3]; ctx.beginPath(); ctx.arc(w / 2 - 22 + rng() * 44, h - 6 - rng() * 4, 1.4, 0, 7); ctx.fill(); }
  });

  for (let v = 0; v < 3; v++) add(`menhir${v}`, 34, 62, (ctx, w, h) => {
    contact(ctx, w / 2 + 3, h - 3, 14, 4, 0.4);
    const shape = () => { ctx.beginPath(); ctx.moveTo(6, h - 2); ctx.lineTo(5 + v * 2, 14); ctx.quadraticCurveTo(w / 2, -2 + v * 3, w - 6 - v, 12); ctx.lineTo(w - 6, h - 2); ctx.closePath(); };
    shape();
    const g = ctx.createLinearGradient(0, 0, w, h * 0.7);
    g.addColorStop(0, '#a8b0c6'); g.addColorStop(0.5, '#757e98'); g.addColorStop(1, '#3f4559');
    ctx.fillStyle = g; ctx.fill();
    ctx.save(); shape(); ctx.clip();
    speckle(ctx, 0, 0, w, h, ['rgba(0,0,0,.2)', 'rgba(255,255,255,.14)'], 50, rng, 0.6, 1.5);
    ctx.strokeStyle = 'rgba(20,24,36,.5)'; ctx.lineWidth = 1.6;                 // faragott spirál
    ctx.beginPath();
    for (let a = 0; a < Math.PI * 5; a += 0.2) { const r = 1 + a * 1.1; const x = w / 2 + Math.cos(a) * r, y = h * 0.42 + Math.sin(a) * r; a ? ctx.lineTo(x, y) : ctx.moveTo(x, y); }
    ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.4)'; ctx.lineWidth = 1;                      // repedés
    ctx.beginPath(); ctx.moveTo(w - 9, 16); ctx.lineTo(w - 12, 26); ctx.lineTo(w - 10, 34); ctx.stroke();
    speckle(ctx, 2, h - 20, w - 4, 18, ['#4f8a5a', '#6aa35a', '#3a6a40'], 26, rng, 1, 2.6);
    speckle(ctx, 4, 10, w - 8, 18, ['#c9c25a', '#a8b05a'], 8, rng, 0.8, 1.8);  // zuzmó
    ctx.restore();
    shape(); ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.stroke();
  });

  for (const open of [false, true]) add(open ? 'chest-open' : 'chest', 40, 36, (ctx, w, h) => {
    contact(ctx, w / 2 + 2, h - 3, 18, 4, 0.4);
    ctx.lineJoin = 'round';
    // láda teste: deszkák vasabroncsokkal, szegecsekkel
    ctx.save(); ctx.beginPath(); ctx.roundRect(4, 16, w - 8, h - 18, 3); ctx.clip();
    planks(ctx, 4, 16, w - 8, h - 18, { vertical: false, cols: ['#9a7048', '#86603c'], step: 6 });
    ctx.restore();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.roundRect(4, 16, w - 8, h - 18, 3); ctx.stroke();
    const band = (x) => { ctx.fillStyle = vgrad(ctx, 16, h, [[0, '#9aa0b6'], [1, '#4a5068']]); ctx.fillRect(x, 16, 4, h - 18); ctx.fillStyle = '#d9dde8'; for (let y = 20; y < h - 4; y += 5) { ctx.beginPath(); ctx.arc(x + 2, y, 0.8, 0, 7); ctx.fill(); } };
    band(8); band(w - 12);
    if (open) {
      const inner = ctx.createLinearGradient(0, 6, 0, 18);
      inner.addColorStop(0, '#2a1a10'); inner.addColorStop(1, '#4f3420');
      ctx.fillStyle = inner; ctx.beginPath(); ctx.moveTo(4, 16); ctx.lineTo(8, 2); ctx.lineTo(w - 8, 2); ctx.lineTo(w - 4, 16); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.save(); ctx.shadowColor = '#ffd36b'; ctx.shadowBlur = 8;
      ctx.fillStyle = '#ffd36b'; ctx.beginPath(); ctx.ellipse(w / 2, 17, w / 2 - 8, 3, 0, 0, 7); ctx.fill();
      ctx.restore();
      for (let i = 0; i < 6; i++) { ctx.fillStyle = i % 2 ? '#fff3b0' : '#e8b84a'; ctx.beginPath(); ctx.arc(10 + rng() * (w - 20), 15 + rng() * 2, 1.6, 0, 7); ctx.fill(); }
    } else {
      ctx.save(); ctx.beginPath(); ctx.moveTo(4, 18); ctx.quadraticCurveTo(w / 2, 0, w - 4, 18); ctx.closePath(); ctx.clip();
      planks(ctx, 4, 2, w - 8, 18, { vertical: true, cols: ['#a8784c', '#8f6640'], step: 8 });
      ctx.restore();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.8; ctx.beginPath(); ctx.moveTo(4, 18); ctx.quadraticCurveTo(w / 2, 0, w - 4, 18); ctx.closePath(); ctx.stroke();
      ctx.fillStyle = vgrad(ctx, 8, 20, [[0, '#ffe08a'], [1, '#a8782a']]); ctx.beginPath(); ctx.roundRect(w / 2 - 4, 9, 8, 10, 2); ctx.fill(); ctx.stroke();
      ctx.fillStyle = INK; ctx.beginPath(); ctx.arc(w / 2, 13, 1.3, 0, 7); ctx.fill(); ctx.fillRect(w / 2 - 0.6, 13, 1.2, 3);
    }
  });

  add('sign', 44, 56, (ctx, w, h) => {
    contact(ctx, w / 2 + 3, h - 3, 10, 3, 0.4);
    ctx.lineJoin = 'round';
    planks(ctx, w / 2 - 3, 10, 6, h - 12, { cols: ['#6b4a2e'], step: 6 });
    ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.strokeRect(w / 2 - 3, 10, 6, h - 12);
    for (const [y, dir] of [[10, 1], [24, -1]]) {
      const arrow = () => {
        ctx.beginPath();
        if (dir > 0) { ctx.moveTo(4, y); ctx.lineTo(w - 8, y); ctx.lineTo(w - 2, y + 5.5); ctx.lineTo(w - 8, y + 11); ctx.lineTo(4, y + 11); }
        else { ctx.moveTo(w - 4, y); ctx.lineTo(8, y); ctx.lineTo(2, y + 5.5); ctx.lineTo(8, y + 11); ctx.lineTo(w - 4, y + 11); }
        ctx.closePath();
      };
      ctx.save(); arrow(); ctx.clip();
      planks(ctx, 0, y, w, 11, { vertical: false, cols: [dir > 0 ? '#b8875a' : '#a8784c'], step: 11 });
      ctx.restore();
      arrow(); ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.strokeStyle = 'rgba(40,25,10,.7)'; ctx.lineWidth = 1;                // faragott nyíl
      const x0 = dir > 0 ? 9 : w - 9, x1 = dir > 0 ? w - 12 : 12;
      ctx.beginPath(); ctx.moveTo(x0, y + 5.5); ctx.lineTo(x1, y + 5.5); ctx.lineTo(x1 - dir * 3, y + 3); ctx.moveTo(x1, y + 5.5); ctx.lineTo(x1 - dir * 3, y + 8); ctx.stroke();
      ctx.fillStyle = '#3a3a40'; ctx.beginPath(); ctx.arc(w / 2, y + 5.5, 1.2, 0, 7); ctx.fill();   // szög
    }
    ctx.strokeStyle = '#b8a07a'; ctx.lineWidth = 1.2;                        // kötél a csomóponton
    for (let k = 0; k < 3; k++) { ctx.beginPath(); ctx.moveTo(w / 2 - 3.5, 22 + k * 1.6); ctx.lineTo(w / 2 + 3.5, 23 + k * 1.6); ctx.stroke(); }
    speckle(ctx, w / 2 - 6, h - 9, 12, 6, ['#4f7a3a', '#6f9a4a'], 8, rng, 1, 2);
  });

  // --- Drakkar (a kalmár hajója) ---
  add('drakkar', 220, 150, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2.5; ctx.lineJoin = 'round'; ctx.lineCap = 'round';
    // Vitorla
    ctx.fillStyle = '#e8dcc4';
    ctx.beginPath(); ctx.moveTo(w / 2 - 50, 22); ctx.lineTo(w / 2 + 50, 22); ctx.quadraticCurveTo(w / 2 + 56, 64, w / 2 + 46, 92); ctx.lineTo(w / 2 - 46, 92); ctx.quadraticCurveTo(w / 2 - 56, 64, w / 2 - 50, 22); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#b8392f';
    for (let i = 0; i < 5; i += 2) { ctx.beginPath(); ctx.moveTo(w / 2 - 50 + i * 20, 22); ctx.lineTo(w / 2 - 30 + i * 20, 22); ctx.lineTo(w / 2 - 28 + i * 18.4, 92); ctx.lineTo(w / 2 - 46 + i * 18.4, 92); ctx.closePath(); ctx.fill(); }
    ctx.strokeStyle = INK; ctx.strokeRect(w / 2 - 54, 18, 108, 4);
    ctx.fillStyle = '#5a3d24'; ctx.fillRect(w / 2 - 3, 10, 6, 100); ctx.strokeRect(w / 2 - 3, 10, 6, 100);
    // Hajótest, sárkányfejes orral
    ctx.fillStyle = vgrad(ctx, 96, h - 10, [[0, '#8a6844'], [1, '#4a3322']]);
    ctx.beginPath();
    ctx.moveTo(14, 60); ctx.quadraticCurveTo(24, 96, 40, 104);
    ctx.lineTo(w - 40, 104); ctx.quadraticCurveTo(w - 24, 96, w - 14, 60);
    ctx.quadraticCurveTo(w - 30, 130, w / 2, 132); ctx.quadraticCurveTo(30, 130, 14, 60);
    ctx.closePath(); ctx.fill(); ctx.stroke();
    ctx.strokeStyle = 'rgba(0,0,0,.35)'; ctx.lineWidth = 1.5;
    for (const y of [112, 120]) { ctx.beginPath(); ctx.moveTo(34, y); ctx.quadraticCurveTo(w / 2, y + 12, w - 34, y); ctx.stroke(); }
    // Pajzsok a hajó oldalán
    const cols = ['#b8392f', '#d9c7a1', '#2f6fb8', '#d9b45a'];
    for (let i = 0; i < 7; i++) {
      const x = 52 + i * 19;
      ctx.fillStyle = cols[i % 4]; ctx.strokeStyle = INK; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.arc(x, 106, 8, 0, 7); ctx.fill(); ctx.stroke();
      ctx.fillStyle = '#c9d3ea'; ctx.beginPath(); ctx.arc(x, 106, 2.5, 0, 7); ctx.fill();
    }
    // Sárkányfej és farok
    ctx.strokeStyle = INK; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(18, 64); ctx.quadraticCurveTo(4, 30, 20, 18); ctx.stroke();
    ctx.strokeStyle = '#8a6844'; ctx.lineWidth = 4; ctx.stroke();
    ctx.fillStyle = '#8a6844'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.ellipse(26, 18, 10, 6, 0.3, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#ff4d4d'; ctx.beginPath(); ctx.arc(28, 16, 1.6, 0, 7); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 7;
    ctx.beginPath(); ctx.moveTo(w - 18, 64); ctx.quadraticCurveTo(w - 2, 40, w - 14, 26); ctx.stroke();
    ctx.strokeStyle = '#8a6844'; ctx.lineWidth = 4; ctx.stroke();
    // Vízvonal
    ctx.fillStyle = 'rgba(20,50,90,.55)'; ctx.fillRect(0, 124, w, h - 124);
    ctx.strokeStyle = 'rgba(230,245,255,.75)'; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(20, 125); for (let x = 20; x < w - 20; x += 16) ctx.quadraticCurveTo(x + 8, 121, x + 16, 125); ctx.stroke();
  });

  // --- Stég (a halásznál) ---
  add('pier', 120, 40, (ctx, w, h) => {
    ctx.lineJoin = 'round';
    // Cölöpök: nedves, sötét fa, a vízvonalnál algával
    for (const x of [12, 52, 92]) {
      ctx.fillStyle = vgrad(ctx, 14, h, [[0, '#5a3d24'], [0.6, '#3a2716'], [1, '#2a4a40']]);
      ctx.beginPath(); ctx.roundRect(x, 14, 7, h - 14, 2); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.6; ctx.stroke();
      ctx.fillStyle = 'rgba(90,140,90,.7)'; ctx.fillRect(x + 0.5, h - 9, 6, 3);
      ctx.fillStyle = 'rgba(255,255,255,.25)'; ctx.fillRect(x + 1, 16, 1.5, h - 26);
    }
    // Deszkapadló erezettel, alatta a homlokgerenda
    planks(ctx, 4, 6, w - 8, 14, { cols: ['#8a6844', '#7a5a3a', '#94724c'], step: 9.5 });
    ctx.strokeStyle = INK; ctx.lineWidth = 2; ctx.strokeRect(4, 6, w - 8, 14);
    planks(ctx, 3, 19, w - 6, 5, { vertical: false, cols: ['#5a3d24'], step: 5 });
    ctx.strokeRect(3, 19, w - 6, 5);
    ctx.fillStyle = 'rgba(255,240,210,.18)'; ctx.fillRect(5, 7, w - 10, 2);
    // Kikötőbak kötéllel a stég végén
    ctx.fillStyle = vgrad(ctx, 0, 14, [[0, '#7a5534'], [1, '#4a3322']]);
    ctx.beginPath(); ctx.roundRect(w - 13, 0, 8, 14, 2); ctx.fill(); ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
    ctx.strokeStyle = '#d8c08a'; ctx.lineWidth = 1.4;
    for (const y of [4, 7, 10]) { ctx.beginPath(); ctx.moveTo(w - 13, y); ctx.lineTo(w - 5, y + 1); ctx.stroke(); }
    // Feltekert kötél és vödör a deszkán
    for (const r of [6, 4.2, 2.4]) { ctx.strokeStyle = INK; ctx.lineWidth = 2.6; ctx.beginPath(); ctx.ellipse(26, 11, r, r * 0.45, 0, 0, 7); ctx.stroke(); ctx.strokeStyle = '#d8c08a'; ctx.lineWidth = 1.4; ctx.stroke(); }
    ctx.fillStyle = vgrad(ctx, 2, 12, [[0, '#8a6844'], [1, '#4f3420']]);
    ctx.beginPath(); ctx.moveTo(w - 30, 3); ctx.lineTo(w - 19, 3); ctx.lineTo(w - 20.5, 12); ctx.lineTo(w - 28.5, 12); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = INK; ctx.lineWidth = 1.4; ctx.stroke();
    ctx.fillStyle = '#3a3a40'; ctx.fillRect(w - 29.5, 6, 10, 1.4);
    ctx.fillStyle = '#4a7aa0'; ctx.beginPath(); ctx.ellipse(w - 24.5, 3.5, 5, 1.4, 0, 0, 7); ctx.fill();
    // Hal a stégen
    ctx.fillStyle = '#9fb8c8'; ctx.strokeStyle = INK; ctx.lineWidth = 1;
    ctx.beginPath(); ctx.ellipse(70, 12, 6, 2.2, 0.1, 0, 7); ctx.fill(); ctx.stroke();
    ctx.beginPath(); ctx.moveTo(75, 12.5); ctx.lineTo(79, 10); ctx.lineTo(79, 15); ctx.closePath(); ctx.fill(); ctx.stroke();
  });

  add('campfire', 52, 34, (ctx, w, h) => {
    contact(ctx, w / 2 + 2, h - 8, 24, 7, 0.35);
    const ember = ctx.createRadialGradient(w / 2, h - 12, 1, w / 2, h - 12, 14);
    ember.addColorStop(0, '#fff0b0'); ember.addColorStop(0.4, '#ff8a3d'); ember.addColorStop(1, 'rgba(90,20,10,0)');
    ctx.fillStyle = ember; ctx.beginPath(); ctx.ellipse(w / 2, h - 12, 14, 5, 0, 0, 7); ctx.fill();
    // hasábok keresztben, kéreggel és izzó végekkel
    ctx.save(); ctx.translate(w / 2, h - 12);
    for (const r of [-0.5, 0.5, 0.05]) {
      ctx.save(); ctx.rotate(r);
      const g = ctx.createLinearGradient(0, -3, 0, 3); g.addColorStop(0, '#8a6440'); g.addColorStop(1, '#3f2a18');
      ctx.fillStyle = g; ctx.beginPath(); ctx.roundRect(-14, -3, 28, 6, 3); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.2; ctx.stroke();
      ctx.fillStyle = '#ff7a3d'; ctx.beginPath(); ctx.arc(-1, 0, 2, 0, 7); ctx.fill();
      ctx.restore();
    }
    ctx.restore();
    // kőkör (elöl világosabb kövek)
    for (let i = 0; i < 9; i++) {
      const a = (i / 9) * Math.PI * 2;
      stone(ctx, w / 2 + Math.cos(a) * 19 - 4.5, h - 13 + Math.sin(a) * 7.5 - 3, 9, 6.5, [110, 114, 130]);
    }
  });

  // --- Birka (két képkocka: legel / felnéz) ---
  for (const [key, up] of [['sheep0', false], ['sheep1', true]]) add(key, 40, 30, (ctx, w, h) => {
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.fillStyle = '#3a3033';
    for (const x of [12, 17, 25, 30]) ctx.fillRect(x, h - 9, 3, 8);
    ctx.fillStyle = '#f2ece2';
    for (const [x, y, r] of [[14, h - 14, 7], [21, h - 17, 8], [28, h - 14, 7], [21, h - 11, 7]]) { ctx.beginPath(); ctx.arc(x, y, r, 0, 7); ctx.fill(); }
    ctx.beginPath(); ctx.ellipse(21, h - 14, 14, 9, 0, 0, 7); ctx.stroke();
    ctx.fillStyle = '#3a3033';
    ctx.beginPath(); ctx.ellipse(6, up ? h - 20 : h - 9, 5, 4, up ? -0.3 : 0.5, 0, 7); ctx.fill(); ctx.stroke();
    ctx.fillStyle = '#fff'; ctx.fillRect(4, up ? h - 22 : h - 11, 1.5, 1.5);
  });
}

/* =====================================================================
   Rúnák vonalakból (a realm-grafikával azonos jelkészlet)
   ===================================================================== */
const RUNE_LINES = {
  f: [[[2, 0], [2, 10]], [[2, 3], [5, 0]], [[2, 6], [5, 3]]],
  u: [[[1, 10], [1, 0], [5, 3], [5, 10]]],
  th: [[[2, 0], [2, 10]], [[2, 3], [5, 5], [2, 7]]],
  a: [[[2, 0], [2, 10]], [[2, 0], [5, 3]], [[2, 3], [5, 6]]],
  r: [[[1, 10], [1, 0], [5, 2.5], [1, 5], [5, 10]]],
  k: [[[4.5, 1.5], [1.5, 5], [4.5, 8.5]]],
  o: [[[1, 10], [5, 3.5], [3, 0], [1, 3.5], [5, 10]]],
  t: [[[3, 0], [3, 10]], [[0.5, 3], [3, 0], [5.5, 3]]],
};
export function drawRunes(ctx, keys, x, y, h, step, color) {
  const s = h / 10;
  const stroke = (lw, col, alpha) => {
    ctx.save();
    ctx.globalAlpha = alpha; ctx.strokeStyle = col; ctx.lineWidth = lw; ctx.lineCap = 'round'; ctx.lineJoin = 'round';
    keys.forEach((k, i) => {
      for (const poly of RUNE_LINES[k] || []) {
        ctx.beginPath();
        poly.forEach(([px, py], j) => { const X = x + px * s, Y = y + i * step + py * s; j ? ctx.lineTo(X, Y) : ctx.moveTo(X, Y); });
        ctx.stroke();
      }
    });
    ctx.restore();
  };
  stroke(4, color, 0.35);
  stroke(1.6, '#e8fffb', 1);
}

/* =====================================================================
   Sárkányok — tintázott testrész-textúrák
   ===================================================================== */
const imageCache = new Map();
function loadImage(url) {
  if (!imageCache.has(url)) {
    imageCache.set(url, new Promise((resolve, reject) => {
      const img = new Image();
      img.onload = () => resolve(img);
      img.onerror = () => reject(new Error(`Nem tölthető be: ${url}`));
      img.src = url;
    }));
  }
  return imageCache.get(url);
}

/**
 * A sárkány négy testrészének textúrái (a kulcsokat adja vissza).
 * Minden rész ugyanarra a 64-es rácsra rajzolt kép, ezért egymásra
 * téve pontosan összeillenek — és külön mozgathatók (szárnycsapás,
 * fejmozdulat) a rögzített csatlakozási pontok körül.
 */
export async function dragonTextures(scene, dragon, catalog, size = 256) {
  // A szín a skins.js-ből: saját szín, a has felé világosabb
  const look = dragonLook(dragon, catalog);
  const keys = { look };
  await Promise.all(SLOTS.map(async (slot) => {
    const id = dragon[slot];
    const part = id ? catalog[slot]?.[id] : null;
    if (!part) return;
    const key = `dp:${slot}:${id}:${dragon.szin}:${look.seed}:${size}`;
    keys[slot] = key;
    if (scene.textures.exists(key)) return;

    const img = await loadImage(part.img);
    const pad = Math.round(size * SKIN_PAD);
    const c = canvas(size + pad * 2, size + pad * 2);
    paintPart(c.getContext('2d'), size, slot, img, look);
    if (!scene.textures.exists(key)) scene.textures.addCanvas(key, c);
  }));
  return keys;
}

/** Kis portré a felülethez (a már elkészült textúrákból). */
export function dragonPortrait(scene, keys, size = 72) {
  const c = canvas(size, size);
  const ctx = c.getContext('2d');
  const P = keys.look ? SKIN_PAD : 0;                     // a festett textúráknak keskeny pereme van
  for (const slot of ['test', 'lab', 'fej', 'szarny']) {
    if (!keys[slot]) continue;
    const src = scene.textures.get(keys[slot]).getSourceImage();
    ctx.drawImage(src, -P * size, -P * size, size * (1 + 2 * P), size * (1 + 2 * P));
  }
  return c;
}

/**
 * Sárkány a jelenetben: konténer, benne a négy rész. A szárny és a fej
 * saját csatlakozási pontja körül forgatható (ugyanazok a pontok, amikre
 * a rajzok készültek: nyaktő 26,20 — szárnytő 36,27 a 64-es rácson).
 */
export function makeDragonView(scene, keys, displaySize) {
  const cont = scene.add.container(0, 0);
  const inner = scene.add.container(0, 0);        // ezt tükrözzük irány szerint
  cont.add(inner);
  const S = displaySize;
  const P = keys.look ? SKIN_PAD : 0;
  const part = (slot, ox, oy) => {
    if (!keys[slot]) return null;
    const img = scene.add.image((ox - 0.5) * S, (oy - 0.5) * S, keys[slot])
      .setOrigin((ox + P) / (1 + 2 * P), (oy + P) / (1 + 2 * P))
      .setDisplaySize(S * (1 + 2 * P), S * (1 + 2 * P));
    inner.add(img);
    return img;
  };
  const body  = part('test', 0.5, 0.5);
  const legs  = part('lab', 0.5, 0.5);
  const head  = part('fej', 26 / 64, 20 / 64);
  const wings = part('szarny', 36 / 64, 27 / 64);
  cont.setData('parts', { body, legs, head, wings, inner });
  return cont;
}

/* =====================================================================
   Barlangi háttér a csatához
   ===================================================================== */
const CAVE_LOOK = {
  1: { theme: 'moss',     top: '#040a07', deep: '#1f4634', layers: ['#16342a', '#0e221a', '#07130e'], rim: '#8affc0', glow: '#9dffc9', floor: ['#2c3e30', '#0a110c'] },
  2: { theme: 'ice',      top: '#040912', deep: '#36608a', layers: ['#223f5e', '#142840', '#0a1626'], rim: '#cdeeff', glow: '#9fe8ff', floor: ['#41546e', '#0a1018'] },
  3: { theme: 'amethyst', top: '#06040c', deep: '#43307a', layers: ['#2c2052', '#1c1436', '#0f0a1e'], rim: '#dcb4ff', glow: '#c9a0ff', floor: ['#30284a', '#08060e'] },
  4: { theme: 'lava',     top: '#0a0303', deep: '#7a2a10', layers: ['#3e1a10', '#26100a', '#140706'], rim: '#ffa060', glow: '#ff7a2c', floor: ['#3c2622', '#0a0505'] },
  5: { theme: 'roots',    top: '#040306', deep: '#3e2e1a', layers: ['#2a1f30', '#1a1220', '#0c0812'], rim: '#ffd36b', glow: '#ffd36b', floor: ['#2c2432', '#050407'] },
};

/**
 * Barlang a csatához — festett, rétegzett mélység:
 * háttérfény a messzi csarnokból → három sziklakulissza (egyre közelebb,
 * egyre sötétebb, peremfénnyel) → a fokozat saját látványa (vízesés,
 * jégfolyam, ametisztfürt, lávató, Yggdrasil-gyökerek) → kőpadló →
 * előtér-sziluettek, köd, vignetta. Egyszer készül, futás közben nem költ.
 */
export function caveBackdrop(scene, tier, w, h) {
  const key = `cavebg2:${tier}:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const L = CAVE_LOOK[tier] || CAVE_LOOK[1];
  const rng = mulberry32(tier * 999 + 7);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const floorY = h * 0.72;
  const glowAt = (x, y, r, col, a) => {
    const g = ctx.createRadialGradient(x, y, 0, x, y, r);
    g.addColorStop(0, hexA(col, a)); g.addColorStop(1, hexA(col, 0));
    ctx.fillStyle = g; ctx.fillRect(x - r, y - r, r * 2, r * 2);
  };

  // 1. Mélység: sötét boltozat, a messzi csarnok fénye középen
  ctx.fillStyle = vgrad(ctx, 0, h, [[0, L.top], [0.5, L.deep], [0.72, L.layers[0]], [1, L.top]]);
  ctx.fillRect(0, 0, w, h);
  glowAt(w * 0.5, h * 0.52, Math.max(w, h) * 0.42, L.glow, 0.28);

  /** Sziklakulissza: bal és jobb tömb + mennyezetsáv, csipkés belső éllel, peremfénnyel. */
  const curtain = (inner, ceil, col, rimA, jag) => {
    const edge = (side) => {
      const pts = [];
      const x0 = side ? w * (1 - inner) : w * inner;
      for (let y = -10; y <= floorY + 30; y += 18 + rng() * 14) {
        const bulge = Math.sin((y / h) * Math.PI * (1.2 + rng() * 0.3)) * w * 0.05;
        pts.push([x0 + (side ? -1 : 1) * (bulge + (rng() - 0.5) * jag), y]);
      }
      return pts;
    };
    const ceilPts = [];
    for (let x = -10; x <= w + 10; x += 22 + rng() * 18) ceilPts.push([x, h * ceil + Math.sin((x / w) * Math.PI) * h * 0.05 + (rng() - 0.5) * jag * 0.8]);
    ctx.fillStyle = col;
    for (const side of [0, 1]) {
      const e = edge(side);
      ctx.beginPath();
      ctx.moveTo(side ? w + 10 : -10, -10);
      for (const [x, y] of e) ctx.lineTo(x, y);
      ctx.lineTo(side ? w + 10 : -10, floorY + 40);
      ctx.closePath(); ctx.fill();
      ctx.strokeStyle = hexA(L.rim, rimA); ctx.lineWidth = 2;
      ctx.beginPath(); e.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    }
    ctx.beginPath(); ctx.moveTo(-10, -10);
    for (const [x, y] of ceilPts) ctx.lineTo(x, y);
    ctx.lineTo(w + 10, -10); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexA(L.rim, rimA * 0.7); ctx.lineWidth = 2;
    ctx.beginPath(); ceilPts.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
    return ceilPts;
  };

  /** Cseppkő a mennyezetről, kétoldalt árnyalva. */
  const stalactite = (x, y0, len, wid, col, rimA) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(x - wid / 2, y0 - 4); ctx.quadraticCurveTo(x - wid * 0.12, y0 + len * 0.6, x, y0 + len);
    ctx.quadraticCurveTo(x + wid * 0.12, y0 + len * 0.6, x + wid / 2, y0 - 4); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexA(L.rim, rimA); ctx.lineWidth = 1.5;
    ctx.beginPath(); ctx.moveTo(x - wid / 2, y0); ctx.quadraticCurveTo(x - wid * 0.12, y0 + len * 0.6, x, y0 + len); ctx.stroke();
  };

  // 2. A fokozat saját háttérlátványa (a legtávolabbi kulissza mögött)
  const T = L.theme;
  if (T === 'moss' || T === 'ice') {
    // vízesés (jégnél befagyott) a csarnok mélyén
    const wx = w * (0.5 + (rng() - 0.5) * 0.1), ww = w * 0.05;
    const fall = ctx.createLinearGradient(0, h * 0.18, 0, floorY);
    fall.addColorStop(0, hexA(T === 'ice' ? '#e8f8ff' : '#bff0ff', 0.1)); fall.addColorStop(0.3, hexA(T === 'ice' ? '#cdeeff' : '#9fe8ff', 0.55)); fall.addColorStop(1, hexA('#ffffff', 0.7));
    ctx.fillStyle = fall;
    ctx.beginPath(); ctx.moveTo(wx - ww * 0.6, h * 0.18); ctx.lineTo(wx + ww * 0.6, h * 0.18); ctx.lineTo(wx + ww, floorY - 6); ctx.lineTo(wx - ww, floorY - 6); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexA('#ffffff', T === 'ice' ? 0.55 : 0.35); ctx.lineWidth = 1.2;
    for (let i = 0; i < 9; i++) { const x = wx - ww * 0.8 + rng() * ww * 1.6; ctx.beginPath(); ctx.moveTo(x, h * 0.2 + rng() * 40); ctx.lineTo(x + (rng() - 0.5) * 6, floorY - 10 - rng() * 30); ctx.stroke(); }
    glowAt(wx, floorY - 8, ww * 3, '#ffffff', 0.25);
    ctx.fillStyle = hexA(T === 'ice' ? '#dff4ff' : '#bff0ff', 0.35);
    ctx.beginPath(); ctx.ellipse(wx, floorY - 4, ww * 2.6, 8, 0, 0, 7); ctx.fill();
  }
  if (T === 'lava') {
    // lávató a mélyben, lávazuhatag a falon
    const g = ctx.createLinearGradient(0, floorY - 30, 0, floorY + 6);
    g.addColorStop(0, '#ffd27a'); g.addColorStop(0.5, '#ff7a2c'); g.addColorStop(1, '#8a2410');
    glowAt(w * 0.5, floorY - 20, w * 0.35, '#ff6a1f', 0.45);
    ctx.fillStyle = g; ctx.beginPath(); ctx.ellipse(w * 0.5, floorY - 14, w * 0.24, 18, 0, 0, 7); ctx.fill();
    ctx.strokeStyle = 'rgba(255,240,180,.6)'; ctx.lineWidth = 1.2;
    for (let i = 0; i < 8; i++) { const x = w * 0.3 + rng() * w * 0.4; ctx.beginPath(); ctx.moveTo(x, floorY - 18 + rng() * 8); ctx.lineTo(x + 10 + rng() * 20, floorY - 16 + rng() * 8); ctx.stroke(); }
    const fx = w * (0.4 + rng() * 0.2);
    const lf = ctx.createLinearGradient(0, h * 0.2, 0, floorY);
    lf.addColorStop(0, 'rgba(255,200,90,.3)'); lf.addColorStop(1, 'rgba(255,120,40,.9)');
    ctx.fillStyle = lf; ctx.beginPath(); ctx.moveTo(fx - 6, h * 0.2); ctx.quadraticCurveTo(fx + 8, h * 0.45, fx - 4, floorY - 16); ctx.lineTo(fx + 14, floorY - 16); ctx.quadraticCurveTo(fx + 20, h * 0.45, fx + 6, h * 0.2); ctx.fill();
  }
  if (T === 'amethyst') {
    // ősi rúnaoszlop a csarnok közepén
    const px = w * 0.5, pw = Math.max(26, w * 0.035), ph = h * 0.36;
    ctx.fillStyle = vgrad(ctx, floorY - ph, floorY, [[0, '#3a3058'], [1, '#18122a']]);
    ctx.beginPath(); ctx.roundRect(px - pw / 2, floorY - ph, pw, ph, [8, 8, 0, 0]); ctx.fill();
    ctx.strokeStyle = hexA(L.rim, 0.4); ctx.lineWidth = 2; ctx.stroke();
    glowAt(px, floorY - ph * 0.55, pw * 3, L.glow, 0.35);
    drawRunes(ctx, ['t', 'a', 'th', 'k'], px - pw * 0.12, floorY - ph + 14, pw * 0.42, pw * 0.62, '#e8d0ff');
  }

  // 3. Három kulissza (távoli → közeli)
  curtain(0.3, 0.2, L.layers[0], 0.35, 40);
  if (T === 'roots') {
    // Yggdrasil gyökerei a mennyezetből: elvékonyodó, csavarodó, elágazó ívek arany nedvvel
    const root = (pts, w0, col, depth) => {
      const n = 26;
      const P = (t) => {
        const u = 1 - t;
        return [u * u * u * pts[0][0] + 3 * u * u * t * pts[1][0] + 3 * u * t * t * pts[2][0] + t * t * t * pts[3][0],
                u * u * u * pts[0][1] + 3 * u * u * t * pts[1][1] + 3 * u * t * t * pts[2][1] + t * t * t * pts[3][1]];
      };
      ctx.lineCap = 'round';
      for (let k = 0; k < n; k++) {
        const t0 = k / n, t1 = (k + 1) / n, [x0, y0] = P(t0), [x1, y1] = P(t1);
        const wd = w0 * (1 - t0 * 0.85);
        ctx.strokeStyle = col; ctx.lineWidth = wd;
        ctx.beginPath(); ctx.moveTo(x0, y0); ctx.lineTo(x1, y1); ctx.stroke();
        ctx.strokeStyle = hexA(L.rim, 0.22); ctx.lineWidth = Math.max(1, wd * 0.12);
        ctx.beginPath(); ctx.moveTo(x0 - wd * 0.3, y0 - wd * 0.2); ctx.lineTo(x1 - wd * 0.3, y1 - wd * 0.2); ctx.stroke();
        if (k % 3 === 1) {
          ctx.strokeStyle = hexA('#ffd36b', 0.5); ctx.lineWidth = Math.max(1, wd * 0.08);
          ctx.beginPath(); ctx.moveTo(x0 + wd * 0.1, y0); ctx.lineTo(x1 + wd * 0.1, y1); ctx.stroke();
        }
        // oldalhajtások
        if (depth > 0 && k > 4 && k % 7 === 0 && wd > 10) {
          const dir = rng() < 0.5 ? -1 : 1;
          root([[x0, y0], [x0 + dir * 40, y0 + 30], [x0 + dir * 70, y0 + 60 + rng() * 40], [x0 + dir * (80 + rng() * 60), y0 + 120 + rng() * 60]], wd * 0.45, col, depth - 1);
        }
      }
    };
    for (let i = 0; i < 6; i++) {
      const x0 = w * (0.1 + 0.8 * i / 5) + (rng() - 0.5) * 60, x1 = x0 + (rng() - 0.5) * w * 0.5;
      root([[x0, -30], [x0 + (rng() - 0.5) * 200, h * 0.25], [x1 + (rng() - 0.5) * 200, h * 0.5], [x1, floorY - rng() * 40]],
        26 + rng() * 30, i % 2 ? L.layers[0] : L.layers[1], 2);
    }
    glowAt(w * 0.5, h * 0.4, w * 0.25, '#ffd36b', 0.15);
  }
  const midCeil = curtain(0.17, 0.12, L.layers[1], 0.3, 50);
  // a középső mennyezetről cseppkövek / jégcsapok / gyökérszálak
  for (const [x, y] of midCeil) {
    if (rng() < 0.45) continue;
    const len = 20 + rng() * h * 0.14;
    if (T === 'ice') {
      ctx.fillStyle = 'rgba(180,230,255,.55)';
      ctx.beginPath(); ctx.moveTo(x - 7, y - 4); ctx.lineTo(x, y + len); ctx.lineTo(x + 7, y - 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = 'rgba(255,255,255,.7)'; ctx.lineWidth = 1; ctx.beginPath(); ctx.moveTo(x - 2, y); ctx.lineTo(x, y + len * 0.8); ctx.stroke();
    } else if (T === 'moss' || T === 'roots') {
      ctx.strokeStyle = T === 'moss' ? 'rgba(90,170,110,.55)' : 'rgba(80,60,50,.8)'; ctx.lineWidth = 2;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.bezierCurveTo(x + 6, y + len * 0.3, x - 6, y + len * 0.7, x + 2, y + len * 1.3); ctx.stroke();
      if (T === 'moss') { ctx.fillStyle = hexA('#8affc0', 0.8); ctx.beginPath(); ctx.arc(x + 2, y + len * 1.3, 2.2, 0, 7); ctx.fill(); }
    } else stalactite(x, y, len, 10 + rng() * 16, L.layers[1], 0.3);
  }
  // fokozat-díszek a középső kulissza tövében
  for (const side of [0, 1]) {
    const bx = side ? w * (0.86 + rng() * 0.06) : w * (0.08 + rng() * 0.06);
    if (T === 'amethyst' || T === 'ice') {
      glowAt(bx, floorY - 30, 110, L.glow, 0.3);
      for (let k = 0; k < 5; k++) {
        const a = -Math.PI / 2 + (k - 2) * 0.32 + (rng() - 0.5) * 0.2, len = 40 + rng() * 60, cw = 9 + rng() * 9;
        const tx = bx + Math.cos(a) * len, ty = floorY - 6 + Math.sin(a) * len;
        const nx = -Math.sin(a) * cw / 2, ny = Math.cos(a) * cw / 2;
        ctx.fillStyle = T === 'ice' ? 'rgba(200,240,255,.85)' : hexA('#b98cff', 0.9);
        ctx.beginPath(); ctx.moveTo(bx + nx, floorY - 6 + ny); ctx.lineTo(tx, ty); ctx.lineTo(bx - nx, floorY - 6 - ny); ctx.closePath(); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.35)';
        ctx.beginPath(); ctx.moveTo(bx + nx, floorY - 6 + ny); ctx.lineTo(tx, ty); ctx.lineTo(bx, floorY - 6); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = INK; ctx.lineWidth = 1.5;
        ctx.beginPath(); ctx.moveTo(bx + nx, floorY - 6 + ny); ctx.lineTo(tx, ty); ctx.lineTo(bx - nx, floorY - 6 - ny); ctx.stroke();
      }
    }
    if (T === 'moss') {
      // világító gombák
      for (let k = 0; k < 6; k++) {
        const mx = bx + (rng() - 0.5) * 90, my = floorY - 4 - rng() * 30, r = 5 + rng() * 9;
        glowAt(mx, my - r * 0.4, r * 4, '#8affc0', 0.25);
        ctx.fillStyle = '#d8e8d0'; ctx.fillRect(mx - r * 0.18, my - r * 0.4, r * 0.36, r * 1.1);
        ctx.fillStyle = hexA('#8affc0', 0.95); ctx.beginPath(); ctx.ellipse(mx, my - r * 0.4, r, r * 0.55, 0, Math.PI, 0); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,.6)'; ctx.beginPath(); ctx.arc(mx - r * 0.3, my - r * 0.7, r * 0.15, 0, 7); ctx.fill();
      }
    }
    if (T === 'lava') {
      // bazaltoszlopok
      for (let k = 0; k < 5; k++) {
        const cx = bx + (k - 2) * 22 * (side ? -1 : 1), ch = 60 + rng() * 110, cw = 20;
        ctx.fillStyle = vgrad(ctx, floorY - ch, floorY, [[0, '#4a2a24'], [1, '#160a08']]);
        ctx.beginPath(); ctx.moveTo(cx - cw / 2, floorY); ctx.lineTo(cx - cw / 2, floorY - ch + 6); ctx.lineTo(cx, floorY - ch); ctx.lineTo(cx + cw / 2, floorY - ch + 6); ctx.lineTo(cx + cw / 2, floorY); ctx.closePath(); ctx.fill();
        ctx.strokeStyle = 'rgba(255,140,70,.35)'; ctx.lineWidth = 1.5; ctx.stroke();
        ctx.fillStyle = 'rgba(255,120,50,.18)'; ctx.fillRect(cx - cw / 2, floorY - ch + 6, cw * 0.3, ch - 6);
      }
    }
  }

  // 4. Kőpadló: perspektivikus lapok, a széle felé sötétebb
  ctx.fillStyle = vgrad(ctx, floorY - 16, h, [[0, L.floor[0]], [1, L.floor[1]]]);
  const floorEdge = [];
  for (let x = -10; x <= w + 10; x += 26) floorEdge.push([x, floorY - 12 + Math.sin(x / 110) * 8 + rng() * 6]);
  ctx.beginPath(); ctx.moveTo(-10, h);
  for (const [x, y] of floorEdge) ctx.lineTo(x, y);
  ctx.lineTo(w + 10, h); ctx.closePath(); ctx.fill();
  ctx.strokeStyle = hexA(L.rim, 0.28); ctx.lineWidth = 2;
  ctx.beginPath(); floorEdge.forEach(([x, y], i) => (i ? ctx.lineTo(x, y) : ctx.moveTo(x, y))); ctx.stroke();
  // lapok és repedések (a mélység felé sűrűsödő sorok)
  for (let row = 0; row < 7; row++) {
    const y = floorY + Math.pow(row / 7, 1.6) * (h - floorY) + 6;
    const step = 60 + row * 30;
    for (let x = -step + (row % 2) * step / 2; x < w + step; x += step * (0.7 + rng() * 0.6)) {
      ctx.strokeStyle = `rgba(0,0,0,${0.2 + row * 0.03})`; ctx.lineWidth = 1 + row * 0.25;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + step * 0.4, y + 2 + rng() * 3, x + step * 0.8, y + (rng() - 0.5) * 4); ctx.stroke();
      ctx.strokeStyle = hexA(L.rim, 0.06 + rng() * 0.05); ctx.lineWidth = 1;
      ctx.beginPath(); ctx.moveTo(x + 2, y - 2); ctx.lineTo(x + step * 0.5, y - 1.5); ctx.stroke();
    }
  }
  // padló-díszek fokozatonként
  for (let i = 0; i < 14; i++) {
    const x = rng() * w, y = floorY + 10 + rng() * (h - floorY - 20), s = 0.6 + (y - floorY) / (h - floorY);
    if (T === 'lava' && i < 6) {
      ctx.strokeStyle = '#ff7a2c'; ctx.lineWidth = 2 * s; ctx.shadowColor = '#ff6a1f'; ctx.shadowBlur = 8;
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 14 * s, y + 3); ctx.lineTo(x + 26 * s, y - 2); ctx.stroke(); ctx.shadowBlur = 0;
    } else if ((T === 'moss' || T === 'ice') && i < 4) {
      ctx.fillStyle = hexA(L.glow, 0.18); ctx.beginPath(); ctx.ellipse(x, y, 40 * s, 7 * s, 0, 0, 7); ctx.fill();
      ctx.strokeStyle = hexA('#ffffff', 0.25); ctx.lineWidth = 1; ctx.beginPath(); ctx.ellipse(x - 6 * s, y - 1, 18 * s, 2 * s, 0, 0, 7); ctx.stroke();
    } else if (T === 'roots' && i < 5) {
      // csontok
      ctx.strokeStyle = '#cfc4b0'; ctx.lineWidth = 3 * s; ctx.lineCap = 'round';
      ctx.beginPath(); ctx.moveTo(x, y); ctx.lineTo(x + 18 * s, y - 4 * s); ctx.stroke();
      ctx.fillStyle = '#cfc4b0'; for (const [dx, dy] of [[0, 0], [18, -4]]) { ctx.beginPath(); ctx.arc(x + dx * s, y + dy * s, 2.6 * s, 0, 7); ctx.fill(); }
    } else {
      ctx.fillStyle = `rgba(0,0,0,${0.25 + rng() * 0.2})`; ctx.beginPath(); ctx.ellipse(x + 3, y + 3, 10 * s, 4 * s, 0, 0, 7); ctx.fill();
      ctx.fillStyle = L.floor[0]; ctx.beginPath(); ctx.ellipse(x, y, 9 * s, 5 * s, rng(), 0, 7); ctx.fill();
      ctx.strokeStyle = hexA(L.rim, 0.15); ctx.lineWidth = 1; ctx.stroke();
    }
  }

  // 5. Közeli kulissza és előtér: nagy sötét sziklák a sarkokban, cseppkövek
  const nearCeil = curtain(0.05, 0.05, L.layers[2], 0.22, 30);
  for (const [x, y] of nearCeil) {
    if (rng() < 0.35) continue;
    if (T === 'ice') {
      const len = 30 + rng() * h * 0.16;
      ctx.fillStyle = 'rgba(150,210,240,.75)'; ctx.beginPath(); ctx.moveTo(x - 9, y - 4); ctx.lineTo(x, y + len); ctx.lineTo(x + 9, y - 4); ctx.closePath(); ctx.fill();
      ctx.strokeStyle = INK; ctx.lineWidth = 1.5; ctx.stroke();
      ctx.fillStyle = 'rgba(255,255,255,.5)'; ctx.beginPath(); ctx.moveTo(x - 6, y); ctx.lineTo(x, y + len * 0.85); ctx.lineTo(x - 1, y); ctx.fill();
    } else stalactite(x, y, 30 + rng() * h * 0.16, 16 + rng() * 22, L.layers[2], 0.2);
  }
  for (const side of [0, 1]) {
    const bx = side ? w : 0;
    ctx.fillStyle = L.layers[2];
    ctx.beginPath(); ctx.moveTo(bx, h);
    ctx.lineTo(bx, h - h * (0.22 + rng() * 0.1));
    ctx.quadraticCurveTo(bx + (side ? -1 : 1) * w * 0.08, h - h * 0.3, bx + (side ? -1 : 1) * w * (0.12 + rng() * 0.05), h - h * 0.1);
    ctx.lineTo(bx + (side ? -1 : 1) * w * 0.2, h); ctx.closePath(); ctx.fill();
    ctx.strokeStyle = hexA(L.rim, 0.25); ctx.lineWidth = 2; ctx.stroke();
  }

  // 6. Fénysáv a padló fölött, köd és vignetta
  const haze = ctx.createLinearGradient(0, floorY - 60, 0, floorY + 40);
  haze.addColorStop(0, hexA(L.glow, 0)); haze.addColorStop(0.5, hexA(L.glow, 0.1)); haze.addColorStop(1, hexA(L.glow, 0));
  ctx.fillStyle = haze; ctx.fillRect(0, floorY - 60, w, 100);
  const v = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.78);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.72)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

  scene.textures.addCanvas(key, c);
  return key;
}

/* =====================================================================
   A Gyakorlótér a párbajhoz: alkonyi égbolt, sarkfény, cölöpkerítés
   ===================================================================== */
export function arenaBackdrop(scene, w, h) {
  const key = `arenabg:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const rng = mulberry32(2026);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const floorY = h * 0.72;

  // Ég: mély kék → alkonyi narancs a látóhatáron
  ctx.fillStyle = vgrad(ctx, 0, floorY, [[0, '#070b1e'], [0.55, '#1a2350'], [0.85, '#5a3a52'], [1, '#c4683a']]);
  ctx.fillRect(0, 0, w, floorY);
  // Csillagok
  for (let i = 0; i < 90; i++) {
    ctx.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.6})`;
    ctx.fillRect(rng() * w, rng() * floorY * 0.55, 1.5, 1.5);
  }
  // Sarkfény-szalagok
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
  // Távoli hegyek két rétegben
  for (const [col, base, amp, seed] of [['#1a1f3c', floorY - 70, 90, 1], ['#10142a', floorY - 30, 60, 2]]) {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, floorY);
    for (let x = 0; x <= w; x += 40) ctx.lineTo(x, base - Math.abs(Math.sin(x / 170 + seed)) * amp - rng() * 14);
    ctx.lineTo(w, floorY); ctx.closePath(); ctx.fill();
  }
  // Talaj: döngölt föld
  ctx.fillStyle = vgrad(ctx, floorY - 10, h, [[0, '#5a4430'], [1, '#1a120b']]);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 30) ctx.lineTo(x, floorY - 12 + Math.sin(x / 120) * 5);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  speckle(ctx, 0, floorY, w, h - floorY, ['rgba(0,0,0,.25)', 'rgba(255,220,170,.08)'], 160, rng, 1, 3);
  // Cölöpkerítés a háttérben
  for (let x = -6; x < w + 10; x += 22) {
    const hh = 64 + rng() * 22, y = floorY - 8;
    ctx.fillStyle = vgrad(ctx, y - hh, y, [[0, '#6b4a2e'], [1, '#2e1f12']]);
    ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(x - 9, y); ctx.lineTo(x - 9, y - hh + 10); ctx.lineTo(x, y - hh); ctx.lineTo(x + 9, y - hh + 10); ctx.lineTo(x + 9, y); ctx.closePath();
    ctx.fill(); ctx.stroke();
  }
  ctx.fillStyle = '#3a2716'; ctx.fillRect(0, floorY - 52, w, 7);
  // Fáklyák a kerítésen
  for (const fx of [w * 0.12, w * 0.38, w * 0.62, w * 0.88]) {
    const fy = floorY - 78;
    const g = ctx.createRadialGradient(fx, fy, 0, fx, fy, 110);
    g.addColorStop(0, 'rgba(255,170,80,.45)'); g.addColorStop(1, 'rgba(255,170,80,0)');
    ctx.fillStyle = g; ctx.fillRect(fx - 110, fy - 110, 220, 220);
    ctx.fillStyle = '#3a2716'; ctx.fillRect(fx - 3, fy, 6, 30);
    ctx.fillStyle = '#ffd08a'; ctx.beginPath(); ctx.ellipse(fx, fy - 4, 5, 10, 0, 0, 7); ctx.fill();
    ctx.fillStyle = '#fff3c4'; ctx.beginPath(); ctx.ellipse(fx, fy - 1, 2.5, 5, 0, 0, 7); ctx.fill();
  }
  // Lobogók
  for (const bx of [w * 0.25, w * 0.75]) {
    ctx.fillStyle = '#7a1f17'; ctx.strokeStyle = INK; ctx.lineWidth = 2;
    ctx.beginPath(); ctx.moveTo(bx - 18, floorY - 150); ctx.lineTo(bx + 18, floorY - 150); ctx.lineTo(bx + 18, floorY - 90); ctx.lineTo(bx, floorY - 104); ctx.lineTo(bx - 18, floorY - 90); ctx.closePath(); ctx.fill(); ctx.stroke();
    drawRunes(ctx, ['t'], bx - 4, floorY - 142, 22, 0, '#ffd08a');
    ctx.fillStyle = '#3a2716'; ctx.fillRect(bx - 22, floorY - 154, 44, 5);
  }
  // Vignetta
  const v = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.65)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

  scene.textures.addCanvas(key, c);
  return key;
}

/* =====================================================================
   Szabadtéri csatahátterek (kóborló sárkányok, őr-csaták)
   ===================================================================== */
const FIELD = {
  meadow: { sky: ['#0a1430', '#24386a', '#4a5a8a'], hills: ['#1c2a3a', '#14202c'], ground: ['#2f5a3a', '#0e1a12'], trees: '#0f1c16', accent: '#9dffc9', moon: true },
  forest: { sky: ['#06100c', '#12301f', '#22503a'], hills: ['#0f2016', '#0a160f'], ground: ['#24402a', '#08120a'], trees: '#06100a', accent: '#d8ff8a', dense: true },
  snow:   { sky: ['#0a1428', '#28406a', '#7a90b8'], hills: ['#5d667f', '#3b4258'], ground: ['#c9d6ea', '#5a6a88'], trees: '#1a2a3a', accent: '#e8fffb', snow: true, moon: true },
  ash:    { sky: ['#120404', '#3a0e08', '#8a2a10'], hills: ['#2a1210', '#1a0806'], ground: ['#3a2a2a', '#0a0505'], trees: '#120808', accent: '#ff8a3d', dead: true },
  shore:  { sky: ['#081430', '#1d3a6a', '#c4683a'], hills: ['#1a2a4a', '#10182c'], ground: ['#a8946a', '#2a2418'], trees: '#0f1a24', accent: '#9fe8ff', sea: true },
};

export function fieldBackdrop(scene, w, h, kind = 'meadow') {
  const key = `fieldbg:${kind}:${w}x${h}`;
  if (scene.textures.exists(key)) return key;
  const L = FIELD[kind] || FIELD.meadow;
  const rng = mulberry32(kind.length * 7919);
  const c = canvas(w, h);
  const ctx = c.getContext('2d');
  const floorY = h * 0.72;

  ctx.fillStyle = vgrad(ctx, 0, floorY, [[0, L.sky[0]], [0.6, L.sky[1]], [1, L.sky[2]]]);
  ctx.fillRect(0, 0, w, floorY);
  for (let i = 0; i < 70; i++) { ctx.fillStyle = `rgba(255,255,255,${0.2 + rng() * 0.5})`; ctx.fillRect(rng() * w, rng() * floorY * 0.5, 1.4, 1.4); }
  if (L.moon) {
    const mx = w * 0.78, my = h * 0.16;
    const g = ctx.createRadialGradient(mx, my, 10, mx, my, 120);
    g.addColorStop(0, 'rgba(230,240,255,.35)'); g.addColorStop(1, 'rgba(230,240,255,0)');
    ctx.fillStyle = g; ctx.fillRect(mx - 120, my - 120, 240, 240);
    ctx.fillStyle = '#eef4fc'; ctx.beginPath(); ctx.arc(mx, my, 26, 0, 7); ctx.fill();
    ctx.fillStyle = 'rgba(160,170,200,.35)'; ctx.beginPath(); ctx.arc(mx - 8, my - 5, 6, 0, 7); ctx.arc(mx + 9, my + 7, 4, 0, 7); ctx.fill();
  }
  if (kind === 'ash') {
    // Izzó felhők
    for (let i = 0; i < 8; i++) {
      const x = rng() * w, y = h * (0.1 + rng() * 0.3);
      const g = ctx.createRadialGradient(x, y, 4, x, y, 160);
      g.addColorStop(0, 'rgba(255,90,30,.18)'); g.addColorStop(1, 'rgba(255,90,30,0)');
      ctx.fillStyle = g; ctx.fillRect(x - 160, y - 160, 320, 320);
    }
  }
  // Hegyek két rétegben
  L.hills.forEach((col, li) => {
    ctx.fillStyle = col;
    ctx.beginPath(); ctx.moveTo(0, floorY);
    for (let x = 0; x <= w; x += 30) ctx.lineTo(x, floorY - 60 - li * -30 - Math.abs(Math.sin(x / (160 - li * 40) + li)) * (110 - li * 40) - rng() * 12);
    ctx.lineTo(w, floorY); ctx.closePath(); ctx.fill();
    if (L.snow && li === 0) {
      ctx.fillStyle = 'rgba(238,244,252,.5)';
      for (let x = 20; x < w; x += 90) { ctx.beginPath(); ctx.ellipse(x + rng() * 40, floorY - 120 - rng() * 30, 30, 8, 0, 0, 7); ctx.fill(); }
    }
  });
  if (L.sea) {
    ctx.fillStyle = vgrad(ctx, floorY - 40, floorY, [[0, '#23537f'], [1, '#14304d']]);
    ctx.fillRect(0, floorY - 40, w, 40);
    ctx.strokeStyle = 'rgba(200,230,255,.3)'; ctx.lineWidth = 1.5;
    for (let i = 0; i < 18; i++) { const x = rng() * w, y = floorY - 36 + rng() * 32; ctx.beginPath(); ctx.moveTo(x, y); ctx.quadraticCurveTo(x + 10, y - 3, x + 20, y); ctx.stroke(); }
  }
  // Fasor sziluettje
  const treeLine = (y0, scale, col, count) => {
    ctx.fillStyle = col;
    for (let i = 0; i < count; i++) {
      const x = (i / count) * w + rng() * 30, hh = (50 + rng() * 60) * scale;
      if (L.dead) {
        ctx.strokeStyle = col; ctx.lineWidth = 3 * scale; ctx.lineCap = 'round';
        ctx.beginPath(); ctx.moveTo(x, y0); ctx.lineTo(x, y0 - hh); ctx.moveTo(x, y0 - hh * 0.6); ctx.lineTo(x + 14 * scale, y0 - hh * 0.85); ctx.moveTo(x, y0 - hh * 0.45); ctx.lineTo(x - 12 * scale, y0 - hh * 0.7); ctx.stroke();
      } else {
        ctx.beginPath(); ctx.moveTo(x, y0 - hh); ctx.lineTo(x + 16 * scale, y0); ctx.lineTo(x - 16 * scale, y0); ctx.closePath(); ctx.fill();
        if (L.snow) { ctx.fillStyle = 'rgba(238,244,252,.6)'; ctx.beginPath(); ctx.moveTo(x, y0 - hh); ctx.lineTo(x + 6 * scale, y0 - hh * 0.6); ctx.lineTo(x - 6 * scale, y0 - hh * 0.6); ctx.fill(); ctx.fillStyle = col; }
      }
    }
  };
  if (!L.sea) treeLine(floorY - 6, 0.7, L.hills[1], L.dense ? 40 : 18);
  // Talaj
  ctx.fillStyle = vgrad(ctx, floorY - 14, h, [[0, L.ground[0]], [1, L.ground[1]]]);
  ctx.beginPath(); ctx.moveTo(0, h);
  for (let x = 0; x <= w; x += 30) ctx.lineTo(x, floorY - 12 + Math.sin(x / 110) * 6);
  ctx.lineTo(w, h); ctx.closePath(); ctx.fill();
  speckle(ctx, 0, floorY, w, h - floorY, ['rgba(0,0,0,.22)', 'rgba(255,255,255,.06)'], 160, rng, 1, 3);
  if (kind === 'ash') {
    ctx.strokeStyle = 'rgba(255,140,60,.7)'; ctx.lineWidth = 2;
    for (let i = 0; i < 7; i++) { let x = rng() * w, y = floorY + rng() * (h - floorY) * 0.6; ctx.beginPath(); ctx.moveTo(x, y); for (let k = 0; k < 4; k++) { x += 14 + rng() * 14; y += (rng() - 0.5) * 10; ctx.lineTo(x, y); } ctx.stroke(); }
  }
  // Előtér: fák/kövek a két szélén (keretezés)
  for (const side of [0, 1]) for (let i = 0; i < 3; i++) {
    const x = side ? w - 14 - i * 46 - rng() * 20 : 14 + i * 46 + rng() * 20;
    const hh = (h * 0.42) - i * 40;
    ctx.fillStyle = L.trees; ctx.strokeStyle = '#000'; ctx.lineWidth = 2;
    if (L.dead || L.sea) {
      ctx.beginPath(); ctx.moveTo(x - 24, h); ctx.lineTo(x - 10, h - hh * 0.4); ctx.lineTo(x + 12, h - hh * 0.3); ctx.lineTo(x + 26, h); ctx.closePath(); ctx.fill();
    } else {
      for (let t = 0; t < 3; t++) {
        const top = h - hh + t * hh * 0.25, half = 18 + t * 10;
        ctx.beginPath(); ctx.moveTo(x, top); ctx.lineTo(x + half, top + hh * 0.36); ctx.lineTo(x - half, top + hh * 0.36); ctx.closePath(); ctx.fill();
      }
    }
  }
  // Köd, vignetta
  ctx.fillStyle = hexA(L.accent, 0.05);
  for (let i = 0; i < 5; i++) { ctx.beginPath(); ctx.ellipse(rng() * w, floorY + rng() * 40, 220, 30, 0, 0, 7); ctx.fill(); }
  const v = ctx.createRadialGradient(w / 2, h * 0.55, h * 0.25, w / 2, h * 0.55, Math.max(w, h) * 0.8);
  v.addColorStop(0, 'rgba(0,0,0,0)'); v.addColorStop(1, 'rgba(0,0,0,.65)');
  ctx.fillStyle = v; ctx.fillRect(0, 0, w, h);

  scene.textures.addCanvas(key, c);
  return key;
}

function hexA(hex, a) {
  const n = parseInt(hex.slice(1), 16);
  return `rgba(${(n >> 16) & 255},${(n >> 8) & 255},${n & 255},${a})`;
}
