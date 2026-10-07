/* =====================================================================
   Játékszabályok — grafikától független, tiszta logika
   ---------------------------------------------------------------------
   A sárkány harci értékei a testrészeiből jönnek:

     FEJ    → különleges képesség (a fej FORMÁJA szerint)
     TEST   → páncél, életerő-szorzó
     LÁB    → páncél, gyorsaság
     SZÁRNY → gyorsaság, kitérés (a szárny méretével szorozva)

   Az életerő és a sebzés alapja ugyanaz, mint az oldal többi részén
   (a testrészek HP/DMG összege), erre jön a szint, a nemzedék és a
   vonások bónusza.
   ===================================================================== */

export const SLOTS = ['fej', 'test', 'lab', 'szarny'];
export const SLOT_NAMES = { fej: 'Fej', test: 'Test', lab: 'Láb', szarny: 'Szárny' };

/* --- Képességek (a fej formájából) --------------------------------- */
export const SKILLS = {
  fire:    { name: 'Lángcsóva',    rune: 'ᚲ', color: 0xff8a3d, desc: '135% sebzés, 3 körig ég a célpont' },
  crush:   { name: 'Zúzó harapás', rune: 'ᚦ', color: 0xd9c7a1, desc: '150% sebzés, 35% eséllyel elkábít' },
  pierce:  { name: 'Átdöfés',      rune: 'ᛏ', color: 0xe8f1ff, desc: '140% sebzés, átüti a páncélt' },
  thunder: { name: 'Viharüvöltés', rune: 'ᛊ', color: 0x9fd8ff, desc: '75% sebzés MINDEN ellenfélre' },
  drain:   { name: 'Lélekszívás',  rune: 'ᛗ', color: 0xff5d7a, desc: '120% sebzés, a fele visszagyógyul' },
  venom:   { name: 'Méregfog',     rune: 'ᛃ', color: 0x7dff6a, desc: '100% sebzés, 4 körig mérgez' },
  charge:  { name: 'Rohamdöfés',   rune: 'ᚢ', color: 0xffc46b, desc: '190% sebzés, de 12% visszaüt' },
  frost:   { name: 'Jégszilánk',   rune: 'ᛁ', color: 0x7ce7ff, desc: '120% sebzés, 40% eséllyel megfagyaszt' },
  tail:    { name: 'Farokcsapás',  rune: 'ᚱ', color: 0xc9d3ea, desc: '110% sebzés (fej nélkül)' },
};

/* --- Elemi összetétel és kombinált képesség ---------------------------
   Minden testrésznek eleme van (a nevéből: Lávapofa → tűz, Jégkarom →
   jég…). A fej eleme az ELSŐDLEGES, a test + láb + szárny közül a
   leggyakoribb a MÁSODLAGOS; a kettő párosa adja a sárkány kombinált
   képességét (6 tiszta + 15 vegyes = 21 féle). Minél több testrész
   „rezonál" a párossal, annál erősebb (rezonancia: 2–4 rész). */
export const ELEMENTS = {
  fire:   { name: 'Tűz',   icon: '🔥', color: 0xff8a3d },
  frost:  { name: 'Jég',   icon: '❄', color: 0x7ce7ff },
  storm:  { name: 'Vihar', icon: '⚡', color: 0x9fd8ff },
  shadow: { name: 'Árny',  icon: '🌑', color: 0xb18cff },
  earth:  { name: 'Kő',    icon: '⛰', color: 0xd9a066 },
  venom:  { name: 'Méreg', icon: '☠', color: 0x7dff6a },
};

/** Testrész-azonosító → elem (a tools/parts_table.php nevei alapján). */
const PART_ELEMENT = {
  fej: {
    1: 'earth', 2: 'fire', 3: 'fire', 4: 'frost', 5: 'fire', 6: 'storm', 7: 'earth', 8: 'shadow', 9: 'storm',
    10: 'storm', 11: 'storm', 12: 'venom', 13: 'frost', 14: 'fire', 15: 'earth', 16: 'shadow', 17: 'earth', 18: 'fire',
  },
  test: {
    1: 'storm', 2: 'earth', 3: 'earth', 4: 'frost', 5: 'fire', 6: 'storm', 7: 'earth', 8: 'shadow', 9: 'frost',
    10: 'venom', 11: 'earth', 12: 'shadow', 13: 'storm', 14: 'earth', 15: 'venom', 16: 'frost', 17: 'shadow', 18: 'fire',
  },
  lab: {
    1: 'earth', 2: 'fire', 3: 'earth', 4: 'frost', 5: 'fire', 6: 'storm', 7: 'earth', 8: 'shadow', 9: 'storm',
    10: 'earth', 11: 'storm', 12: 'venom', 13: 'shadow', 14: 'earth', 15: 'venom', 16: 'frost', 17: 'earth', 18: 'storm',
  },
  szarny: {
    1: 'storm', 2: 'fire', 3: 'storm', 4: 'frost', 5: 'fire', 6: 'storm', 7: 'earth', 8: 'shadow', 9: 'frost',
    10: 'storm', 11: 'venom', 12: 'frost', 13: 'storm', 14: 'frost', 15: 'shadow', 16: 'earth', 17: 'venom', 18: 'shadow',
  },
};
/** Ismeretlen (később felvett) részeknél a formából. */
const SHAPE_ELEMENT = {
  snout: 'fire', blunt: 'earth', beak: 'storm', crest: 'storm', skull: 'shadow', viper: 'venom', horned: 'earth', crystal: 'frost',
  standard: 'fire', stocky: 'earth', arched: 'frost', serpent: 'venom', long: 'earth', skeletal: 'shadow',
  digit: 'fire', pillar: 'earth', lanky: 'storm', hoof: 'earth', grasp: 'shadow',
  bat: 'shadow', feather: 'storm', insect: 'venom', fin: 'frost', double: 'storm', torn: 'shadow',
};

/**
 * A kombinált képességek. target: 'enemy' · 'all' · 'party'.
 * fx: a látvány fajtája (battle.js). A hatások: burn/poison/slow/mark (kör),
 * freeze/stun (esély), drain (a sebzés ennyi része gyógyít), chain (a
 * többi ellenfél ennyi szorzót kap), heal (a csapat %-a), ward (kör).
 */
export const COMBOS = {
  'fire+fire':     { name: 'Pokolkatlan',    rune: 'ᚲ', color: 0xff6a1f, target: 'all',   fx: 'erupt',    mult: 0.9,  burn: 3,
                     desc: 'Lángoszlopok törnek fel minden ellenfél alatt: 90% sebzés, 3 körig égnek' },
  'frost+frost':   { name: 'Örök fagy',      rune: 'ᛁ', color: 0x9fe8ff, target: 'enemy', fx: 'icefall',  mult: 1.6,  freeze: 0.65,
                     desc: 'Jégtömb zuhan a célpontra: 160% sebzés, 65% eséllyel megfagyaszt' },
  'storm+storm':   { name: 'Láncvillám',     rune: 'ᛊ', color: 0xcfefff, target: 'enemy', fx: 'chain',    mult: 1.3,  chain: 0.7,
                     desc: 'A villám a célpontról mindenkire átugrik: 130% + a többieknek 70% sebzés' },
  'shadow+shadow': { name: 'Éjnyelő',        rune: 'ᛇ', color: 0x8a5cff, target: 'enemy', fx: 'void',     mult: 1.5,  drain: 0.5, mark: 2,
                     desc: 'Örvénylő sötétség: 150% sebzés, a fele visszagyógyul, 2 körig bélyeg' },
  'earth+earth':   { name: 'Hegyomlás',      rune: 'ᛞ', color: 0xd9a066, target: 'all',   fx: 'rockfall', mult: 1.0,  stun: 0.3, heavy: true,
                     desc: 'Sziklák zúdulnak minden ellenfélre: 100% sebzés, 30% eséllyel kábít' },
  'venom+venom':   { name: 'Dögvész',        rune: 'ᛃ', color: 0x7dff6a, target: 'all',   fx: 'cloud',    mult: 0.6,  poison: 4,
                     desc: 'Mérgező felhő: 60% sebzés mindenkire, 4 körig mérgez' },

  'fire+frost':    { name: 'Gőzrobbanás',    rune: 'ᚺ', color: 0xe8f6ff, target: 'enemy', fx: 'steam',    mult: 1.7,  pierce: true,
                     desc: 'Tűz és jég egymásnak csapódik: 170% sebzés, átüti a páncélt' },
  'fire+storm':    { name: 'Tűzvihar',       rune: 'ᚲ', color: 0xffb347, target: 'all',   fx: 'firerain', mult: 0.8,  burn: 2,
                     desc: 'Lángeső minden ellenfélre: 80% sebzés, 2 körig égnek' },
  'fire+shadow':   { name: 'Pokoltűz',       rune: 'ᚦ', color: 0xc04dff, target: 'enemy', fx: 'hellfire', mult: 1.5,  burn: 3, mark: 2,
                     desc: 'Bíbor lángcsóva: 150% sebzés, 3 körig ég, 2 körig bélyeg' },
  'earth+fire':    { name: 'Magmafeltörés',  rune: 'ᛞ', color: 0xff7a3d, target: 'all',   fx: 'erupt',    mult: 0.95, burn: 2, burnChance: 0.5,
                     desc: 'Izzó magma tör fel: 95% sebzés mindenkire, 50% eséllyel lángra kapnak' },
  'fire+venom':    { name: 'Kénköd',         rune: 'ᛃ', color: 0xe8d36b, target: 'all',   fx: 'cloud',    mult: 0.55, burn: 2, poison: 2,
                     desc: 'Égő kénfelhő: 55% sebzés mindenkire, égés és méreg 2 körig' },
  'frost+storm':   { name: 'Hóvihar',        rune: 'ᚹ', color: 0xc9f0ff, target: 'all',   fx: 'blizzard', mult: 0.7,  slow: 2, freeze: 0.25,
                     desc: 'Fagyos szélvihar: 70% sebzés mindenkire, lassít, 25% eséllyel fagyaszt' },
  'frost+shadow':  { name: 'Sírfagy',        rune: 'ᛁ', color: 0x8fa8ff, target: 'enemy', fx: 'volley',   mult: 1.4,  freeze: 0.5, drain: 0.3,
                     desc: 'Holdfényes jégszilánkok: 140% sebzés, 50% fagyás, 30% visszagyógyul' },
  'earth+frost':   { name: 'Gleccsertörés',  rune: 'ᛁ', color: 0xb9e6ff, target: 'enemy', fx: 'icefall',  mult: 1.9,  stun: 0.35, heavy: true,
                     desc: 'Egy gleccser darabja zuhan le: 190% sebzés, 35% eséllyel kábít' },
  'frost+venom':   { name: 'Dérméreg',       rune: 'ᛃ', color: 0x9dffd8, target: 'enemy', fx: 'volley',   mult: 1.2,  poison: 3, slow: 2,
                     desc: 'Mérgezett jégtűk: 120% sebzés, 3 körig méreg, 2 körig lassít' },
  'shadow+storm':  { name: 'Fekete villám',  rune: 'ᛊ', color: 0xb18cff, target: 'enemy', fx: 'darkbolt', mult: 1.6,  crit: true,
                     desc: 'Bíbor villám: 160% sebzés, biztos kritikus találat' },
  'earth+storm':   { name: 'Mennykőcsapás',  rune: 'ᛊ', color: 0xffe08a, target: 'all',   fx: 'bolts',    mult: 0.85, stun: 0.25,
                     desc: 'Villámok csapnak a földbe: 85% sebzés mindenkire, 25% eséllyel kábít' },
  'storm+venom':   { name: 'Savas eső',      rune: 'ᛚ', color: 0xb6ff5a, target: 'all',   fx: 'rain',     mult: 0.6,  poison: 3,
                     desc: 'Maró eső: 60% sebzés mindenkire, 3 körig mérgez' },
  'earth+shadow':  { name: 'Kőkripta',       rune: 'ᛒ', color: 0xa8a0c8, target: 'party', fx: 'crypt',    mult: 0,    heal: 0.15, ward: 2,
                     desc: 'Kőfal emelkedik a csapat köré: 15% gyógyulás, 2 körig pajzsfal' },
  'shadow+venom':  { name: 'Lidércharapás',  rune: 'ᛗ', color: 0xd06bff, target: 'enemy', fx: 'wraith',   mult: 1.3,  poison: 4, drain: 0.4,
                     desc: 'Lidércfog: 130% sebzés, 4 körig méreg, 40% visszagyógyul' },
  'earth+venom':   { name: 'Tüskeinda',      rune: 'ᚾ', color: 0x9dd86a, target: 'all',   fx: 'roots',    mult: 0.7,  slow: 2, poison: 2,
                     desc: 'Tüskés indák: 70% sebzés mindenkire, lassít és mérgez 2 körig' },
};
export const COMBO_COST = 3;
export const comboKey = (a, b) => [a, b].sort().join('+');

/**
 * A sárkány elemi összetétele.
 * @returns {{parts:Object<string,string>, primary:string, secondary:string,
 *            key:string, resonance:number, power:number}|null}
 */
export function composition(d, catalog) {
  const parts = {};
  for (const s of SLOTS) {
    if (!d[s]) continue;
    const id = Number(d[s]);
    parts[s] = PART_ELEMENT[s][id] || SHAPE_ELEMENT[catalog?.[s]?.[id]?.shape] || null;
  }
  const rest = ['test', 'szarny', 'lab'].map((s) => parts[s]).filter(Boolean);
  const primary = parts.fej || rest[0];
  if (!primary) return null;
  // A másodlagos: a fejen kívüli részek leggyakoribb eleme (döntetlennél test > szárny > láb)
  const count = {};
  for (const e of rest) count[e] = (count[e] || 0) + 1;
  let secondary = primary, best = 0;
  for (const e of rest) if (count[e] > best) { best = count[e]; secondary = e; }
  const key = comboKey(primary, secondary);
  const resonance = Object.values(parts).filter((e) => e === primary || e === secondary).length;
  return { parts, primary, secondary, key, resonance, power: 1 + 0.08 * Math.max(0, resonance - 2) };
}

/* --- Tanult technikák (a Gyakorlótéren, Ragnhildtól) -----------------
   target: 'enemy' egy ellenfél · 'all' minden ellenfél · 'ally' a
   legsebesültebb társ · 'party' az egész csapat · 'self' önmaga */
/* `src`: ki tanítja. Ragnhild a sajátjait mindig; a többit csak az adott
   helyen lehet először elsajátítani (a völgyben szétszórva, játékosonként
   máshol) — utána Ragnhild is begyakoroltatja bármelyik sárkánnyal. */
export const TECHNIQUES = {
  mark:       { name: 'Rúnabélyeg',     rune: 'ᛉ', color: 0xff6b6b, cost: 1, lvl: 2,  price: 35, target: 'enemy', src: 'ragnhild',
                desc: '60% sebzés, és a célpont 3 körig +30% sebzést kap mindenkitől' },
  warcry:     { name: 'Harci üvöltés',  rune: 'ᛜ', color: 0xffc46b, cost: 2, lvl: 3,  price: 45, target: 'party', src: 'ragnhild',
                desc: 'Az egész csapat +25% sebzést okoz 3 körig' },
  shieldwall: { name: 'Pajzsfal',       rune: 'ᛒ', color: 0x7ce7ff, cost: 1, lvl: 4,  price: 45, target: 'party', src: 'ragnhild',
                desc: 'Az egész csapat 30%-kal kevesebb sebzést kap 2 körig' },
  galdr:      { name: 'Gyógyító galdr', rune: 'ᛚ', color: 0x7dffb0, cost: 2, lvl: 2,  price: 30, target: 'ally', src: 'hermit',
                desc: 'A legsebesültebb társ 30%-ot gyógyul, és lemossa róla az égést és a mérget' },
  shadow:     { name: 'Árnyéklépés',    rune: 'ᛇ', color: 0xb18cff, cost: 1, lvl: 6,  price: 55, target: 'self', src: 'hermit',
                desc: 'A következő támadása biztos kritikus, addig pedig +40% eséllyel kitér' },
  thorns:     { name: 'Tüskepáncél',    rune: 'ᚦ', color: 0xc9a27e, cost: 1, lvl: 5,  price: 50, target: 'self', src: 'dwarf',
                desc: '3 körig a rá mért sebzés 35%-át visszaüti a támadóra' },
  quake:      { name: 'Földrengés',     rune: 'ᛞ', color: 0xd9a066, cost: 3, lvl: 10, price: 80, target: 'all', src: 'dwarf',
                desc: '100% sebzés minden ellenfélre, 25% eséllyel elkábít' },
  gale:       { name: 'Szélörvény',     rune: 'ᚹ', color: 0xc9f0ff, cost: 2, lvl: 8,  price: 60, target: 'all', src: 'frost',
                desc: '65% sebzés minden ellenfélre, és 2 körig lelassítja őket' },
  meteor:     { name: 'Hullócsillag',   rune: 'ᚺ', color: 0xff7a3d, cost: 3, lvl: 12, price: 95, target: 'enemy', src: 'muspell',
                desc: '260% sebzés egy célpontra — kitérni nem lehet előle' },
};

/* --- Ultik: a harci ének teli sávjával, a csapat közös csapásai -------
   Mindegyiket máshol lehet elnyerni; ha több is van, a játékos választ. */
export const ULTIMATES = {
  chorus:   { name: 'Sárkánykórus',    rune: 'ᛟ', color: 0xffe08a, from: 'Ragnhild, a Gyakorlótéren',
              desc: 'Minden sárkányod egyszerre okád — páncélon át, minden ellenfélre' },
  muspell:  { name: 'Muspell lángja',  rune: 'ᚲ', color: 0xff6a1f, from: 'a Muspell-oltár (a hamuvidéken)',
              desc: 'Tűzeső hullik minden ellenfélre, és 3 körig lángra kapnak' },
  fimbul:   { name: 'Fimbul-tél',      rune: 'ᛁ', color: 0x9fe8ff, from: 'a Fagyóriás trónja (a havas északon)',
              desc: 'Hóvihar: sebzés mindenkire, 55% eséllyel megfagyaszt, és 2 körig lassít' },
  valhalla: { name: 'Valkűrök áldása', rune: 'ᛒ', color: 0xfff3c4, from: 'a Valkűr-kő',
              desc: 'A csapat 55%-ot gyógyul, az elájultak felállnak, és 2 körig pajzsfal védi őket' },
  gungnir:  { name: 'Gungnir',         rune: 'ᚷ', color: 0xc9f0ff, from: 'a Vándor (aki sosem marad egy helyen)',
              desc: 'Odin dárdája: biztos kritikus, páncélon átütő csapás egy ellenfélre' },
};

/* --- Ereklyék: a csapat minden sárkányára ható, tartós áldások -------- */
export const RELICS = {
  mjolnir:     { name: 'Mjölnir-amulett',     icon: '🔨', desc: '+6% sebzés',               atk: 0.06 },
  brisingamen: { name: 'Brísingamen gyöngye', icon: '📿', desc: '+8% életerő',              hp: 0.08 },
  huginn:      { name: 'Huginn tolla',        icon: '🪶', desc: '+4 gyorsaság',             spd: 4 },
  skofnung:    { name: 'Sköfnung-pikkely',    icon: '🛡', desc: '+4 páncél',                def: 4 },
  draupnir:    { name: 'Draupnir gyűrűje',    icon: '💍', desc: '+25% rúnaszilánk a csatákból', shards: 0.25 },
  gjallar:     { name: 'Gjallarhorn szilánkja', icon: '📯', desc: 'A harci ének 25%-kal gyorsabban telik', chorus: 0.25 },
};

/** Csak Níðhöggr ismeri. */
export const BOSS_TECH = {
  root: { name: 'Gyökérrontás', rune: 'ᚾ', color: 0x9d6bff, cost: 2, target: 'all', desc: '70% sebzés mindenkire, és 3 körig mérgez' },
};
export const techInfo = (k) => TECHNIQUES[k] || BOSS_TECH[k];

/** Hány technikát tudhat egy sárkány: a második hely a 8. szinten nyílik. */
export const techSlots = (level) => (level >= 8 ? 2 : 1);

/* --- A csapat közös csapása (Ragnhild tanítja a II. fejezetben) ----- */
export const CHORUS = {
  name: 'Sárkánykórus', rune: 'ᛟ', color: 0xffe08a, max: 100,
  desc: 'Minden sárkányod egyszerre okád — páncélon át, minden ellenfélre',
  gain: { hit: 7, crit: 6, hurt: 6, ko: 14 },
};

/* --- Edzés: tartós fokozatok sárkányonként -------------------------- */
export const TRAIN = {
  atk: { name: 'Erő',          icon: '⚔', max: 5, per: 0.04, desc: '+4% sebzés fokonként' },
  def: { name: 'Páncél',       icon: '🛡', max: 5, per: 3,    desc: '+3 páncél fokonként' },
  spd: { name: 'Fürgeség',     icon: '➶', max: 5, per: 3,    desc: '+3 gyorsaság fokonként' },
  hp:  { name: 'Állóképesség', icon: '❤', max: 5, per: 0.05, desc: '+5% életerő fokonként' },
};
export const drillCost = (rank) => 25 + rank * 15;

const HEAD_SKILL = {
  snout: 'fire', blunt: 'crush', beak: 'pierce', crest: 'thunder',
  skull: 'drain', viper: 'venom', horned: 'charge', crystal: 'frost',
};

const BODY = {
  standard: { def: 10 },
  stocky:   { def: 16, hp: 1.10, spd: -4 },
  arched:   { def: 12, hp: 1.03 },
  serpent:  { def: 6,  spd: 8 },
  long:     { def: 8,  spd: 4, hp: 1.05 },
  skeletal: { def: 5,  atk: 1.08 },
};
const LEGS = {
  digit:  { def: 4,  spd: 6 },
  pillar: { def: 10, spd: -6 },
  lanky:  { def: 0,  spd: 12 },
  hoof:   { def: 5,  spd: 8 },
  grasp:  { def: 6,  crit: 0.05 },
};
const WINGS = {
  bat:     { spd: 10, eva: 0.05 },
  feather: { spd: 14, eva: 0.08 },
  insect:  { spd: 20, eva: 0.12 },
  fin:     { spd: 4,  eva: 0.02 },
  crystal: { spd: 8,  eva: 0.04, def: 4 },
  double:  { spd: 16, eva: 0.06 },
  torn:    { spd: 6,  eva: 0.03, crit: 0.05 },
};

/* --- Szint ----------------------------------------------------------- */
export const MAX_LEVEL = 40;
export const levelOf    = (xp) => Math.min(MAX_LEVEL, Math.floor(Math.sqrt(Math.max(0, xp) / 30)) + 1);
export const xpForLevel = (lvl) => 30 * (lvl - 1) * (lvl - 1);

/* --- Álvéletlen (a térképnek és a vad sárkányoknak) ------------------ */
export function mulberry32(seed) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
export const pick = (arr, rng = Math.random) => arr[Math.floor(rng() * arr.length)];

/**
 * A sárkány harci értékei.
 * @param {object} d        {fej,test,lab,szarny,hp,dmg,xp,gen,traits}
 * @param {object} catalog  a szerver katalógusa (forma, méret)
 */
export function deriveStats(d, catalog, extra = {}) {
  const shape = (slot) => (d[slot] ? catalog[slot]?.[d[slot]]?.shape : null);
  const body  = BODY[shape('test')]  || { def: 3 };
  const legs  = LEGS[shape('lab')]   || { def: 0, spd: -8 };
  const wings = WINGS[shape('szarny')] || { spd: 0, eva: 0 };
  const wingSize = d.szarny ? (catalog.szarny?.[d.szarny]?.size ?? 1) : 1;

  let def  = 2 + (body.def || 0) + (legs.def || 0) + (wings.def || 0);
  let spd  = 50 + (body.spd || 0) + (legs.spd || 0) + (wings.spd || 0) * wingSize;
  let eva  = 0.02 + (wings.eva || 0) * wingSize;
  let crit = 0.08 + (legs.crit || 0) + (wings.crit || 0);
  let hpMul  = body.hp || 1;
  let atkMul = body.atk || 1;

  const level  = extra.level ?? levelOf(d.xp || 0);
  const growth = 1 + 0.05 * (level - 1) + 0.04 * (d.gen || 0);

  const traits = new Set(d.traits || []);
  if (traits.has('ancient'))   hpMul *= 1.12;
  if (traits.has('storm'))     spd += 12;
  if (traits.has('ironscale')) def += 8;
  if (traits.has('fated'))     crit += 0.08;

  // Edzésfokozatok (a Gyakorlótéren szerzett, tartós bónusz)
  const tr = extra.train || {};
  hpMul  *= 1 + TRAIN.hp.per  * (tr.hp  || 0);
  atkMul *= 1 + TRAIN.atk.per * (tr.atk || 0);
  def    += TRAIN.def.per * (tr.def || 0);
  spd    += TRAIN.spd.per * (tr.spd || 0);

  // Ereklyék (a csapat közös kincsei)
  for (const k of extra.relics || []) {
    const r = RELICS[k];
    if (!r) continue;
    atkMul *= 1 + (r.atk || 0);
    hpMul  *= 1 + (r.hp || 0);
    spd += r.spd || 0;
    def += r.def || 0;
  }

  // A vadon élő sárkányok az első fokokon gyengébbek (betanítatlan
  // vadak) — különben egy friss kezdő sárkány az első barlangban elvérzik.
  const WILD = { 1: 0.6, 2: 0.68, 3: 0.74, 4: 0.64, 5: 0.64 };
  const wild = d.wild && !extra.boss ? WILD[d.tier] || 1 : 1;
  const bossMul = extra.boss ? { hp: BOSS.hpMul, atk: BOSS.atkMul } : { hp: wild, atk: wild };

  return {
    maxHp: Math.round(Math.max(30, d.hp || 0) * 1.2 * hpMul * growth * bossMul.hp),
    atk:   Math.round(Math.max(8, d.dmg || 0) * atkMul * growth * bossMul.atk),
    def:   Math.round(def),
    spd:   Math.round(spd),
    eva:   Math.min(0.3, eva),
    crit:  Math.min(0.5, crit),
    skill: HEAD_SKILL[shape('fej')] || 'tail',
    combo: composition(d, catalog),
    level,
    traits,
  };
}

/* =====================================================================
   Harc
   ===================================================================== */

/**
 * Egy találat kiszámítása.
 * @returns {{amount:number, crit:boolean, miss:boolean}}
 */
export function rollDamage(att, tgt, mult, opts = {}) {
  const rng = opts.rng || Math.random;
  const has = (u, k) => (u.status?.[k] || 0) > 0;
  const eva = tgt.stats.eva + (has(tgt, 'shadow') ? 0.4 : 0);
  if (!opts.sure && rng() < eva) return { amount: 0, crit: false, miss: true };

  const defense = opts.pierce ? 0 : tgt.stats.def;
  let dmg = att.stats.atk * 0.9 * mult * (0.88 + rng() * 0.24) * (60 / (60 + defense));

  if (att.stats.traits.has('berserk') && att.hp < att.stats.maxHp / 2) dmg *= 1.2;
  if (opts.fire && att.stats.traits.has('fireblood')) dmg *= 1.15;
  if (has(att, 'atkUp')) dmg *= 1.25;
  if (has(tgt, 'ward'))  dmg *= 0.7;
  if (has(tgt, 'mark'))  dmg *= 1.3;
  if (has(tgt, 'broken')) dmg *= BOSS.brokenMul;
  if (tgt.defending) dmg *= 0.5;

  const crit = opts.forceCrit || has(att, 'shadow') || rng() < att.stats.crit;
  if (crit) dmg *= 1.6;
  return { amount: Math.max(1, Math.round(dmg)), crit, miss: false };
}

/* --- Níðhöggr, a végső ellenfél (battle.js: #bossTurn, boss.js: a rajza) ---
   Egyedül érkezik az utolsó hullámban, három fázisban harcol (a 66% és a
   33% életerőnél vált), a harmadikban körönként kétszer lép. Időnként
   „mély lélegzetet vesz": a következő lépése a Világvég-lehelet, ami a
   teljes életerő 90%-át viszi el — védekezve csak 30%-ot —, hacsak meg nem
   törik előbb. A találatok a MEGTÖRÉS sávot töltik; ha megtelik,
   megtántorodik (kimarad), és két körig +40% sebzést kap. A kábítást és
   fagyasztást lerázza, de az is töri.
   Szimulációval hangolva (edzéssel, ereklyékkel, kórussal számolva):
   20. szinten ~50%, 24. szinten ~80% győzelem; a technikák ezen javítanak. */
export const BOSS = {
  hpMul: 2.0, atkMul: 0.72,
  phases: [0.66, 0.33],
  staggerMax: 80,
  brokenMul: 1.4,
  moves: {
    bite:   { name: 'Gyökértépő harapás', mult: 1.45 },
    tail:   { name: 'Farokcsapás',        mult: 0.7 },
    roots:  { name: 'Gyökérrontás',       mult: 0.6, poison: 3 },
    gale:   { name: 'Éjszárny-vihar',     mult: 0.5, slow: 2 },
    venom:  { name: 'Méregláng',          mult: 0.65, poison: 2, burn: 2 },
    quake:  { name: 'Világfa-rengés',     mult: 0.75, stun: 0.2 },
    breath: { name: 'Világvég-lehelet',   hit: 0.9, guarded: 0.3, burn: 3 },
  },
};
export const bossPhase = (hp, max) => (hp > max * BOSS.phases[0] ? 1 : hp > max * BOSS.phases[1] ? 2 : 3);

/** Energia: támadás és védekezés +1, a különleges képesség 2-be kerül. */
export const MAX_ENERGY = 3;
export const SKILL_COST = 2;

/* =====================================================================
   Vadon élő sárkányok
   ===================================================================== */

export const CAVES = {
  1: { name: 'Mohos barlang',     color: 0x5fd18a, palette: ['#7bd88f', '#a3c46b', '#5fb3a1', '#c2d66b'], waves: [1, 1, 1] },
  2: { name: 'Fagyott Torok',     color: 0x7ce7ff, palette: ['#8fd3ff', '#b9e6ff', '#6fa8ff', '#d9f2ff'], waves: [1, 2, 2] },
  3: { name: 'Suttogó Mélység',   color: 0xb18cff, palette: ['#9d7bff', '#c28cff', '#6f6bd8', '#e08cff'], waves: [2, 2, 3] },
  4: { name: 'Hamuverem',         color: 0xff7a3d, palette: ['#ff6a3d', '#ff9a3d', '#d94a2a', '#ffc46b'], waves: [2, 3, 3] },
  5: { name: 'Níðhöggr Gyökere',  color: 0xffd36b, palette: ['#3a2a55', '#55304a', '#2a3a55'],            waves: [1] },        // egyből a boss
};

const NAME_A = ['Moha', 'Hamu', 'Jég', 'Kő', 'Vihar', 'Árny', 'Rozsda', 'Szirt', 'Köd', 'Parázs', 'Fagy', 'Tövis', 'Csont', 'Éj'];
const NAME_B = ['karmú', 'farkú', 'fogú', 'szárnyú', 'szemű', 'taréjú', 'pikkelyű', 'torkú', 'hátú', 'lelkű'];

/* A mélyebb barlangok lakói harcedzettek: egy technikát ők is ismernek
   (a II. fokon csak némelyik, az I. fokon egyik sem — ott tanul a kezdő). */
const WILD_TECH = {
  2: ['mark', 'shieldwall'],
  3: ['mark', 'warcry', 'galdr'],
  4: ['warcry', 'gale', 'shieldwall', 'galdr'],
  5: ['gale', 'quake', 'warcry'],
};
const wildTech = (tier, rng) => {
  if (tier < 2 || (tier === 2 && rng() > 0.3)) return [];
  return [pick(WILD_TECH[tier], rng)];
};

/** Gyakorló ellenfél Ragnhild karámjából, a csapat szintjéhez igazítva. */
export function makeSparring(level, tiers, i, rng = Math.random) {
  const tier = Math.max(1, Math.min(4, Math.ceil(level / 4)));
  const parts = {};
  for (const s of SLOTS) parts[s] = pick(tiers[s][tier], rng);
  const names = ['Szélvész', 'Kőszív', 'Vasfarok'];
  return {
    id: `spar-${i}-${Math.floor(rng() * 1e9)}`, wild: true, spar: true, tier,
    nev: names[i % names.length], szin: ['#d9c7a1', '#c96b4a', '#8fb3ff'][i % 3],
    ...parts, hp: 0, dmg: 0,
    xp: xpForLevel(Math.max(1, level)), gen: 0, traits: [],
    tech: [pick(['mark', 'warcry', 'shieldwall', 'galdr'], rng)],
  };
}

/** A barlang egy lakója. A boss (5. fok utolsó hulláma) Níðhöggr maga. */
export function makeWild(tier, wave, tiers, rng = Math.random, boss = false) {
  const level = Math.min(MAX_LEVEL, 1 + (tier - 1) * 4 + (boss ? 3 : wave) + Math.floor(rng() * 2));
  if (boss) {
    return {
      id: `wild-boss`, wild: true, boss: true, tier,
      nev: 'Níðhöggr, a Gyökérrágó', szin: '#4a2f6b',
      fej: 9, test: 9, lab: 9, szarny: 9,
      hp: 400, dmg: 90, xp: xpForLevel(level), gen: 0, traits: ['ironscale'],
      tech: ['root', 'mark'],
    };
  }
  const parts = {};
  for (const s of SLOTS) parts[s] = pick(tiers[s][tier], rng);
  return {
    id: `wild-${tier}-${wave}-${Math.floor(rng() * 1e9)}`, wild: true, tier,
    nev: `${pick(NAME_A, rng)}${pick(NAME_B, rng)}`,
    szin: pick(CAVES[tier].palette, rng),
    ...parts,
    hp: 0, dmg: 0,                 // a katalógusból számolódik (lásd withTotals)
    xp: xpForLevel(level), gen: 0,
    traits: rng() < 0.08 * tier ? [pick(['ironscale', 'storm', 'berserk', 'regen', 'fated'], rng)] : [],
    tech: wildTech(tier, rng),
  };
}

/** HP/DMG a testrészekből — ugyanúgy, ahogy a szerver számolja. */
export function withTotals(d, catalog) {
  if (d.boss) return d;
  let hp = 0, dmg = 0;
  for (const s of SLOTS) {
    const p = d[s] ? catalog[s]?.[d[s]] : null;
    if (p) { hp += p.hp; dmg += p.dmg; }
  }
  return { ...d, hp, dmg };
}

/* =====================================================================
   Jutalmak
   ===================================================================== */
export const shardsFor = (enemyLevel) => 5 + enemyLevel * 4;
export const xpFor     = (enemyLevel) => 10 + enemyLevel * 9;
export const caveBonus = (tier) => 40 * tier;
export const TAME_CHANCE = 0.4;
export const TAME_COST   = 25;
export const breedCost   = (gen) => 40 + 20 * Math.max(0, gen - 1);
