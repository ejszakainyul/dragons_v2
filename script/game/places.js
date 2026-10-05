/* =====================================================================
   A völgy helyei — tanítók, oltárok, emberek, ládák, rejtvények
   ---------------------------------------------------------------------
   A terep mindenkinek ugyanaz (world.js), de ezek a helyek JÁTÉKOSONKÉNT
   máshová kerülnek: a játékos nevéből képzett maggal, a vidékhez illő
   csempékre (az oltár a hamuvidékre, a trón a havas északra, a kovács a
   hegyek tövébe…). Így mindenkinek meg kell keresnie a sajátjait.

     shrine   tanítóhely: technikát és/vagy ultit lehet ott elnyerni
              (talány, felajánlás, őr-csata vagy méltóság kell hozzá)
     npc      halász, kalmár, skald — mellékszálak, bolt, pletykák
     ruins    a Régi Kőkör: rúnasorrend-rejtvény, a közepén ereklye
     chest    láda: szilánk, gyógyfű, ritkán ereklye
     sign     útjelző tábla a csomópontokban: merre mi van
     wanderer a Vándor: 8 percenként máshol bukkan fel

   Minden állapot a mentésben (save.places, save.techSrc, save.ultis,
   save.relics) — a szervert nem érinti, mert nem jön létre új sárkány.
   ===================================================================== */
import { TILE, B } from './world.js';
import { mulberry32, TECHNIQUES, ULTIMATES, RELICS, SLOTS, pick, makeWild, levelOf, xpForLevel } from './rules.js';
import { esc } from './hud.js';

const L = (who, text, choices) => ({ who, text, ...(choices ? { choices } : {}) });

/* =====================================================================
   A helyek leírása
   ===================================================================== */
export const PLACES = {
  hermit:   { kind: 'shrine', name: 'Gunnhild kunyhója',    sprite: 'hut',       where: 'forest',    teaches: ['galdr', 'shadow'], color: '#7dffb0' },
  dwarf:    { kind: 'shrine', name: 'Brokk kovácsműhelye',  sprite: 'forge',     where: 'mountain',  teaches: ['thorns', 'quake'], color: '#ffb36b' },
  frost:    { kind: 'shrine', name: 'A Fagyóriás trónja',   sprite: 'throne',    where: 'snow',      teaches: ['gale'], ulti: 'fimbul', color: '#9fe8ff' },
  muspell:  { kind: 'shrine', name: 'Muspell-oltár',        sprite: 'altar',     where: 'ash',       teaches: ['meteor'], ulti: 'muspell', color: '#ff6a1f' },
  valkyrie: { kind: 'shrine', name: 'A Valkűr-kő',          sprite: 'valkstone', where: 'open',      ulti: 'valhalla', color: '#fff3c4' },
  fisher:   { kind: 'npc',    name: 'Bjarki, a halász',     sprite: 'npc-fisher',   where: 'lakeshore', color: '#8fd3ff' },
  merchant: { kind: 'npc',    name: 'Sigrid, a kalmár',     sprite: 'npc-merchant', where: 'seashore',  color: '#ffd36b' },
  skald:    { kind: 'npc',    name: 'Einar, a skald',       sprite: 'npc-skald',    where: 'nearhome',  color: '#c28cff' },
  ruins:    { kind: 'ruins',  name: 'A Régi Kőkör',         where: 'clearing', color: '#b8c4e0' },
};

/* A ládák tartalma; az ereklyés ládák a nehezebb vidékekre kerülnek. */
const CHESTS = [
  { where: 'snow', loot: { relic: 'huginn', shards: 20 } },
  { where: 'ash',  loot: { relic: 'gjallar', shards: 30 } },
  { where: 'any',  loot: { shards: 40 } },
  { where: 'any',  loot: { shards: 25, herbs: 2 } },
  { where: 'forest', loot: { herbs: 3 } },
  { where: 'any',  loot: { shards: 60 } },
  { where: 'far',  loot: { shards: 45, herbs: 1 } },
];

/** A Kőkör rúnái körben; a kezdet négy rúnája (fuþark) nyitja. */
export const RING_RUNES = ['ᚨ', 'ᚱ', 'ᚢ', 'ᚦ', 'ᚠ', 'ᚲ'];
const RING_ORDER = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ'];

/** Egyszerű szám-mag a játékos nevéből. */
export function playerSeed(name) {
  let h = 2166136261;
  for (const ch of String(name || 'viking')) { h ^= ch.charCodeAt(0); h = Math.imul(h, 16777619); }
  return h >>> 0;
}

/* =====================================================================
   Elhelyezés
   ===================================================================== */
export function layoutPlaces(world, seed) {
  const { w: W, h: H, biome, blocked, reach, snowy, ashy, occupied, treeAt } = world;
  const rng = mulberry32(seed ^ 0x5eed);
  const at = (x, y) => y * W + x;
  const inside = (x, y) => x >= 3 && y >= 3 && x < W - 3 && y < H - 3;
  const home = world.pois[0];
  const taken = [];                       // a már kiosztott helyek (egymástól távol)
  const far = (x, y, d) => taken.every((p) => Math.hypot(p.x - x, p.y - y) >= d)
    && world.pois.every((p) => Math.hypot(p.x - x, p.y - y) >= 4);
  const free = (x, y) => inside(x, y) && reach[at(x, y)] && !blocked[at(x, y)] && !occupied[at(x, y)]
    && biome[at(x, y)] !== B.PATH && biome[at(x, y)] !== B.BRIDGE;
  // A hely maga és a bejárata (alatta) is legyen szabad, és oldalról is meg lehessen kerülni
  const spot = (x, y) => free(x, y) && free(x, y + 1) && (free(x - 1, y) || free(x + 1, y));
  const trees = (x, y) => {
    let n = 0;
    for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) if (treeAt[at(x + dx, y + dy)]) n++;
    return n;
  };
  const nearB = (x, y, b, r = 1) => {
    for (let dy = -r; dy <= r; dy++) for (let dx = -r; dx <= r; dx++) if (biome[at(x + dx, y + dy)] === b) return true;
    return false;
  };
  const dHome = (x, y) => Math.hypot(x - home.x, y - home.y);
  const tests = {
    forest:    (x, y) => !snowy[at(x, y)] && !ashy[at(x, y)] && trees(x, y) >= 4 && dHome(x, y) > 8,
    ash:       (x, y) => ashy[at(x, y)],
    snow:      (x, y) => snowy[at(x, y)] && biome[at(x, y)] === B.GRASS,
    mountain:  (x, y) => !ashy[at(x, y)] && !snowy[at(x, y)] && nearB(x, y, B.MOUNTAIN, 1) && dHome(x, y) > 10,
    open:      (x, y) => !snowy[at(x, y)] && !ashy[at(x, y)] && trees(x, y) === 0 && dHome(x, y) > 12,
    lakeshore: (x, y) => biome[at(x, y)] === B.SAND && x < 32 && y > 36 && nearB(x, y, B.WATER, 1),
    seashore:  (x, y) => biome[at(x, y)] === B.SAND && x > 58 && y > 46 && nearB(x, y, B.WATER, 1),
    nearhome:  (x, y) => !snowy[at(x, y)] && dHome(x, y) >= 4 && dHome(x, y) <= 8 && y > home.y - 2,
    any:       (x, y) => dHome(x, y) > 9,
    far:       (x, y) => dHome(x, y) > 26,
    clearing:  (x, y) => {
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) {
        const i = at(x + dx, y + dy);
        if (!inside(x + dx, y + dy) || blocked[i] || occupied[i] || biome[i] !== B.GRASS || snowy[i] || ashy[i]) return false;
      }
      return free(x, y + 3) && dHome(x, y) > 10;
    },
  };
  const candidates = (test) => {
    const out = [];
    for (let y = 4; y < H - 4; y++) for (let x = 4; x < W - 4; x++) if (spot(x, y) && tests[test](x, y)) out.push({ x, y });
    return out;
  };
  const choose = (test, minDist = 7) => {
    const list = candidates(test);
    for (let tries = 0; tries < 200 && list.length; tries++) {
      const c = list[Math.floor(rng() * list.length)];
      if (far(c.x, c.y, minDist)) return c;
    }
    return list.length ? list[Math.floor(rng() * list.length)] : null;
  };
  const claim = (c, solid = 1) => {
    taken.push(c);
    occupied[at(c.x, c.y)] = 1;
    occupied[at(c.x, c.y + 1)] = 1;
    if (solid) blocked[at(c.x, c.y)] = 1;
  };

  const added = [];
  for (const [key, def] of Object.entries(PLACES)) {
    const c = choose(def.where);
    if (!c) continue;
    claim(c, def.kind !== 'ruins');
    if (def.kind === 'ruins') {
      // A kör közepe a láda (szilárd), a kövek díszek körülötte
      blocked[at(c.x, c.y)] = 1;
      for (let dy = -2; dy <= 2; dy++) for (let dx = -2; dx <= 2; dx++) occupied[at(c.x + dx, c.y + dy)] = 1;
    }
    added.push({ type: def.kind, id: key, place: key, x: c.x, y: c.y, name: def.name });
  }
  CHESTS.forEach((ch, i) => {
    const c = choose(ch.where, 6) || choose('any', 4);
    if (!c) return;
    claim(c);
    added.push({ type: 'chest', id: `chest${i}`, x: c.x, y: c.y, loot: ch.loot, name: 'Láda' });
  });

  // Útjelző táblák: a csomópontok mellé, egymástól távol
  const juncs = [...world.junctions].sort(() => rng() - 0.5);
  let signs = 0;
  for (const j of juncs) {
    if (signs >= 5) break;
    if (!far(j.x, j.y, 9)) continue;
    const side = [[1, -1], [-1, -1], [1, 1], [-1, 1], [1, 0], [-1, 0]].map(([dx, dy]) => ({ x: j.x + dx, y: j.y + dy })).find((s) => spot(s.x, s.y) || (free(s.x, s.y) && free(s.x, s.y + 1)));
    if (!side) continue;
    claim(side);
    added.push({ type: 'sign', id: `sign${signs++}`, x: side.x, y: side.y, name: 'Útjelző tábla' });
  }

  // A Vándor lehetséges helyei: tisztások, utak mentén
  const wanderSpots = [];
  for (let i = 0; i < 6; i++) {
    const c = choose('any', 8);
    if (!c) continue;
    taken.push(c);
    wanderSpots.push(c);
  }
  if (wanderSpots.length) {
    added.push({ type: 'wanderer', id: 'wanderer', x: wanderSpots[0].x, y: wanderSpots[0].y, spots: wanderSpots, name: 'Egy öreg vándor' });
  }

  // Kóborló vad sárkányok fészkelőhelyei (a csapattól távol)
  const roamSpots = candidates('any').filter((c) => dHome(c.x, c.y) > 13).sort(() => rng() - 0.5).slice(0, 40);

  world.pois.push(...added);
  return { added, roamSpots };
}

/** A Vándor 8 percenként máshová áll; a megfejtés után is jár-kel. */
export function wandererIndex(p, now, seed) {
  return (Math.floor(now / 480) + (seed % 7)) % p.spots.length;
}

/* =====================================================================
   Interakciók
   ===================================================================== */
export class Places {
  /**
   * @param {object} g     közös szolgáltatások (state, hud, sfx, story…)
   * @param {object} host  a völgy (overworld) visszahívásai:
   *                       { teach(keys, place), guardian(placeId), reveal(x, y, r), refresh(p) }
   */
  constructor(g, host) {
    this.g = g;
    this.host = host;
  }

  get save() { return this.g.state.save; }
  ps(id) { return (this.save.places[id] ||= {}); }
  say(lines) { return this.g.story.dialogue.play(lines); }
  get now() { return this.g.state.now; }

  async interact(p) {
    const fn = {
      shrine: () => this.shrine(p),
      npc: () => this.npc(p),
      ruins: () => this.ruins(p),
      chest: () => this.chest(p),
      sign: () => this.sign(p),
      wanderer: () => this.wanderer(p),
    }[p.type];
    await fn?.();
    this.host.refresh(p);
  }

  /** Egy tanítóhely technikáinak felszabadítása + a tanítás ablaka. */
  #unlock(key) {
    const { state } = this.g;
    const fresh = state.grant('techSrc', key);
    if (fresh) {
      const names = PLACES[key].teaches.map((t) => TECHNIQUES[t].name).join(', ');
      this.g.hud.toast(`ᛚ Új technikák taníthatók: <b>${esc(names)}</b><small>Itt, és mostantól Ragnhildnál is.</small>`, 'good', 5500);
      this.g.sfx.buff();
    }
    state.commit();
  }

  #grantUlti(key) {
    const { state, hud, sfx } = this.g;
    if (!state.grant('ultis', key)) return;
    const u = ULTIMATES[key];
    sfx.chorus();
    hud.toast(`${u.rune} <b>Új ulti: ${esc(u.name)}</b><small>${esc(u.desc)}. Ha a harci ének megtelt: Q.</small>`, 'good', 7000);
    state.commit();
  }

  #grantRelic(key) {
    const { state, hud, sfx } = this.g;
    if (!state.grant('relics', key)) return false;
    const r = RELICS[key];
    sfx.levelUp();
    hud.toast(`${r.icon} <b>Ereklye: ${esc(r.name)}</b><small>${esc(r.desc)} — a csapat minden sárkányára.</small>`, 'good', 6000);
    hud.renderParty();
    state.commit('party');
    return true;
  }

  #cooldown(id, label) {
    const left = Math.ceil((this.ps(id).retry || 0) - this.now);
    if (left <= 0) return false;
    this.g.hud.toast(`${esc(label)} <small>Még ${left} mp.</small>`, 'warn');
    return true;
  }

  /* ------------------------------------------------------------------ */
  /* Tanítóhelyek                                                        */
  /* ------------------------------------------------------------------ */
  async shrine(p) {
    switch (p.place) {
      case 'hermit': return this.#hermit(p);
      case 'dwarf': return this.#dwarf(p);
      case 'frost': return this.#frost(p);
      case 'muspell': return this.#muspell(p);
      case 'valkyrie': return this.#valkyrie(p);
    }
  }

  async #hermit(p) {
    const { state } = this.g;
    if (state.has('techSrc', 'hermit')) {
      await this.say([L('gunnhild', pick([
        'Na, mit tanuljon ma a sárkányod? A gombáimhoz ne nyúlj.',
        'A galdr nem dal — a galdr parancs. Csak kedvesen mondjuk.',
        'Megint te? Jó. Legalább nem a medve.',
      ]))]);
      return this.host.teach(PLACES.hermit.teaches, p);
    }
    if (this.#cooldown('hermit', 'Gunnhild még durcás a rossz válasz miatt.')) return;
    const ans = await this.say([
      L('gunnhild', 'Ki zörget? Á, egy sárkánylovas. Évek óta nem járt erre senki, aki ne a gombáimat akarta volna ellopni.'),
      L('gunnhild', 'Tudok én egyet-mást. <b>Galdrot</b>, ami begyógyítja a sebet. <b>Lépést</b>, ami az árnyékba rejt. De a tudás nem ingyen jár: felelj a talányomra.'),
      L('gunnhild', 'Mi az, amiből minél többet veszel el, annál <em>nagyobb</em> lesz?', ['A gödör', 'A sárkány étvágya', 'A tenger']),
    ]);
    if (ans === 0) {
      await this.say([L('gunnhild', 'Okos. A föld tudja, a víz nem. Gyere, megmutatom, mit tud egy öregasszony.')]);
      this.#unlock('hermit');
      return this.host.teach(PLACES.hermit.teaches, p);
    }
    this.ps('hermit').retry = this.now + 90;
    state.commit();
    if (ans >= 0) await this.say([L('gunnhild', 'Hát ez nem az. Menj, gondolkodj — és ha megvan, gyere vissza. Addig a kunyhóm zárva.')]);
  }

  async #dwarf(p) {
    const { state, hud } = this.g;
    const st = this.ps('dwarf');
    if (!st.met) {
      st.met = 1;
      await this.say([
        L('brokk', 'Ki nyitja rám az ajtót a fújtatás közepén?! …Sárkány? Mutasd a pikkelyét.'),
        L('brokk', 'Hm. Jó anyag. A törpék két dolgot tudnak: kovácsolni és a földet megrázni. Az utóbbit megtanítom — de a kovácsnak is ennie kell.'),
      ]);
    }
    const unlocked = state.has('techSrc', 'dwarf');
    const hasScale = state.has('relics', 'skofnung');
    const opts = [unlocked ? 'Tanítás' : 'Fizetek 40 ᚱ-t a tanításért', hasScale ? 'Csak beköszöntem' : 'Kovácsolj nekem pikkelyt (70 ᚱ)', 'Majd máskor'];
    const ans = await this.say([L('brokk', unlocked ? 'Na? Rázzuk meg a földet, vagy csak a sörömet iszod?' : 'Szóval? Az idő drága, a parázs még drágább.', opts)]);
    if (ans === 0) {
      if (!unlocked) {
        if (state.save.shards < 40) { await this.say([L('brokk', 'Negyven szilánk, kölyök. Nem harminckilenc. Gyere vissza, ha megvan.')]); return; }
        state.save.shards -= 40;
        this.#unlock('dwarf');
        await this.say([L('brokk', 'Lábat szét, súlypont le, és üss a földbe, mintha az anyósod lenne alatta. Na. Most a sárkány.')]);
      }
      return this.host.teach(PLACES.dwarf.teaches, p);
    }
    if (ans === 1 && !hasScale) {
      if (state.save.shards < 70) { await this.say([L('brokk', 'Hetven. A Sköfnung-pikkely nem vásári kacat.')]); return; }
      state.save.shards -= 70;
      this.g.sfx.crack();
      await this.say([L('brokk', 'Kalapács, üllő, egy csepp sárkányvér… Íme. Minden sárkányodra ráillik — a törpe munka ilyen.')]);
      this.#grantRelic('skofnung');
      hud.renderResources();
    }
  }

  async #frost(p) {
    const { state } = this.g;
    if (state.has('ultis', 'fimbul')) {
      await this.say([L('hrimthurs', '<em>A tél emlékszik rád, melegvérű. Tanulj, ha akarsz — aztán menj, mielőtt megfagysz.</em>')]);
      return this.host.teach(PLACES.frost.teaches, p);
    }
    if (this.#cooldown('frost', 'A trón jéghideg és néma.')) return;
    const ans = await this.say([
      L('hrimthurs', '<em>Ki merészel a trónom elé állni, melegvérű?</em>'),
      L('hrimthurs', '<em>A fagy nem tűri a gyengét. De a bölcset igen. Felelj, és megkapod a tél egy darabját.</em>'),
      L('hrimthurs', '<em>Az enyém, mégis mások használják többet, mint én. Mi az?</em>', ['A trónom', 'A nevem', 'A jég']),
    ]);
    if (ans === 1) {
      await this.say([L('hrimthurs', '<em>…Hrímþurs. Így szólítanak, akik még élnek. Vidd a <b>Fimbul-tél</b> dalát — és a szél örvényét.</em>')]);
      this.#grantUlti('fimbul');
      this.#unlock('frost');
      this.host.burst?.(p, 0x9fe8ff);
      return this.host.teach(PLACES.frost.teaches, p);
    }
    this.ps('frost').retry = this.now + 120;
    state.commit();
    if (ans >= 0) await this.say([L('hrimthurs', '<em>Rossz. A fagy türelmes. Te is légy az.</em>')]);
  }

  async #muspell(p) {
    const { state } = this.g;
    if (state.has('ultis', 'muspell')) {
      await this.say([L('surtr', '<em>A láng ismer téged. Égess bátran.</em>')]);
      return this.host.teach(PLACES.muspell.teaches, p);
    }
    const ans = await this.say([
      L('surtr', '<em>A láng nem kérdez. A láng próbára tesz.</em>'),
      L('surtr', '<em>Győzd le az őrömet, és Muspell tüze a tiéd. Égj el, és a hamuval együtt fújlak vissza a völgybe.</em>',
        ['Állok elébe! (őr-csata)', 'Még nem vagyok kész']),
    ]);
    if (ans === 0) this.host.guardian('muspell');
  }

  /** Az őr-csata után (a völgy hívja, ha győzött). */
  async guardianWon(id) {
    const p = this.g.world.pois.find((x) => x.place === id);
    if (id === 'muspell') {
      await this.say([L('surtr', '<em>…A láng elfogad. Vidd <b>Muspell lángját</b>, és a hulló csillagot. A tűz a tiéd — de te is a tűzé vagy.</em>')]);
      this.#grantUlti('muspell');
      this.#unlock('muspell');
      this.host.burst?.(p, 0xff6a1f);
      this.host.teach(PLACES.muspell.teaches, p);
    }
  }

  async #valkyrie(p) {
    const { state, hud, sfx } = this.g;
    if (state.has('ultis', 'valhalla')) {
      const st = this.ps('valkyrie');
      if ((st.blessAt || 0) > this.now) {
        await this.say([L('brynhild', 'A kő még a legutóbbi áldástól izzik. Később, sárkánylovas.')]);
        return;
      }
      st.blessAt = this.now + 300;
      state.healAll();
      sfx.heal();
      this.host.burst?.(p, 0xfff3c4);
      await this.say([L('brynhild', 'Pihenjenek a sárkányaid a szárnyaink árnyékában. Felépültek.')]);
      hud.toast('ᛒ A Valkűr-kő áldása: a csapatod teljesen felépült.', 'good');
      return;
    }
    if (state.save.stats.wins < 3) {
      await this.say([
        L('huginn', 'A kő hallgat… de érzem, hogy valaki figyel a felhők mögül. Kraa.'),
        L('huginn', 'A valkűrök csak a <b>méltókhoz</b> szólnak. Győzz legalább <b>három barlangi csatában</b>, aztán gyere vissza. (Eddig: ' + state.save.stats.wins + ')'),
      ]);
      return;
    }
    await this.say([
      L('brynhild', 'Láttalak a csatákban, sárkánylovas. Nem futottál el — és amikor kellett, igen. Az is bátorság.'),
      L('brynhild', 'A valkűrök azokat viszik Valhallába, akik elesnek. Te nem fogsz. Erről mi gondoskodunk.'),
      L('brynhild', 'Vidd a <b>Valkűrök áldását</b>. Ha a harci ének megtelt, hívj — és a sárkányaid újra felállnak.'),
    ]);
    this.#grantUlti('valhalla');
    this.host.burst?.(p, 0xfff3c4);
  }

  /* ------------------------------------------------------------------ */
  /* Emberek                                                             */
  /* ------------------------------------------------------------------ */
  async npc(p) {
    if (p.place === 'fisher') return this.#fisher(p);
    if (p.place === 'merchant') return this.#merchant(p);
    if (p.place === 'skald') return this.#skald(p);
  }

  async #fisher(p) {
    const { state, hud } = this.g;
    const st = this.ps('fisher');
    if (!st.met) {
      st.met = 1;
      await this.say([
        L('bjarki', 'Psszt! Elijeszted a halakat! …Na jó, úgysem kapnak ma.'),
        L('bjarki', 'Tudod, mit fogtam tegnap? Egy <b>gyöngyöt</b>. Aranyból. Azt mondják, Freyja elvesztette a Brísingament, és egy szeme ide gurult a tóba.'),
        L('bjarki', 'Odaadnám — de a lábam sajog, a gyógyfű kéne. Hozz <b>3 gyógyfüvet</b>, és tiéd a gyöngy.'),
      ]);
    }
    if (!st.done) {
      if (state.save.herbs < 3) { await this.say([L('bjarki', `Három gyógyfű, barátom. Nálad most ${state.save.herbs} van. A völgyben a lila virágú bokrokat keresd.`)]); return; }
      const ans = await this.say([L('bjarki', 'Na? Hoztál gyógyfüvet?', ['Odaadok 3 gyógyfüvet', 'Majd később'])]);
      if (ans !== 0) return;
      state.save.herbs -= 3;
      st.done = 1;
      await this.say([L('bjarki', 'Ah, máris jobb! Fogd a gyöngyöt — Freyja biztos nem haragszik, ha egy sárkánylovas hordja.')]);
      this.#grantRelic('brisingamen');
      hud.renderResources();
      return;
    }
    // Pletyka: egy még fel nem fedezett hely környéke kirajzolódik a térképen
    if ((st.rumorAt || 0) > this.now) { await this.say([L('bjarki', 'Ma már elmondtam minden pletykát. A halak se tudnak többet.')]); return; }
    const hint = this.host.hintPlace();
    if (!hint) { await this.say([L('bjarki', 'Te már mindent bejártál, amiről én hallottam. Tisztelem.')]); return; }
    st.rumorAt = this.now + 180;
    state.commit();
    await this.say([L('bjarki', `Hallottam a révészektől, hogy <b>${esc(hint.name)}</b> ${esc(hint.dir)} felé van innen. Rajzoltam neked egy jelet a térképedre.`)]);
  }

  async #merchant(p) {
    const st = this.ps('merchant');
    if (!st.met) {
      st.met = 1;
      await this.say([
        L('sigrid', 'Üdv a <b>Tengeri Kancán</b>! A legjobb drakkar az északi vizeken — és az egyetlen bolt a völgyben.'),
        L('sigrid', 'Gyógyfű, térkép, mézsör, és ha a szilánkod is bírja, egy-két kincs a déli szigetekről. Nézz körül!'),
      ]);
    }
    this.#shop();
  }

  #shop() {
    const { state, hud, sfx } = this.g;
    const st = this.ps('merchant');
    const items = [
      { id: 'herb', icon: '🌿', name: 'Gyógyfű', desc: 'Harcban a legsebesültebb társ 40%-ot gyógyul', price: 14 },
      { id: 'mead', icon: '🍺', name: 'Mézsör', desc: 'A következő csatában a csapat teli energiával és félig telt harci énekkel kezd', price: 25, off: !!state.save.places.mead },
      { id: 'map', icon: '🗺', name: 'Térkép-töredék', desc: 'Egy még fel nem fedezett hely kirajzolódik a térképeden', price: 35 },
      { id: 'draupnir', icon: '💍', name: 'Draupnir gyűrűje', desc: RELICS.draupnir.desc + ' (ereklye)', price: 120, off: state.has('relics', 'draupnir') },
    ];
    const card = hud.openModal(`
      <p class="gm-kicker">ᚠ Fehu — a gazdagság</p>
      <h2>A Tengeri Kanca — Sigrid boltja</h2>
      <p class="gm-lore">A drakkar fedélzetén ládák, hordók, és egy kalitka, amiben gyanúsan nagy tojás pihen. „Az nem eladó."</p>
      <div class="shop-list">${items.map((it) => `
        <div class="shop-item${it.off ? ' is-off' : ''}">
          <span class="shop-ico">${it.icon}</span>
          <div><b>${esc(it.name)}</b><small>${esc(it.desc)}</small></div>
          <button class="btn btn-sm${it.off ? '' : ' btn-primary'}" type="button" data-buy="${it.id}" ${it.off || state.save.shards < it.price ? 'disabled' : ''}>
            ${it.off ? (it.id === 'mead' ? 'Már a tiéd' : 'Megvetted') : `${it.price} ᚱ`}</button>
        </div>`).join('')}</div>
      <div class="gm-facts"><span>Van: <b>${state.save.shards} ᚱ</b></span><span>Gyógyfű: <b>${state.save.herbs}</b></span></div>
      <div class="gm-actions"><button class="btn btn-ghost" type="button" data-act="ok">Viszlát, Sigrid</button></div>`, { wide: true });
    card.querySelector('[data-act="ok"]').onclick = () => hud.closeModal();
    card.querySelectorAll('[data-buy]').forEach((b) => b.onclick = () => {
      const it = items.find((x) => x.id === b.dataset.buy);
      if (state.save.shards < it.price) return;
      if (it.id === 'map') {
        const hint = this.host.hintPlace();
        if (!hint) { hud.toast('Sigrid vállat von: „Te már mindent ismersz, amit én."', 'warn'); return; }
        hud.toast(`🗺 A térképen kirajzolódott: <b>${esc(hint.name)}</b> (${esc(hint.dir)})`, 'good', 5000);
      }
      state.save.shards -= it.price;
      if (it.id === 'herb') state.save.herbs++;
      if (it.id === 'mead') state.save.places.mead = 1;
      if (it.id === 'draupnir') this.#grantRelic('draupnir');
      st.spent = (st.spent || 0) + it.price;
      sfx.pickup();
      state.commit();
      this.#shop();
    });
  }

  async #skald(p) {
    const { state, hud } = this.g;
    const st = this.ps('skald');
    const verses = [
      '<em>„Öt seb a földön, öt barlang a mélyben, / öt pecsét izzik a sárkánylovas kezében."</em>',
      '<em>„Ki a kört kinyitja, kezdje a kezdettel: / marhával, bölénnyel, tövissel, istennel."</em> — a régi rúnasor, ha érted…',
      '<em>„Fent a havas északon trón áll jégből, / kérdez, ki ül rajta — a neve a kérdés."</em>',
      '<em>„Öreg vándor jár a völgyben, félszemű, csendes, / két holló kíséri — kérdezd meg, ki ő."</em>',
      '<em>„A hamu alatt tűz, a tűz alatt próba, / ki legyőzi az őrt, az lesz a láng ura."</em>',
      '<em>„Hol a fenyő sűrű, gombák közt kunyhó áll, / a vén Gunnhild ott galdrot dalol, talányt kiált."</em>',
    ];
    const v = verses[(st.n || 0) % verses.length];
    st.n = (st.n || 0) + 1;
    const lines = [L('einar', v)];
    // Ihletés: a következő csata félig telt harci énekkel indul (5 percenként)
    if ((st.inspireAt || 0) <= this.now && state.save.ultis.length) {
      st.inspireAt = this.now + 300;
      state.save.places.inspired = 1;
      lines.push(L('einar', 'Vidd magaddal a dalt! A következő csatádban a <b>harci ének</b> már félig telve szól.'));
      hud.toast('🎵 Ihletés: a következő csata félig telt harci énekkel indul.', 'good');
    } else if (!st.met) {
      lines.push(L('einar', 'Einar vagyok, skald. Ha egyszer ultit tanulsz, gyere vissza — a dalom megtölti a harci éneket.'));
    }
    st.met = 1;
    state.commit();
    await this.say(lines);
  }

  /* ------------------------------------------------------------------ */
  /* Kőkör, ládák, táblák, Vándor                                        */
  /* ------------------------------------------------------------------ */
  ruins(p) {
    const { state, hud, sfx } = this.g;
    const st = this.ps('ruins');
    if (st.done) { hud.toast('A Régi Kőkör csendes. A rúnák halványan izzanak.', 'info'); return; }
    let seq = [];
    return new Promise((resolve) => {
      const render = (flash = '') => {
        const card = hud.openModal(`
          <p class="gm-kicker">ᚨ A Régi Kőkör</p>
          <h2>Hat kő, hat rúna</h2>
          <p class="gm-lore">A középső kőbe vésve: <em>„A kezdet négy rúnája nyitja a kört."</em> Alatta egy ládát tart egy kőkéz.</p>
          <div class="ring ${flash}">
            ${RING_RUNES.map((r, i) => `<button type="button" class="ring-stone${seq.includes(r) ? ' is-lit' : ''}" style="--a:${i * 60}deg" data-r="${r}">${r}</button>`).join('')}
            <div class="ring-core">${seq.length}/${RING_ORDER.length}</div>
          </div>
          <p class="br-help">Érintsd meg a köveket a helyes sorrendben. Tipp: a rúnakövek tetején ugyanez a sor kezdődik.</p>
          <div class="gm-actions"><button class="btn btn-ghost" type="button" data-act="ok">Elmegyek</button></div>`);
        hud.onModalClose = resolve;
        card.querySelector('[data-act="ok"]').onclick = () => hud.closeModal();
        card.querySelectorAll('[data-r]').forEach((b) => b.onclick = () => {
          const r = b.dataset.r;
          if (r !== RING_ORDER[seq.length]) { seq = []; sfx.miss(); render('is-wrong'); return; }
          seq.push(r);
          sfx.click();
          if (seq.length < RING_ORDER.length) { render(); return; }
          st.done = 1;
          sfx.portal();
          render('is-open');
          setTimeout(() => {
            this.#grantRelic('mjolnir');
            state.save.shards += 30;
            state.commit();
            hud.closeModal();
          }, 900);
        });
      };
      render();
    });
  }

  async chest(p) {
    const { state, hud, sfx } = this.g;
    const st = this.ps(p.id);
    if (st.open) { hud.toast('Üres láda. Valaki — te — már kifosztotta.', 'info'); return; }
    st.open = 1;
    const l = p.loot;
    sfx.crack();
    this.host.openChest?.(p);
    state.save.shards += l.shards || 0;
    state.save.herbs += l.herbs || 0;
    const parts = [l.shards ? `+${l.shards} ᚱ` : '', l.herbs ? `+${l.herbs} 🌿` : ''].filter(Boolean).join(' · ');
    if (parts) hud.toast(`📦 Láda: ${parts}`, 'good', 4000);
    if (l.relic) this.#grantRelic(l.relic);
    state.commit();
  }

  sign(p) {
    const { hud } = this.g;
    const fog = this.host.fogAt;
    const arrows = ['→', '↘', '↓', '↙', '←', '↖', '↑', '↗'];
    const rows = this.g.world.pois
      .filter((q) => q !== p && q.type !== 'sign' && q.type !== 'chest' && q.type !== 'wanderer' && (fog(q.x, q.y) || ['home', 'cave', 'trainer', 'nest'].includes(q.type)))
      .map((q) => {
        const dx = q.x - p.x, dy = q.y - p.y;
        const a = Math.round(((Math.atan2(dy, dx) + Math.PI * 2) % (Math.PI * 2)) / (Math.PI / 4)) % 8;
        return { q, d: Math.round(Math.hypot(dx, dy)), arrow: arrows[a] };
      })
      .sort((a, b) => a.d - b.d).slice(0, 7);
    const name = (q) => q.name || ({ cave: `Barlang (${q.tier}. fok)`, stone: 'Rúnakő' })[q.type] || q.type;
    const card = hud.openModal(`
      <p class="gm-kicker">ᚱ Raidho — az út</p>
      <h2>Útjelző tábla</h2>
      <ul class="sign-list">${rows.map((r) => `<li><i>${r.arrow}</i> <b>${esc(name(r.q))}</b> <small>${r.d * 3} lépés</small></li>`).join('')}</ul>
      <p class="muted">A tábla aljára valaki odakarcolta: <em>„A Vándor sosem marad egy helyen."</em></p>
      <div class="gm-actions"><button class="btn btn-primary" type="button" data-act="ok">Tovább</button></div>`);
    card.querySelector('[data-act="ok"]').onclick = () => hud.closeModal();
  }

  async wanderer(p) {
    const { state, story } = this.g;
    if (state.has('ultis', 'gungnir')) {
      await this.say([L('vandor', pick([
        'Útközben vagyok, mint mindig. A hollóim üdvözölnek.',
        'A dárda sosem téveszt célt, sárkánylovas. Csak a kéz, ami eldobja.',
        'Kilenc éjjel függtem a fán a rúnákért. Te csak ne siess ennyire.',
      ]))]);
      return;
    }
    const ans = await this.say([
      L('vandor', 'Jó estét, sárkánylovas. Hosszú az út, rövid a nap.'),
      L('vandor', 'Széles karimájú kalap, félszem, köpeny, amit ezer szél tépett… Ne bámulj. Inkább felelj: <b>tudod-e, ki vagyok?</b>',
        ['Egy öreg vándor', 'Odin, a Mindenek Atyja', 'Loki, a csalafinta']),
    ]);
    if (ans === 1) {
      const lines = [
        L('vandor', 'Ha! A hollóim jól választottak. Fogd: <b>Gungnir</b> dala. Ha a harci ének megtelt, a dárdám veled repül.'),
      ];
      if (story.s.q > 4) lines.push(L('huginn', 'Kraa! …Atyám?! Én végig tudtam! …Jó, nem tudtam.'));
      await this.say(lines);
      this.#grantUlti('gungnir');
      this.host.burst?.(p, 0xc9f0ff);
      return;
    }
    if (ans >= 0) {
      await this.say([L('vandor', 'Talán. Talán nem. Az út majd megmondja.')]);
      this.host.moveWanderer?.(p);
    }
  }
}

/* =====================================================================
   Kóborló vad sárkányok és őrök (a csatához)
   ===================================================================== */
export function makeRoamer(tier, tiers, rng = Math.random) {
  const d = makeWild(tier, 1, tiers, rng);
  d.id = `roam-${Math.floor(rng() * 1e9)}`;
  return d;
}

export function makeGuardian(id, partyLevel, tiers) {
  if (id === 'muspell') {
    const parts = {};
    for (const s of SLOTS) parts[s] = pick(tiers[s][4]);
    const level = Math.max(10, partyLevel + 1);
    return [{
      id: 'guard-muspell', wild: true, tier: 4, nev: 'Lángőr, Surtr szolgája', szin: '#ff5a1f',
      ...parts, hp: 0, dmg: 0, xp: xpForLevel(level), gen: 0, traits: ['fireblood'], tech: ['meteor', 'warcry'],
    }, {
      id: 'guard-muspell-2', wild: true, tier: 3, nev: 'Parázsfióka', szin: '#ffb347',
      ...Object.fromEntries(SLOTS.map((s) => [s, pick(tiers[s][3])])), hp: 0, dmg: 0, xp: xpForLevel(Math.max(6, partyLevel - 2)), gen: 0, traits: [], tech: [],
    }];
  }
  return [];
}

export { levelOf };
