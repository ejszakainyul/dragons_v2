<?php
/**
 * A testrészek megrajzolása — anatómiai tömegekből.
 *
 * Miért így: a korábbi változat minden részt egyetlen gerincből és egy
 * vastagságprofilból épített. Az ilyen alakzat mindig CSŐ marad — abból
 * kígyó lesz, nem sárkány: nincs mellkas, nincs far, nincs váll.
 *
 * Itt minden rész több, egymást átfedő tömegből áll (mellkas, far,
 * koponya, comb), amiket a silhouette() olvaszt EGY tiszta körvonalú
 * alakzattá. A tömegekre utána valódi megvilágítás kerül: magárnyék az
 * árnyékos oldalon, peremfény a fény felőli élen, és anatómiai vonalak
 * (váll, bordák, hasi pajzsok).
 *
 * A fényforrás mindenhol BAL-FENT van.
 */

/* =====================================================================
   Közös: egy rész összeállítása
   ===================================================================== */

/**
 * Több átfedő tömegből EGY test.
 *
 * A résztömegek (mellkas, has, far, nyak...) egymásra csúsztatva adják a
 * sziluettet. Két dolgot kell nagyon pontosan csinálni:
 *
 *  1. A körvonal csak a KÜLSŐ peremen látsszon. Ezért először minden
 *     alakzat tintával kitöltve + körvonalazva megy ki, aztán az alapszín
 *     mindet átfesti: a vonal kifelé eső fele marad csak meg.
 *
 *  2. A fény-árnyék sem körvonalazhat résztömegeket. A korábbi változat
 *     eltolt KÖRVONALAKAT rajzolt, és a belső ellipszisek gyűrűként
 *     ütöttek át a testen — a sárkány buborékosnak látszott. Helyette
 *     maszk: a sziluett mínusz az eltolt sziluett = egyetlen, a teljes
 *     külső peremet követő fény- illetve árnyéksáv.
 *
 * Minden alakzat egyszer kerül a <defs>-be, és <use> hivatkozik rá —
 * különben hatszoros fájlméret jönne ki.
 */
function assemble(string $id, array $shapes, string $fill, string $detail = '',
                  string $behind = '', string $front = '', float $outline = 1.9): string
{
    $g = DG;
    $ink = $g['ink'];

    $defs = '';
    $ids  = [];
    foreach (array_values($shapes) as $i => $d) {
        if ($d === '') continue;
        $sid  = $id . '-s' . $i;
        $ids[] = $sid;
        $defs .= '<path id="' . $sid . '" d="' . $d . '"/>';
    }
    if (!$ids) return '';

    $ref = function (string $attrs) use ($ids): string {
        $out = '';
        foreach ($ids as $sid) $out .= '<use href="#' . $sid . '" ' . $attrs . '/>';
        return $out;
    };

    $mask = function (string $suffix, float $dx, float $dy) use ($id, $ref): string {
        return '<mask id="' . $id . '-' . $suffix . '" maskUnits="userSpaceOnUse"'
             . ' x="0" y="0" width="64" height="64">'
             . '<rect width="64" height="64" fill="#000"/>'
             . $ref('fill="#fff"')
             . '<g transform="translate(' . fmt($dx) . ',' . fmt($dy) . ')">'
             . $ref('fill="#000"') . '</g>'
             . '</mask>';
    };

    $defs .= '<clipPath id="' . $id . '-clip">' . $ref('') . '</clipPath>'
           . $mask('rim',  1.9, 2.4)    // marad: bal-felső perem
           . $mask('core', -3.2, -4.0); // marad: jobb-alsó perem

    $draw = $ref('fill="' . $ink . '" stroke="' . $ink . '" stroke-width="' . fmt($outline)
                 . '" stroke-linejoin="round" stroke-linecap="round"')
          . $ref('fill="' . $fill . '"');

    $band = function (string $suffix, string $color, float $op) use ($id): string {
        return '<g mask="url(#' . $id . '-' . $suffix . ')" opacity="' . fmt($op) . '">'
             . '<rect width="64" height="64" fill="' . $color . '"/></g>';
    };

    $shading =
        // Lágy belső árnyék: eltolt tömeg, EGYETLEN csoport-átlátszósággal,
        // hogy az átfedő részek ne sötétedjenek duplán
        '<g clip-path="url(#' . $id . '-clip)">'
        . '<g transform="translate(3.4,4.0)" opacity="0.26">' . $ref('fill="' . $g['shadow'] . '"') . '</g>'
        . '<g transform="translate(6.6,7.6)" opacity="0.13">' . $ref('fill="' . $ink . '"') . '</g>'
        . '</g>'
        . $band('core', $ink, 0.20)
        . $band('rim', $g['spec'], 0.52)
        . '<g clip-path="url(#' . $id . '-clip)">' . $detail . '</g>';

    return '<defs>' . $defs . '</defs>' . $behind . $draw . $shading . $front;
}

/* =====================================================================
   TEST — nyak + mellkas + törzs + far + farok
   ===================================================================== */

/** Archetípusonkénti anatómia. Minden méret a `bulk`-kal skálázódik. */
function body_anatomy(string $shape): array
{
    // [nyakgörbe, nyakvastagság, mellkas, törzs, far, farokgörbe, farokvastagság]
    return match ($shape) {

        'stocky' => [
            [[26, 20], [29, 22], [31.5, 25], [34, 29]], [3.4, 6.4],
            ['cx' => 37.5, 'cy' => 33.5, 'rx' => 9.6, 'ry' => 9.0, 'rot' => -0.10],
            [[35, 33.5], [51, 35]], 8.6,
            ['cx' => 50.5, 'cy' => 34.5, 'rx' => 10.0, 'ry' => 9.4, 'rot' => 0.08],
            [[[56, 32], [60, 30], [62, 24], [59.5, 16]]], [5.4, 1.0],
        ],

        'arched' => [
            [[26, 20], [29.5, 21.5], [32, 23.5], [34.5, 27]], [3.0, 5.2],
            ['cx' => 38, 'cy' => 31, 'rx' => 8.4, 'ry' => 7.6, 'rot' => -0.16],
            [[35.5, 31], [51, 33.5]], 7.2,
            ['cx' => 50.5, 'cy' => 33, 'rx' => 9.0, 'ry' => 8.4, 'rot' => 0.14],
            [[[56, 31], [61, 29], [63.5, 21], [58, 10]]], [4.8, 0.7],
        ],

        'serpent' => [
            [[26, 20], [29, 23], [30.5, 26], [33, 30]], [2.6, 4.2],
            ['cx' => 37, 'cy' => 33.5, 'rx' => 6.4, 'ry' => 6.0, 'rot' => -0.08],
            [[35, 34], [50, 35.5]], 5.4,
            ['cx' => 49.5, 'cy' => 35, 'rx' => 6.8, 'ry' => 6.4, 'rot' => 0.06],
            [[[54, 33.5], [59, 31], [63, 24], [56, 15]],
             [[56, 15], [50, 8.5], [58, 3.5], [62, 9]]], [4.0, 0.5],
        ],

        'long' => [
            [[26, 20], [28.5, 23], [30, 27], [33, 31.5]], [3.2, 5.6],
            ['cx' => 37, 'cy' => 35, 'rx' => 8.0, 'ry' => 7.4, 'rot' => -0.06],
            [[34.5, 35.5], [53, 36.5]], 7.6,
            ['cx' => 52, 'cy' => 36, 'rx' => 8.8, 'ry' => 8.0, 'rot' => 0.05],
            [[[57.5, 34], [61.5, 32], [63.5, 26], [61, 18]]], [5.0, 0.8],
        ],

        'skeletal' => [
            [[26, 20], [29, 22.5], [30.5, 26], [33, 30]], [2.4, 4.0],
            ['cx' => 37, 'cy' => 33, 'rx' => 6.8, 'ry' => 6.4, 'rot' => -0.12],
            [[35, 33.5], [50, 35]], 5.0,
            ['cx' => 50, 'cy' => 34.5, 'rx' => 7.2, 'ry' => 6.8, 'rot' => 0.10],
            [[[55, 32.5], [59.5, 30.5], [62.5, 23], [60, 13]]], [4.2, 0.6],
        ],

        default => [   // standard
            [[26, 20], [29, 22], [31, 25], [34, 29.5]], [3.0, 5.4],
            ['cx' => 37.5, 'cy' => 33, 'rx' => 8.6, 'ry' => 8.0, 'rot' => -0.12],
            [[35, 33], [50.5, 34.5]], 7.4,
            ['cx' => 50.5, 'cy' => 34, 'rx' => 9.2, 'ry' => 8.6, 'rot' => 0.10],
            [[[55.5, 32], [60, 30], [62.5, 23], [60, 13]]], [5.0, 0.7],
        ],
    };
}

function draw_body(int $n, array $p): string
{
    $id = "b$n";
    $g  = DG;
    $k  = $p['bulk'];

    [$neckPts, $neckW, $chest, $barrel, $barrelW, $haunch, $tailSegs, $tailW] = body_anatomy($p['shape']);

    /* --- A tömegek --- */
    $neckSp = spine([$neckPts], 12);
    $neck = outline_path($neckSp, wsteps([$neckW[0] * $k, $neckW[1] * $k]), true, true);

    $chestM = ellipse_path($chest['cx'], $chest['cy'], $chest['rx'] * $k, $chest['ry'] * $k, $chest['rot']);
    $haunchM = ellipse_path($haunch['cx'], $haunch['cy'], $haunch['rx'] * $k, $haunch['ry'] * $k, $haunch['rot']);

    $barrelSp = spine([[
        $barrel[0],
        [$barrel[0][0] + 5, $barrel[0][1] + 1],
        [$barrel[1][0] - 5, $barrel[1][1] + 1],
        $barrel[1],
    ]], 12);
    $barrelPath = outline_path($barrelSp, wsteps([$barrelW * $k, $barrelW * 0.94 * $k, $barrelW * $k]), true, true);

    $tailSp = spine($tailSegs, 20);
    $tail = outline_path($tailSp, wsteps([$tailW[0] * $k, $tailW[0] * 0.55 * $k, $tailW[1]]), true, $p['tail'] !== 'whip');

    $shapes = [$neck, $chestM, $barrelPath, $haunchM, $tail];

    /* --- Anatómiai vonalak a sziluetten belül --- */
    $lines = body_lines($chest, $haunch, $barrel, $k, $p['skin']);

    /* --- Hátdísz és farokvég a sziluett mögé --- */
    $behind = body_crest($neckSp, $barrelSp, $tailSp, $p, $k);

    return '<g id="' . $id . '">'
         . assemble($id, $shapes, 'url(#' . $id . '-vol)', $lines, $behind, '', 2.0)
         . '</g>';
}

/** Váll, far, bordák, hasi pajzsok — ezek adják az „élő" hatást. */
function body_lines(array $chest, array $haunch, array $barrel, float $k, string $skin): string
{
    $g = DG;
    $d = '';

    // Vállív a mellkas előtt
    $d .= '<path d="' . ellipse_path($chest['cx'] - $chest['rx'] * 0.25, $chest['cy'],
            $chest['rx'] * 0.72 * $k, $chest['ry'] * 0.8 * $k, $chest['rot'])
        . '" fill="none" stroke="' . $g['shadow'] . '" stroke-width="0.7" opacity="0.35"/>';

    // Farizom íve
    $d .= '<path d="' . ellipse_path($haunch['cx'] + $haunch['rx'] * 0.1, $haunch['cy'],
            $haunch['rx'] * 0.68 * $k, $haunch['ry'] * 0.74 * $k, $haunch['rot'])
        . '" fill="none" stroke="' . $g['shadow'] . '" stroke-width="0.8" opacity="0.4"/>';

    // Hasi pajzsok: vízszintes sávok a törzs alján
    $x0 = $barrel[0][0] - 2;
    $x1 = $barrel[1][0] + 1;
    $plates = '';
    for ($i = 0; $i < 7; $i++) {
        $x = $x0 + ($x1 - $x0) * $i / 6;
        $plates .= 'M' . fmt($x) . ',' . fmt($barrel[0][1] + 3)
                 . 'q1.6,4.4 3.4,5.2';
    }
    $d .= '<path d="' . $plates . '" fill="none" stroke="' . $g['shadow']
        . '" stroke-width="0.7" opacity="0.4" stroke-linecap="round"/>';

    // Bőrminta
    switch ($skin) {
        case 'bone':
            $ribs = '';
            for ($i = 0; $i < 5; $i++) {
                $x = $chest['cx'] - 4 + $i * 3.4;
                $ribs .= 'M' . fmt($x) . ',' . fmt($chest['cy'] - 5) . 'q-1.6,5 0.6,9.4';
            }
            $d .= '<path d="' . $ribs . '" fill="none" stroke="' . $g['bright']
                . '" stroke-width="0.9" opacity="0.5" stroke-linecap="round"/>';
            break;

        case 'facet':
            $f = '';
            for ($i = 0; $i < 5; $i++) {
                $x = $chest['cx'] - 3 + $i * 4.2;
                $f .= 'M' . fmt($x) . ',' . fmt($chest['cy'] - 7) . 'L' . fmt($x + 2.4) . ',' . fmt($chest['cy'] + 6);
            }
            $d .= '<path d="' . $f . '" fill="none" stroke="' . $g['spec']
                . '" stroke-width="0.6" opacity="0.4"/>';
            break;

        case 'crack':
            $c = '';
            for ($i = 0; $i < 4; $i++) {
                $x = $chest['cx'] - 2 + $i * 4.6;
                $c .= 'M' . fmt($x) . ',' . fmt($chest['cy'] + 5) . 'q1.4,-3.4 0.4,-6.2q-1,-2.6 1.2,-4.4';
            }
            $d .= '<path d="' . $c . '" fill="none" stroke="' . $g['spec']
                . '" stroke-width="0.8" opacity="0.75" stroke-linecap="round"/>';
            break;

        case 'plate':
            $s = '';
            for ($row = 0; $row < 3; $row++) {
                for ($i = 0; $i < 6; $i++) {
                    $x = $chest['cx'] - 4 + $i * 3.6 + ($row % 2) * 1.8;
                    $y = $chest['cy'] - 4 + $row * 3.4;
                    $s .= 'M' . fmt($x - 1.8) . ',' . fmt($y) . 'q1.8,2.2 3.6,0';
                }
            }
            $d .= '<path d="' . $s . '" fill="none" stroke="' . $g['shadow']
                . '" stroke-width="0.55" opacity="0.4"/>';
            break;

        case 'streak':
            $s = '';
            for ($i = 0; $i < 6; $i++) {
                $x = $chest['cx'] - 3 + $i * 3.8;
                $s .= 'M' . fmt($x) . ',' . fmt($chest['cy'] - 2) . 'q3,1.4 5.4,0.6';
            }
            $d .= '<path d="' . $s . '" fill="none" stroke="' . $g['bright']
                . '" stroke-width="0.5" opacity="0.4"/>';
            break;
    }

    return $d;
}

/** Hátgerinc-dísz és farokvég — a sziluett mögé rajzolva. */
function body_crest(array $neckSp, array $barrelSp, array $tailSp, array $p, float $k): string
{
    $g = DG;
    $kind = $p['ridge'];
    if ($kind === 'none') return '';

    // A hátvonal: a nyak, a törzs és a farok teteje egyben
    $back = array_merge($neckSp, $barrelSp, $tailSp);
    $d = '';

    // Szabálytalan méretek: a tökéletesen egyforma tüskék gépiesnek hatnak
    $jitter = [1.0, 0.86, 1.12, 0.94, 1.18, 0.9, 1.06, 0.82, 1.14, 0.96, 1.08, 0.88, 1.1];

    switch ($kind) {
        case 'spikes':
        case 'shards':
            $sharp = $kind === 'shards';
            $count = $sharp ? 11 : 14;
            for ($i = 0; $i < $count; $i++) {
                $t = 0.10 + 0.76 * $i / ($count - 1);
                $len = (3.4 + 4.6 * sin(M_PI * $i / ($count - 1))) * $k * $jitter[$i % 13];
                $d .= spike($back, $t, $len, $sharp ? 1.8 : 2.6, SIDE_BACK, $sharp ? 0.3 : -0.42, 5.0 * $k);
            }
            break;

        case 'plates':
            for ($i = 0; $i < 12; $i++) {
                $t = 0.12 + 0.74 * $i / 11;
                $len = (2.6 + 3.0 * sin(M_PI * $i / 11)) * $k * $jitter[$i % 13];
                $d .= spike($back, $t, $len, 4.0, SIDE_BACK, -0.15, 5.0 * $k);
            }
            break;

        case 'frill':
            for ($i = 0; $i < 11; $i++) {
                $t = 0.12 + 0.68 * $i / 10;
                $j = (int)round($t * (count($back) - 1));
                [$tx, $ty] = tangent_at($back, $j);
                $h = (2.8 + 3.4 * sin(M_PI * $i / 10)) * $k * $jitter[$i % 13];
                $c = $back[$j];
                $bx = $ty; $by = -$tx;
                $d .= 'M' . fmt($c[0] + $bx * 4.4 * $k - $tx * 1.9) . ',' . fmt($c[1] + $by * 4.4 * $k - $ty * 1.9)
                    . 'Q' . fmt($c[0] + $bx * (4.4 * $k + $h)) . ',' . fmt($c[1] + $by * (4.4 * $k + $h)) . ' '
                    . fmt($c[0] + $bx * 4.4 * $k + $tx * 1.9) . ',' . fmt($c[1] + $by * 4.4 * $k + $ty * 1.9) . 'Z';
            }
            break;

        case 'fin':
        case 'sail':
            $tall = $kind === 'sail' ? 8.0 : 4.4;
            $top = $base = [];
            for ($i = 0; $i <= 22; $i++) {
                $t = 0.10 + 0.74 * $i / 22;
                $j = (int)round($t * (count($back) - 1));
                [$tx, $ty] = tangent_at($back, $j);
                $h = (2.4 + $tall * sin(M_PI * $i / 22)) * $k;
                $top[]  = [$back[$j][0] + $ty * (4.6 * $k + $h), $back[$j][1] - $tx * (4.6 * $k + $h)];
                $base[] = [$back[$j][0] + $ty * 3.4 * $k,        $back[$j][1] - $tx * 3.4 * $k];
            }
            $d = catmull_path(array_merge($top, array_reverse($base)), true);
            break;

        case 'soft':
            for ($i = 0; $i < 10; $i++) {
                $d .= spike($back, 0.16 + 0.62 * $i / 9, 2.6 * $k * $jitter[$i % 13], 3.0,
                            SIDE_BACK, -0.2, 4.6 * $k);
            }
            break;

        default: // nub
            for ($i = 0; $i < 8; $i++) {
                $d .= spike($back, 0.18 + 0.56 * $i / 7, 1.8 * $k * $jitter[$i % 13], 2.6,
                            SIDE_BACK, -0.15, 4.6 * $k);
            }
    }

    $crest = '<path d="' . $d . '" fill="' . $g['mid'] . '" stroke="' . $g['ink']
           . '" stroke-width="1.5" stroke-linejoin="round"/>';

    return $crest . body_tail_tip($tailSp, $p['tail'], $k);
}

function body_tail_tip(array $tailSp, string $kind, float $k): string
{
    $g = DG;
    [$x, $y] = point_at($tailSp, 1.0);

    $d = match ($kind) {
        'spiked' => spike($tailSp, 0.98, 5.2 * $k, 3.0, SIDE_BACK, 0.4, 0.6)
                  . spike($tailSp, 0.94, 4.0 * $k, 2.4, SIDE_BELLY, 0.4, 0.6),

        'fin', 'shard' =>
            'M' . fmt($x - 3.6) . ',' . fmt($y + 2.0) . 'L' . fmt($x + 0.4) . ',' . fmt($y - 5.6)
          . 'L' . fmt($x + 4.0) . ',' . fmt($y + 2.6) . 'L' . fmt($x) . ',' . fmt($y + 1.4) . 'Z',

        'fan' =>
            'M' . fmt($x) . ',' . fmt($y + 2.4)
          . 'L' . fmt($x - 5.2) . ',' . fmt($y - 3.0) . 'L' . fmt($x - 1.6) . ',' . fmt($y - 1.2)
          . 'L' . fmt($x - 0.6) . ',' . fmt($y - 6.2) . 'L' . fmt($x + 1.8) . ',' . fmt($y - 1.4)
          . 'L' . fmt($x + 5.2) . ',' . fmt($y - 2.6) . 'L' . fmt($x + 2.6) . ',' . fmt($y + 2.0) . 'Z',

        'arrow' =>
            'M' . fmt($x - 3.0) . ',' . fmt($y + 2.8) . 'L' . fmt($x + 0.6) . ',' . fmt($y - 6.0)
          . 'L' . fmt($x + 4.0) . ',' . fmt($y + 2.8) . 'L' . fmt($x + 0.6) . ',' . fmt($y + 0.8) . 'Z',

        'tuft' =>
            'M' . fmt($x - 3.0) . ',' . fmt($y + 2.6)
          . 'Q' . fmt($x - 0.4) . ',' . fmt($y - 5.0) . ' ' . fmt($x + 3.2) . ',' . fmt($y + 1.6)
          . 'Q' . fmt($x) . ',' . fmt($y + 0.4) . ' ' . fmt($x - 3.0) . ',' . fmt($y + 2.6) . 'Z',

        'club' => ellipse_path($x, $y, 4.0 * $k, 3.6 * $k, 0.3),

        default => '',
    };

    if ($d === '') return '';
    return '<path d="' . $d . '" fill="' . $g['light'] . '" stroke="' . $g['ink']
         . '" stroke-width="1.5" stroke-linejoin="round"/>';
}
