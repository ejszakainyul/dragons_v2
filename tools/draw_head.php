<?php
/**
 * FEJ — koponya + pofa + pofazacskó + állkapocs, külön tömegekként.
 *
 * A korábbi változat egyetlen elvékonyodó csövet rajzolt: abból krokodil
 * lett, nem sárkány. Itt a koponya, a pofa és az állkapocs külön tömeg,
 * amiket a silhouette() olvaszt egy alakzattá — így van homloka, pofája
 * és álla is.
 */

/** [koponya, pofa(honnan,hova), pofavastagság, pofazacskó, állcsúcs] */
function head_anatomy(string $shape): array
{
    return match ($shape) {
        'blunt' => [
            ['cx' => 19.5, 'cy' => 14.5, 'rx' => 8.0, 'ry' => 7.0, 'rot' => -0.12],
            [[15, 15.0], [7.0, 15.6]], [6.2, 4.4],
            ['cx' => 22.5, 'cy' => 18.5, 'rx' => 5.4, 'ry' => 4.8],
            [7.6, 20.4],
        ],
        'beak' => [
            ['cx' => 19.5, 'cy' => 14.0, 'rx' => 6.8, 'ry' => 6.0, 'rot' => -0.18],
            [[15, 13.6], [3.6, 13.0]], [4.6, 1.8],
            ['cx' => 22, 'cy' => 17.6, 'rx' => 4.4, 'ry' => 4.0],
            [4.6, 17.6],
        ],
        'crest' => [
            ['cx' => 19.5, 'cy' => 13.4, 'rx' => 7.4, 'ry' => 7.0, 'rot' => -0.16],
            [[15, 14.2], [4.2, 14.6]], [5.2, 2.6],
            ['cx' => 22, 'cy' => 17.8, 'rx' => 4.8, 'ry' => 4.4],
            [5.0, 19.6],
        ],
        'skull' => [
            ['cx' => 19.5, 'cy' => 14.6, 'rx' => 6.4, 'ry' => 5.6, 'rot' => -0.12],
            [[15, 15.0], [4.0, 15.4]], [4.4, 2.2],
            ['cx' => 21.5, 'cy' => 18.0, 'rx' => 3.8, 'ry' => 3.4],
            [4.4, 19.8],
        ],
        'viper' => [
            ['cx' => 19, 'cy' => 15.4, 'rx' => 6.4, 'ry' => 5.2, 'rot' => -0.10],
            [[14.5, 15.8], [2.4, 16.4]], [4.4, 1.9],
            ['cx' => 21.5, 'cy' => 18.4, 'rx' => 4.2, 'ry' => 3.6],
            [2.8, 20.4],
        ],
        'horned' => [
            ['cx' => 20, 'cy' => 14.4, 'rx' => 8.2, 'ry' => 7.0, 'rot' => -0.14],
            [[15.5, 15.0], [4.0, 15.4]], [5.6, 2.8],
            ['cx' => 23, 'cy' => 18.4, 'rx' => 5.6, 'ry' => 4.8],
            [4.8, 20.2],
        ],
        'crystal' => [
            ['cx' => 19.5, 'cy' => 14.0, 'rx' => 7.2, 'ry' => 6.4, 'rot' => -0.16],
            [[15, 14.4], [3.6, 14.8]], [5.0, 2.4],
            ['cx' => 22, 'cy' => 17.8, 'rx' => 4.6, 'ry' => 4.2],
            [4.4, 19.6],
        ],
        default => [   // snout
            ['cx' => 19.5, 'cy' => 14.4, 'rx' => 7.2, 'ry' => 6.3, 'rot' => -0.14],
            [[15, 14.8], [3.6, 15.2]], [5.2, 2.5],
            ['cx' => 22, 'cy' => 18.0, 'rx' => 4.8, 'ry' => 4.3],
            [4.2, 19.8],
        ],
    };
}

function draw_head(int $n, array $p): string
{
    $id = "h$n";
    $g  = DG;
    $shape = $p['shape'];

    [$cran, $muzzle, $muzzleW, $cheek, $chin] = head_anatomy($shape);

    /* --- Tömegek --- */
    $cranM  = ellipse_path($cran['cx'], $cran['cy'], $cran['rx'], $cran['ry'], $cran['rot']);
    $cheekM = ellipse_path($cheek['cx'], $cheek['cy'], $cheek['rx'], $cheek['ry'], 0.1);

    $muzSp = spine([[
        $muzzle[0],
        [$muzzle[0][0] - 4, $muzzle[0][1] + 0.2],
        [$muzzle[1][0] + 4, $muzzle[1][1] - 0.3],
        $muzzle[1],
    ]], 10);
    $muzM = outline_path($muzSp, wsteps([$muzzleW[0], $muzzleW[0] * 0.8, $muzzleW[1]]), true, true);

    $shapes = [$cranM, $cheekM, $muzM];

    /* --- Alsó állkapocs: saját sziluett, a koponya mögé --- */
    $open = $p['jaw'] === 'open';
    $drop = $open ? 6.2 : 0.0;
    $jawSp = spine([[
        [24.0, 21.0],
        [19.0, 22.6 + $drop * 0.5],
        [11.0, 22.4 + $drop * 0.9],
        [$chin[0], $chin[1] + $drop],
    ]], 12);
    $jawM = outline_path($jawSp, wsteps([3.6, 3.0, 2.4, 1.3]), true, true);
    $jaw  = assemble($id . '-jaw', [$jawM], $g['dark'], '', '', '', 1.8);

    $behind = $jaw . head_crest($shape, $p['horn'], !empty($p['frill']));

    /* --- Szem helye archetípusonként --- */
    $eyeC = match ($shape) {
        'viper' => [13.0, 15.0],
        'beak'  => [15.0, 13.2],
        'blunt' => [15.5, 13.8],
        default => [14.6, 13.8],
    };

    /* --- Részletek a sziluetten belül --- */
    $detail =
        // Szemgödör-árnyék: enélkül a szem ráfestettnek hat
        '<ellipse cx="' . fmt($eyeC[0] + 0.6) . '" cy="' . fmt($eyeC[1] + 0.5)
      . '" rx="4.2" ry="3.4" fill="' . $g['shadow'] . '" opacity="0.45"/>'
        // A koponya és a pofa találkozása
      . '<path d="' . ellipse_path($cran['cx'] - 1.5, $cran['cy'] + 1, $cran['rx'] * 0.72,
            $cran['ry'] * 0.78, $cran['rot'])
      . '" fill="none" stroke="' . $g['shadow'] . '" stroke-width="0.7" opacity="0.3"/>'
        // Ajakvonal
      . '<path d="M' . fmt($muzzle[1][0] + 1) . ',' . fmt($muzzle[1][1] + 2.4)
      . 'Q' . fmt(($muzzle[0][0] + $muzzle[1][0]) / 2) . ',' . fmt($muzzle[1][1] + 4.2) . ' '
      . fmt($muzzle[0][0] + 6) . ',' . fmt($muzzle[0][1] + 4.6)
      . '" fill="none" stroke="' . $g['shadow'] . '" stroke-width="0.9" opacity="0.55" stroke-linecap="round"/>'
      . head_skin($shape, $cran);

    /* --- Fölé: fogak, szemöldök, szem, orrlyuk --- */
    $front = head_teeth_new($open, $muzzle, $chin, $drop)
           . head_brow($shape, $eyeC)
           . head_eye_new($eyeC[0], $eyeC[1], 1.35 * $p['eye'], $shape === 'skull')
           . '<ellipse cx="' . fmt($muzzle[1][0] + 1.4) . '" cy="' . fmt($muzzle[1][1] - 0.6)
           . '" rx="1" ry="0.75" fill="' . $g['ink'] . '" opacity="0.75"/>';

    // A fej a törzshöz képest túl nagy volt. A kicsinyítés a NYAK TÖVE
    // körül történik, így a csatlakozási pont nem mozdul el.
    return '<g id="' . $id . '" transform="translate(26,20) scale(0.88) translate(-26,-20)">'
         . assemble($id, $shapes, 'url(#' . $id . '-vol)', $detail, $behind, $front, 2.1)
         . '</g>';
}

/** Homlokpajzs a szem fölé — ettől lesz tekintete. */
function head_brow(string $shape, array $eye): string
{
    if ($shape === 'skull') return '';
    $g = DG;
    [$x, $y] = $eye;
    return '<path d="M' . fmt($x + 5.4) . ',' . fmt($y - 3.4)
         . 'Q' . fmt($x - 0.4) . ',' . fmt($y - 6.2) . ' ' . fmt($x - 4.8) . ',' . fmt($y - 2)
         . 'Q' . fmt($x - 0.2) . ',' . fmt($y - 3.4) . ' ' . fmt($x + 4.6) . ',' . fmt($y - 1.2) . 'Z"'
         . ' fill="' . $g['light'] . '" opacity="0.75"/>'
         . '<path d="M' . fmt($x + 5.0) . ',' . fmt($y - 2.6)
         . 'Q' . fmt($x - 0.3) . ',' . fmt($y - 5.2) . ' ' . fmt($x - 4.4) . ',' . fmt($y - 1.6) . '"'
         . ' fill="none" stroke="' . $g['ink'] . '" stroke-width="0.7" opacity="0.7" stroke-linecap="round"/>';
}

function head_eye_new(float $cx, float $cy, float $r, bool $hollow): string
{
    $g = DG;

    if ($hollow) {
        return '<ellipse cx="' . fmt($cx) . '" cy="' . fmt($cy) . '" rx="' . fmt($r * 1.35)
             . '" ry="' . fmt($r * 1.2) . '" fill="' . $g['ink'] . '"/>'
             . '<circle cx="' . fmt($cx - $r * 0.2) . '" cy="' . fmt($cy) . '" r="' . fmt($r * 0.45)
             . '" fill="' . $g['spec'] . '" opacity="0.9"/>';
    }

    return '<g>'
        . '<ellipse cx="' . fmt($cx) . '" cy="' . fmt($cy) . '" rx="' . fmt($r * 1.2) . '" ry="' . fmt($r)
        . '" fill="' . $g['spec'] . '" stroke="' . $g['ink'] . '" stroke-width="0.6"/>'
        . '<ellipse cx="' . fmt($cx - 0.35) . '" cy="' . fmt($cy) . '" rx="' . fmt($r * 0.3)
        . '" ry="' . fmt($r * 0.86) . '" fill="' . $g['ink'] . '"/>'
        . '<circle cx="' . fmt($cx - $r * 0.5) . '" cy="' . fmt($cy - $r * 0.45) . '" r="' . fmt($r * 0.28)
        . '" fill="' . $g['spec'] . '"/>'
        . '</g>';
}

function head_teeth_new(bool $open, array $muzzle, array $chin, float $drop): string
{
    $g = DG;
    $x0 = $muzzle[1][0] + 1.6;
    $x1 = $muzzle[0][0] + 2.0;
    $upper = $muzzle[1][1] + 3.4;

    $d = '';
    $count = $open ? 6 : 4;
    for ($i = 0; $i < $count; $i++) {
        $f = $i / max(1, $count - 1);
        $x = $x0 + ($x1 - $x0) * $f;
        $h = 2.0 + 1.4 * (1 - $f);
        $d .= 'M' . fmt($x - 0.8) . ',' . fmt($upper - 0.4)
            . 'L' . fmt($x) . ',' . fmt($upper + $h)
            . 'L' . fmt($x + 0.8) . ',' . fmt($upper - 0.4) . 'Z';
    }

    if ($open) {
        $lower = $chin[1] + $drop - 2.6;
        for ($i = 0; $i < 5; $i++) {
            $x = $x0 + 1.2 + ($x1 - $x0) * $i / 4;
            $d .= 'M' . fmt($x - 0.7) . ',' . fmt($lower + 0.4)
                . 'L' . fmt($x) . ',' . fmt($lower - 2.2)
                . 'L' . fmt($x + 0.7) . ',' . fmt($lower + 0.4) . 'Z';
        }
    }

    return '<path d="' . $d . '" fill="' . $g['spec'] . '" stroke="' . $g['ink'] . '" stroke-width="0.45"/>';
}

function head_skin(string $shape, array $cran): string
{
    $g = DG;
    return match ($shape) {
        'crystal' => '<path d="M' . fmt($cran['cx'] - 5) . ',' . fmt($cran['cy'] - 3)
                   . 'L' . fmt($cran['cx']) . ',' . fmt($cran['cy'] - 6)
                   . 'L' . fmt($cran['cx'] + 5) . ',' . fmt($cran['cy'] - 2)
                   . 'L' . fmt($cran['cx'] + 2) . ',' . fmt($cran['cy'] + 4) . 'Z" fill="'
                   . $g['spec'] . '" opacity="0.25" stroke="' . $g['spec'] . '" stroke-width="0.5"/>',

        'skull'   => '<path d="M' . fmt($cran['cx'] - 4) . ',' . fmt($cran['cy'] + 2)
                   . 'q4,1.6 8,0" fill="none" stroke="' . $g['ink'] . '" stroke-width="0.8" opacity="0.6"/>',

        default   => '<path d="M' . fmt($cran['cx'] - 4) . ',' . fmt($cran['cy'] + 3)
                   . 'q2,1.6 4,0m-1,2.4q2,1.4 4,0" fill="none" stroke="' . $g['shadow']
                   . '" stroke-width="0.55" opacity="0.4"/>',
    };
}

/** Szarvak, agancs, taréj, gallér — a fej mögé. */
function head_crest(string $shape, string $horn, bool $frill): string
{
    $g = DG;
    $d = '';

    if ($shape === 'crest') {
        $d .= 'M20,10Q27,2.6 32,3.4Q28,8 29,15.4Q24,11.6 19,12.6Z';
    }

    switch ($horn) {
        case 'pair':
            $d .= horn_path(19.5, 8.6, 30.0, 3.0, 2.6) . horn_path(15.5, 8.6, 25.5, 1.2, 2.0);
            break;

        case 'crown':
            for ($i = 0; $i < 5; $i++) {
                $x = 13.0 + $i * 3.6;
                $d .= horn_path($x, 9.2 - $i * 0.5, $x + 7.0 + $i, 1.8 + $i * 0.5, 1.7 + $i * 0.18);
            }
            break;

        case 'crystal':
            for ($i = 0; $i < 4; $i++) {
                $x = 13.5 + $i * 3.8;
                $y = 9.6 - $i * 0.7;
                $d .= 'M' . fmt($x - 1.8) . ',' . fmt($y)
                    . 'L' . fmt($x + 1.2 + $i * 1.4) . ',' . fmt($y - 7.0 - $i * 1.2)
                    . 'L' . fmt($x + 2.4) . ',' . fmt($y - 0.4) . 'Z';
            }
            break;

        case 'swept':
            $d .= horn_path(20.0, 9.4, 32.0, 5.4, 2.4) . horn_path(16.5, 9.0, 28.5, 3.6, 1.9);
            break;

        case 'antler':
            $d .= horn_path(18.5, 8.6, 28.0, 1.6, 2.2)
                . horn_path(22.5, 6.0, 31.0, 5.6, 1.5)
                . horn_path(20.5, 5.4, 25.0, -0.2, 1.2)
                . horn_path(15.0, 8.8, 22.5, 2.4, 1.6);
            break;

        case 'spiral':
            $d .= 'M18.5,9Q27,3 30.5,8.4Q32.6,12.8 27,13.4Q29.8,11 27.4,9Q24.4,7.2 20.6,11Z'
                . 'M14.6,8.8Q22.6,4 25.2,8.6Q27,12.2 22.6,12.8Q25,10.8 23,9.2Q20.6,8 17,10.8Z';
            break;
    }

    $out = '';

    if ($frill) {
        $f = 'M25,11';
        for ($i = 0; $i < 7; $i++) {
            $a = -1.0 + 2.1 * $i / 6;
            $f .= 'L' . fmt(25 + cos($a) * 11.0) . ',' . fmt(17.5 + sin($a) * 11.0)
                . 'L' . fmt(25 + cos($a + 0.15) * 5.0) . ',' . fmt(17.5 + sin($a + 0.15) * 5.0);
        }
        $out .= '<path d="' . $f . 'Z" fill="' . $g['dark'] . '" stroke="' . $g['ink']
              . '" stroke-width="1.4" stroke-linejoin="round"/>';
    }

    if ($d !== '') {
        $out .= '<path d="' . $d . '" fill="' . $g['light'] . '" stroke="' . $g['ink']
              . '" stroke-width="1.5" stroke-linejoin="round"/>';
    }

    return $out;
}

function horn_path(float $x0, float $y0, float $x1, float $y1, float $base): string
{
    $mx = ($x0 + $x1) / 2;
    $my = min($y0, $y1) - 2.4;
    return 'M' . fmt($x0 - $base / 2) . ',' . fmt($y0)
         . 'Q' . fmt($mx) . ',' . fmt($my) . ' ' . fmt($x1) . ',' . fmt($y1)
         . 'Q' . fmt($mx + 0.7) . ',' . fmt($my + 2.6) . ' ' . fmt($x0 + $base / 2) . ',' . fmt($y0 + 0.7)
         . 'Z';
}
