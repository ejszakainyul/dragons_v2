<?php
/**
 * A kalandjáték (kaland.php) szerveroldali szabályai.
 *
 * Munkamegosztás a kliens és a szerver között:
 *
 *   KLIENS  — mozgás, harc, jutalmak, játékállás (egyjátékos: ha valaki
 *             a saját állását piszkálja, csak a saját játékát rontja)
 *   SZERVER — minden, ami új sárkányt hoz létre a közös adatbázisban:
 *             tenyésztés (a tojás testrészei a tojásrakáskor, titokban
 *             dőlnek el), kikelés (időzár), szelídítés (csak a barlang
 *             fokához illő testrészek), kezdő sárkány.
 *
 * A harci képességek a testrészek FORMÁJÁBÓL jönnek (tools/parts_table.php:
 * pl. kígyófej = méregfog, rovarszárny = gyors és kitérő) — a kliens a
 * katalógussal együtt kapja meg őket.
 */

require_once __DIR__ . '/bootstrap.php';
require_once APP_ROOT . '/tools/parts_table.php';

/** Vonások: tenyésztéskor öröklődnek, és ritkán újak is kialakulnak. */
const GAME_TRAITS = [
    'fireblood'  => ['Tűzvérű',        'Nem ég meg, és a tűzsebzése +15%'],
    'frostheart' => ['Jégszív',        'Nem lehet megfagyasztani'],
    'ancient'    => ['Ősi vér',        '+12% életerő'],
    'storm'      => ['Viharszárnyú',   '+12 gyorsaság'],
    'ironscale'  => ['Vaspikkely',     '+8 páncél'],
    'berserk'    => ['Dühöngő',        '+20% sebzés, ha az életereje a fele alá esik'],
    'regen'      => ['Regenerálódó',   'Minden körében 4% életerőt gyógyul'],
    'fated'      => ['Norn-áldott',    '+8% kritikus esély'],
];

const GAME_SLOTS = ['fej' => 'fej_id', 'test' => 'test_id', 'lab' => 'lab_id', 'szarny' => 'szarny_id'];

const GAME_MAX_DRAGONS   = 60;   // ennyi fér el egy játékos barlangjában
const GAME_TAME_COOLDOWN = 20;   // másodperc két szelídítés között
const GAME_NESTS         = 3;    // ennyi fészek van a térképen
const GAME_MUTATION_PCT  = 18;   // „sorsra bízott" testrésznél ennyi % az esély új részre

/* =====================================================================
   Katalógus
   ===================================================================== */

/**
 * Minden testrész: név, statisztika, forma, kép — a kliensnek.
 * @return array<string, array<int, array>>
 */
function game_catalog(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;

    $table = parts_table();
    $out = [];
    foreach (GAME_SLOTS as $slot => $_) {
        foreach (part_catalog($slot) as $row) {
            $id = (int)$row['id'];
            $meta = $table[$slot][$id] ?? [];
            $out[$slot][$id] = [
                'nev'    => (string)$row['nev'],
                'hp'     => (int)$row['hp'],
                'dmg'    => (int)$row['dmg'],
                'shape'  => (string)($meta['shape'] ?? 'standard'),
                'size'   => (float)($meta['size'] ?? 1.0),
                'secret' => $id === SECRET_PART_ID,
                'img'    => part_src(PART_FILES[$slot] . '[' . $id . ']'),
            ];
        }
    }
    return $cache = $out;
}

/** Egy testrész „ereje" a barlangfokok besorolásához (a sebzés többet számít). */
function game_part_power(array $p): int
{
    return $p['hp'] + $p['dmg'] * 3;
}

/**
 * Barlangfokonként megengedett testrészek (1 = leggyengébb, 5 = legerősebb).
 * A vadon élő sárkányok ezekből épülnek, és szelídítéskor a szerver
 * ugyanezt ellenőrzi.
 *
 * @return array<string, array<int, int[]>>  [rész][fok] => [id, ...]
 */
function game_tiers(): array
{
    static $cache = null;
    if ($cache !== null) return $cache;

    $cat = game_catalog();
    $out = [];
    foreach (GAME_SLOTS as $slot => $_) {
        $ids = array_values(array_filter(normal_part_ids($slot), fn($id) => isset($cat[$slot][$id])));
        usort($ids, fn($a, $b) => game_part_power($cat[$slot][$a]) <=> game_part_power($cat[$slot][$b]));
        $n = count($ids);
        for ($t = 1; $t <= 5; $t++) {
            // Átfedő ablakok: a fokok között fokozatos az átmenet
            $lo = (int)floor(($t - 1) * max(1, $n - 4) / 4);
            $hi = min($n - 1, $lo + 5);
            $out[$slot][$t] = array_slice($ids, $lo, $hi - $lo + 1);
        }
    }
    return $cache = $out;
}

/* =====================================================================
   Sárkányok
   ===================================================================== */

function game_dragon_row(array $r): array
{
    return [
        'id'     => (int)$r['id'],
        'nev'    => (string)$r['nev'],
        'szin'   => (string)$r['szin'],
        'fej'    => (int)$r['fej_id'],
        'test'   => (int)$r['test_id'],
        'lab'    => (int)$r['lab_id'],
        'szarny' => (int)$r['szarny_id'],
        'hp'     => (int)$r['hp'],
        'dmg'    => (int)$r['dmg'],
        'xp'     => (int)$r['xp'],
        'gen'    => (int)$r['generacio'],
        'traits' => array_values(array_filter(explode(',', (string)$r['vonasok']), fn($t) => isset(GAME_TRAITS[$t]))),
    ];
}

/** @return array<int, array> */
function game_dragons(int $uid): array
{
    $stmt = db()->prepare(
        'SELECT id, nev, szin, fej_id, test_id, lab_id, szarny_id, hp, dmg, xp, generacio, vonasok
           FROM sarkanyok WHERE user_id = ? ORDER BY id ASC'
    );
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    return array_map('game_dragon_row', $rows);
}

function game_dragon(int $uid, int $id): ?array
{
    $stmt = db()->prepare(
        'SELECT id, nev, szin, fej_id, test_id, lab_id, szarny_id, hp, dmg, xp, generacio, vonasok
           FROM sarkanyok WHERE id = ? AND user_id = ?'
    );
    $stmt->bind_param('ii', $id, $uid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ? game_dragon_row($row) : null;
}

function game_dragon_count(int $uid): int
{
    $stmt = db()->prepare('SELECT COUNT(*) FROM sarkanyok WHERE user_id = ?');
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $stmt->bind_result($n);
    $stmt->fetch();
    $stmt->close();
    return (int)$n;
}

/**
 * Új sárkány beszúrása. A statisztika MINDIG a testrészekből számolódik,
 * sosem a klienstől jön.
 */
function game_insert_dragon(int $uid, array $d): array
{
    $tot = dragon_totals($d['fej'], $d['test'], $d['lab'], $d['szarny']);
    $traits = implode(',', array_slice(array_values(array_unique($d['traits'] ?? [])), 0, 3));
    $gen = max(0, min(255, (int)($d['gen'] ?? 0)));
    $name = mb_substr(trim((string)$d['nev']), 0, 60) ?: 'Sárkány';

    $stmt = db()->prepare(
        'INSERT INTO sarkanyok (user_id, nev, szin, fej_id, test_id, lab_id, szarny_id, hp, dmg, generacio, vonasok)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->bind_param('issiiiiiiis', $uid, $name, $d['szin'], $d['fej'], $d['test'], $d['lab'], $d['szarny'],
                      $tot['hp'], $tot['dmg'], $gen, $traits);
    $stmt->execute();
    $id = (int)$stmt->insert_id;
    $stmt->close();

    return game_dragon($uid, $id);
}

/* =====================================================================
   Tenyésztés
   ===================================================================== */

/**
 * Két szín keveréke a SZÍNKÖRÖN (HSL), kis véletlen eltéréssel.
 *
 * RGB-ben átlagolva a kiegészítő színek kioltják egymást (narancs + cián
 * = szürke). A színkörön a rövidebb íven keverve élénk marad: narancs +
 * cián = zöld. A telítettség nem eshet 55% alá, hogy ne legyen fakó.
 */
function game_mix_color(string $a, string $b): string
{
    $toHsl = static function (string $hex): array {
        $hex = ltrim($hex, '#');
        if (!preg_match('/^[0-9a-f]{6}$/i', $hex)) $hex = 'ff8a3d';
        $r = hexdec(substr($hex, 0, 2)) / 255;
        $g = hexdec(substr($hex, 2, 2)) / 255;
        $b = hexdec(substr($hex, 4, 2)) / 255;
        $max = max($r, $g, $b); $min = min($r, $g, $b);
        $l = ($max + $min) / 2;
        $d = $max - $min;
        if ($d < 1e-6) return [0.0, 0.0, $l];
        $s = $d / (1 - abs(2 * $l - 1));
        $h = match (true) {
            $max === $r => fmod(($g - $b) / $d + 6, 6),
            $max === $g => ($b - $r) / $d + 2,
            default     => ($r - $g) / $d + 4,
        };
        return [$h * 60, $s, $l];
    };

    [$h1, $s1, $l1] = $toHsl($a);
    [$h2, $s2, $l2] = $toHsl($b);
    $w = random_int(35, 65) / 100;                     // nem mindig pont a fele

    // A szürke szülő színárnyalata nem számít — a másikét örökli
    if ($s1 < 0.08) $h1 = $h2;
    if ($s2 < 0.08) $h2 = $h1;
    $dh = fmod($h2 - $h1 + 540, 360) - 180;            // a rövidebb ív
    $h = fmod($h1 + $dh * (1 - $w) + random_int(-14, 14) + 360, 360);
    $s = max(0.55, min(1, $s1 * $w + $s2 * (1 - $w) + random_int(-5, 8) / 100));
    $l = max(0.38, min(0.68, $l1 * $w + $l2 * (1 - $w) + random_int(-5, 5) / 100));

    // HSL -> RGB
    $c = (1 - abs(2 * $l - 1)) * $s;
    $x = $c * (1 - abs(fmod($h / 60, 2) - 1));
    $m = $l - $c / 2;
    [$r, $g, $bb] = match ((int)floor($h / 60) % 6) {
        0 => [$c, $x, 0], 1 => [$x, $c, 0], 2 => [0, $c, $x],
        3 => [0, $x, $c], 4 => [$x, 0, $c], default => [$c, 0, $x],
    };
    return sprintf('#%02x%02x%02x', (int)round(($r + $m) * 255), (int)round(($g + $m) * 255), (int)round(($bb + $m) * 255));
}

function game_random_trait(array $exclude): ?string
{
    $pool = array_values(array_diff(array_keys(GAME_TRAITS), $exclude));
    return $pool ? $pool[array_rand($pool)] : null;
}

/**
 * A fióka meghatározása.
 *
 * @param array $pick  testrészenként: 'a' | 'b' | 'r' (sorsra bízva)
 *                     A „sors" 50–50%-ban választ a szülők közül, és
 *                     GAME_MUTATION_PCT eséllyel teljesen új testrészt hoz —
 *                     ez az egyetlen út új testrészhez a tenyésztésben.
 */
function game_breed(array $a, array $b, array $pick): array
{
    $child = [];
    $mutated = [];

    foreach (GAME_SLOTS as $slot => $_) {
        $choice = $pick[$slot] ?? 'r';
        if ($choice === 'a') {
            $id = $a[$slot];
        } elseif ($choice === 'b') {
            $id = $b[$slot];
        } else {
            $id = random_int(0, 1) ? $a[$slot] : $b[$slot];
            if (random_int(1, 100) <= GAME_MUTATION_PCT) {
                $ids = normal_part_ids($slot);
                $id = $ids[array_rand($ids)];
                $mutated[] = $slot;
            }
        }
        $child[$slot] = (int)$id;
    }

    // Vonások: a szülőké egyenként 55%-kal öröklődik, és van esély újra
    $traits = [];
    foreach (array_unique(array_merge($a['traits'], $b['traits'])) as $t) {
        if (random_int(1, 100) <= 55) $traits[] = $t;
    }
    $newChance = 14 + 10 * count($mutated);
    if (count($traits) < 3 && random_int(1, 100) <= $newChance) {
        $t = game_random_trait($traits);
        if ($t) $traits[] = $t;
    }

    $child['traits']  = array_slice($traits, 0, 3);
    $child['gen']     = min(20, max($a['gen'], $b['gen']) + 1);
    $child['szin']    = game_mix_color($a['szin'], $b['szin']);
    $child['mutated'] = $mutated;
    return $child;
}

/** Keltetési idő másodpercben: nemzedékenként hosszabb. */
function game_incubation_seconds(int $gen): int
{
    return min(600, 60 + 30 * $gen);
}

/** A tenyésztés ára rúnaszilánkban (a kliens vonja le a saját állásából). */
function game_breed_cost(int $gen): int
{
    return 40 + 20 * max(0, $gen - 1);
}

/* =====================================================================
   Játékállás
   ===================================================================== */

function game_load_save(int $uid): ?array
{
    $stmt = db()->prepare('SELECT allas, szelidites FROM sarkanyok_jatek WHERE user_id = ?');
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row) return null;
    $save = json_decode((string)$row['allas'], true);
    return is_array($save) ? $save + ['_tamedAt' => $row['szelidites']] : null;
}

function game_store_save(int $uid, string $json): void
{
    $stmt = db()->prepare(
        'INSERT INTO sarkanyok_jatek (user_id, allas) VALUES (?, ?)
         ON DUPLICATE KEY UPDATE allas = VALUES(allas)'
    );
    $stmt->bind_param('is', $uid, $json);
    $stmt->execute();
    $stmt->close();
}

/** A legmagasabb legyőzött barlangfok a mentett állás szerint. */
function game_max_cleared(int $uid): int
{
    $save = game_load_save($uid);
    $max = 0;
    foreach ((array)($save['cleared'] ?? []) as $tier => $done) {
        if ($done) $max = max($max, (int)$tier);
    }
    return $max;
}

/* =====================================================================
   Tojások
   ===================================================================== */

/** @return array<int, array> a kliensnek — a testrészek NÉLKÜL (meglepetés) */
function game_eggs(int $uid): array
{
    $stmt = db()->prepare(
        'SELECT id, feszek, szulo_a, szulo_b, szin, generacio, UNIX_TIMESTAMP(kesz) AS kesz
           FROM sarkanyok_tojasok WHERE user_id = ? ORDER BY feszek'
    );
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();

    return array_map(fn($r) => [
        'id'    => (int)$r['id'],
        'nest'  => (int)$r['feszek'],
        'a'     => (string)$r['szulo_a'],
        'b'     => (string)$r['szulo_b'],
        'szin'  => (string)$r['szin'],
        'gen'   => (int)$r['generacio'],
        'ready' => (int)$r['kesz'],
    ], $rows);
}
