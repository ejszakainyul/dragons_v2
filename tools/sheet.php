<?php
/**
 * Összehasonlító lap: sprite-ok egymás mellé rakva egyetlen PNG-be,
 * hogy egyben lehessen megnézni az eredményt.
 *
 *   php tools/sheet.php <cél.png> <cella> <fájl1> [fájl2 ...]
 *
 * A kisebb képeket egész léptékkel nagyítja (szomszéd-mintavétel), a
 * nagyobbakat átlagolva kicsinyíti. A hátteret sötétre teszi, hogy a
 * világos sprite-ok látszódjanak.
 */

require __DIR__ . '/png.php';

if (PHP_SAPI !== 'cli') exit('Csak parancssorból.');

$dst  = $argv[1] ?? null;
$cell = (int)($argv[2] ?? 192);
$files = array_slice($argv, 3);

if (!$dst || !$files) {
    exit("Használat: php tools/sheet.php <cél.png> <cella> <fájl...>\n");
}

$cols = min(count($files), 6);
$rows = (int)ceil(count($files) / $cols);

$sheet = new Bitmap($cols * $cell, $rows * $cell);

// Sötét sakktábla háttér
for ($y = 0; $y < $sheet->h; $y++) {
    for ($x = 0; $x < $sheet->w; $x++) {
        $i = $y * $sheet->w + $x;
        $c = ((int)($x / 16) + (int)($y / 16)) % 2 ? 0.16 : 0.11;
        $sheet->r[$i] = $c;
        $sheet->g[$i] = $c;
        $sheet->b[$i] = $c + 0.03;
        $sheet->a[$i] = 1.0;
    }
}

foreach ($files as $n => $file) {
    if (!is_file($file)) { echo "hiányzik: $file\n"; continue; }
    $im = png_read($file);

    $ox = ($n % $cols) * $cell;
    $oy = (int)($n / $cols) * $cell;

    for ($y = 0; $y < $cell; $y++) {
        // forrásképpont (dobozszűrővel, ha kicsinyítünk)
        $sy0 = (int)floor($y       * $im->h / $cell);
        $sy1 = max($sy0 + 1, (int)floor(($y + 1) * $im->h / $cell));
        for ($x = 0; $x < $cell; $x++) {
            $sx0 = (int)floor($x       * $im->w / $cell);
            $sx1 = max($sx0 + 1, (int)floor(($x + 1) * $im->w / $cell));

            $r = $g = $b = $a = 0.0; $k = 0;
            for ($sy = $sy0; $sy < $sy1 && $sy < $im->h; $sy++) {
                for ($sx = $sx0; $sx < $sx1 && $sx < $im->w; $sx++) {
                    $si = $sy * $im->w + $sx;
                    $av = $im->a[$si];
                    $r += $im->r[$si] * $av;
                    $g += $im->g[$si] * $av;
                    $b += $im->b[$si] * $av;
                    $a += $av;
                    $k++;
                }
            }
            if ($k === 0) continue;
            $a /= $k;
            if ($a < 0.002) continue;
            $r = $r / $k / $a; $g = $g / $k / $a; $b = $b / $k / $a;

            $di = ($oy + $y) * $sheet->w + ($ox + $x);
            $sheet->r[$di] = $sheet->r[$di] * (1 - $a) + $r * $a;
            $sheet->g[$di] = $sheet->g[$di] * (1 - $a) + $g * $a;
            $sheet->b[$di] = $sheet->b[$di] * (1 - $a) + $b * $a;
        }
    }
}

png_write($sheet, $dst);
echo "kész: $dst (" . $sheet->w . "×" . $sheet->h . ")\n";
