# Sárkányok és Vikingek

Interaktív, északi mitológiába ágyazott sárkánynevelő webalkalmazás. A játékos
egy kérdőív alapján kapja az első sárkányát, a műhelyben testrészekből épít
továbbiakat, az arénában megméretteti őket, és megíratja a saját viking sagáját.

---

## Telepítés

1. Indítsd el a XAMPP-ban az **Apache** és a **MySQL** szolgáltatást.
2. A projekt legyen a `htdocs/sarkanyok` mappában.
3. Nyisd meg: <http://localhost/sarkanyok/install.php>
   — létrehozza az adatbázist, feltölti a testrész-katalógust, és opcionálisan
   létrehoz egy admin felhasználót.
4. Ha kész, töröld az `install.php`-t, vagy állítsd benne az
   `INSTALL_LOCKED` konstanst `true`-ra.

Parancssorból ugyanez. A `--default-character-set=utf8mb4` **kötelező**:
nélküle a Windows konzol kódlapja miatt az ékezetek duplán kódolódnak
(`Kölyökfej` → `K├Âly├Âkfej`). A `.sql` fájlok emiatt `SET NAMES utf8mb4;`-gyel
is kezdődnek, de a kapcsoló a biztos megoldás:

```bash
mysql --default-character-set=utf8mb4 -u root < sql/schema.sql
```

```bash
mysql --default-character-set=utf8mb4 -u root < sql/seed.sql
```

Bemutató adatok (4 felhasználó, 6 sárkány):

```bash
php sql/demo_seed.php
```

## Konfiguráció

Minden beállítás a `config.php`-ban van. Éles adatokhoz hozz létre egy
`config.local.php`-t, ami ugyanilyen szerkezetű tömböt ad vissza — az felülírja
az alapértékeket, és nem kerül a repóba:

```php
<?php
return [
    'db'     => ['host' => 'mysql.pelda.hu', 'user' => '...', 'pass' => '...', 'name' => '...'],
    'app'    => ['debug' => false, 'base_url' => 'https://pelda.hu'],
    'openai' => ['api_key' => 'sk-...'],
];
```

Az OpenAI kulcs elhagyható: kulcs nélkül a `inc/story_generator.php` beépített
mesélője írja a történeteket, így az oldal teljes értékűen működik.

---

## Funkciók

| Oldal | Leírás |
|---|---|
| `index.php` | Főoldal élő statisztikákkal és ranglistával |
| `quiz.php` | A jóslat — 5 kérdés, ami kiosztja az első sárkányt |
| `nyitott.php` | A műhely — drag & drop sárkányépítő, élő statokkal |
| `arena.php` | Körökre osztott csata, kitéréssel és kritikus találattal |
| `story.php` | Történetgenerátor (AI vagy beépített mesélő) |
| `user.php` | Profil: sárkányok, történetek, barátok, beállítások |
| `about.php` | Projektbemutató + rejtett sárkány (easter egg) |
| `dataeditor.php` | Admin adatböngésző (csak olvasás) |
| `jatek.php` | A Godot játékmodul beléptetője |

## Felépítés

```
config.php              beállítások (config.local.php felülírja)
db_connect.php          mysqli kapcsolat + barátságos hibaoldal
install.php             telepítő / adatbázis-helyreállító
inc/
  bootstrap.php         session, auth, CSRF, sárkány-segédfüggvények
  battle.php            csataszimuláció
  story_generator.php   OpenAI + offline mesélő
header.php / footer.php közös keret (minden oldal ezt használja)
sql/
  schema.sql            táblák
  seed.sql              testrész-katalógus
  demo_seed.php         bemutató felhasználók és sárkányok
style/theme.css         design rendszer (színek, gombok, kártyák)
script/ui.js            közös felületi viselkedés
```

## Adatmodell

- `sarkanyok_users` — fiókok, `is_admin`, `quiz_taken`, jelszó-visszaállító token
- `sarkanyok` — sárkányok; a négy testrész id-je, számolt `hp`/`dmg`, `wins`/`losses`
- `sarkanyok_fej` / `_test` / `_lab` / `_szarny` — testrész-katalógusok (1–8 + 9 = titkos)
- `sarkanyok_story` — generált történetek
- `sarkanyok_friends` — barátságok (`status`: 0 = függő, 1 = elfogadott)
- `sarkanyok_battles` — arénacsaták naplója

A sárkány képe négy PNG egymásra rajzolva; a színezés SVG `feColorMatrix`
szűrővel történik futásidőben.

### A testrész-grafikák

| mappa | mi ez |
|---|---|
| `dragons/svg/` | **ezt használja az oldal** — vektoros, generált rajzok |
| `dragons/hd/` | korábbi 384×384-es raszter változat (tartalék) |
| `dragons/` | az eredeti, kézzel rajzolt 64×64-es pixelgrafika (tartalék) |

A `part_set()` ([inc/bootstrap.php](inc/bootstrap.php)) ebben a sorrendben
keres, és az első létezőt használja — így egy mappa átnevezésével vissza
lehet váltani a régebbi készletre.

A katalógus **18 változat testrészenként** (17 szabadon keverhető + a 9-es,
ami a titkos sárkányé) — ez 17⁴ ≈ **83 500 kombináció**.

Az SVG-k újragenerálása. Ugyanez a parancs írja újra a `sql/seed.sql`-t is,
hogy a név, a statisztika és a rajz ne csúszhasson el egymástól:

```bash
php tools/build_svg.php
```

A forrás a [tools/parts_table.php](tools/parts_table.php): egy sor ír le egy
testrészt (név, HP, DMG, forma-archetípus, stílusparaméterek). Új darabhoz
elég ide egy sort felvenni és lefuttatni a generátort — a műhely, a kérdőív
és a statisztikák maguktól követik, mert a kódban sehol nincs beégetve, hány
darab van.

A generátor öt fájlból áll:

| fájl | mi van benne |
|---|---|
| [tools/parts_table.php](tools/parts_table.php) | a katalógus — **ez a forrás** |
| [tools/svglib.php](tools/svglib.php) | görbék, sziluett, megvilágítás, színpaletta |
| [tools/draw_parts.php](tools/draw_parts.php) | test + az `assemble()` |
| [tools/draw_head.php](tools/draw_head.php) | fej |
| [tools/draw_limbs.php](tools/draw_limbs.php) | láb, szárny |
| [tools/build_svg.php](tools/build_svg.php) | vezérlő: kiírja a 72 SVG-t és a seed.sql-t |

Forma-archetípusok:

| rész | archetípusok |
|---|---|
| fej | `snout` `blunt` `beak` `crest` `skull` `viper` `horned` `crystal` (+ szarv: pár, korona, kristály, hátracsapott, agancs, csavart) |
| test | `standard` `stocky` `arched` `serpent` `long` `skeletal` (+ hátdísz és farokvég) |
| láb | `digit` `pillar` `lanky` `hoof` `grasp` |
| szárny | `bat` `feather` `insect` `fin` `crystal` `double` `torn` |

#### Hogyan épül fel egy rajz

Minden testrész **átfedő tömegekből** áll (mellkas, has, far, koponya,
állkapocs, comb, lábszár…), nem egyetlen körvonalból. Egy gerinc +
vastagságprofil mindig csak *csövet* ad — abból kígyó lesz, nem sárkány;
ezért a hosszúkás részeket (nyak, farok, ujjak) még az adja, de a
térfogatot ellipszisek és cseppformák.

Az SVG-ben nincs path-unió, ezért az `assemble()`
([tools/draw_parts.php](tools/draw_parts.php)) három trükkel olvasztja őket
egybe:

1. **Sziluett.** Először minden alakzat tintával *kitöltve és
   körvonalazva* megy ki, majd az alapszín mindet átfesti. A körvonalnak
   csak a kifelé eső fele marad meg, a belső határok eltűnnek.
2. **Fény-árnyék maszkkal, nem körvonallal.** A peremfény a
   *sziluett mínusz az eltolt sziluett* — egyetlen, a külső peremet követő
   sáv. (Ha résztömegenként körvonalaznánk, a belső ellipszisek gyűrűként
   ütnének át, és a sárkány buborékosnak látszana. Ez tényleg megtörtént.)
3. **`<use>` hivatkozások.** Minden alakzat egyszer kerül a `<defs>`-be;
   a hat réteg csak hivatkozik rá. Enélkül háromszoros a fájlméret.

A változatok — vaskosabb test, hosszabb farok, más szarv — csak
paraméterek a [tools/parts_table.php](tools/parts_table.php) sorában.

#### Buktatók, amikbe bele lehet futni

- **Az oldal előjele.** A normális a `+1` oldalon a rajzon **lefelé** mutat
  (SVG-ben az y lefelé nő), tehát `SIDE_BELLY = +1` és `SIDE_BACK = -1`.
  Ezeket a konstansokat használd, ne a nyers számokat.
- **A tüskék a gerinc közepéről indulnak.** A `spike()` `$offset`
  paraméterének át kell adni a test félvastagságát (`$w($t)`), különben a
  tüske teljesen a testen belül marad és soha nem látszik.
- **A `viewBox` levág.** A szárny töve (36, 27) van, onnan fölfelé 27,
  jobbra 28 egység a hely. A `wing_frame()` ezért nem fix hosszú ujjakkal
  dolgozik, hanem a rajzterület peremére vetíti az ujjhegyeket
  (ellipszis-metszés), és csak a `size` skálázza vissza őket.
- **Az árnyalás ne legyen résztömegenkénti.** Lásd fent a 2. pontot; a
  csoport-átlátszóságot is a `<g>`-re kell tenni, nem az egyes
  alakzatokra, különben az átfedések duplán sötétednek.

Két megkötés, amit minden változtatásnál tartani kell:

- **Ugyanaz a 64 egységes rács.** A `viewBox="0 0 64 64"` megegyezik az
  eredeti pixelgrafikáéval, és minden rész ugyanazt a régiót foglalja el
  (fej balra fent, test középen, láb alul, szárny a háton) — így a négy
  réteg továbbra is egymásra rakható.
- **Szürkeárnyalatos marad** (R=G=B). A színezést futásidőben az SVG
  `feColorMatrix` szűrő végzi, ami csatornánként szorozza a fényességet;
  színes rajznál ez hamis árnyalatokat adna.

Előnézet böngészőben:

- <http://localhost/sarkanyok/tools/preview.php> — a 18 szett
- <http://localhost/sarkanyok/tools/preview.php?mix=1> — véletlen keverékek
- <http://localhost/sarkanyok/tools/preview.php?part=head> — egy résztípus összes változata

A raszteres készlet előállítása (csak ha vissza akarsz térni PNG-re):

```bash
php tools/render_parts.php 384
```

### A háttérvilág (minden oldalon)

Éjszakai fjord sarkfénnyel, rúnagyűrűs holddal, hosszúházzal, drakkarral,
rúnakövekkel és lebegő tárgyakkal (rúnák, parázs, Mjölnir, pajzs, balta,
ivókürt, valknut, sisak, holló). Az egér és a görgetés szerint rétegenként
elmozdul (parallaxis), ettől lesz térhatása.

| fájl | mi van benne |
|---|---|
| [tools/build_realm.php](tools/build_realm.php) | a tájképek generátora → `img/realm/*.svg` |
| [inc/realm.php](inc/realm.php) | a jelölés (a header.php illeszti be) |
| [style/realm.css](style/realm.css) | rétegek, animációk, könnyített mód |
| [script/realm.js](script/realm.js) | parallaxis, rúnasor a címek fölött, kártyabillenés |

```bash
php tools/build_realm.php
```

**Gyengébb gépekre tervezve** — ezeket a szabályokat érdemes tartani:

- Csak `transform`/`opacity` animálódik (azt a böngésző festés nélkül,
  a kompozitoron végzi). A nagy SVG-k belül sosem mozognak; ami mozog,
  az külön kis HTML elem.
- Nincs `backdrop-filter` (a fejléc korábbi elmosása a mögötte mozgó
  háttér miatt minden képkockán újraszámolódott volna).
- A parallaxis-ciklus leáll, ha nincs mit közelíteni.
- `html.realm-lite`: kevés mag/memória vagy adattakarékos mód esetén
  kevesebb réteg, nincs parallaxis (a header.php kapcsolja még a festés
  előtt). `prefers-reduced-motion` esetén nincs lebegés.
- A rúnák a képekben vonalakból állnak, nem betűtípusból: képként
  betöltött SVG nem látja az oldal webfontjait.

### A 3D-s kérdőív teljesítménye

- **Fénykészlet** ([script/journey/lightpool.js](script/journey/lightpool.js)):
  3 valódi pontfény szolgálja ki az összes fényforrást (rúnakövek, kapuk,
  szempár, sárkány), a kamerához legközelebbieket. A fények száma sosem
  változik, ezért a shaderek sem fordulnak újra menet közben.
- **Shader-előfordítás** a bevezető képernyő alatt, a tényleges renderelési
  célpontra — az utazás alatt egyetlen shader sem fordul.
- **Felbontás-szabályozó**: folyamatosan méri a képkockaidőt, és ahhoz
  igazítja a renderelési felbontást (0,5–1,25); ha ez sem elég, a ködből,
  a parázsból, végül a fényudvarból (bloom) vesz vissza.
- Matt felületeken `MeshLambertMaterial` (a PBR tükröző tagja ott úgyis nulla
  lenne), a vászon élsimítása kikapcsolva, bloom nélkül nincs utófeldolgozás.

## A Sárkányok Völgye — kalandjáték (`kaland.php`)

Bejárható völgy (Phaser 3.90, `vendor/phaser/`), amin a csapat vezérsárkánya a
játékos. **Barlangok** (I–IV. fok, 3 hullám; sorban nyílnak): körökre osztott
harc. Az **V. barlang** Níðhöggr fészke: mindig nyitva, egyből a boss jön, és
bármikor — akár többször is — legyőzhető. **Fészkek**: két saját sárkányból tojás — testrészenként dönthető, kitől
örököl a fióka, a „Sors" 18% eséllyel új testrészt hoz. **Hosszúház**: pihenés,
csapat. A kikelt és a megszelídített sárkányok a közös gyűjteménybe kerülnek
(profil, aréna).

| fájl | mi van benne |
|---|---|
| `script/game/main.js` | indítás, kezdő tojás új játékosnak |
| `script/game/world.js` | determinisztikus térképgenerátor (A*-os folyó és utak) |
| `script/game/overworld.js` | a völgy: mozgás, köd, helyszínek, tenyésztés |
| `script/game/battle.js` | a csata (hullámok, képességek, jutalmak) |
| `script/game/rules.js` | statisztikák, képességek, sebzés, vad sárkányok |
| `script/game/art.js` | effektek, sárkánynézet, a renderelt képek kódrajzos tartaléka |
| `script/game/skins.js` | a sárkányrészek színezése (fő kép × szín + saját színű réteg), fajtanév |
| `script/game/render3d.js` | a közös renderelő mag (sárkányok, a völgy tárgyai, csatahátterek, Níðhöggr) |
| `tools/dragonart/` | a testrészek formái és gyártója (`dragons/hd/`) |
| `tools/worldart/` | a völgy tárgyai (`img/world/`), a csatahátterek darabjai és Níðhöggr részei (`img/battle/`), `world-manifest.js` |
| `script/game/backdrops.js` | a csatahátterek összerakása a képernyő méretére (barlangok, szabadtér, karám) |
| `script/game/music.js` | saját zene WebAudio-szintézissel (völgy, éjszaka, csata, boss) |
| `script/game/daynight.js` | napszakok: közös világóra, éjjeli fények, éji vadak |
| `script/game/tiles.js` | a csempék képpontonként (domborított textúra, part, szegélycsempék a vidékhatárokra) |
| `script/game/terrain.js` | árnyalt hegycsúcsok a hegyvidékben (egy textúralapon) |
| `script/game/hud.js`, `state.js`, `sfx.js`, `path.js`, `lore.js` | felület, mentés, hangok, A*, rúnakövek |
| `kaland_api.php`, `inc/game.php` | szerver: tenyésztés, kikelés, szelídítés, mentés |
| `sql/migrate_game.sql` | a két új tábla és a `generacio`/`vonasok` oszlop |

```bash
mysql -u root --default-character-set=utf8mb4 < sql/migrate_game.sql
```

**Harci képességek a testrészekből:** a fej formája adja a különleges
képességet (tűzokádó orr = Lángcsóva, kígyófej = Méregfog, kristályfej =
Jégszilánk, taréjos fej = Viharüvöltés minden ellenfélre…), a test és a láb a
páncélt, a szárny a gyorsaságot és a kitérést.

**Kombinált képesség az összetételből:** minden testrésznek eleme van
(🔥 tűz, ❄ jég, ⚡ vihar, 🌑 árny, ⛰ kő, ☠ méreg — a nevéből: Lávapofa,
Jégkarom, Viharszárny…). A fej eleme az elsődleges, a test + láb + szárny
leggyakoribb eleme a másodlagos; a kettő párosa adja a sárkány második,
teli energiába (3) kerülő képességét — 6 tiszta és 15 vegyes, összesen 21
féle (pl. tűz + jég = Gőzrobbanás, vihar + méreg = Savas eső, kő + árny =
Kőkripta). Minél több rész „rezonál" a párossal, annál erősebb (+8%
részenként). A vad sárkányok is használják. Táblázat: `COMBOS` a `rules.js`-ben.

**A völgy megjelenése:** minden indításkor, egyszer készül — futás közben
nincs rajta extra effekt. A csempék (`tiles.js`) képpontonként rajzolódnak,
varratmentesen, bal felső fénnyel domborítva (fű, ösvény, homok, hó, hamu,
szikla, sziklafal, jég). A vidékhatárokra ritka szegélyrétegek kerülnek: a
szomszéd anyaga hullámos, puha széllel, enyhe árnyékkal lóg át (hó a fűre,
fű az ösvényre…). A partokon homok, nedves sáv, hab és sekély víz, lekerekített
sarkokkal. A fák és sziklák árnyéka a képükbe van rajzolva; a hegyvidékben
árnyalt, havas csúcsok (`terrain.js`).

**Zene:** négy saját szerzemény, hangfájl nélkül, a böngészőben szintetizálva
(`music.js`): „A Völgy dala" (lant-arpeggio, furulya, keretdob, orgonapont),
ugyanez éjjeli változatban, „Pajzsfal" a csatákhoz (taikó, vonós ostinato,
kürt) és „Níðhöggr ébredése" (frigiai fordulat, mély kórus, nehéz dobok).
Darabváltáskor áttűnik; a ♫ gombbal külön kikapcsolható.

**Napszakok:** a völgyben egy nap 12 perc, a valódi órához igazítva — minden
játékosnál egyszerre van éjfél. Alkonyatkor narancs, éjjel mélykék a fény;
kigyulladnak a hosszúház, a tábortűz, a kohó és a szentélyek fényei, a
sárkányod körül lámpásfény dereng. Éjjel „éji vadak" járnak: két szinttel
erősebbek, de másfélszeres zsákmányt adnak. Az óra a felső sávban látszik.

**Térkép:** a kistérkép festett hatású (domborzati árnyék, mély és sekély víz,
hab, utak, fák, hegycsúcsok), a játékos körül gördül, irányjelző nyíllal; a
saga célja a peremén nyíllal jelez, ha kívül esik. **M** (vagy a ⛶ gomb):
teljes világtérkép nevekkel és jelmagyarázattal — kattintásra odaindulsz.

**Barlangok a csatában:** rétegzett, festett mélység — a messzi csarnok
fénye, három sziklakulissza peremfénnyel, és fokozatonként saját látvány:
mohás vízesés világító gombákkal, befagyott vízesés jégcsapokkal,
ametisztfürtök és rúnaoszlop, lávató lávazuhataggal és bazaltoszlopokkal,
Níðhöggr barlangjában Yggdrasil elágazó gyökerei arany nedvvel. Mindegyikhez
saját mozgó hangulat (csöppek, hószikra, fényszemcsék, parázs, spórák).

**Helyszínek:** a hosszúház (csónakgerinc-ívű zsindelytető mohával, sárkányfejes
oromdeszkák, festett pajzsok, lámpások), a kunyhó, a kovácsműhely, a barlang,
a fészek, a rúnakő, a jégtrón, a Muspell-oltár, a Valkűr-kő, a stég, a ládák és
a menhírek mind anyag-segédekkel készülnek (erezett deszka, faragott kő, moha,
talajárnyék), utána egy közös simítás ad nekik peremfényt és árnyékoldalt.

**Egyedi sárkányok:** a testrészek festett, térhatású PNG-k (`dragons/hd/`),
amiket a `tools/dragonart/` renderelő gyárt (`node tools/dragonart/build.mjs`).
Nem körvonalas rajzok: minden rész valódi térbeli formákból áll (elvékonyodó
csövek, ellipszoidok, lapok, kristályprizmák), és pixelenként kap fényt —
szórt fény, ég-fény, csillanás, peremfény, résárnyék, hideg árnyék, finom
kontúr; a felszínen halpikkely, hasi lemezek, szarvgyűrűk, tolllapok. Minden
résznek két képe van: a fő kép (szürke test + saját színű anyagok) és a
`-fx` réteg (szarv, karom, fog, szem, kristály, láva, fém, csillanás). A
színezett nézetek a fő képet a sárkány színével szorozzák, és fölé teszik a
`-fx` réteget — így a szarv csont színű marad, a láva izzik, a szem világít.
18 fej, 18 test, 18 láb és 18 szárny, mind más formájú (kölyökfej,
triceratopsz-gallér, koponya, csőr, vipera, sörényes keleti sárkány, vassisak;
páncélhát, kígyótest, csontváz, vitorlás hát, mohos bunda; karmos, oszlop-,
futó-, markoló- és patás láb; denevér-, tollas, rovar-, uszony- és
kristályszárny…). A csatlakozási pontok változatlanok: bármelyik kombinálható.

**Egységes látvány:** a völgy tárgyai (fák, sziklák, épületek, NPC-k, birkák,
hegycsúcsok), a csatahátterek és Níðhöggr is ugyanazzal a renderelővel
készülnek, mint a sárkányok (`node tools/worldart/build.mjs`, ~20 mp): térbeli
formák, pixelenkénti fény, saját anyagok (kéreg, tűlevél, zsindely, kő, jég,
ametiszt, izzó láva, rúnák). A völgy képei induláskor töltődnek be (a régi
kódrajz csak tartalék), a csatahátterek darabjai csatánként, csak az épp
kellő témáé (~250 KB barlangonként). A `backdrops.js` a képernyő méretére
rakja össze őket: három sziklakulissza egyre közelebb (a távoliak a csarnok
fényébe olvadnak), cseppkövek, a téma díszei, padlókövek; szabadtéren
hegyláncok, fasor, előtér-fák; a karámban cölöpkerítés, fáklyák, lobogók.

**Ki mit dönt:** a mozgás, a harc és a játékállás a kliensen fut (egyjátékos:
a csalás csak a saját játékot rontja). Ami új sárkányt hoz létre a közös
adatbázisban, azt mindig a szerver dönti el: a tojás testrészei már a
tojásrakáskor, titokban; a kikelés időzáras; szelídíteni csak a barlang fokához
illő testrészű sárkányt lehet, és csak a már bejárt barlangokból.

**Egyensúly:** szimulációval hangolva (a vad sárkányok erő-szorzója a
`rules.js`-ben). Friss kezdő sárkány az I. barlangban ~78% (gyógyfűvel ~96%),
ajánlott szintű csapat a II–IV. fokon 90/90/71%, Níðhöggr 20. szint körül.

### Saga, mesterek, ultik (RPG-réteg)

| fájl | mi van benne |
|---|---|
| `script/game/story.js` | a saga: prológus + 5 fejezet + epilógus, küldetéslánc, mellékszálak, krónika (ᛉ) |
| `script/game/dialogue.js` | párbeszéd írógép-szöveggel és **választásokkal** (talányok), kódból rajzolt portrék, fejezetcímek |
| `script/game/places.js` | a völgy helyei **játékosonként máshol** (a névből képzett maggal): tanítók, emberek, ládák, kőkör, Vándor |
| `script/game/trainer.js` | Ragnhild Gyakorlótere (technikák, „Rúnaütés" edzés, párbaj) — és a mesterek tanító ablaka |

- **Technikák** (9): Ragnhild csak a sajátjait tanítja (Rúnabélyeg, Harci üvöltés, Pajzsfal);
  a többit először egy mesternél kell elsajátítani — Gunnhild remete (talány), Brokk
  törpe (fizetség), a Fagyóriás trónja (talány), a Muspell-oltár (őr-csata). Utána
  Ragnhild is tanítja. Egy sárkány 1, a 8. szinttől 2 technikát tudhat.
- **Ultik** (5): a harci ének teli sávjával (Q). Sárkánykórus (Ragnhild), Muspell
  lángja (oltár), Fimbul-tél (trón), Valkűrök áldása (Valkűr-kő, 3 győzelem kell),
  Gungnir (a Vándor — 8 percenként máshol áll; ki ő?). Több ulti esetén választani lehet.
- **Ereklyék** (6): a csapat minden sárkányára ható bónuszok — ládákból, a halász
  mellékszálából, a kőkör rúnarejtvényéből, a kovácstól és a kalmártól.
- **A völgyben:** kóborló vad sárkányok (közel érve rád rontanak; a vidék és a bejárt
  barlangok szabják meg az erejüket), útjelző táblák, a kalmár boltja (gyógyfű,
  mézsör, térkép-töredék), a skald ihletése, birkák, hollók, felhőárnyékok.
- **Csata:** állapotok látszanak a sárkányon (lángok, jég, csillagok, pajzsbuborék…),
  mozis kamera a nagy technikáknál, ütésmegállás, lassított utolsó csapás, utóképek.
- **Níðhöggr, a végső ellenfél** (`boss.js` + `battle.js`): nem testrészekből áll,
  hanem saját, kódból rajzolt óriás (kb. kétszer akkora, mint egy sárkány):
  szegmentált nyak, szarvkorona, három pár izzó szem, nyíló állkapocs, tépett
  szárnyak, tüskés farok, izzó gyökérerek. Egyedül jön az V. barlang utolsó
  hullámában, és **három fázisban** harcol (66% és 33% életerőnél vált):
  saját mozdulatai vannak (harapás, farokcsapás, gyökérrontás, szárnyvihar,
  méregláng, rengés), a 2. fázisban csatlóst hív, a 3.-ban körönként kétszer
  lép. Ha **mély lélegzetet vesz**, a következő lépése a Világvég-lehelet
  (az életerő 90%-a — védekezve csak 30%). A találatok a **megtörés**-sávot
  töltik: ha megtelik, megtántorodik, két körig +40% sebzést kap, és a
  feltöltött lehelete elvész. A kábítást lerázza, de az is töri.
  Számok: `BOSS` a `rules.js`-ben (szimulációval hangolva).
- **A saga vége** (`ending.js`): az epilógus után teljes képernyős, animált zárókép:
  éjszakai ég sarki fénnyel és hullócsillagokkal, telihold, a Világfa sziluettje,
  csúszó hegyvonulatok, felszálló parázs, és a játékos saját sárkányai repülnek át
  a hold előtt. Előtte kirajzolódó rúnakör, betűnként felragyogó cím, felpörgő
  statisztikák, a csapat bemutatása és stáblista. Kattintásra azonnal kibomlik;
  a krónikából (ᛉ) bármikor újranézhető.

Minden új állapot a mentett játékállás JSON-jában van (`story`, `learned`, `train`,
`ultis`, `relics`, `techSrc`, `places`) — szerveroldali változás nem kellett, mert
ezek egyike sem hoz létre új sárkányt a közös adatbázisban.

A `jatek.php` érintetlenül a Godot-modul bejárata maradt.

## Technológiák

PHP 8 · MySQL · HTML5 · CSS3 · vanilla JavaScript · Godot Engine (játékmodul)
