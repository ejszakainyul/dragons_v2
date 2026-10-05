<?php
/**
 * A háttérvilág („realm") grafikái.
 *
 *   php tools/build_realm.php
 *
 * Kimenet: img/realm/*.svg — statikus fájlok, a böngésző oldalanként
 * gyorsítótárazza őket. Minden oldal ugyanezeket használja (lásd
 * inc/realm.php és style/realm.css).
 *
 * TELJESÍTMÉNY: ezek a képek SOHA nem animálódnak belülről. Egy nagy
 * SVG-n belüli animáció az egész réteget minden képkockán újrafestené.
 * Ami mozog (hajó, rúnakő-fény, köd, lebegő tárgyak), az külön HTML elem,
 * és csak transform/opacity változik rajta — azt a böngésző a
 * kompozitoron, festés nélkül végzi.
 *
 * A rúnák itt VONALAKBÓL állnak, nem betűtípusból: képként betöltött SVG
 * nem látja az oldal webfontjait, és a rendszerfontokban sem mindenhol
 * van rúnás blokk. (A HTML-ben lévő rúnákhoz a Noto Sans Runic töltődik.)
 */

if (PHP_SAPI !== 'cli') exit("Csak parancssorból.\n");

$OUT = dirname(__DIR__) . '/img/realm';
if (!is_dir($OUT) && !mkdir($OUT, 0777, true)) exit("Nem hozható létre: $OUT\n");

const W = 1600;
const H = 900;

/* =====================================================================
   Segédek
   ===================================================================== */
function f(float $v): string
{
    $s = number_format($v, 1, '.', '');
    return str_ends_with($s, '.0') ? substr($s, 0, -2) : $s;
}

/** Determinisztikus álvéletlen (a kimenet futásról futásra azonos). */
final class Rng
{
    private int $s;
    public function __construct(int $seed) { $this->s = $seed & 0x7fffffff ?: 1; }
    public function next(): float
    {
        $this->s = (1103515245 * $this->s + 12345) & 0x7fffffff;
        return $this->s / 0x7fffffff;
    }
    public function range(float $a, float $b): float { return $a + ($b - $a) * $this->next(); }
}

/** 1D értékzaj oktávokkal — a gerincek finom csipkézettségéhez. */
function noise1(float $x, int $seed): float
{
    $i = (int)floor($x);
    $t = $x - $i;
    $h = static function (int $n) use ($seed): float {
        $n = ($n * 374761393 + $seed * 668265263) & 0x7fffffff;
        $n = ($n ^ ($n >> 13)) * 1274126177 & 0x7fffffff;
        return (($n & 0xffff) / 0xffff) * 2 - 1;
    };
    $u = $t * $t * (3 - 2 * $t);
    return $h($i) * (1 - $u) + $h($i + 1) * $u;
}

function fbm(float $x, int $seed, int $oct = 4): float
{
    $v = 0; $a = 1; $f = 1; $sum = 0;
    for ($o = 0; $o < $oct; $o++) {
        $v += noise1($x * $f, $seed + $o * 17) * $a;
        $sum += $a; $a *= 0.5; $f *= 2.1;
    }
    return $v / $sum;
}

/**
 * Hegygerinc: kiemelkedő csúcsok (meredek, fjordszerű) + csipkézett zaj.
 * @param array<array{c:float,h:float,w:float}> $peaks
 * @return array<array{0:float,1:float}>
 */
function ridge(float $base, array $peaks, float $jag, int $seed, float $step = 4): array
{
    $pts = [];
    for ($x = -20; $x <= W + 20; $x += $step) {
        $lift = 0;
        foreach ($peaks as $p) {
            $d = abs($x - $p['c']) / $p['w'];
            if ($d < 1) {
                // 1.25-ös kitevő: meredek oldal, hegyes csúcs
                $lift = max($lift, $p['h'] * pow(1 - $d, 1.25));
            }
        }
        $y = $base - $lift + fbm($x / 38, $seed) * $jag + fbm($x / 9, $seed + 5) * $jag * 0.35;
        $pts[] = [$x, $y];
    }
    return $pts;
}

/** Gerinc → zárt terület a kép aljáig. */
function ridge_area(array $pts, float $bottom = H + 10): string
{
    $d = 'M' . f($pts[0][0]) . ',' . f($bottom);
    foreach ($pts as [$x, $y]) $d .= 'L' . f($x) . ',' . f($y);
    return $d . 'L' . f(end($pts)[0]) . ',' . f($bottom) . 'Z';
}

function ridge_line(array $pts): string
{
    $d = '';
    foreach ($pts as $i => [$x, $y]) $d .= ($i ? 'L' : 'M') . f($x) . ',' . f($y);
    return $d;
}

/** Hósapkák: a hóhatár fölötti szakaszokon, cakkos alsó éllel. */
function snow_caps(array $pts, float $snowLine, int $seed): string
{
    $d = '';
    $run = [];
    $flush = function () use (&$run, &$d, $seed) {
        if (count($run) < 3) { $run = []; return; }
        $top = ''; $bottom = [];
        foreach ($run as $i => [$x, $y, $low]) {
            $top .= ($i ? 'L' : 'M') . f($x) . ',' . f($y);
            $bottom[] = [$x, $low];
        }
        foreach (array_reverse($bottom) as [$x, $y]) $top .= 'L' . f($x) . ',' . f($y);
        $d .= $top . 'Z';
        $run = [];
    };
    foreach ($pts as [$x, $y]) {
        $low = min($snowLine + fbm($x / 14, $seed) * 22 + 10, $y + 70);
        if ($y < $low - 2) $run[] = [$x, $y, $low];
        else $flush();
    }
    $flush();
    return $d;
}

/* =====================================================================
   Rúnák vonalakból — 6×10-es rácson
   ===================================================================== */
const RUNE_LINES = [
    'f' => [[[2,0],[2,10]], [[2,3],[5,0]], [[2,6],[5,3]]],
    'u' => [[[1,10],[1,0],[5,3],[5,10]]],
    'th'=> [[[2,0],[2,10]], [[2,3],[5,5],[2,7]]],
    'a' => [[[2,0],[2,10]], [[2,0],[5,3]], [[2,3],[5,6]]],
    'r' => [[[1,10],[1,0],[5,2.5],[1,5],[5,10]]],
    'k' => [[[4.5,1.5],[1.5,5],[4.5,8.5]]],
    'g' => [[[0.5,0],[5.5,10]], [[5.5,0],[0.5,10]]],
    'w' => [[[1.5,10],[1.5,0],[5,2.5],[1.5,5]]],
    'h' => [[[1,0],[1,10]], [[5,0],[5,10]], [[1,3],[5,6]]],
    'n' => [[[3,0],[3,10]], [[1,3],[5,6]]],
    'i' => [[[3,0],[3,10]]],
    'j' => [[[3.5,1],[1,4],[3.5,7]], [[2.5,3],[5,6],[2.5,9]]],
    'ei'=> [[[3,0],[3,10]], [[3,0],[5.5,2.5]], [[3,10],[0.5,7.5]]],
    'p' => [[[1.5,0],[1.5,10]], [[1.5,0],[4.5,2.5],[4.5,3.5]], [[1.5,10],[4.5,7.5],[4.5,6.5]]],
    'z' => [[[3,0],[3,10]], [[3,4],[0.5,0.5]], [[3,4],[5.5,0.5]]],
    's' => [[[4.5,0],[1.5,3.5],[4.5,6.5],[1.5,10]]],
    't' => [[[3,0],[3,10]], [[0.5,3],[3,0],[5.5,3]]],
    'b' => [[[1.5,0],[1.5,10]], [[1.5,0],[5,2.5],[1.5,5],[5,7.5],[1.5,10]]],
    'e' => [[[1,10],[1,0],[3,3],[5,0],[5,10]]],
    'm' => [[[1,10],[1,0],[5,4]], [[5,10],[5,0],[1,4]]],
    'l' => [[[1.5,10],[1.5,0],[5,3]]],
    'ng'=> [[[3,2],[5.5,5],[3,8],[0.5,5],[3,2]]],
    'd' => [[[0.5,0],[0.5,10],[5.5,0],[5.5,10],[0.5,0]]],
    'o' => [[[1,10],[5,3.5],[3,0],[1,3.5],[5,10]]],
];

/** Egy rúna mint path, (x,y) bal felső sarokkal, h magassággal, forgatva. */
function rune_path(string $key, float $x, float $y, float $h, float $angle = 0.0): string
{
    $s = $h / 10;
    $c = cos($angle); $sn = sin($angle);
    $cx = 3 * $s; $cy = 5 * $s;            // a jel közepe körül forgatunk
    $d = '';
    foreach (RUNE_LINES[$key] as $poly) {
        foreach ($poly as $i => [$px, $py]) {
            $lx = $px * $s - $cx; $ly = $py * $s - $cy;
            $rx = $x + $cx + $lx * $c - $ly * $sn;
            $ry = $y + $cy + $lx * $sn + $ly * $c;
            $d .= ($i ? 'L' : 'M') . f($rx) . ',' . f($ry);
        }
    }
    return $d;
}

/** Szöveg → rúnakulcsok (egyszerűsített átírás, ékezetek nélkül). */
function to_runes(string $text): array
{
    $t = strtr(mb_strtolower($text), ['á'=>'a','é'=>'e','í'=>'i','ó'=>'o','ö'=>'o','ő'=>'o','ú'=>'u','ü'=>'u','ű'=>'u']);
    $out = [];
    for ($i = 0; $i < strlen($t); $i++) {
        $two = substr($t, $i, 2);
        if ($two === 'th' || $two === 'ng') { $out[] = $two; $i++; continue; }
        $ch = $t[$i];
        $map = ['c'=>'k','q'=>'k','v'=>'w','y'=>'i','x'=>'k'];
        $ch = $map[$ch] ?? $ch;
        if (isset(RUNE_LINES[$ch])) $out[] = $ch;
        elseif ($ch === ' ') $out[] = ' ';
    }
    return $out;
}

/* =====================================================================
   1. ÉGBOLT — színátmenet + statikus csillagmező + tejút
   ===================================================================== */
function build_sky(): string
{
    $r = new Rng(7);
    $stars = '';
    for ($i = 0; $i < 260; $i++) {
        $x = $r->range(0, W);
        // az ég felső részén sűrűbb
        $y = pow($r->next(), 1.6) * H * 0.72;
        $rad = $r->next() < 0.92 ? $r->range(0.5, 1.2) : $r->range(1.3, 2.0);
        $op = $r->range(0.25, 0.95);
        $stars .= '<circle cx="' . f($x) . '" cy="' . f($y) . '" r="' . f($rad) . '" opacity="' . number_format($op, 2) . '"/>';
    }
    // Tejút: sok halvány pont egy ferde sávban
    $milky = '';
    for ($i = 0; $i < 420; $i++) {
        $t = $r->next();
        $x = $t * W;
        $y = 60 + $t * 300 + ($r->next() - 0.5) * 120 * (0.6 + sin($t * 3.1) * 0.4);
        $milky .= '<circle cx="' . f($x) . '" cy="' . f($y) . '" r="' . f($r->range(0.35, 0.8)) . '" opacity="' . number_format($r->range(0.15, 0.5), 2) . '"/>';
    }

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMid slice">
<defs>
  <linearGradient id="sky" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0"    stop-color="#02040a"/>
    <stop offset="0.45" stop-color="#070d22"/>
    <stop offset="0.72" stop-color="#121a3d"/>
    <stop offset="1"    stop-color="#1d1f45"/>
  </linearGradient>
  <radialGradient id="glowTeal" cx="0.3" cy="0.62" r="0.55">
    <stop offset="0" stop-color="#2fd6c6" stop-opacity=".16"/>
    <stop offset="1" stop-color="#2fd6c6" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="glowViolet" cx="0.78" cy="0.7" r="0.5">
    <stop offset="0" stop-color="#8a64ff" stop-opacity=".14"/>
    <stop offset="1" stop-color="#8a64ff" stop-opacity="0"/>
  </radialGradient>
  <radialGradient id="milkyGlow" cx="0.5" cy="0.5" r="0.5">
    <stop offset="0" stop-color="#b9c8ff" stop-opacity=".10"/>
    <stop offset="1" stop-color="#b9c8ff" stop-opacity="0"/>
  </radialGradient>
</defs>
<rect width="1600" height="900" fill="url(#sky)"/>
<rect width="1600" height="900" fill="url(#glowTeal)"/>
<rect width="1600" height="900" fill="url(#glowViolet)"/>
<ellipse cx="800" cy="220" rx="900" ry="120" fill="url(#milkyGlow)" transform="rotate(12 800 220)"/>
<g fill="#dfe8ff">$milky</g>
<g fill="#ffffff">$stars</g>
</svg>
SVG;
}

/* =====================================================================
   2. SARKFÉNY — függönyök, függőleges csíkozással, elmosva
   ===================================================================== */
function build_aurora(): string
{
    $r = new Rng(21);
    $bands = [
        ['y' => 175, 'amp' => 60, 'h' => 170, 'c1' => '#3cf0c8', 'c2' => '#1b9cff', 'op' => .38, 'seed' => 3],
        ['y' => 215, 'amp' => 48, 'h' => 130, 'c1' => '#6ef7a8', 'c2' => '#3cf0c8', 'op' => .26, 'seed' => 9],
        ['y' => 140, 'amp' => 40, 'h' => 110, 'c1' => '#9d7bff', 'c2' => '#ff6fd8', 'op' => .20, 'seed' => 15],
    ];
    $defs = ''; $body = '';
    foreach ($bands as $i => $b) {
        // Az alsó él hullámvonala
        $low = []; $x = -40;
        while ($x <= W + 40) {
            $low[] = [$x, $b['y'] + sin($x / 230 + $b['seed']) * $b['amp'] + fbm($x / 90, $b['seed']) * 26];
            $x += 20;
        }
        $d = 'M' . f($low[0][0]) . ',' . f($low[0][1] - $b['h']);
        foreach ($low as [$lx, $ly]) $d .= 'L' . f($lx) . ',' . f($ly - $b['h'] + fbm($lx / 60, $b['seed'] + 3) * 40);
        foreach (array_reverse($low) as [$lx, $ly]) $d .= 'L' . f($lx) . ',' . f($ly);
        $d .= 'Z';

        $defs .= '<linearGradient id="a' . $i . '" x1="0" y1="1" x2="0" y2="0">'
               . '<stop offset="0" stop-color="' . $b['c1'] . '" stop-opacity="' . $b['op'] . '"/>'
               . '<stop offset=".35" stop-color="' . $b['c2'] . '" stop-opacity="' . ($b['op'] * .55) . '"/>'
               . '<stop offset="1" stop-color="' . $b['c2'] . '" stop-opacity="0"/></linearGradient>'
               . '<clipPath id="c' . $i . '"><path d="' . $d . '"/></clipPath>';

        // Függönycsíkok: vékony függőleges sávok a szalagon belül
        $streaks = '';
        for ($s = 0; $s < 90; $s++) {
            $sx = $r->range(-20, W + 20);
            $streaks .= '<rect x="' . f($sx) . '" y="0" width="' . f($r->range(2, 9)) . '" height="900" opacity="' . number_format($r->range(.03, .14), 2) . '"/>';
        }
        $body .= '<g filter="url(#blur)"><path d="' . $d . '" fill="url(#a' . $i . ')"/>'
               . '<g clip-path="url(#c' . $i . ')" fill="' . $b['c1'] . '">' . $streaks . '</g></g>';
    }

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 520" preserveAspectRatio="none">
<defs>
  <filter id="blur" x="-10%" y="-30%" width="120%" height="160%"><feGaussianBlur stdDeviation="12"/></filter>
  $defs
</defs>
$body
</svg>
SVG;
}

/* =====================================================================
   3. TÁVOLI HEGYEK — fjord csúcsok hósapkával
   ===================================================================== */
function build_far(): string
{
    $peaks = [
        ['c' => 90,   'h' => 190, 'w' => 260], ['c' => 330,  'h' => 270, 'w' => 250],
        ['c' => 540,  'h' => 180, 'w' => 200], ['c' => 760,  'h' => 300, 'w' => 260],
        ['c' => 1010, 'h' => 220, 'w' => 230], ['c' => 1240, 'h' => 320, 'w' => 280],
        ['c' => 1490, 'h' => 230, 'w' => 240],
    ];
    $pts = ridge(610, $peaks, 16, 11);
    $area = ridge_area($pts);
    $snow = snow_caps($pts, 420, 13);
    $rim  = ridge_line($pts);

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
<defs>
  <linearGradient id="m" x1="0" y1="0" x2="0" y2="1">
    <stop offset=".3"  stop-color="#1a284c"/>
    <stop offset=".7"  stop-color="#101a34"/>
  </linearGradient>
  <linearGradient id="s" x1="0" y1="0" x2="1" y2="0">
    <stop offset="0" stop-color="#cfe0ff" stop-opacity=".30"/>
    <stop offset="1" stop-color="#9fb4e0" stop-opacity=".16"/>
  </linearGradient>
  <linearGradient id="haze" x1="0" y1="0" x2="0" y2="1">
    <stop offset=".4"  stop-color="#161f42" stop-opacity="0"/>
    <stop offset=".72" stop-color="#161f42" stop-opacity=".9"/>
  </linearGradient>
</defs>
<path d="$area" fill="url(#m)"/>
<path d="$snow" fill="url(#s)"/>
<path d="$rim" fill="none" stroke="#9cc4ff" stroke-opacity=".14" stroke-width="1.4"/>
<rect width="1600" height="900" fill="url(#haze)"/>
</svg>
SVG;
}

/* =====================================================================
   4. KÖZEPES HEGYEK + FJORD víztükör
   ===================================================================== */
function build_mid(): string
{
    $peaks = [
        ['c' => 0,    'h' => 250, 'w' => 330], ['c' => 380,  'h' => 180, 'w' => 260],
        ['c' => 1120, 'h' => 200, 'w' => 260], ['c' => 1420, 'h' => 290, 'w' => 330],
        ['c' => 1650, 'h' => 220, 'w' => 260],
    ];
    $pts  = ridge(770, $peaks, 12, 31);
    $area = ridge_area($pts, 790);
    $snow = snow_caps($pts, 560, 33);
    $rim  = ridge_line($pts);

    // A víz csillámcsíkjai
    $r = new Rng(41);
    $shimmer = '';
    for ($i = 0; $i < 70; $i++) {
        $y = $r->range(780, 885);
        $x = $r->range(80, 1520);
        $w = $r->range(20, 120) * (1 - ($y - 780) / 180);
        $shimmer .= '<rect x="' . f($x) . '" y="' . f($y) . '" width="' . f($w) . '" height="1.4" rx=".7" opacity="' . number_format($r->range(.12, .45), 2) . '"/>';
    }
    // A hegyek tükörképe a vízben (lefelé tükrözve, elhalványítva)
    $mirror = '';
    foreach ($pts as $i => [$x, $y]) $mirror .= ($i ? 'L' : 'M') . f($x) . ',' . f(780 + (780 - $y) * 0.35);
    $mirror .= 'L' . f(end($pts)[0]) . ',780L' . f($pts[0][0]) . ',780Z';

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
<defs>
  <linearGradient id="m" x1="0" y1="0" x2="0" y2="1">
    <stop offset=".45" stop-color="#101a34"/>
    <stop offset=".85" stop-color="#080f21"/>
  </linearGradient>
  <linearGradient id="w" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#1a2a55"/>
    <stop offset=".35" stop-color="#0d1834"/>
    <stop offset="1" stop-color="#060b19"/>
  </linearGradient>
  <linearGradient id="mir" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0b1328" stop-opacity=".9"/>
    <stop offset="1" stop-color="#0b1328" stop-opacity="0"/>
  </linearGradient>
</defs>
<rect x="-20" y="776" width="1640" height="140" fill="url(#w)"/>
<path d="$mirror" fill="url(#mir)"/>
<g fill="#8fdcff">$shimmer</g>
<path d="$area" fill="url(#m)"/>
<path d="$snow" fill="#b8ccf2" fill-opacity=".16"/>
<path d="$rim" fill="none" stroke="#7fb2ff" stroke-opacity=".16" stroke-width="1.2"/>
<rect x="-20" y="776" width="1640" height="3" fill="#7fe3ff" opacity=".18"/>
</svg>
SVG;
}

/* =====================================================================
   5. KÖZELI PART — dombok, fenyők, hosszúház
   ===================================================================== */
function pine(float $x, float $y, float $h): string
{
    // Rétegzett ágak, enyhén aszimmetrikusan
    $w = $h * 0.42;
    $d = 'M' . f($x) . ',' . f($y - $h);
    $tiers = 4;
    for ($i = 1; $i <= $tiers; $i++) {
        $ty = $y - $h + $h * $i / $tiers;
        $tw = $w * (0.35 + 0.65 * $i / $tiers);
        $d .= 'L' . f($x + $tw * 0.5) . ',' . f($ty) . 'L' . f($x + $tw * 0.18) . ',' . f($ty - $h * 0.06);
    }
    $d .= 'L' . f($x + 1.5) . ',' . f($y) . 'L' . f($x - 1.5) . ',' . f($y);
    for ($i = $tiers; $i >= 1; $i--) {
        $ty = $y - $h + $h * $i / $tiers;
        $tw = $w * (0.35 + 0.65 * $i / $tiers);
        $d .= 'L' . f($x - $tw * 0.18) . ',' . f($ty - $h * 0.06) . 'L' . f($x - $tw * 0.5) . ',' . f($ty);
    }
    return $d . 'Z';
}

function build_near(): string
{
    // Bal domb (itt állnak a rúnakövek — HTML elemek), jobb domb a hosszúházzal
    $peaks = [
        ['c' => 190,  'h' => 105, 'w' => 420],
        ['c' => 1330, 'h' => 150, 'w' => 470],
    ];
    $pts  = ridge(872, $peaks, 7, 51, 6);
    $area = ridge_area($pts);

    $groundY = function (float $x) use ($pts): float {
        $i = (int)round(($x + 20) / 6);
        return $pts[max(0, min(count($pts) - 1, $i))][1];
    };

    // Fenyők a dombokon
    $r = new Rng(61);
    $pines = '';
    foreach ([[-20, 520, 26], [900, 1620, 30]] as [$a, $b, $n]) {
        for ($i = 0; $i < $n; $i++) {
            $x = $r->range($a, $b);
            if ($x > 1180 && $x < 1420) continue;     // a hosszúház előtt ne legyen
            $h = $r->range(26, 70) * (0.8 + 0.4 * $r->next());
            $pines .= '<path d="' . pine($x, $groundY($x) + 4, $h) . '"/>';
        }
    }

    // Hosszúház a jobb dombon
    $hx = 1300; $hy = $groundY(1300) + 6;
    $house = <<<H
<g transform="translate($hx $hy)">
  <ellipse cx="0" cy="-30" rx="150" ry="70" fill="url(#hearth)"/>
  <path d="M-92,0 L-86,-44 Q0,-52 86,-44 L92,0 Z" fill="#05070e"/>
  <path d="M-104,-40 L0,-108 L104,-40 Q0,-56 -104,-40 Z" fill="#070a14"/>
  <path d="M-8,-104 L-34,-136 Q-40,-146 -30,-146 M8,-104 L34,-136 Q40,-146 30,-146" fill="none" stroke="#070a14" stroke-width="7" stroke-linecap="round"/>
  <path d="M-104,-40 L0,-108 L104,-40" fill="none" stroke="#2a3a66" stroke-opacity=".5" stroke-width="1.5"/>
  <path d="M-11,0 L-11,-26 Q0,-33 11,-26 L11,0 Z" fill="#ffb35a"/>
  <rect x="-56" y="-30" width="9" height="7" rx="1" fill="#ff9a3d" opacity=".85"/>
  <rect x="47"  y="-30" width="9" height="7" rx="1" fill="#ff9a3d" opacity=".85"/>
  <path d="M8,-112 C14,-140 -10,-160 4,-190 C14,-212 -6,-232 6,-256" fill="none" stroke="#9aa9cf" stroke-opacity=".10" stroke-width="10" stroke-linecap="round"/>
</g>
H;

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
<defs>
  <linearGradient id="g" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#0a1020"/>
    <stop offset=".5" stop-color="#05080f"/>
  </linearGradient>
  <radialGradient id="hearth" cx=".5" cy=".6" r=".5">
    <stop offset="0" stop-color="#ff9a3d" stop-opacity=".35"/>
    <stop offset="1" stop-color="#ff9a3d" stop-opacity="0"/>
  </radialGradient>
</defs>
$house
<path d="$area" fill="url(#g)"/>
<g fill="#050810">$pines</g>
<path d="{$area}" fill="none" stroke="#3c5a9a" stroke-opacity=".18" stroke-width="1.2"/>
</svg>
SVG;
}

/* =====================================================================
   6. RÚNAKÖVEK — kígyószalagos runestone, a sávban rúnafelirattal
   ===================================================================== */
function build_stone(int $variant, string $text): string
{
    $r = new Rng(100 + $variant);
    $w = 120; $h = 230;

    // A kő körvonala: lekerekített, szabálytalan tetejű lap
    $outline = [];
    $n = 40;
    for ($i = 0; $i <= $n; $i++) {
        $a = M_PI + M_PI * $i / $n;                 // felső félkör
        $rx = $w * 0.5 * (0.95 + fbm($i / 5, $variant) * 0.08);
        $ry = $h * 0.42 * (0.95 + fbm($i / 4, $variant + 2) * 0.1);
        $outline[] = [60 + cos($a) * $rx, 100 + sin($a) * $ry];
    }
    $d = 'M' . f(60 - $w * 0.52) . ',' . f($h);
    foreach ($outline as [$x, $y]) $d .= 'L' . f($x) . ',' . f($y);
    $d .= 'L' . f(60 + $w * 0.54) . ',' . f($h) . 'Z';

    // Kígyószalag: a körvonalon belül futó ív (a runestone-ok jellegzetes eleme)
    $band = []; $bn = 60;
    for ($i = 0; $i <= $bn; $i++) {
        $t = $i / $bn;
        $a = M_PI * 0.92 + M_PI * 1.16 * $t;
        $band[] = [60 + cos($a) * 40, 118 + sin($a) * 78, $a];
    }
    // A két szár lefut az aljáig
    $bandPath = 'M' . f($band[0][0]) . ',222';
    foreach ($band as [$x, $y]) $bandPath .= 'L' . f($x) . ',' . f($y);
    $bandPath .= 'L' . f(end($band)[0]) . ',222';

    // Rúnák a szalag mentén, az érintő irányába forgatva
    $keys = array_values(array_filter(to_runes($text), fn($k) => $k !== ' '));
    $runes = '';
    $count = min(count($keys), 16);
    for ($i = 0; $i < $count; $i++) {
        $t = 0.06 + 0.88 * $i / max(1, $count - 1);
        $idx = (int)round($t * $bn);
        [$x, $y, $a] = $band[$idx];
        $angle = $a + M_PI / 2;                         // a szalagra merőlegesen álljon
        $runes .= rune_path($keys[$i], $x - 3.3, $y - 5.5, 11, $angle);
    }

    // Kígyófej a szalag végén
    [$ex, $ey] = end($band);
    $head = 'M' . f($ex - 6) . ',' . f($ey + 2) . 'Q' . f($ex + 2) . ',' . f($ey - 12) . ' ' . f($ex + 10) . ',' . f($ey - 2)
          . 'Q' . f($ex + 4) . ',' . f($ey + 6) . ' ' . f($ex - 6) . ',' . f($ey + 2) . 'Z';

    // Zuzmófoltok
    $lichen = '';
    for ($i = 0; $i < 9; $i++) {
        $lichen .= '<ellipse cx="' . f($r->range(18, 102)) . '" cy="' . f($r->range(40, 210)) . '" rx="' . f($r->range(3, 9)) . '" ry="' . f($r->range(2, 6)) . '" opacity="' . number_format($r->range(.08, .2), 2) . '"/>';
    }

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 120 230">
<defs>
  <linearGradient id="st" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="#3a4668"/>
    <stop offset=".55" stop-color="#1c2440"/>
    <stop offset="1" stop-color="#0c1122"/>
  </linearGradient>
  <filter id="gl" x="-30%" y="-30%" width="160%" height="160%"><feGaussianBlur stdDeviation="2.6"/></filter>
  <clipPath id="cl"><path d="$d"/></clipPath>
</defs>
<path d="$d" fill="url(#st)" stroke="#070a14" stroke-width="2"/>
<g clip-path="url(#cl)" fill="#9fb0d8">$lichen</g>
<path d="$bandPath" fill="none" stroke="#0a0f1d" stroke-width="17" stroke-linecap="round" stroke-opacity=".55"/>
<path d="$bandPath" fill="none" stroke="#4fe6d0" stroke-width="1.2" stroke-opacity=".35"/>
<g filter="url(#gl)"><path d="$runes" fill="none" stroke="#4fffe0" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"/></g>
<path d="$runes" fill="none" stroke="#b9fff2" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
<path d="$head" fill="#4fe6d0" fill-opacity=".45"/>
<path d="M14,60 Q30,30 60,22" fill="none" stroke="#8ea2d4" stroke-opacity=".25" stroke-width="2" stroke-linecap="round"/>
</svg>
SVG;
}

/* =====================================================================
   7. DRAKKAR — sárkányfejes orr, csíkos vitorla, pajzssor
   ===================================================================== */
function build_ship(): string
{
    $shields = '';
    for ($i = 0; $i < 9; $i++) {
        $x = 58 + $i * 20;
        $c = $i % 2 ? '#6e2622' : '#7d735f';
        $shields .= '<circle cx="' . $x . '" cy="96" r="7.5" fill="' . $c . '" stroke="#0a0d18" stroke-width="1.5"/>'
                  . '<circle cx="' . $x . '" cy="96" r="2" fill="#0a0d18"/>';
    }
    $oars = '';
    for ($i = 0; $i < 8; $i++) {
        $x = 66 + $i * 20;
        $oars .= '<path d="M' . $x . ',104 L' . ($x - 16) . ',132" stroke="#0a0d18" stroke-width="2.2"/>';
    }
    $stripes = '';
    for ($i = 0; $i < 5; $i++) {
        $x = 112 + $i * 16;
        $stripes .= '<rect x="' . $x . '" y="18" width="8" height="66" fill="#5a1d1b" opacity=".9"/>';
    }

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 300 150">
<defs>
  <linearGradient id="sail" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#8a7f68"/>
    <stop offset="1" stop-color="#5a5244"/>
  </linearGradient>
  <linearGradient id="hull" x1="0" y1="0" x2="0" y2="1">
    <stop offset="0" stop-color="#2a2233"/>
    <stop offset="1" stop-color="#0b0a12"/>
  </linearGradient>
</defs>
$oars
<path d="M150,6 L150,100" stroke="#0a0d18" stroke-width="4"/>
<path d="M104,16 Q150,10 196,16 L200,84 Q150,92 100,84 Z" fill="url(#sail)"/>
$stripes
<path d="M104,16 Q150,10 196,16 L200,84 Q150,92 100,84 Z" fill="none" stroke="#0a0d18" stroke-width="2"/>
<path d="M22,92 Q30,112 70,116 L232,116 Q270,112 280,92 Q250,104 150,104 Q50,104 22,92 Z" fill="url(#hull)" stroke="#0a0d18" stroke-width="2"/>
$shields
<path d="M270,96 Q286,78 280,54 Q276,40 288,32 Q300,30 296,42 Q290,40 288,48 Q298,60 284,70 Q292,86 276,98 Z" fill="#1c1826" stroke="#0a0d18" stroke-width="2"/>
<circle cx="291" cy="37" r="1.6" fill="#ffb35a"/>
<path d="M30,96 Q14,80 20,60 Q24,48 14,44 Q8,46 12,52" fill="none" stroke="#1c1826" stroke-width="7" stroke-linecap="round"/>
</svg>
SVG;
}

/* =====================================================================
   8. RÚNAGYŰRŰ — a hold és a hero-kör köré
   ===================================================================== */
function build_ring(string $text, string $color): string
{
    $keys = array_values(array_filter(to_runes($text), fn($k) => $k !== ' '));
    $n = count($keys);
    $runes = ''; $ticks = '';
    $R = 88;
    for ($i = 0; $i < $n; $i++) {
        $a = 2 * M_PI * $i / $n - M_PI / 2;
        $x = 100 + cos($a) * $R; $y = 100 + sin($a) * $R;
        $runes .= rune_path($keys[$i], $x - 3.6, $y - 6, 12, $a + M_PI / 2);
        // elválasztó pöttyök a rúnák között
        $b = $a + M_PI / $n;
        $ticks .= '<circle cx="' . f(100 + cos($b) * $R) . '" cy="' . f(100 + sin($b) * $R) . '" r="1.1"/>';
    }

    return <<<SVG
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 200 200">
<defs><filter id="g" x="-20%" y="-20%" width="140%" height="140%"><feGaussianBlur stdDeviation="1.6"/></filter></defs>
<circle cx="100" cy="100" r="97" fill="none" stroke="$color" stroke-opacity=".35" stroke-width=".8"/>
<circle cx="100" cy="100" r="79" fill="none" stroke="$color" stroke-opacity=".35" stroke-width=".8"/>
<circle cx="100" cy="100" r="76" fill="none" stroke="$color" stroke-opacity=".15" stroke-width="3" stroke-dasharray="1 5"/>
<g filter="url(#g)"><path d="$runes" fill="none" stroke="$color" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round" opacity=".8"/></g>
<path d="$runes" fill="none" stroke="$color" stroke-width="1.1" stroke-linecap="round" stroke-linejoin="round"/>
<g fill="$color" opacity=".7">$ticks</g>
</svg>
SVG;
}

/* =====================================================================
   Kiírás
   ===================================================================== */
$files = [
    'sky.svg'        => build_sky(),
    'aurora.svg'     => build_aurora(),
    'far.svg'        => build_far(),
    'mid.svg'        => build_mid(),
    'near.svg'       => build_near(),
    'stone1.svg'     => build_stone(1, 'sarkanyok es vikingek'),
    'stone2.svg'     => build_stone(2, 'odin latja utadat'),
    'stone3.svg'     => build_stone(3, 'a tuz sose alszik'),
    'ship.svg'       => build_ship(),
    'ring-ice.svg'   => build_ring('a kod kapujaban sors var rad', '#7ff6e4'),
    'ring-ember.svg' => build_ring('tuz es jeg dala', '#ffb35a'),
];

$total = 0;
foreach ($files as $name => $svg) {
    file_put_contents("$OUT/$name", $svg);
    $total += strlen($svg);
    printf("  %-16s %6.1f kB\n", $name, strlen($svg) / 1024);
}
printf("\nKész: %d fájl, %.1f kB összesen.\n", count($files), $total / 1024);
