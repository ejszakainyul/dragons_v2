/* =====================================================================
   A történet felvonásai.

   Minden felvonás megadja:
     - a helyszín hangulatát (köd, fények, részecskék),
     - a checkpointnál feltett kérdést,
     - a válaszokat, és hogy melyik kapu felé viszi tovább a kamerát,
     - a válasz utáni „csavart".
   ===================================================================== */

/** Egy felvonás hossza a pálya mentén (világegységben). */
export const ACT_LENGTH = 168;

export const ACTS = [
  /* --------------------------------------------------------------- 1 */
  {
    id: 'part',
    chapter: 'Első ének',
    title: 'A part',
    mood: {
      fog:      '#0b1a33',
      fogDensity: 0.0050,
      ambient:  '#33507f',
      ambientIntensity: 0.55,
      key:      '#9fc6ff',
      keyIntensity: 1.25,
      mote:     '#a8c8ff',
      moteRise: -1,          // hópelyhek hullanak
      moteSize: 2.0,
      water:    -6,
      aurora:   1.0,
      mist:     0.10,
      lava:     0,
    },
    question:
      'A tengerparton a homokba mélyedt karmok nyoma látszik, hatalmas lépéseket tett. ' +
      'A nyomok közvetlenül a tenger felé vezetnek, mintha egy sárkány rejtőzködne a hullámok alatt.',
    options: [
      { label: 'Követés',   offset: -20, color: '#4fd6ff', line: 'Lemész a vízhez. A nyomok nem állnak meg a parton.' },
      { label: 'Menekülés', offset:  20, color: '#9d7bff', line: 'A sziklák felé indulsz. A hullámok mögötted nem csitulnak.' },
    ],
    twist: 'seaRecoil',
  },

  /* --------------------------------------------------------------- 2 */
  {
    id: 'hajo',
    chapter: 'Második ének',
    title: 'A hajó orra',
    mood: {
      fog:      '#071b24',
      fogDensity: 0.0078,
      ambient:  '#1f5f6e',
      ambientIntensity: 0.62,
      key:      '#68e0d6',
      keyIntensity: 1.0,
      mote:     '#8de6dd',
      moteRise: -1,
      moteSize: 1.7,
      water:    -2.5,
      aurora:   0.45,
      mist:     0.26,
      lava:     0,
    },
    question:
      'A hajó orrán a ködben egy sárkány feje tűnik fel. Az óceán egyik ősi uralkodója. ' +
      'A szemei olyan élesek, hogy minden mozdulatot figyelnek.',
    options: [
      { label: 'Tisztelet', offset: -20, color: '#4fd6ff', line: 'Leereszted a fegyvered. A fej lassan bólint.' },
      { label: 'Harc',      offset:  20, color: '#ff5d6c', line: 'Megmarkolod a fegyvert. A köd felszisszen.' },
    ],
    twist: 'flyby',
  },

  /* --------------------------------------------------------------- 3 */
  {
    id: 'hegyek',
    chapter: 'Harmadik ének',
    title: 'A hegyek haragja',
    mood: {
      fog:      '#2b0b06',
      fogDensity: 0.0076,
      ambient:  '#7a2a10',
      ambientIntensity: 0.7,
      key:      '#ff8a3d',
      keyIntensity: 1.6,
      mote:     '#ffb86b',
      moteRise: 1,           // parázs száll fel
      moteSize: 2.8,
      water:    -22,
      aurora:   0.12,
      mist:     0.15,
      lava:     1,
    },
    question:
      'A hegyek között egy lángoló tűzgömb tűnik fel, a sárkányok haragja. A föld elreped a tűz erejétől, ' +
      'és a levegő hirtelen megtelik a hatalmas lény füstjével.',
    options: [
      { label: 'Bátorság',  offset: -26, color: '#ff8a3d', line: 'Beleállsz a forróságba. A repedések utat nyitnak.' },
      { label: 'Óvatosság', offset:   0, color: '#ffc46b', line: 'Kivárod a lélegzetvételnyi szünetet a lángok között.' },
      { label: 'Menekülés', offset:  26, color: '#9d7bff', line: 'A hegyoldalnak fordulsz. A hő a hátadat perzseli.' },
    ],
    twist: 'eruption',
  },

  /* --------------------------------------------------------------- 4 */
  {
    id: 'ejszaka',
    chapter: 'Negyedik ének',
    title: 'Az árnyék az égen',
    mood: {
      fog:      '#0d0820',
      fogDensity: 0.0062,
      ambient:  '#3a2a72',
      ambientIntensity: 0.5,
      key:      '#b79cff',
      keyIntensity: 1.1,
      mote:     '#c9b6ff',
      moteRise: -1,
      moteSize: 2.2,
      water:    -14,
      aurora:   0.8,
      mist:     0.19,
      lava:     0.3,   // a völgy még parázslik, de már kihűlőben
    },
    question:
      'Az éjszakai égbolton egy árnyék suhan el, majd a hold fénye elhalványul. Mintha valami hatalmas és sötét ' +
      'alak közeledne. A szél felerősödik, és egy ismerős, régi sárkányfajta illata kúszik a levegőbe.',
    options: [
      { label: 'Követés',   offset: -26, color: '#4fd6ff', line: 'Az árnyék után indulsz, bele az éjszakába.' },
      { label: 'Várakozás', offset:   0, color: '#c9b6ff', line: 'Megállsz. Hagyod, hogy ő jöjjön hozzád.' },
      { label: 'Erőszak',   offset:  26, color: '#ff5d6c', line: 'Kiáltasz az égre. A szél egy pillanatra eláll.' },
    ],
    twist: 'lightning',
  },

  /* --------------------------------------------------------------- 5 */
  {
    id: 'kod',
    chapter: 'Ötödik ének',
    title: 'A köd szeme',
    mood: {
      fog:      '#04060d',
      fogDensity: 0.0108,
      ambient:  '#1a1830',
      ambientIntensity: 0.34,
      key:      '#ffb03a',
      keyIntensity: 0.9,
      mote:     '#ffd9a8',
      moteRise: 1,
      moteSize: 2.0,
      water:    -30,
      aurora:   0.05,
      mist:     0.38,
      lava:     0.12,
    },
    question:
      'A ködben egy hatalmas, tüzes szempár jelenik meg, a sárkányok ősi uralkodója figyel minket. ' +
      'Az éles pillantás mindent áthat, egy titokzatos erő rejtőzködik a sötétben, amit csak a legerősebbek képesek megérinteni.',
    options: [
      { label: 'Barátság', offset: -20, color: '#2dd4a7', line: 'Kinyújtod a kezed a sötétbe. Meleg lehelet éri.' },
      { label: 'Támadás',  offset:  20, color: '#ff5d6c', line: 'Előrelendülsz. A szempár nem hunyorodik.' },
    ],
    twist: 'reveal',
  },
];

/** A fináléban használt hangulat. */
export const FINALE_MOOD = {
  fog:      '#0a0f20',
  fogDensity: 0.0046,
  ambient:  '#44609b',
  ambientIntensity: 0.75,
  key:      '#ffc46b',
  keyIntensity: 1.5,
  mote:     '#ffd9a8',
  moteRise: 1,
  moteSize: 2.6,
  water:    -10,
  aurora:   1.25,
  mist:     0.12,
  lava:     0.2,
};

/** A csavarok rövid, képernyőre írt szövege. */
export const TWIST_TEXT = {
  seaRecoil: 'A tenger visszahúzódik. Valami hatalmas mozdul a felszín alatt.',
  flyby:     'Egy szárny csapása kioltja a holdat. Az árnyék elsuhan fölötted.',
  eruption:  'A föld megnyílik. A völgy egyetlen izzó torokká válik.',
  lightning: 'Villám hasít az égbe — és a fényben egy koponya kapuja rajzolódik ki.',
  reveal:    'A köd szétnyílik.',
};
