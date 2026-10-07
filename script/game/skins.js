/* =====================================================================
   Sárkánybőrök — színezés
   ---------------------------------------------------------------------
   A sárkányok formája a testrész-rajzokból jön (dragons/svg, a
   tools/draw_*.php generálja): 18 különböző fej, test, láb és szárny,
   szabadon kombinálva. Itt már csak a szín készül: a szürkeárnyalatos
   rajzot a sárkány saját színével szorozzuk, a has felé kicsit
   világosabban (az elem szerinti árnyalattal), és kap egy lágy bal
   felső fényt. Nincs ráfestett effekt — a karaktert a rajz adja.
   ===================================================================== */
import { composition } from './rules.js';

const rgb = (hex) => {
  const n = parseInt(String(hex || '#ff8a3d').replace('#', ''), 16);
  return Number.isNaN(n) ? [255, 138, 61] : [(n >> 16) & 255, (n >> 8) & 255, n & 255];
};
const mix = (a, b, t) => a.map((v, i) => Math.round(v + (b[i] - v) * t));
const css = (c, a = 1) => `rgba(${c[0]},${c[1]},${c[2]},${a})`;
/** Az oldal színezésével azonos fényesítés (× 1,3), hogy a szürke rajzon ne sötétüljön el. */
const tint = (c) => c.map((v) => Math.round(Math.min(1, (v / 255) * 1.3) * 255));

const BELLY = { fire: '#ffd08a', frost: '#eaf8ff', storm: '#d6ecff', shadow: '#b8a8e0', earth: '#e0cfa4', venom: '#dcff9a' };
const ELEMENT_ADJ = { fire: 'Parázshátú', frost: 'Dérpikkelyű', storm: 'Viharszárnyú', shadow: 'Árnyékbőrű', earth: 'Kőpáncélú', venom: 'Méregtüskés' };
const SHAPE_NOUN = { standard: 'sárkány', stocky: 'páncélsárkány', arched: 'gerincsárkány', serpent: 'kígyósárkány', long: 'lindwurm', skeletal: 'csontsárkány' };

/** A sárkány színei és fajtaneve — determinisztikus, a testrészekből. */
export function dragonLook(d, catalog) {
  const comp = composition(d, catalog);
  const prim = comp?.primary || 'earth';
  const bodyEl = comp?.parts.test || prim;
  const bodyShape = (d.test ? catalog?.test?.[d.test]?.shape : null) || 'standard';
  const base = rgb(d.szin);
  return {
    seed: `${d.fej}.${d.test}.${d.lab}.${d.szarny}`,
    base,
    belly: mix(mix(base, [255, 255, 255], 0.4), rgb(BELLY[bodyEl] || BELLY.earth), 0.35),
    species: `${ELEMENT_ADJ[bodyEl] || 'Vad'} ${SHAPE_NOUN[bodyShape] || 'sárkány'}`,
  };
}

/** A textúrák pereme (a rács méretének aránya mindkét oldalon). */
export const SKIN_PAD = 0.02;

/**
 * Egy rész kifestése: a festett rajz × saját szín (a has felé világosabb),
 * fölötte a saját színű réteg (szarv, karom, szem, kristály, láva, csillanás).
 */
export function paintPart(ctx, N, slot, img, look, fx = null) {
  const u = N / 64;
  ctx.translate(Math.round(N * SKIN_PAD), Math.round(N * SKIN_PAD));
  ctx.drawImage(img, 0, 0, N, N);
  const top = tint(look.base);
  const bottom = slot === 'szarny' ? tint(mix(look.base, [255, 255, 255], 0.12)) : tint(look.belly);
  // A test színe magasság szerint (a has felé világosodik). A láb teteje
  // pontosan ezt folytatja, így a csípőnél nincs színvarrat; lejjebb a
  // láb a sárkány alapszínét veszi fel.
  const bodyAt = (y) => mix(top, bottom, Math.max(0, Math.min(1, (y - 33.6) / 10.4)));
  const range = { fej: [8, 30], test: [18, 44], lab: [30, 62], szarny: [2, 30] }[slot] || [10, 50];
  const stops = slot === 'lab'
    ? [[30, bodyAt(30)], [36, bodyAt(36)], [39, bodyAt(39)], [47, top], [62, top]]
    : [[range[0], top], [range[0] + (range[1] - range[0]) * 0.6, top], [range[1], bottom]];
  ctx.save();
  ctx.globalCompositeOperation = 'multiply';
  const g = ctx.createLinearGradient(0, range[0] * u, 0, range[1] * u);
  for (const [y, c] of stops) g.addColorStop((y - range[0]) / (range[1] - range[0]), css(c));
  ctx.fillStyle = g; ctx.fillRect(0, 0, N, N);
  ctx.globalCompositeOperation = 'destination-in';
  ctx.drawImage(img, 0, 0, N, N);
  ctx.restore();
  if (fx) ctx.drawImage(fx, 0, 0, N, N);
}
