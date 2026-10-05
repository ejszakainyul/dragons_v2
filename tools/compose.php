<?php
/**
 * Egy teljes sárkány összerakása a négy rétegből — ugyanabban a sorrendben,
 * ahogy az oldal is rétegzi (test, láb, fej, szárny).
 *
 *   php tools/compose.php <cél.png> <mappa> <szett> [szín]
 *   php tools/compose.php ki.png dragons/hd 7 "#ff8a3d"
 *
 * Ezzel ellenőrizhető, hogy az új grafikák ugyanúgy illeszkednek-e,
 * és hogy a színezés a vártat adja-e.
 */

require __DIR__ . '/png.php';

if (PHP_SAPI !== 'cli') exit('Csak parancssorból.');

$dst  = $argv[1] ?? 'compose.png';
$dir  = $argv[2] ?? 'dragons';
$set  = (int)($argv[3] ?? 7);
$hex  = $argv[4] ?? null;      // ha megadod, színezve rakja össze

$root = dirname(__DIR__);
$layers = ['body', 'legs', 'head', 'wings'];   // ugyanaz a sorrend, mint a weboldalon

$first = png_read("$root/$dir/{$layers[0]}[$set].png");
$out = new Bitmap($first->w, $first->h);

// Színszorzó (ugyanaz a logika, mint a feColorMatrix: csatornánkénti szorzás)
$mr = $mg = $mb = 1.0;
if ($hex) {
    $h = ltrim($hex, '#');
    $mr = min(1.0, hexdec(substr($h, 0, 2)) / 255 * 1.3);
    $mg = min(1.0, hexdec(substr($h, 2, 2)) / 255 * 1.3);
    $mb = min(1.0, hexdec(substr($h, 4, 2)) / 255 * 1.3);
}

foreach ($layers as $layer) {
    $path = "$root/$dir/{$layer}[$set].png";
    if (!is_file($path)) { echo "hiányzik: $path\n"; continue; }
    $im = png_read($path);

    if ($im->w !== $out->w || $im->h !== $out->h) {
        exit("Eltérő méret: $path ({$im->w}×{$im->h}) vs {$out->w}×{$out->h}\n");
    }

    for ($i = 0, $n = $out->w * $out->h; $i < $n; $i++) {
        $a = $im->a[$i];
        if ($a <= 0.001) continue;
        $out->r[$i] = $out->r[$i] * (1 - $a) + $im->r[$i] * $mr * $a;
        $out->g[$i] = $out->g[$i] * (1 - $a) + $im->g[$i] * $mg * $a;
        $out->b[$i] = $out->b[$i] * (1 - $a) + $im->b[$i] * $mb * $a;
        $out->a[$i] = $out->a[$i] + $a * (1 - $out->a[$i]);
    }
}

png_write($out, $dst);
echo "kész: $dst ({$out->w}×{$out->h}, szett $set" . ($hex ? ", szín $hex" : '') . ")\n";
