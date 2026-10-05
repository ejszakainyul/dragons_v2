/* =====================================================================
   A saga — fejezetek, küldetések, párbeszédek
   ---------------------------------------------------------------------
   A fő szál egy lineáris küldetéslánc (QUESTS). Mindegyiknek van egy
   eseménye (`on`), ami teljesíti:

     talk:home / talk:trainer   beszélgetés a Völvával / Ragnhilddal
     clear:N                    az N. fokú barlang első bejárása
     learn                      egy technika megtanulása

   A teljesítéskor lejátszódik a párbeszéd (`talk` vagy `after`), jön a
   jutalom, és ha új fejezet kezdődik, a fejezetcím.

   Mellékszálak (SIDE): bármikor teljesülhetnek, a mentett állásból
   ellenőrizve (rúnakövek, kikelés, szelídítés, edzés, párbaj).

   Régi mentésnél (amikor még nem volt saga) a lánc csendben előreugrik
   addig, ameddig a játékos már amúgy is eljutott.
   ===================================================================== */
import { Dialogue, chapterCard } from './dialogue.js';
import { esc } from './hud.js';
import { ULTIMATES, RELICS } from './rules.js';

/* =====================================================================
   Párbeszédek
   ===================================================================== */
const L = (who, text) => ({ who, text });

export const SCRIPTS = {
  intro: [
    L('huginn', 'Kraa! Nocsak — egy új arc a ködben, és már sárkány lohol a nyomodban. Gyorsan nőnek errefelé.'),
    L('huginn', 'Huginn vagyok, Odin hollója. A <b>gondolat</b>. …Már ha emlékszik még rám valaki ebben a völgyben.'),
    L('huginn', 'Mert a Völgy beteg, viking. A barlangokból rossz álmok szivárognak. Menj a <b>Hosszúházhoz</b> — Hervör, a Völva vár rád. Ő többet lát, mint én.'),
  ],
  seer1: [
    L('hervor', 'Hát eljöttél. A nornák fonala ma hajnalban megremegett — tudtam, hogy egy tojás gazdát talált.'),
    L('hervor', 'Figyelj jól. E völgy alatt fut <b>Yggdrasil</b> egyik gyökere. A mélyén <b>Níðhöggr</b>, a Gyökérrágó rágja — és ahol rág, ott sebek nyílnak a földön.'),
    L('hervor', 'Öt seb, öt barlang. Őseim rúnapecséttel zárták le őket, de a pecsétek gyengülnek. Níðhöggr <em>suttogása</em> kiszivárog, és megzavarja a vad sárkányok elméjét.'),
    L('huginn', 'Ezért harapnak. Nem gonoszak — csak ébren látnak rémálmot. Kraa.'),
    L('hervor', 'Kezdd a <b>Mohos barlanggal</b>, délnyugatra. Győzd le a lakóit, és a pecsét újra izzani fog. Aki pedig megszabadul a suttogástól… az néha melléd szegődik.'),
    L('hervor', 'Vidd ezeket a gyógyfüveket. És ne feledd: a hosszúház tüze mindig visszavár.'),
  ],
  cave1done: [
    L('huginn', 'Kraa! Láttam fentről — az első pecsét újra zöld fénnyel ég! A moha elhallgatott.'),
    L('huginn', 'De a suttogás mélyebbről jön. A barlangok egyre vadabbak lesznek, a te sárkányod pedig még csak a karmait élesíti.'),
    L('huginn', 'Van jó hírem is: megérkezett <b>Ragnhild</b>, a fegyvermester. A hosszúháztól <b>keletre</b> verte le a karámját, a <b>Gyakorlótéren</b>. Ha valaki, hát ő megtanítja harcolni a sárkányodat.'),
    L('huginn', 'És figyelj, ha jársz-kelsz: a völgyben <b>remeték, törpék, oltárok</b> rejtőznek, akik olyat is tudnak, amit Ragnhild nem. Kérdezd a halászt, a kalmárt — és olvasd el az <b>útjelző táblákat</b>.'),
    L('huginn', 'Ja, és a <b>kóborló vad sárkányokat</b> kerüld el, ha gyenge vagy. Vagy ne. Te tudod. Kraa.'),
  ],
  trainerLocked: [
    L('huginn', 'Üres karám, kopott bábu, frissen levert cölöpök… Kraa. Valaki nemrég járt itt — és hamarosan visszajön.'),
    L('huginn', 'Addig is: a Völgy nem fog magától meggyógyulni. Nézd meg a feladatod a bal oldalon.'),
  ],
  ragnhild1: [
    L('ragnhild', 'Szóval te vagy a Völva kiválasztottja. Kisebbre számítottam. Vagy nagyobbra. Mindegy.'),
    L('ragnhild', 'Húsz telet repültem Szélvész hátán, mielőtt a tenger elvitte. Azóta másokat tanítok — ez a karám az enyém, amíg a Völgy bajban van.'),
    L('ragnhild', 'Egy sárkány a <b>fejéből</b> harcol, ezt tudod. De a <b>technika</b> a tanulásból jön: rúnabélyeg, pajzsfal, galdr… Én tanítom, te fizetsz. Rúnaszilánkban.'),
    L('ragnhild', 'Az első leckét most ingyen adom. Válassz egy technikát a sárkányodnak — mutasd, mit tanul meg elsőre.'),
    L('ragnhild', 'Ha pedig erősebb akarsz lenni: <b>edzés</b> a bábun, vagy <b>párbaj</b> az én sárkányaimmal. Itt nem hal meg senki. Legfeljebb a büszkeség.'),
  ],
  learned1: [
    L('ragnhild', 'Nem rossz. A technika energiába kerül, akárcsak a fej ereje — a támadás és a védekezés tölti vissza. Okosan oszd be.'),
    L('ragnhild', 'A <b>8. szinten</b> a sárkányod második technikát is megtanulhat. Addig is: a <b>Fagyott Torok</b> vár, keletre. Vigyél meleg ruhát.'),
  ],
  cave2done: [
    L('huginn', 'A második pecsét is ég! Kék fény, mint a sarki jég. Kraa!'),
    L('huginn', '…Muninn. A testvérem. Nem jött haza az éjjel. Az emlékezet hollója sosem késik. <em>Sosem.</em>'),
    L('huginn', 'Ragnhild üzent: hívat a <b>Gyakorlótérre</b>. Azt mondja, a csapatod készen áll valamire, amit csak együtt lehet megtanulni.'),
  ],
  ragnhild2: [
    L('ragnhild', 'A régi lovasok tudták: egy sárkány erős. De egy <b>dal</b> — az legyőzhetetlen.'),
    L('ragnhild', 'Ez a <b>Sárkánykórus</b>. Ahogy a csapatod harcol — üt, kap, győz —, úgy telik a <b>harci ének</b>. Ha megtelt, minden sárkányod egyszerre okád.'),
    L('ragnhild', 'Páncélon át, minden ellenfélre. A barlang falai is beleremegnek. Csak ne a saját fejedre hozd le a mennyezetet.'),
    L('ragnhild', 'Ez az első <b>ulti</b>, de nem az utolsó. Azt beszélik, a völgyben <b>tüzes oltár, jégtrón és egy valkűr-kő</b> is őrzi a maga dalát. Ha többet tudsz, a teli ének után <b>választhatsz</b> közülük.'),
    L('huginn', 'És ha Muninnt látod odalent… kérlek. Hozd haza.'),
  ],
  whisper: [
    L('nidhoggr', '<em>…kicsi viking…</em>'),
    L('nidhoggr', '<em>Hallak. Hallom a szíved, és a sárkányod szívét. Három sebemet zártad be. Azt hiszed, ez gyógyítás?</em>'),
    L('nidhoggr', '<em>Az emlékezet hollója az enyém. Muninn a hamuban alszik. Gyere érte… ha emlékszel még, miért jöttél.</em>'),
  ],
  cave3done: [
    L('huginn', 'Hallottad te is? Az a hang… <b>Níðhöggr</b>. Ő vitte el Muninnt. Kraa, kraa…'),
    L('huginn', 'Menj a <b>Völvához</b>. Ő tudja, hogyan lehet a Hamuverembe jutni anélkül, hogy a feledés elnyeljen.'),
  ],
  seer2: [
    L('hervor', 'Láttam a lángokban. Muninn a <b>Hamuveremben</b> raboskodik, a negyedik sebnél. Amíg ott van, a Völgy felejt — a sárkányok elfelejtik, hogy egykor velünk repültek.'),
    L('hervor', 'Ezért olyan nehéz megszelídíteni őket. Nem a vadság tartja vissza őket. A <em>feledés</em>.'),
    L('hervor', 'A Hamuverem tüze nem emészt, de próbára tesz. Itt van három gyógyfű. És <em>ne hallgass a suttogásra</em>.'),
  ],
  cave4done: [
    L('muninn', '…Huginn? A te hangod ez? Olyan régen volt… vagy tegnap?'),
    L('huginn', 'Muninn! Kraa! Tudtam! Tudtam, hogy a viking elhoz!'),
    L('muninn', 'Emlékszem már. Mindenre. Viking — Níðhöggr <b>fél</b> tőled. Ezért suttog. A félelem hangos.'),
    L('muninn', 'Az ötödik seb a Világfa gyökerénél nyílik, <b>északon</b>. Ott alszik — de már nem sokáig. Ha legyőzöd, a Völgy újra emlékezni fog.'),
  ],
  nidhoggr: [
    L('nidhoggr', '<em>Hát eljöttél. A hollók hozták a neved, mint két tolvaj a zsákmányt.</em>'),
    L('nidhoggr', '<em>Ezer éve rágom ezt a gyökeret. Ezer év múlva is rágni fogom. Te egy nyár vagy, viking. Egy szikra.</em>'),
    L('nidhoggr', '<em>Gyere hát, szikra. Hadd lássam, meddig világítasz.</em>'),
  ],
  nidhoggrRage: [
    L('nidhoggr', '<b>ELÉG!</b> <em>A gyökér velem van — és a gyökér mindent elér!</em>'),
  ],
  nidhoggrFall: [
    L('nidhoggr', '<em>…a szikra… nem alszik ki…</em>'),
    L('nidhoggr', '<em>Visszatérek a mélybe. Aludni. Álmodni. De a gyökér emlékezni fog rád, viking…</em>'),
  ],
  cave5done: [
    L('huginn', 'Kraa! KRAA! Az ötödik pecsét! Nézd, ahogy a köd felszáll a Völgyről!'),
    L('muninn', 'És én emlékezni fogok rá. Örökre. Erre vagyok.'),
    L('huginn', 'A Völva vár a <b>Hosszúháznál</b>. Azt mondja, egy saga csak akkor teljes, ha valaki el is mondja.'),
  ],
  seer3: [
    L('hervor', 'Az öt seb bezárult. Níðhöggr alszik — mélyebben, mint ezer éve bármikor.'),
    L('hervor', 'És a sárkányok emlékeznek. Látod? Már nem morognak a barlangok szájából. Kíváncsian néznek utánad.'),
    L('ragnhild', 'Meg kell hagyni, viking. Szélvész is büszke lett volna rád. A karám nyitva marad — a tanulásnak sosincs vége.'),
    L('hervor', 'A neved felkerült az ötödik kőre. De a saga nem ér véget: a fészkek várnak, a barlangok mélyén még erős vadak élnek, és a nornák fonala tovább fut.'),
    L('hervor', 'Menj, sárkánylovas. A Völgy a tiéd.'),
  ],
};

/* =====================================================================
   A fő szál
   ===================================================================== */
export const QUESTS = [
  { id: 'seer',     ch: ['Prológus', 'A köd és a tojás'],        goal: 'Keresd fel a Völvát a Hosszúháznál',
    target: 'home', on: 'talk:home', talk: 'seer1', reward: { herbs: 2 } },
  { id: 'cave1',    ch: ['I. fejezet', 'A moha suttogása'],      goal: 'Tisztítsd meg a Mohos barlangot (I.)',
    target: 'cave1', on: 'clear:1', after: 'cave1done', reward: { shards: 20 } },
  { id: 'trainer',  ch: ['I. fejezet', 'A moha suttogása'],      goal: 'Keresd fel Ragnhildot a Gyakorlótéren',
    target: 'trainer', on: 'talk:trainer', talk: 'ragnhild1', flag: 'freeLesson' },
  { id: 'learn',    ch: ['I. fejezet', 'A moha suttogása'],      goal: 'Taníts meg egy technikát valamelyik sárkányodnak',
    target: 'trainer', on: 'learn', after: 'learned1', reward: { shards: 20 } },
  { id: 'cave2',    ch: ['II. fejezet', 'A jég torka'],          goal: 'Járd be a Fagyott Torkot (II.)',
    target: 'cave2', on: 'clear:2', after: 'cave2done', reward: { shards: 25 } },
  { id: 'chorus',   ch: ['II. fejezet', 'A jég torka'],          goal: 'Ragnhild hívat: új dalt tanít a Gyakorlótéren',
    target: 'trainer', on: 'talk:trainer', talk: 'ragnhild2', flag: 'chorus' },
  { id: 'cave3',    ch: ['III. fejezet', 'A suttogó mélység'],   goal: 'Szállj le a Suttogó Mélységbe (III.)',
    target: 'cave3', on: 'clear:3', after: 'cave3done', reward: { shards: 30 } },
  { id: 'seer2',    ch: ['III. fejezet', 'A suttogó mélység'],   goal: 'Mondd el a Völvának, mit hallottál a mélyben',
    target: 'home', on: 'talk:home', talk: 'seer2', reward: { herbs: 3 } },
  { id: 'cave4',    ch: ['IV. fejezet', 'Hamu és parázs'],       goal: 'Szabadítsd ki Muninnt a Hamuveremből (IV.)',
    target: 'cave4', on: 'clear:4', after: 'cave4done', reward: { shards: 40 } },
  { id: 'cave5',    ch: ['V. fejezet', 'A Gyökérrágó'],          goal: 'Győzd le Níðhöggrt a Világfa gyökerénél (V.)',
    target: 'cave5', on: 'clear:5', after: 'cave5done' },
  { id: 'epilogue', ch: ['Epilógus', 'Dal a Völgyről'],          goal: 'Térj haza a Völvához',
    target: 'home', on: 'talk:home', talk: 'seer3', reward: { shards: 100 }, finale: true },
];
const QI = Object.fromEntries(QUESTS.map((q, i) => [q.id, i]));

/* --- Mellékszálak ---------------------------------------------------- */
export const SIDE = [
  { id: 'stones', name: 'A kövek tudása',     goal: 'Olvasd el mind az öt rúnakövet',
    done: (s) => Object.keys(s.stones).length >= 5, progress: (s) => `${Object.keys(s.stones).length}/5`, reward: { shards: 60, herbs: 2 } },
  { id: 'tame',   name: 'A feledés ellen',    goal: 'Szelídíts meg egy vad sárkányt',
    done: (s) => s.stats.tamed >= 1, reward: { herbs: 2 } },
  { id: 'hatch',  name: 'Új nemzedék',        goal: 'Kelts ki egy fiókát valamelyik fészekben',
    done: (s) => s.stats.hatched >= 1, reward: { shards: 40 } },
  { id: 'drill',  name: 'Verejték és szalma', goal: 'Végezz el egy edzést Ragnhild bábuján',
    done: (s) => s.stats.drills >= 1, reward: { shards: 15 } },
  { id: 'spar',   name: 'Tisztes párbaj',     goal: 'Győzz egy gyakorló párbajban',
    done: (s) => s.stats.spars >= 1, reward: { shards: 25 } },
  { id: 'roam',   name: 'Vadászat a vadonban', goal: 'Győzz le három kóborló vad sárkányt',
    done: (s) => (s.stats.roams || 0) >= 3, progress: (s) => `${Math.min(3, s.stats.roams || 0)}/3`, reward: { shards: 40, herbs: 1 } },
  { id: 'masters', name: 'A völgy mesterei', goal: 'Sajátíts el technikát három különböző mestertől (remete, törpe, trón, oltár)',
    done: (s) => (s.techSrc || []).length >= 3, progress: (s) => `${(s.techSrc || []).length}/3`, reward: { shards: 70 } },
  { id: 'ultis',  name: 'Öt dal, egy kórus', goal: 'Nyerd el mind az öt ultit',
    done: (s) => (s.ultis || []).length >= 5, progress: (s) => `${(s.ultis || []).length}/5`, reward: { shards: 120, herbs: 3 } },
  { id: 'relics', name: 'Az istenek kincsei', goal: 'Gyűjts össze négy ereklyét',
    done: (s) => (s.relics || []).length >= 4, progress: (s) => `${(s.relics || []).length}/4`, reward: { shards: 80 } },
];

const rewardText = (r = {}) => [r.shards ? `+${r.shards} ᚱ` : '', r.herbs ? `+${r.herbs} 🌿` : ''].filter(Boolean).join(' · ');

/* =====================================================================
   A saga vezérlője
   ===================================================================== */
export class Story {
  constructor(g) {
    this.g = g;
    this.dialogue = new Dialogue(document.getElementById('gameShell'), g.hud, g.sfx);
    this.busy = false;
    const save = g.state.save;
    this.fresh = !save.story;
    save.story = Object.assign({ q: 0, side: {}, flags: {}, seen: {} }, save.story || {});
    if (this.fresh) this.#catchUp();
    if (this.s.flags.chorus && !(save.ultis || []).includes('chorus')) save.ultis = [...(save.ultis || []), 'chorus'];
    g.state.on(() => this.checkSide());
  }

  get s() { return this.g.state.save.story; }
  get quest() { return QUESTS[this.s.q] || null; }
  get done() { return this.s.q >= QUESTS.length; }
  /** A célpont helyszín azonosítója (iránytű, kistérkép). */
  get target() { return this.quest?.target || null; }
  has(flag) { return !!this.s.flags[flag]; }
  /** Ragnhild már a karámban van? */
  get trainerOpen() { return this.s.q >= QI.trainer; }

  /** Régi mentés: ami a barlangok alapján már nyilvánvalóan megtörtént, azt átugorjuk. */
  #catchUp() {
    const cleared = this.g.state.save.cleared;
    const laterClear = (i) => QUESTS.slice(i + 1).some((q) => q.on.startsWith('clear:') && cleared[q.on.slice(6)]);
    while (this.s.q < QUESTS.length) {
      const q = QUESTS[this.s.q];
      const auto = q.on.startsWith('clear:') ? !!cleared[q.on.slice(6)] : laterClear(this.s.q);
      if (!auto) break;
      if (q.flag) this.s.flags[q.flag] = true;
      this.s.q++;
    }
    // Aki már túl van az első barlangon, annak se legyen az első lecke ára
    if (this.s.q > QI.trainer) this.s.flags.freeLesson = false;
  }

  /* ------------------------------------------------------------------ */
  /* Megjelenítés                                                        */
  /* ------------------------------------------------------------------ */
  say(key) {
    const lines = SCRIPTS[key];
    return this.dialogue.play(lines);
  }

  chapter(q = this.quest) {
    if (!q) return Promise.resolve();
    return chapterCard(document.getElementById('gameShell'), q.ch[0], q.ch[1], this.g.sfx);
  }

  renderTracker() {
    const q = this.quest;
    this.g.hud.setQuest(q
      ? { kicker: q.ch.join(' — '), goal: q.goal }
      : { kicker: 'A saga teljes', goal: 'Szabad játék: tenyéssz, edz, és járd be újra a barlangokat.', done: true });
  }

  /** Új játékosnak: fejezetcím + Huginn. Régi mentésnek egy rövid jelzés. */
  async start() {
    this.renderTracker();
    if (this.fresh && this.s.q === 0 && !this.s.seen.intro) {
      this.s.seen.intro = 1;
      this.g.state.touch();
      await this.chapter();
      await this.say('intro');
    } else if (this.fresh) {
      this.g.hud.toast('ᛟ <b>Új: a Saga!</b> <small>A bal oldali rúnatábla mutatja, merre tovább — a ᛉ gomb a krónikát.</small>', 'good', 6500);
    }
  }

  /* ------------------------------------------------------------------ */
  /* Események                                                           */
  /* ------------------------------------------------------------------ */
  /**
   * Történt valami. Ha ez teljesíti a soron lévő küldetést, lejátssza
   * a jelenetet és továbblép.
   * @returns {Promise<boolean>} volt-e jelenet (a hívó ilyenkor nem nyit ablakot)
   */
  async event(name) {
    const q = this.quest;
    if (!q || q.on !== name || this.busy) return false;
    this.busy = true;
    try {
      await this.#complete(q);
      // Ha a játékos előreszaladt (pl. a Gyakorlótér előtt bejárta a II.
      // barlangot), a már teljesült barlangos küldetések most jönnek sorra.
      const cleared = this.g.state.save.cleared;
      while (this.quest?.on.startsWith('clear:') && cleared[this.quest.on.slice(6)]) await this.#complete(this.quest);
      return true;
    } finally {
      this.busy = false;
    }
  }

  async #complete(q) {
    const { state, hud, sfx } = this.g;
    await this.say(q.talk || q.after);
    if (q.flag) this.s.flags[q.flag] = true;
    if (q.flag === 'chorus' && state.grant('ultis', 'chorus')) {
      hud.toast(`ᛟ <b>Új ulti: ${esc(ULTIMATES.chorus.name)}</b><small>Ha a harci ének megtelt: Q.</small>`, 'good', 6000);
    }
    this.#reward(q.reward, `ᛟ <b>${esc(q.goal)}</b> — teljesítve`);
    this.s.q++;
    state.commit();
    if (q.finale) await this.#finale();
    const next = this.quest;
    this.renderTracker();
    if (next && next.ch[0] !== q.ch[0]) await this.chapter(next);
    else if (next) { sfx.pickup(); hud.toast(`ᛉ Új cél: <b>${esc(next.goal)}</b>`, 'info', 4500); }
  }

  /** Barlangi jelenetek (a csata hívja): csak egyszer, és csak a saga megfelelő pontján. */
  battleLines(kind, tier) {
    const q = this.quest;
    const when = {
      whisper:      q?.id === 'cave3' && tier === 3,
      nidhoggr:     q?.id === 'cave5' && tier === 5,
      nidhoggrRage: tier === 5,
      nidhoggrFall: q?.id === 'cave5' && tier === 5,
    }[kind];
    if (!when) return null;
    // A dühkitörés minden csatában jár, a többi csak egyszer
    if (kind !== 'nidhoggrRage') {
      if (this.s.seen[kind]) return null;
      this.s.seen[kind] = 1;
    }
    return SCRIPTS[kind];
  }

  #reward(r, label) {
    if (!r) return;
    const { state, hud, sfx } = this.g;
    state.save.shards += r.shards || 0;
    state.save.herbs += r.herbs || 0;
    sfx.levelUp();
    hud.toast(`${label}<small>Jutalom: ${rewardText(r)}</small>`, 'good', 5000);
  }

  /** Mellékszálak: a mentett állásból ellenőrizve, bármikor teljesülhetnek. */
  checkSide() {
    const save = this.g.state.save;
    if (!save.story) return;
    for (const sq of SIDE) {
      if (this.s.side[sq.id] || !sq.done(save)) continue;
      this.s.side[sq.id] = 1;
      // A jutalmat a következő képkockán adjuk: ne a state.on értesítés közepén módosítsunk
      setTimeout(() => {
        this.#reward(sq.reward, `ᛉ Mellékszál: <b>${esc(sq.name)}</b>`);
        this.g.state.commit();
      }, 0);
    }
  }

  async #finale() {
    const { hud, state } = this.g;
    const st = state.save.stats;
    await new Promise((resolve) => {
      const card = hud.openModal(`
        <p class="gm-kicker">ᛟ Othala — a saga teljes</p>
        <h2>A Sárkányok Völgyének dala</h2>
        <p class="gm-lore">„…és a sárkánylovas bezárta az öt sebet, és a hollók hazatértek,
           és a Völgy újra emlékezett." — így éneklik majd a hosszúházban.</p>
        <div class="gm-facts">
          <span>Csaták: <b>${st.battles}</b></span>
          <span>Győzelmek: <b>${st.wins}</b></span>
          <span>Szelídítve: <b>${st.tamed}</b></span>
          <span>Kikelt fióka: <b>${st.hatched}</b></span>
          <span>Sárkányaid: <b>${state.dragons.size}</b></span>
        </div>
        <p class="gm-good">A Völgy a tiéd. A barlangok, a fészkek és a Gyakorlótér továbbra is várnak.</p>
        <div class="gm-actions"><button class="btn btn-primary" data-act="ok" type="button">Tovább a Völgyben</button></div>`,
      { closeable: false });
      hud.onModalClose = resolve;
      card.querySelector('[data-act="ok"]').onclick = () => hud.closeModal();
    });
  }

  /* ------------------------------------------------------------------ */
  /* Krónika (a ᛉ gomb)                                                 */
  /* ------------------------------------------------------------------ */
  openBook() {
    const { hud, state } = this.g;
    const save = state.save;
    const chapters = [];
    for (const [i, q] of QUESTS.entries()) {
      const key = q.ch.join(' — ');
      let c = chapters.find((x) => x.key === key);
      if (!c) chapters.push(c = { key, kicker: q.ch[0], title: q.ch[1], items: [] });
      c.items.push({ q, state: i < this.s.q ? 'done' : i === this.s.q ? 'now' : 'later' });
    }
    const visible = chapters.filter((c) => c.items.some((it) => it.state !== 'later'));
    const html = visible.map((c) => `
      <section class="sb-chapter">
        <p class="sb-kicker">${esc(c.kicker)}</p>
        <h3>${esc(c.title)}</h3>
        <ul>${c.items.filter((it) => it.state !== 'later').map((it) => `
          <li class="is-${it.state}"><i>${it.state === 'done' ? '✓' : 'ᛉ'}</i> ${esc(it.q.goal)}</li>`).join('')}
        </ul>
      </section>`).join('');
    const side = SIDE.map((sq) => {
      const ok = !!this.s.side[sq.id];
      return `<li class="${ok ? 'is-done' : ''}"><i>${ok ? '✓' : '◇'}</i> <b>${esc(sq.name)}</b> — ${esc(sq.goal)}
        ${!ok && sq.progress ? `<small>(${esc(sq.progress(save))})</small>` : ''}
        <small class="sb-reward">${rewardText(sq.reward)}</small></li>`;
    }).join('');
    const ultis = Object.entries(ULTIMATES).map(([k, u]) => {
      const has = (save.ultis || []).includes(k);
      return `<li class="${has ? 'is-done' : ''}"><i>${has ? u.rune : '?'}</i> <b>${has ? esc(u.name) : '???'}</b>
        <small class="sb-desc">${has ? esc(u.desc) : `Rejtve — ${esc(u.from)}`}</small></li>`;
    }).join('');
    const relics = Object.entries(RELICS).map(([k, r]) => {
      const has = (save.relics || []).includes(k);
      return `<li class="${has ? 'is-done' : ''}"><i>${has ? r.icon : '·'}</i> <b>${has ? esc(r.name) : 'Ismeretlen ereklye'}</b>
        <small class="sb-desc">${has ? esc(r.desc) : ''}</small></li>`;
    }).join('');
    const card = hud.openModal(`
      <p class="gm-kicker">ᛉ Algiz — a krónika</p>
      <h2>${esc(state.player)} sagája</h2>
      <div class="sb-book">${html}</div>
      <div class="sb-cols">
        <div><h3 class="sb-side-title">Ultik</h3><ul class="sb-side">${ultis}</ul></div>
        <div><h3 class="sb-side-title">Ereklyék</h3><ul class="sb-side">${relics}</ul></div>
      </div>
      <h3 class="sb-side-title">Mellékszálak</h3>
      <ul class="sb-side">${side}</ul>
      ${this.done ? '' : `<p class="muted">A következő fejezetek még a nornák fonalán várnak.</p>`}
      <div class="gm-actions"><button class="btn btn-primary" data-act="ok" type="button">Bezárás</button></div>`, { wide: true });
    card.querySelector('[data-act="ok"]').onclick = () => hud.closeModal();
  }
}
