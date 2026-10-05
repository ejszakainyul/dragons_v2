<?php
/**
 * Vektoros rajzsegédek a sárkány-testrészekhez.
 *
 * Alapötlet: a testrészeket nem kézzel megrajzolt körvonalként írjuk le,
 * hanem egy „gerinccel" (középvonal) és egy vastagságprofillal. A körvonalat
 * ebből számoljuk ki — így a változatok (vékonyabb, vaskosabb, hosszabb farok)
 * csak paraméterek, és minden rész ugyanazon a 64 egységes rácson marad,
 * tehát ugyanúgy illeszkednek egymásra, mint az eredeti pixelgrafikák.
 */

/* =====================================================================
   Görbék
   ===================================================================== */

/** Köbös Bézier-pont. */
function bez(array $p0, array $p1, array $p2, array $p3, float $t): array
{
    $u = 1 - $t;
    $a = $u * $u * $u;
    $b = 3 * $u * $u * $t;
    $c = 3 * $u * $t * $t;
    $d = $t * $t * $t;
    return [
        $a * $p0[0] + $b * $p1[0] + $c * $p2[0] + $d * $p3[0],
        $a * $p0[1] + $b * $p1[1] + $c * $p2[1] + $d * $p3[1],
    ];
}

/**
 * Gerinc mintavételezése Bézier-szakaszokból.
 *
 * @param array $segments [[p0, c1, c2, p3], ...]
 * @return array<int,array{0:float,1:float}>
 */
function spine(array $segments, int $perSegment = 22): array
{
    $pts = [];
    foreach ($segments as $s => $seg) {
        [$p0, $c1, $c2, $p3] = $seg;
        $start = $s === 0 ? 0 : 1;          // a csatlakozási pontot ne duplázzuk
        for ($i = $start; $i <= $perSegment; $i++) {
            $pts[] = bez($p0, $c1, $c2, $p3, $i / $perSegment);
        }
    }
    return $pts;
}

/** Egy gerincpont érintője (középső differencia). */
function tangent_at(array $pts, int $i): array
{
    $n = count($pts);
    $a = $pts[max(0, $i - 1)];
    $b = $pts[min($n - 1, $i + 1)];
    $dx = $b[0] - $a[0];
    $dy = $b[1] - $a[1];
    $l = sqrt($dx * $dx + $dy * $dy) ?: 1;
    return [$dx / $l, $dy / $l];
}

/** Merőleges (balra forgatott) egységvektor. */
function normal_at(array $pts, int $i): array
{
    [$tx, $ty] = tangent_at($pts, $i);
    return [-$ty, $tx];
}

/**
 * Melyik oldal merre van.
 *
 * A normális (-ty, tx), és mivel SVG-ben az y LEFELÉ nő, a +1 oldal a
 * rajzon lefelé mutat. Ez félrevezető, ezért nevesítve használjuk:
 * e nélkül könnyű a hátdíszt a hasra tenni.
 */
const SIDE_BELLY = +1;   // has — a rajzon lefelé
const SIDE_BACK  = -1;   // hát — a rajzon fölfelé

/**
 * A gerinc egyik oldalának eltolt pontsora.
 *
 * @param callable $widthFn  fn(float $t): float — félvastagság 0..1 mentén
 * @param int      $side     SIDE_BELLY vagy SIDE_BACK
 */
function offset_side(array $pts, callable $widthFn, int $side): array
{
    $n = count($pts);
    $out = [];
    for ($i = 0; $i < $n; $i++) {
        $t = $n > 1 ? $i / ($n - 1) : 0;
        $w = $widthFn($t);
        [$nx, $ny] = normal_at($pts, $i);
        $out[] = [$pts[$i][0] + $nx * $w * $side, $pts[$i][1] + $ny * $w * $side];
    }
    return $out;
}

/**
 * Zárt körvonal a gerinc két oldalából, lekerekített végekkel.
 */
function outline_path(array $pts, callable $widthFn, bool $roundStart = true, bool $roundEnd = true): string
{
    $left  = offset_side($pts, $widthFn, +1);
    $right = array_reverse(offset_side($pts, $widthFn, -1));

    $ring = $left;

    // Vég lekerekítése: fél körív a gerinc végén
    if ($roundEnd) {
        $n = count($pts);
        $w = $widthFn(1.0);
        [$tx, $ty] = tangent_at($pts, $n - 1);
        $c = $pts[$n - 1];
        for ($k = 1; $k <= 5; $k++) {
            $ang = M_PI * ($k / 6);
            // a végponton a normálistól a tangens felé, majd a túloldali normálisig
            $nx = -$ty; $ny = $tx;
            $ring[] = [
                $c[0] + ($nx * cos($ang) + $tx * sin($ang)) * $w,
                $c[1] + ($ny * cos($ang) + $ty * sin($ang)) * $w,
            ];
        }
    }

    $ring = array_merge($ring, $right);

    if ($roundStart) {
        $w = $widthFn(0.0);
        [$tx, $ty] = tangent_at($pts, 0);
        $c = $pts[0];
        for ($k = 1; $k <= 5; $k++) {
            $ang = M_PI * ($k / 6);
            $nx = $ty; $ny = -$tx;          // a másik oldalról indulunk
            $ring[] = [
                $c[0] + ($nx * cos($ang) - $tx * sin($ang)) * $w,
                $c[1] + ($ny * cos($ang) - $ty * sin($ang)) * $w,
            ];
        }
    }

    return catmull_path($ring, true);
}

/**
 * Sima, zárt (vagy nyitott) útvonal pontokból — Catmull-Rom spline-t
 * alakítunk köbös Bézierré, így nem lesz töréspont a körvonalon.
 */
function catmull_path(array $p, bool $closed = false, float $tension = 1.0): string
{
    $n = count($p);
    if ($n < 2) return '';

    $get = function (int $i) use ($p, $n, $closed) {
        if ($closed) return $p[(($i % $n) + $n) % $n];
        return $p[max(0, min($n - 1, $i))];
    };

    $d = 'M' . fmtp($p[0]);
    $last = $closed ? $n : $n - 1;

    for ($i = 0; $i < $last; $i++) {
        $p0 = $get($i - 1);
        $p1 = $get($i);
        $p2 = $get($i + 1);
        $p3 = $get($i + 2);

        $c1 = [
            $p1[0] + ($p2[0] - $p0[0]) / 6 * $tension,
            $p1[1] + ($p2[1] - $p0[1]) / 6 * $tension,
        ];
        $c2 = [
            $p2[0] - ($p3[0] - $p1[0]) / 6 * $tension,
            $p2[1] - ($p3[1] - $p1[1]) / 6 * $tension,
        ];
        $d .= 'C' . fmtp($c1) . ' ' . fmtp($c2) . ' ' . fmtp($p2);
    }

    return $d . ($closed ? 'Z' : '');
}

/** Koordináta rövid szöveggé (kisebb fájl, elég pontos). */
function fmt(float $v): string
{
    return rtrim(rtrim(number_format($v, 2, '.', ''), '0'), '.') ?: '0';
}

function fmtp(array $p): string
{
    return fmt($p[0]) . ',' . fmt($p[1]);
}

/* =====================================================================
   Geometriai segédek
   ===================================================================== */

/** Pont a gerincen 0..1 paraméterrel. */
function point_at(array $pts, float $t): array
{
    $n = count($pts);
    $i = (int)round($t * ($n - 1));
    return $pts[max(0, min($n - 1, $i))];
}

/**
 * Egy tüske/karom háromszög, kifelé állítva.
 *
 * FONTOS az $offset: a tüske a gerinc KÖZEPÉRŐL indulna, a test viszont
 * 5–10 egység vastag — offset nélkül a tüske teljes egészében a testen
 * belül marad, és soha nem látszik. Ezért a hívó a test félvastagságát
 * adja át, így a tüske a felszínről nő ki.
 *
 * @param float $offset  ennyivel tolódik kifelé a tüske TALPA
 */
function spike(array $pts, float $t, float $len, float $base,
               int $side = 1, float $lean = 0.0, float $offset = 0.0): string
{
    $n = count($pts);
    $i = max(0, min($n - 1, (int)round($t * ($n - 1))));
    $c = $pts[$i];
    [$tx, $ty] = tangent_at($pts, $i);
    $nx = -$ty * $side;
    $ny = $tx * $side;

    // A talp a felszínen
    $base0 = [$c[0] + $nx * $offset, $c[1] + $ny * $offset];

    $a = [$base0[0] - $tx * $base / 2, $base0[1] - $ty * $base / 2];
    $b = [$base0[0] + $tx * $base / 2, $base0[1] + $ty * $base / 2];
    $tip = [
        $base0[0] + $nx * $len + $tx * $lean * $len,
        $base0[1] + $ny * $len + $ty * $lean * $len,
    ];

    return 'M' . fmtp($a) . 'L' . fmtp($tip) . 'L' . fmtp($b) . 'Z';
}

/**
 * Pikkelysor: félhold alakú pikkelyek a gerinc mentén, egy adott oldalon.
 */
function scales(array $pts, float $t0, float $t1, int $count, float $offset, float $size, int $side = 1): string
{
    $d = '';
    for ($k = 0; $k < $count; $k++) {
        $t = $t0 + ($t1 - $t0) * ($count > 1 ? $k / ($count - 1) : 0.5);
        $n = count($pts);
        $i = max(0, min($n - 1, (int)round($t * ($n - 1))));
        $c = $pts[$i];
        [$tx, $ty] = tangent_at($pts, $i);
        $nx = -$ty * $side;
        $ny = $tx * $side;

        $cx = $c[0] + $nx * $offset;
        $cy = $c[1] + $ny * $offset;

        // enyhén ívelt pikkely: két végpont a tangens mentén, csúcs a normális mentén
        $a = [$cx - $tx * $size, $cy - $ty * $size];
        $b = [$cx + $tx * $size, $cy + $ty * $size];
        $m = [$cx + $nx * $size * 0.85, $cy + $ny * $size * 0.85];

        $d .= 'M' . fmtp($a)
            . 'Q' . fmtp($m) . ' ' . fmtp($b);
    }
    return $d;
}

/* =====================================================================
   SVG váz
   ===================================================================== */

/**
 * Szürkeárnyalatos paletta.
 * A színezés (feColorMatrix) csatornánként szorozza a fényességet, ezért
 * minden R=G=B — így az eredmény pontosan a kiválasztott szín árnyalatai.
 */
const DG = [
    'ink'      => '#101010',   // körvonal
    'shadow'   => '#3b3b3b',   // mély árnyék
    'dark'     => '#5d5d5d',
    'mid'      => '#8f8f8f',   // alaptónus
    'light'    => '#bdbdbd',
    'bright'   => '#e2e2e2',
    'spec'     => '#fbfbfb',   // csúcsfény
];

/**
 * Teljes SVG dokumentum összeállítása.
 *
 * @param string $body  a rajz tartalma
 * @param string $extraDefs  további <defs> tartalom
 */
function svg_document(string $body, string $id, string $extraDefs = ''): string
{
    $g = DG;
    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 64 64" width="512" height="512"
     shape-rendering="geometricPrecision">
<defs>
  <!-- Lagy tonusatmenet. Szandekosan nem megy le a legsotetebb arnyekig:
       a kemeny sotet foltok a format nem terfogatosnak, hanem koszosnak
       mutatjak. A melyebb arnyekot kulon retegek adjak. -->
  <linearGradient id="{$id}-vol" x1="0.18" y1="0.02" x2="0.82" y2="1">
    <stop offset="0"    stop-color="{$g['bright']}"/>
    <stop offset="0.30" stop-color="{$g['light']}"/>
    <stop offset="0.66" stop-color="{$g['mid']}"/>
    <stop offset="1"    stop-color="{$g['dark']}"/>
  </linearGradient>
  <!-- Fuggoleges valtozat. Hosszukas alakzatoknal (fej, lab) a ferde
       atmenet ugy hat, mintha sotet sapka lenne rajtuk; a felulrol jovo
       fenyhez a fuggoleges a termeszetes. -->
  <linearGradient id="{$id}-volV" x1="0.42" y1="0" x2="0.58" y2="1">
    <stop offset="0"    stop-color="{$g['bright']}"/>
    <stop offset="0.34" stop-color="{$g['light']}"/>
    <stop offset="0.74" stop-color="{$g['mid']}"/>
    <stop offset="1"    stop-color="{$g['dark']}"/>
  </linearGradient>
  <linearGradient id="{$id}-vol2" x1="0.2" y1="0" x2="0.8" y2="1">
    <stop offset="0"    stop-color="{$g['light']}"/>
    <stop offset="0.5"  stop-color="{$g['dark']}"/>
    <stop offset="1"    stop-color="{$g['shadow']}"/>
  </linearGradient>
  <!-- A membran a test fenyiranyat koveti: bal-felul vilagos. Forditva
       (sotet tetovel) a szarny fekete folttal ult a vilagos sarkanyon. -->
  <linearGradient id="{$id}-membrane" x1="0.12" y1="0" x2="0.78" y2="1">
    <stop offset="0"    stop-color="{$g['light']}"/>
    <stop offset="0.45" stop-color="{$g['mid']}"/>
    <stop offset="1"    stop-color="{$g['dark']}"/>
  </linearGradient>
  <radialGradient id="{$id}-sheen" cx="0.34" cy="0.24" r="0.95">
    <stop offset="0"    stop-color="{$g['spec']}" stop-opacity="0.62"/>
    <stop offset="0.38" stop-color="{$g['spec']}" stop-opacity="0.22"/>
    <stop offset="1"    stop-color="{$g['spec']}" stop-opacity="0"/>
  </radialGradient>
{$extraDefs}
</defs>
{$body}
</svg>
SVG;
}

/* =====================================================================
   Tömegekből épített sziluett

   Ez volt a hiányzó eszköz. Egy gerinc + vastagságprofil mindig CSÖVET
   ad — abból kígyó lesz, nem sárkány. Egy élőlénynek átfedő tömegei
   vannak: mellkas, far, koponya, comb. Az SVG-nek nincs path-unió, de
   ugyanaz az eredmény elérhető két rétegben:

     1. ugyanazok az alakzatok vastag sötét KÖRVONALLAL és sötét kitöltéssel,
     2. fölé ugyanazok az alakzatok a valódi kitöltéssel.

   Az átfedések így eltűnnek, és egyetlen, tiszta körvonalú alak marad.
   ===================================================================== */

/**
 * @param string[] $shapes  az átfedő alakzatok `d` attribútumai
 * @return array{defs:string, draw:string}
 */
function silhouette(string $clipId, array $shapes, string $fill, float $outline = 2.0): array
{
    $ink  = DG['ink'];
    $defs = '<clipPath id="' . $clipId . '">';
    $edge = '';
    $body = '';

    foreach ($shapes as $d) {
        if ($d === '') continue;
        $defs .= '<path d="' . $d . '"/>';
        $edge .= '<path d="' . $d . '" fill="' . $ink . '" stroke="' . $ink
               . '" stroke-width="' . fmt($outline) . '" stroke-linejoin="round" stroke-linecap="round"/>';
        $body .= '<path d="' . $d . '" fill="' . $fill . '"/>';
    }

    return ['defs' => $defs . '</clipPath>', 'draw' => $edge . $body];
}

/** A sziluettre vágott réteg — ide jön minden árnyék és részlet. */
function inside(string $clipId, string $content): string
{
    return '<g clip-path="url(#' . $clipId . ')">' . $content . '</g>';
}

/**
 * Peremfény: ugyanazok az alakzatok világos vonallal, kissé ELTOLVA.
 * A sziluettre vágva így csak a fény felőli (bal-felső) élen marad látszó
 * csík — ez adja a térfogat érzetét.
 */
function rim_light(array $shapes, float $dx, float $dy, float $width, string $color, float $opacity): string
{
    $d = '';
    foreach ($shapes as $s) {
        if ($s === '') continue;
        $d .= '<path d="' . $s . '" fill="none" stroke="' . $color . '" stroke-width="' . fmt($width)
            . '" stroke-linejoin="round" stroke-linecap="round"/>';
    }
    return '<g transform="translate(' . fmt($dx) . ',' . fmt($dy) . ')" opacity="' . $opacity . '">' . $d . '</g>';
}

/**
 * Magárnyék: ugyanazok az alakzatok sötéten, az ÁRNYÉK felé eltolva.
 * A sziluettre vágva a jobb-alsó oldalon marad meg — a forma „elfordul"
 * a fénytől.
 */
function core_shadow(array $shapes, float $dx, float $dy, string $color, float $opacity): string
{
    $d = '';
    foreach ($shapes as $s) {
        if ($s === '') continue;
        $d .= '<path d="' . $s . '" fill="' . $color . '"/>';
    }
    // A „lyuk" az eredeti alak: csak az eltolt rész marad sötét
    $hole = '';
    foreach ($shapes as $s) {
        if ($s === '') continue;
        $hole .= '<path d="' . $s . '"/>';
    }
    return '<g transform="translate(' . fmt($dx) . ',' . fmt($dy) . ')" opacity="' . $opacity . '">' . $d . '</g>';
}

/** Ellipszis útvonalként (elforgatható). */
function ellipse_path(float $cx, float $cy, float $rx, float $ry, float $rot = 0.0, int $steps = 20): string
{
    $c = cos($rot); $s = sin($rot);
    $pts = [];
    for ($i = 0; $i < $steps; $i++) {
        $a = 2 * M_PI * $i / $steps;
        $x = cos($a) * $rx;
        $y = sin($a) * $ry;
        $pts[] = [$cx + $x * $c - $y * $s, $cy + $x * $s + $y * $c];
    }
    return catmull_path($pts, true);
}

/** Csepp alak: egyik vége kerek, másik hegyes (izom, toll, karom). */
function teardrop(float $x0, float $y0, float $x1, float $y1, float $w, float $bulge = 0.45): string
{
    $dx = $x1 - $x0; $dy = $y1 - $y0;
    $len = sqrt($dx * $dx + $dy * $dy) ?: 1;
    $tx = $dx / $len; $ty = $dy / $len;
    $nx = -$ty; $ny = $tx;

    $bx = $x0 + $tx * $len * $bulge;
    $by = $y0 + $ty * $len * $bulge;

    return 'M' . fmt($x0) . ',' . fmt($y0)
         . 'C' . fmt($x0 + $nx * $w * 0.9 - $tx * $w * 0.5) . ',' . fmt($y0 + $ny * $w * 0.9 - $ty * $w * 0.5)
         . ' ' . fmt($bx + $nx * $w) . ',' . fmt($by + $ny * $w)
         . ' ' . fmt($x1) . ',' . fmt($y1)
         . 'C' . fmt($bx - $nx * $w) . ',' . fmt($by - $ny * $w)
         . ' ' . fmt($x0 - $nx * $w * 0.9 - $tx * $w * 0.5) . ',' . fmt($y0 - $ny * $w * 0.9 - $ty * $w * 0.5)
         . ' ' . fmt($x0) . ',' . fmt($y0) . 'Z';
}

/* =====================================================================
   Vastagságprofil (csövekhez: nyak, farok, lábszár)
   ===================================================================== */

function wprofile(array $stops, float $mul = 1.0): callable
{
    return function (float $t) use ($stops, $mul): float {
        $n = count($stops);
        if ($t <= $stops[0][0]) return $stops[0][1] * $mul;
        if ($t >= $stops[$n - 1][0]) return $stops[$n - 1][1] * $mul;
        for ($i = 0; $i < $n - 1; $i++) {
            [$t0, $w0] = $stops[$i];
            [$t1, $w1] = $stops[$i + 1];
            if ($t >= $t0 && $t <= $t1) {
                $k = ($t - $t0) / max(1e-6, $t1 - $t0);
                $k = $k * $k * (3 - 2 * $k);
                return ($w0 + ($w1 - $w0) * $k) * $mul;
            }
        }
        return $stops[$n - 1][1] * $mul;
    };
}

/** Vastagságok listájából profil, 0..1 között egyenletesen elosztva. */
function wsteps(array $widths, float $mul = 1.0): callable
{
    $stops = [];
    $n = count($widths);
    foreach ($widths as $i => $w) {
        $stops[] = [$n > 1 ? $i / ($n - 1) : 0, $w];
    }
    return wprofile($stops, $mul);
}
