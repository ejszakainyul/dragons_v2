<?php
/**
 * Sárkány-testrészek újrarenderelése nagyobb felbontásban.
 *
 *   php tools/render_parts.php [méret]      (alapértelmezés: 384)
 *
 * Mit csinál és mit NEM:
 *   - Az eredeti 64×64-es rajzokból dolgozik, azokat NEM írja felül;
 *     az eredmény a dragons/hd/ mappába kerül.
 *   - A sziluettet képpontra pontosan ugyanott tartja (egész léptékű
 *     nagyítás a közös 64×64-es rácsról), így a fej/test/láb/szárny
 *     ugyanúgy illeszkedik egymásra, mint eddig.
 *   - Az eredmény szürkeárnyalatos marad (R=G=B), hogy a feColorMatrix
 *     színezés pontosan úgy működjön, mint korábban.
 *
 * Amit hozzáad:
 *   - lépcsőmentes, lágy él (bikubikus alfa + keskeny átmenet),
 *     - térfogat: a sziluett belseje felé világosodó árnyalás,
 *   - peremfény balról-fentről,
 *   - sötét körvonal, hogy a rétegek elváljanak egymástól.
 */

require __DIR__ . '/png.php';

if (PHP_SAPI !== 'cli') {
    exit('Csak parancssorból futtatható.');
}

$SIZE   = isset($argv[1]) ? max(64, (int)$argv[1]) : 384;
$FILTER = isset($argv[2]) && $argv[2] !== '' ? explode(',', $argv[2]) : null;
$SRC  = dirname(__DIR__) . '/dragons';
$DST  = $SRC . '/hd';

if (!is_dir($DST) && !mkdir($DST, 0777, true)) {
    exit("Nem hozható létre: $DST\n");
}

/* =====================================================================
   Mintavételezés
   ===================================================================== */

/** Catmull-Rom köbös interpoláció. */
function cubic(float $p0, float $p1, float $p2, float $p3, float $t): float
{
    return 0.5 * ((2 * $p1)
        + (-$p0 + $p2) * $t
        + (2 * $p0 - 5 * $p1 + 4 * $p2 - $p3) * $t * $t
        + (-$p0 + 3 * $p1 - 3 * $p2 + $p3) * $t * $t * $t);
}

/** Bikubikus mintavétel egy csatornából, széleken ismételve. */
function sample_bicubic(array $ch, int $w, int $h, float $x, float $y): float
{
    $x0 = (int)floor($x);
    $y0 = (int)floor($y);
    $tx = $x - $x0;
    $ty = $y - $y0;

    $col = [];
    for ($m = -1; $m <= 2; $m++) {
        $yy = max(0, min($h - 1, $y0 + $m));
        $row = [];
        for ($n = -1; $n <= 2; $n++) {
            $xx = max(0, min($w - 1, $x0 + $n));
            $row[] = $ch[$yy * $w + $xx];
        }
        $col[] = cubic($row[0], $row[1], $row[2], $row[3], $tx);
    }
    return cubic($col[0], $col[1], $col[2], $col[3], $ty);
}

function smoothstep(float $e0, float $e1, float $x): float
{
    if ($e1 <= $e0) return $x < $e0 ? 0.0 : 1.0;
    $t = ($x - $e0) / ($e1 - $e0);
    $t = $t < 0 ? 0 : ($t > 1 ? 1 : $t);
    return $t * $t * (3 - 2 * $t);
}

/**
 * Szeparálható Gauss-elmosás. Ez a kulcslépés: a forrás alfája képpontonként
 * 0 vagy 1, így önmagában a nagyítás lépcsős marad. Elmosás + küszöbölés
 * után viszont a sarkokból sima ív lesz.
 */
function blur(array $ch, int $w, int $h, float $sigma): array
{
    if ($sigma <= 0.01) return $ch;

    $radius = max(1, (int)ceil($sigma * 3));
    $kernel = [];
    $sum = 0.0;
    for ($i = -$radius; $i <= $radius; $i++) {
        $v = exp(-($i * $i) / (2 * $sigma * $sigma));
        $kernel[$i + $radius] = $v;
        $sum += $v;
    }
    foreach ($kernel as $k => $v) $kernel[$k] = $v / $sum;

    // vízszintes
    $tmp = array_fill(0, $w * $h, 0.0);
    for ($y = 0; $y < $h; $y++) {
        $row = $y * $w;
        for ($x = 0; $x < $w; $x++) {
            $acc = 0.0;
            for ($i = -$radius; $i <= $radius; $i++) {
                $xx = $x + $i;
                if ($xx < 0) $xx = 0; elseif ($xx >= $w) $xx = $w - 1;
                $acc += $ch[$row + $xx] * $kernel[$i + $radius];
            }
            $tmp[$row + $x] = $acc;
        }
    }

    // függőleges
    $out = array_fill(0, $w * $h, 0.0);
    for ($y = 0; $y < $h; $y++) {
        for ($x = 0; $x < $w; $x++) {
            $acc = 0.0;
            for ($i = -$radius; $i <= $radius; $i++) {
                $yy = $y + $i;
                if ($yy < 0) $yy = 0; elseif ($yy >= $h) $yy = $h - 1;
                $acc += $tmp[$yy * $w + $x] * $kernel[$i + $radius];
            }
            $out[$y * $w + $x] = $acc;
        }
    }
    return $out;
}

/* =====================================================================
   Távolságtérkép (chamfer 3-4) — ebből lesz a térfogat és a körvonal
   ===================================================================== */
function inside_distance(array $alpha, int $w, int $h): array
{
    $INF = 1e9;
    $d = [];
    for ($i = 0, $n = $w * $h; $i < $n; $i++) {
        $d[$i] = $alpha[$i] > 0.5 ? $INF : 0.0;
    }

    // előre
    for ($y = 0; $y < $h; $y++) {
        for ($x = 0; $x < $w; $x++) {
            $i = $y * $w + $x;
            if ($d[$i] === 0.0) continue;
            $m = $d[$i];
            if ($x > 0)              $m = min($m, $d[$i - 1] + 3);
            if ($y > 0)              $m = min($m, $d[$i - $w] + 3);
            if ($x > 0 && $y > 0)    $m = min($m, $d[$i - $w - 1] + 4);
            if ($x < $w - 1 && $y > 0) $m = min($m, $d[$i - $w + 1] + 4);
            $d[$i] = $m;
        }
    }
    // vissza
    for ($y = $h - 1; $y >= 0; $y--) {
        for ($x = $w - 1; $x >= 0; $x--) {
            $i = $y * $w + $x;
            if ($d[$i] === 0.0) continue;
            $m = $d[$i];
            if ($x < $w - 1)             $m = min($m, $d[$i + 1] + 3);
            if ($y < $h - 1)             $m = min($m, $d[$i + $w] + 3);
            if ($x < $w - 1 && $y < $h - 1) $m = min($m, $d[$i + $w + 1] + 4);
            if ($x > 0 && $y < $h - 1)   $m = min($m, $d[$i + $w - 1] + 4);
            $d[$i] = $m;
        }
    }

    // vissza képpont-egységbe
    for ($i = 0, $n = $w * $h; $i < $n; $i++) {
        $d[$i] = $d[$i] >= $INF ? 0.0 : $d[$i] / 3.0;
    }
    return $d;
}

/* =====================================================================
   Egy sprite feldolgozása
   ===================================================================== */
function render_part(string $srcPath, string $dstPath, int $size): array
{
    $src = png_read($srcPath);
    $sw = $src->w;
    $sh = $src->h;

    // Előszorzott fényesség: így az áttetsző szélekről nem szivárog be fekete
    $lumA = [];
    for ($i = 0, $n = $sw * $sh; $i < $n; $i++) {
        $l = ($src->r[$i] + $src->g[$i] + $src->b[$i]) / 3;
        $lumA[$i] = $l * $src->a[$i];
    }

    $out   = new Bitmap($size, $size);
    $scale = $sw / $size;

    $pxPerSrc = $size / $sw;          // hány új képpont egy eredeti képpont

    // 1) Nagyítás bikubikusan
    $aUp  = array_fill(0, $size * $size, 0.0);
    $laUp = array_fill(0, $size * $size, 0.0);

    for ($y = 0; $y < $size; $y++) {
        $sy = ($y + 0.5) * $scale - 0.5;   // a forrásképpont közepére célzunk
        for ($x = 0; $x < $size; $x++) {
            $sx = ($x + 0.5) * $scale - 0.5;
            $i  = $y * $size + $x;
            $aUp[$i]  = max(0.0, min(1.0, sample_bicubic($src->a, $sw, $sh, $sx, $sy)));
            $laUp[$i] = sample_bicubic($lumA, $sw, $sh, $sx, $sy);
        }
    }

    // 2) Elmosás + küszöbölés: ettől lesz a lépcsős élből sima kontúr
    $aBlur = blur($aUp, $size, $size, 0.85 * $pxPerSrc);

    $alpha = array_fill(0, $size * $size, 0.0);
    for ($i = 0, $n = $size * $size; $i < $n; $i++) {
        $alpha[$i] = smoothstep(0.42, 0.58, $aBlur[$i]);
    }

    // 3) Az eredeti belső árnyalás lágyítva (különben 1 képpontos csíkok
    //    maradnának, amik nagyban durván néznek ki)
    $laS = blur($laUp, $size, $size, 0.28 * $pxPerSrc);
    $aS  = blur($aUp,  $size, $size, 0.28 * $pxPerSrc);

    $base = array_fill(0, $size * $size, 0.0);
    for ($i = 0, $n = $size * $size; $i < $n; $i++) {
        $base[$i] = $aS[$i] > 0.03 ? max(0.0, min(1.0, $laS[$i] / $aS[$i])) : 0.0;
    }

    $dist = inside_distance($alpha, $size, $size);

    // A térfogat- és körvonal-méretek a felbontással skálázódnak
    $px      = $pxPerSrc;             // 1 eredeti képpont ennyi új képpont
    $volR    = 2.6 * $px;             // eddig a mélységig világosodik befelé
    $outline = 1.1 * $px;             // körvonal vastagsága
    $rimR    = 2.0 * $px;             // peremfény szélessége

    // Fényirány: balról-fentről (a képernyő koordinátáiban y lefelé nő)
    $lx = -0.62;
    $ly = -0.78;

    $peak = 0.0;
    $lum  = array_fill(0, $size * $size, 0.0);

    for ($y = 0; $y < $size; $y++) {
        for ($x = 0; $x < $size; $x++) {
            $i = $y * $size + $x;
            if ($alpha[$i] <= 0.004) continue;

            $d     = $dist[$i];
            $depth = smoothstep(0.0, $volR, $d);

            // 1) Az eredeti rajz fényessége az alap
            $l = $base[$i];

            // 2) Térfogat: az él felé sötétedik (takart fény).
            //    Óvatosan: erős értéknél a kisebb részek (fej, láb) teljesen
            //    besötétednek, és elvész az eredeti rajz.
            $l *= 0.68 + 0.32 * $depth;

            // 3) Peremfény: a távolságtérkép gradienséből kapjuk a "normált"
            $gx = ($dist[$i + ($x < $size - 1 ? 1 : 0)] - $dist[$i - ($x > 0 ? 1 : 0)]);
            $gy = ($dist[$i + ($y < $size - 1 ? $size : 0)] - $dist[$i - ($y > 0 ? $size : 0)]);
            $gl = sqrt($gx * $gx + $gy * $gy);
            if ($gl > 1e-4) {
                $nx = $gx / $gl;
                $ny = $gy / $gl;
                // a felület normálisa kifelé mutat, ezért az ellentettjével számolunk
                $ndl = max(0.0, -($nx * $lx + $ny * $ly));
                $rim = $ndl * (1.0 - smoothstep(0.0, $rimR, $d));
                $l  += 0.30 * $rim;
            }

            // 4) Körvonal: keskeny sötét szegély közvetlenül a sziluett mentén.
            //    Ez adja a rétegek elválását, e nélkül összefolynak.
            $l *= 0.18 + 0.82 * smoothstep(0.0, $outline, $d);

            $lum[$i] = $l;
            if ($l > $peak) $peak = $l;
        }
    }

    // Normalizálás: a legvilágosabb pont menjen vissza ~1-re, különben a
    // színezés után minden sárkány tompább lenne a korábbinál
    $norm = $peak > 0.01 ? min(1.35, 1.0 / $peak) : 1.0;

    for ($i = 0, $n = $size * $size; $i < $n; $i++) {
        if ($alpha[$i] <= 0.004) continue;
        $v = min(1.0, $lum[$i] * $norm);
        $out->r[$i] = $v;
        $out->g[$i] = $v;
        $out->b[$i] = $v;
        $out->a[$i] = $alpha[$i];
    }

    png_write($out, $dstPath);
    return ['peak' => $peak, 'norm' => $norm];
}

/* =====================================================================
   Futtatás
   ===================================================================== */
$parts = ['head', 'body', 'legs', 'wings'];
$t0 = microtime(true);
$total = 0;

echo "Renderelés {$SIZE}×{$SIZE} méretben -> dragons/hd/\n\n";

foreach ($parts as $part) {
    foreach (range(1, 9) as $n) {
        $file = "{$part}[{$n}].png";
        if ($FILTER && !in_array($file, $FILTER, true)) continue;
        $srcPath = "$SRC/$file";
        if (!is_file($srcPath)) {
            echo "  ! hiányzik: $file\n";
            continue;
        }
        $dstPath = "$DST/$file";
        render_part($srcPath, $dstPath, $SIZE);
        $kb = round(filesize($dstPath) / 1024, 1);
        $total += filesize($dstPath);
        printf("  %-14s %6s kB\n", $file, $kb);
    }
}

printf("\nKész: %d fájl, összesen %.1f kB, %.1f mp alatt.\n",
    count($parts) * 9, $total / 1024, microtime(true) - $t0);
