<?php
/**
 * A sárkány-testrészek megrajzolása + a sql/seed.sql előállítása.
 *
 *   php tools/build_svg.php
 *
 * Ez csak a vezérlő; a tényleges rajz a draw_* fájlokban van:
 *
 *   tools/svglib.php      görbék, sziluett-olvasztás, megvilágítás
 *   tools/parts_table.php a katalógus (név, statisztika, stílus) — EZ a forrás
 *   tools/draw_parts.php  test
 *   tools/draw_head.php   fej
 *   tools/draw_limbs.php  láb, szárny
 *
 * A 64 egységes rajzterület megegyezik az eredeti pixelgrafikáéval, és a
 * csatlakozási pontok MINDEN változatban azonosak, ezért a négy réteg
 * szabadon egymásra rakható:
 *
 *     nyak töve   (26, 20)              ide csatlakozik a fej
 *     csípők      (36, 38) és (50, 38)  ide a lábak
 *     szárnytő    (36, 27)              ide a szárny
 *
 * A rajz szürkeárnyalatos (R=G=B), mert a színezést futásidőben az SVG
 * feColorMatrix szűrő végzi: az csatornánként szorozza a fényességet.
 */

require __DIR__ . '/svglib.php';
require __DIR__ . '/parts_table.php';
require __DIR__ . '/draw_parts.php';
require __DIR__ . '/draw_head.php';
require __DIR__ . '/draw_limbs.php';

if (PHP_SAPI !== 'cli') exit("Csak parancssorból.\n");

// Diagnosztikai szkriptek csak a rajzoló függvényeket akarják, a kiírást nem
if (defined('SVG_BUILDERS_ONLY')) {
    return;
}

$OUT = dirname(__DIR__) . '/dragons/svg';
if (!is_dir($OUT) && !mkdir($OUT, 0777, true)) exit("Nem hozható létre: $OUT\n");

/* =====================================================================
   Kiírás
   ===================================================================== */
$table    = parts_table();
$builders = ['fej' => 'draw_head', 'test' => 'draw_body', 'lab' => 'draw_legs', 'szarny' => 'draw_wings'];
$prefixes = ['fej' => 'h', 'test' => 'b', 'lab' => 'l', 'szarny' => 'w'];

$total = $count = 0;

foreach ($builders as $part => $fn) {
    foreach ($table[$part] as $n => $row) {
        $svg = svg_document($fn($n, $row), $prefixes[$part] . $n);
        file_put_contents("$OUT/" . PART_FILE_PREFIX[$part] . "[$n].svg", $svg);
        $total += strlen($svg);
        $count++;
    }
    printf("  %-8s %2d fájl\n", $part . ':', count($table[$part]));
}

/* --- A seed.sql ugyanebből a táblából, hogy ne csúszhasson szét --- */
$sql  = "-- =====================================================================\n"
      . "--  Sárkányok és Vikingek — testrész-katalógus\n"
      . "--\n"
      . "--  FIGYELEM: ez a fájl GENERÁLT. Ne kézzel szerkeszd — a forrás a\n"
      . "--  tools/parts_table.php, és a `php tools/build_svg.php` írja újra\n"
      . "--  (a rajzokkal együtt, hogy a név, a statisztika és a kép ne\n"
      . "--  csúszhasson el egymástól).\n"
      . "--\n"
      . "--  A 9-es azonosító minden résznél a TITKOS sárkányé (about.php easter egg).\n"
      . "-- =====================================================================\n\n"
      . "-- A fájl UTF-8. Ezt kötelező közölni a szerverrel: a parancssori mysql\n"
      . "-- kliens különben a Windows konzol kódlapját (pl. cp852) feltételezi,\n"
      . "-- és az ékezetek duplán kódolódnak.\n"
      . "SET NAMES utf8mb4;\n"
      . "USE `sarkanyok`;\n\n";

foreach ($table as $part => $rows) {
    $sql .= "-- ---------------------------------------------------------------------\n";
    $sql .= "INSERT INTO `" . PART_TABLE[$part] . "` (`id`,`nev`,`image`,`hp`,`dmg`,`ritka`) VALUES\n";
    $lines = [];
    foreach ($rows as $n => $row) {
        // A kiterjesztést futásidőben a part_src() igazítja a készlethez
        $img = PART_FILE_PREFIX[$part] . "[$n].png";
        $lines[] = sprintf("  (%d,'%s','%s',%d,%d,%d)",
            $n, str_replace("'", "''", $row[0]), $img, $row[1], $row[2], $n === SECRET_ID ? 1 : 0);
    }
    $sql .= implode(",\n", $lines) . "\n"
          . "ON DUPLICATE KEY UPDATE\n"
          . "  `nev`=VALUES(`nev`), `image`=VALUES(`image`),\n"
          . "  `hp`=VALUES(`hp`), `dmg`=VALUES(`dmg`), `ritka`=VALUES(`ritka`);\n\n";
}

file_put_contents(dirname(__DIR__) . '/sql/seed.sql', $sql);

/* --- A legerősebb keverhető kombináció (a műhely sávjaihoz kell) --- */
$maxHp = $maxDmg = 0;
foreach ($table as $rows) {
    $hp = $dmg = 0;
    foreach ($rows as $n => $row) {
        if ($n === SECRET_ID) continue;
        $hp  = max($hp,  $row[1]);
        $dmg = max($dmg, $row[2]);
    }
    $maxHp  += $hp;
    $maxDmg += $dmg;
}

printf("\nKész: %d SVG (%.1f kB) és a sql/seed.sql frissítve.\n", $count, $total / 1024);
printf("A legerősebb keverhető kombináció: %d HP / %d DMG\n", $maxHp, $maxDmg);
