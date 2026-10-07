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
   TEST — 18 kézzel tervezett törzs
   ---------------------------------------------------------------------
   A nyak mindig a (26, 20) pontban ér véget (oda jön a fej), a törzs
   lefedi a csípőket (36, 38) és (50, 38), a hát a szárnytőnél (36, 27)
   van. Ezen belül a forma szabad: karcsú gyík, páncélos teknőc-hát,
   kígyótest hurokkal, csupasz csontváz, vitorlás hát, mohos bunda...
   ===================================================================== */

function draw_body(int $n, array $p): string
{
    $id = "b$n";
    $D = array_merge(['masses' => [], 'behind' => '', 'detail' => '', 'front' => '', 'belly' => null], body_design($n, $p));
    $belly = $D['belly'] ? kbelly($D['belly'][0], $D['belly'][1], $D['belly'][2] ?? 7, $D['belly'][3] ?? 0.5) : '';
    return '<g id="' . $id . '">'
         . assemble($id, $D['masses'], 'url(#' . $id . '-vol)', $belly . $D['detail'], $D['behind'], $D['front'], 2.0)
         . '</g>';
}

/** Kifelé (a hát felé) mutató normális egy gerincponton. */
function bd_out(array $sp, int $i): array
{
    [$tx, $ty] = tangent_at($sp, $i);
    $nx = -$ty; $ny = $tx;
    if ($nx * 0.45 - $ny > 0) return [$nx, $ny];
    return [-$nx, -$ny];
}

/**
 * Hátdíszek egy vonal mentén (a test MÖGÉ rajzolva, a talp a testbe süllyed).
 * $kind: horn | shard | plate | nub | leaf
 */
function bd_spikes(array $line, int $n, float $t0, float $t1, callable $len, float $w, float $lean, string $kind, string $fill = '', float $inset = 1.4): string
{
    $g = DG;
    $sp = kspine($line, 12);
    $m = count($sp);
    $out = '';
    for ($k = 0; $k < $n; $k++) {
        $f = $n > 1 ? $k / ($n - 1) : 0.5;
        $t = $t0 + ($t1 - $t0) * $f;
        $i = (int)round($t * ($m - 1));
        [$nx, $ny] = bd_out($sp, $i);
        [$tx, $ty] = tangent_at($sp, $i);
        $c = $sp[$i];
        $L = $len($f, $k);
        $b = [$c[0] - $nx * $inset, $c[1] - $ny * $inset];
        $tip = [$c[0] + $nx * $L + $tx * $lean * $L, $c[1] + $ny * $L + $ty * $lean * $L];
        switch ($kind) {
            case 'shard':
                $out .= kpiece(kshard($b, $tip, $w), $fill ?: $g['light'], 1.2) . kfill(kshard_lit($b, $tip, $w), $g['spec'], 0.5);
                break;
            case 'plate':
                $out .= kpiece(kleaf($b, $tip, $w, 0.42), $fill ?: $g['mid'], 1.3)
                      . kstroke(kline([$b, [($b[0] + $tip[0]) / 2, ($b[1] + $tip[1]) / 2]]), $g['dark'], 0.5, 0.6)
                      . kfill(kleaf([$b[0] - 0.3, $b[1] - 0.3], [$tip[0] - $w * 0.15, $tip[1] - 0.2], $w * 0.3, 0.42), $g['spec'], 0.3);
                break;
            case 'leaf':
                $out .= kpiece(kflame($b, $tip, $w, 0.18), $fill ?: $g['mid'], 1.1);
                break;
            case 'nub':
                $out .= kpiece(khorn($b, $tip, $w, -0.1), $fill ?: $g['light'], 1.1);
                break;
            default:
                $out .= kpiece(khorn($b, $tip, $w, -0.12), $fill ?: $g['light'], 1.2)
                      . kfill(khorn([$b[0] - 0.2, $b[1] - 0.2], $tip, $w * 0.3, -0.12), $g['spec'], 0.35);
        }
    }
    return $out;
}

/** Vitorla/úszó: hártya a hátvonal fölött, merevítő tüskékkel, csipkés széllel. */
function bd_sail(array $line, float $t0, float $t1, callable $h, int $rays, string $fill = '', bool $jag = false): string
{
    $g = DG;
    $sp = kspine($line, 12);
    $m = count($sp);
    $top = $base = [];
    $rayD = '';
    $steps = 24;
    for ($k = 0; $k <= $steps; $k++) {
        $f = $k / $steps;
        $i = (int)round(($t0 + ($t1 - $t0) * $f) * ($m - 1));
        [$nx, $ny] = bd_out($sp, $i);
        $c = $sp[$i];
        $H = $h($f);
        if ($jag) $H *= ($k % 2) ? 0.78 : 1.0;
        $top[]  = [$c[0] + $nx * $H, $c[1] + $ny * $H];
        $base[] = [$c[0] - $nx * 1.6, $c[1] - $ny * 1.6];
    }
    for ($r = 0; $r < $rays; $r++) {
        $f = ($r + 0.5) / $rays;
        $i = (int)round(($t0 + ($t1 - $t0) * $f) * ($m - 1));
        [$nx, $ny] = bd_out($sp, $i);
        $c = $sp[$i];
        $H = $h($f) * 1.04;
        $rayD .= 'M' . fmtp($c) . 'L' . fmt($c[0] + $nx * $H) . ',' . fmt($c[1] + $ny * $H);
    }
    $sail = ($jag ? kpoly(array_merge($top, array_reverse($base))) : ksmooth(array_merge($top, array_reverse($base)), true, 0.8));
    return kpiece($sail, $fill ?: $g['dark'], 1.3)
         . kstroke($rayD, $g['ink'], 1.3, 0.9) . kstroke($rayD, $g['light'], 0.6, 0.9);
}

/** Farokvég a farok utolsó két pontjából számolt irányban. */
function bd_tip(string $kind, array $tail, float $s = 1.0): string
{
    $g = DG;
    $n = count($tail);
    $e = $tail[$n - 1]; $q = $tail[$n - 2];
    $dx = $e[0] - $q[0]; $dy = $e[1] - $q[1];
    $l = sqrt($dx * $dx + $dy * $dy) ?: 1;
    $tx = $dx / $l; $ty = $dy / $l; $nx = -$ty; $ny = $tx;
    $at = fn(float $a, float $b) => [$e[0] + $tx * $a + $nx * $b, $e[1] + $ty * $a + $ny * $b];
    switch ($kind) {
        case 'tuft':
            return kpiece(kflame($at(-1, 0), $at(6 * $s, 0), 3.6 * $s, 0.2), $g['light'], 1.2)
                 . kpiece(kflame($at(-1, 0.5), $at(4.4 * $s, 3.6 * $s), 2.8 * $s, 0.2), $g['mid'], 1.1)
                 . kpiece(kflame($at(-1, -0.5), $at(4.4 * $s, -3.6 * $s), 2.8 * $s, -0.2), $g['mid'], 1.1);
        case 'club':
            $sp = '';
            foreach ([[0.5, 1], [-0.5, -1], [2.6, 0], [0.6, -1.1]] as [$a, $b]) {
                $sp .= khorn($at($a, $b * 2.4 * $s), $at($a * 1.6, $b * 6 * $s + ($b ? 0 : 0)) , 2.0 * $s, 0);
            }
            return kpiece($sp, $g['bright'], 1.1)
                 . kpiece(kblob(...array_merge($at(0.6, 0), [4.4 * $s, 3.8 * $s, atan2($ty, $tx)])), $g['mid'], 1.4)
                 . kfill(kblob(...array_merge($at(-0.4, -1.2), [2 * $s, 1.4 * $s, atan2($ty, $tx)])), $g['spec'], 0.4);
        case 'spiked':
            $sp = '';
            foreach ([[-3, 1], [-3, -1], [0.4, 1], [0.4, -1]] as [$a, $b]) $sp .= khorn($at($a, 0), $at($a + 2.6, $b * 6.4 * $s), 2.0, 0);
            return kpiece($sp, $g['bright'], 1.2);
        case 'arrow':
        case 'spade':
            return kpiece(kpoly([$at(-1.6, 0), $at(-0.6, 3.6 * $s), $at(6.4 * $s, 0), $at(-0.6, -3.6 * $s)]), $g['mid'], 1.3)
                 . kfill(kpoly([$at(-1, 0), $at(-0.4, -3 * $s), $at(5.6 * $s, 0)]), $g['spec'], 0.3);
        case 'shard':
            return kpiece(kshard($at(-2, 0), $at(8 * $s, 0), 3.6 * $s), $g['light'], 1.3) . kfill(kshard_lit($at(-2, 0), $at(8 * $s, 0), 3.6 * $s), $g['spec'], 0.55)
                 . kpiece(kshard($at(-1, 0), $at(4, 4.4 * $s), 2.2 * $s), $g['light'], 1.1);
        case 'fin':
            return kpiece(ksmooth([$at(-3, 1.2), $at(2, 5.2 * $s), $at(7 * $s, 2.4 * $s), $at(4, 0), $at(7 * $s, -2.6 * $s), $at(2, -5 * $s), $at(-3, -1.2)]), $g['dark'], 1.3)
                 . kstroke(kline([$e, $at(5.4 * $s, 3 * $s)]) . kline([$e, $at(5.4 * $s, -3 * $s)]) . kline([$e, $at(6, 0)]), $g['light'], 0.5, 0.7);
        case 'fan':
            $o = '';
            for ($i = -2; $i <= 2; $i++) $o .= kpiece(kleaf($at(-0.6, 0), $at(6.4 * $s * cos($i * 0.38), 6.4 * $s * sin($i * 0.38)), 2.4 * $s), $i % 2 ? $g['mid'] : $g['light'], 1.0);
            return $o;
        case 'wisp':
            return kpiece(kflame($at(-2, 0), $at(9 * $s, -1), 3.4 * $s, 0.25), $g['light'], 1.0)
                 . kpiece(kflame($at(-2, 0.6), $at(6 * $s, 5 * $s), 2.4 * $s, 0.25), $g['mid'], 0.9)
                 . kpiece(kflame($at(-2, -0.6), $at(6 * $s, -5.4 * $s), 2.4 * $s, -0.25), $g['mid'], 0.9);
    }
    return '';
}

/** Tömegek: nyak + mellkas + törzs + far + farok. */
function bd_core(array $neck, array $neckW, array $chest, array $barrel, array $barrelW, array $haunch, array $tail, array $tailW): array
{
    return [
        ktube($neck, $neckW, true, true, 10),
        kblob(...$chest),
        ktube($barrel, $barrelW, true, true, 10),
        kblob(...$haunch),
        ktube($tail, $tailW, true, true, 12),
    ];
}

function body_design(int $n, array $p): array
{
    $g = DG;
    switch ($n) {

    /* 1 — Karcsú test: fürge gyíktest, vékony, hosszú farok bojttal */
    case 1:
        $tail = [[55, 32.4], [59.6, 30.4], [62.2, 23], [59.4, 15], [55, 11.6]];
        return [
            'masses' => bd_core([[26, 20], [28, 23.4], [30, 27], [33.4, 31]], [3, 4, 5.2], [37, 33, 7, 6.4, -0.1],
                                [[35, 33.4], [43, 34.6], [50.5, 34]], [5.8, 5.2, 5.8], [50.5, 33.8, 7.2, 6.8, 0.1], $tail, [4.4, 3, 1.8, 1.1, 0.8]),
            'behind' => bd_spikes([[27, 17.6], [31, 23], [36, 26.6], [43, 28.6], [50, 27.2], [56, 28]], 9, 0.06, 0.95, fn($f) => 2.2 + sin($f * M_PI), 2.2, -0.3, 'nub')
                      . bd_tip('tuft', $tail),
            'belly'  => [[[30.6, 30], [36, 37.6], [44, 39.4], [51, 39.6]], 2.4, 8],
            'detail' => kfill(kblob(40, 30, 4, 1.6, 0), $g['spec'], 0.18),
        ];

    /* 2 — Pikkelyes test: a klasszikus, pikkelysorokkal és puha tüskesorral */
    case 2:
        $tail = [[55.5, 32], [60, 30], [62.5, 23], [60.4, 13.6]];
        return [
            'masses' => bd_core([[26, 20], [29, 22], [31, 25], [34, 29.5]], [3.2, 4.4, 5.6], [37.5, 33, 8.6, 8, -0.12],
                                [[35, 33], [43, 34.4], [50.5, 34.5]], [7.4, 7, 7.4], [50.5, 34, 9.2, 8.6, 0.1], $tail, [5, 3.2, 1.6, 0.6]),
            'behind' => bd_spikes([[26.6, 17.4], [31, 22.4], [36, 25], [43, 26.6], [50, 25.4], [57, 27], [61.6, 22], [61, 15]], 14, 0.05, 0.92, fn($f) => 2 + 2.4 * sin($f * M_PI), 2.6, -0.35, 'horn'),
            'belly'  => [[[30.4, 29.6], [35, 38.6], [44, 41.4], [52, 41]], 3.0, 9],
            'detail' => kscale_rows(31, 28.4, 56, 34, 9, 4, 1.3, $g['shadow'], 0.35)
                      . kscale_rows(30, 22, 34, 27, 2, 3, 1.0, $g['shadow'], 0.3),
        ];

    /* 3 — Páncélos test: kupolás, sávos páncélhát dudorokkal, buzogányfarok */
    case 3:
        $tail = [[56, 33.6], [58.6, 32.4], [59.6, 30]];
        $shell = ksmooth([[29.4, 33], [31, 25.6], [37, 21], [45, 19.6], [53, 21.4], [58.6, 27.4], [59.6, 34], [52, 36.4], [44, 37], [35, 36.4]], true, 0.9);
        $bands = ''; $knobs = '';
        for ($i = 0; $i < 6; $i++) {
            $x = 33 + $i * 4.6;
            $bands .= 'M' . fmt($x - 1.4) . ',' . fmt(34.6) . 'Q' . fmt($x - 2.4) . ',' . fmt(27) . ' ' . fmt($x + 1.4) . ',' . fmt(20.6 + abs($i - 2.6) * 0.9);
            for ($k = 0; $k < 3; $k++) {
                $knobs .= kfill(kblob($x + 0.6 - $k * 0.6, 24 + $k * 4 + abs($i - 2.6) * 0.5, 1.0, 0.8), $g['bright'], 0.75, $g['ink'], 0.35);
            }
        }
        return [
            'masses' => [ktube([[26, 20], [28, 23.6], [29.6, 27], [32, 30.6]], [3.6, 5, 6.4], true, true, 10),
                         kblob(38, 34, 9, 6.6, 0), kblob(51, 34, 9, 6.6, 0), $shell,
                         ktube($tail, [5.4, 4, 3.2], true, true, 8)],
            'behind' => '',
            'front'  => bd_tip('club', $tail, 1.05)
                      . kfill(ksmooth([[30, 33.6], [44, 35.4], [59, 33.6], [58.4, 36], [44, 38], [30.6, 36]], true, 0.8), $g['dark'], 0.9, $g['ink'], 0.9),
            'detail' => kstroke($bands, $g['ink'], 1.0, 0.7) . kstroke($bands, $g['spec'], 0.4, 0.5) . $knobs
                      . kfill(ksmooth([[33, 25], [40, 21.4], [48, 21], [42, 24]]), $g['spec'], 0.3),
            'belly'  => [[[30, 31], [34, 38.8], [44, 40.4], [55, 39]], 2.2, 6, 0.4],
        ];

    /* 4 — Jégpáncél: ívelt hát, nagy jégkristály-sor, fazettás test, kristályfarok */
    case 4:
        $tail = [[56, 31.4], [60.6, 29], [62.4, 22], [60, 15.4]];
        $facets = kfill(kpoly([[32, 27], [38, 24.6], [40, 31], [34, 32]]), $g['spec'], 0.3)
                . kfill(kpoly([[40, 31], [38, 24.6], [46, 25.6], [47, 32]]), $g['bright'], 0.25)
                . kfill(kpoly([[47, 32], [46, 25.6], [54, 26.6], [55, 33]]), $g['shadow'], 0.25)
                . kstroke(kline([[32, 27], [38, 24.6], [46, 25.6], [54, 26.6]]) . kline([[38, 24.6], [40, 31], [47, 32], [46, 25.6]]) . kline([[47, 32], [55, 33]]), $g['spec'], 0.5, 0.5);
        return [
            'masses' => bd_core([[26, 20], [29.4, 21.6], [32, 23.6], [34.6, 27]], [3, 4.2, 5.4], [38, 31, 8.4, 7.6, -0.16],
                                [[35.5, 31], [43, 32], [51, 33.4]], [7.2, 6.8, 7.2], [50.5, 33, 9, 8.4, 0.14], $tail, [4.8, 3, 1.4, 0.6]),
            'behind' => bd_spikes([[27, 17.4], [31.6, 21], [37, 23], [44, 23.4], [51, 24.4], [57, 26.4], [61.4, 21]], 9, 0.05, 0.92,
                                  fn($f, $k) => (3.4 + 6 * sin($f * M_PI)) * ($k % 2 ? 0.7 : 1), 3.2, 0.12, 'shard')
                      . bd_tip('shard', $tail),
            'detail' => $facets,
            'belly'  => [[[31, 29], [36, 37.6], [44, 39.8], [52, 40]], 2.6, 7],
        ];

    /* 5 — Izzó test: sötét bazaltlemezek közt izzó repedések, lánguszony a farkon */
    case 5:
        $tail = [[55.5, 32], [60, 30], [62.5, 23], [60.4, 14]];
        $cells = '';
        $pts = [[[31, 27], [36, 25.4], [38, 30], [33, 31.6]], [[36, 25.4], [42, 25.6], [43, 31], [38, 30]], [[42, 25.6], [48, 25.8], [49, 31.4], [43, 31]],
                [[48, 25.8], [54, 27], [55, 32], [49, 31.4]], [[33, 31.6], [38, 30], [39, 35.6], [34, 36]], [[38, 30], [43, 31], [44, 36.4], [39, 35.6]],
                [[43, 31], [49, 31.4], [49.6, 37], [44, 36.4]], [[49, 31.4], [55, 32], [55, 37.4], [49.6, 37]]];
        foreach ($pts as $c) {
            $cx = array_sum(array_column($c, 0)) / 4; $cy = array_sum(array_column($c, 1)) / 4;
            $in = array_map(fn($q) => [$cx + ($q[0] - $cx) * 0.8, $cy + ($q[1] - $cy) * 0.8], $c);
            $cells .= kfill(kpoly($in), $g['shadow'], 0.55);
        }
        $crk = 'M30,30L58,30M36,25L38,36M42,25L44,37M48,25.6L49.6,38M54,27L55,38M31,33.6L56,34.6';
        return [
            'masses' => bd_core([[26, 20], [29, 22], [31, 25], [34, 29.5]], [3.2, 4.4, 5.8], [37.5, 33, 8.6, 8, -0.12],
                                [[35, 33], [43, 34.4], [50.5, 34.5]], [7.4, 7, 7.4], [50.5, 34, 9.2, 8.6, 0.1], $tail, [5, 3.2, 1.6, 0.8]),
            'behind' => bd_spikes([[27, 17.4], [31, 22.4], [36, 25], [43, 26.6], [50, 25.4], [57, 27]], 8, 0.12, 0.9, fn($f) => 2.4 + 2.6 * sin($f * M_PI), 4.2, -0.25, 'plate', $g['dark'])
                      . bd_tip('fin', $tail),
            'detail' => $cells . kstroke($crk, $g['spec'], 1.8, 0.2) . kstroke($crk, $g['spec'], 0.6, 0.75),
            'belly'  => [[[30.4, 29.6], [35, 38.6], [44, 41.4], [52, 41]], 2.6, 8, 0.4],
        ];

    /* 6 — Viharbőr: agárszerű, mély mellkas, behúzott has, villám-cikkcakkos úszó */
    case 6:
        $tail = [[55, 31], [59.4, 28], [62.6, 20.4], [61, 11], [57.4, 6.6]];
        $streak = 'M31,26l3,2l-1.4,1.6l4,1.6M41,27.6l3,1.4l-1.6,1.6l4.4,1M50,27.6l2.6,1.6l-1.2,1.4l3.6,1.4';
        return [
            'masses' => [ktube([[26, 20], [29.6, 21.4], [32.4, 23.6], [35, 27]], [3, 4, 5.4], true, true, 10),
                         kblob(37.6, 31.6, 7.8, 8.6, -0.25), ktube([[37, 30], [44, 30.8], [51, 31.4]], [5.2, 3.8, 5], true, true, 10),
                         kblob(50.6, 32.4, 7.2, 7.2, 0.2), ktube($tail, [4, 2.6, 1.6, 1, 0.6], true, true, 12)],
            'behind' => bd_sail([[27, 17.6], [31.6, 21], [37, 22.8], [44, 25.4], [50, 25], [56, 25.6], [61.6, 20], [61.6, 11]], 0.04, 0.9,
                                fn($f) => 2.2 + 3.4 * sin($f * M_PI), 7, $g['dark'], true)
                      . bd_tip('fin', $tail, 0.9),
            'detail' => kstroke($streak, $g['spec'], 0.75, 0.75),
            'belly'  => [[[31.6, 30], [36.6, 39], [43, 36.4], [50, 38.6]], 2.2, 8],
        ];

    /* 7 — Ősi test: púpos óriás, váltakozó hátlemezek, tüskés farokvég */
    case 7:
        $tail = [[57, 33], [60.4, 31], [61.6, 26.4], [60, 21]];
        $line = [[26.4, 17], [30, 21], [35, 22.4], [42, 20.6], [49, 21.4], [56, 25], [61.6, 26]];
        return [
            'masses' => bd_core([[26, 20], [28.4, 23], [30.6, 26.4], [33.4, 30]], [3.8, 5.4, 7], [38, 32, 10.4, 9.8, -0.1],
                                [[35, 33.5], [44, 33], [51, 35]], [9.4, 9, 9.6], [51, 33.6, 10.4, 9.8, 0.08], $tail, [6.2, 4.2, 2.6, 1.6]),
            'behind' => bd_spikes($line, 8, 0.14, 0.9, fn($f, $k) => (4 + 6.4 * sin($f * M_PI)) * ($k % 2 ? 0.72 : 1), 5.6, -0.12, 'plate')
                      . bd_spikes($line, 7, 0.2, 0.86, fn($f) => 3 + 3 * sin($f * M_PI), 4.4, -0.08, 'plate', $g['dark'])
                      . bd_tip('spiked', $tail, 1.1),
            'detail' => kscale_rows(30, 26, 58, 35, 7, 4, 1.8, $g['shadow'], 0.4)
                      . kstroke('M30,30q6,-4 13,-3M45,27.4q6,-1 10,2', $g['shadow'], 0.8, 0.4),
            'belly'  => [[[29.6, 31], [35, 40.6], [45, 42.6], [55, 41.6]], 3.2, 9],
        ];

    /* 8 — Árnyéktest: sovány, kilátszó bordák, magas tűtüskék, ostorfarok */
    case 8:
        $tail = [[54.6, 32], [59, 30], [62, 22], [60, 13], [54.6, 7], [50, 8.6], [51.4, 12]];
        $ribs = '';
        for ($i = 0; $i < 6; $i++) {
            $x = 33.4 + $i * 2.8;
            $ribs .= 'M' . fmt($x) . ',' . fmt(27.6 + $i * 0.1) . 'Q' . fmt($x - 2.2) . ',' . fmt(32) . ' ' . fmt($x + 0.4) . ',' . fmt(37 - abs($i - 2) * 0.3);
        }
        return [
            'masses' => bd_core([[26, 20], [29, 22.6], [30.6, 26], [33, 30]], [2.4, 3.2, 4.2], [37.4, 32.4, 6.8, 6.4, -0.12],
                                [[35, 33], [43, 33.6], [50, 34.6]], [5.2, 3.8, 5.2], [50, 34.2, 6.8, 6.6, 0.1], $tail, [3.6, 2.2, 1.4, 1, 0.7, 0.5, 0.3]),
            'behind' => bd_spikes([[26.8, 18], [30.6, 22.6], [36, 26], [43, 28.6], [50, 27.6], [56, 29.4], [61, 24]], 12, 0.04, 0.95,
                                  fn($f, $k) => (3 + 5.2 * sin($f * M_PI)) * ($k % 3 === 1 ? 0.6 : 1), 1.6, -0.32, 'horn', $g['dark']),
            'detail' => kstroke($ribs, $g['ink'], 1.6, 0.6) . kstroke($ribs, $g['bright'], 0.7, 0.75)
                      . kstroke('M44,36q3,-2 6,0', $g['shadow'], 0.6, 0.5),
            'belly'  => [[[31, 30], [36, 37.4], [43, 37.2], [50, 39.4]], 1.6, 6, 0.35],
        ];

    /* 9 — Titkos test: ívelt, királyi legyezővitorla kristályfazettákkal, legyezőfarok */
    case 9:
        $tail = [[56, 31.4], [60.6, 29], [62.4, 22], [60, 15]];
        return [
            'masses' => bd_core([[26, 20], [29.4, 21.6], [32, 23.6], [34.6, 27]], [3, 4.2, 5.4], [38, 31, 8.4, 7.6, -0.16],
                                [[35.5, 31], [43, 32], [51, 33.4]], [7.2, 6.8, 7.2], [50.5, 33, 9, 8.4, 0.14], $tail, [4.8, 3, 1.4, 0.8]),
            'behind' => bd_sail([[27, 17.4], [31.6, 21], [37, 23], [44, 23.4], [51, 24.4], [57, 26.4]], 0.08, 0.98, fn($f) => 3 + 9 * sin($f * M_PI) ** 0.8, 8, $g['dark'])
                      . bd_tip('fan', $tail, 1.1),
            'detail' => kfill(kpoly([[33, 26], [39, 24], [41, 31]]), $g['spec'], 0.3) . kfill(kpoly([[41, 31], [47, 25], [50, 32]]), $g['spec'], 0.2)
                      . kstroke('M33,26L39,24L41,31L47,25L50,32L55,27', $g['spec'], 0.5, 0.5),
            'belly'  => [[[31, 29], [36, 37.6], [44, 39.8], [52, 40]], 2.6, 7],
        ];

    /* 10 — Kígyótest: hosszú, hullámzó test, a farok hurokba csavarodik */
    case 10:
        $body = [[26, 20], [28.4, 24.6], [32, 30], [38, 34.4], [45, 35.6], [52, 34], [58, 29.6], [61.4, 22], [59, 14], [52.6, 10.4], [47.6, 13.6], [49.4, 19], [54.4, 19.6]];
        return [
            'masses' => [ktube($body, [3, 4.4, 5.6, 6.2, 6.2, 5.6, 4.6, 3.6, 2.8, 2.2, 1.6, 1.0, 0.5], true, true, 10),
                         kblob(38.6, 34.6, 6.4, 5.8, 0), kblob(49.8, 35, 6.4, 5.6, 0)],
            'behind' => bd_sail([[27, 17.4], [30.6, 23], [36, 28.8], [44, 29.6], [52, 28.4], [57, 24.6], [57.6, 18]], 0.08, 0.95, fn($f) => 1.6 + 1.8 * sin($f * M_PI), 10, $g['dark'], true),
            'detail' => kstroke('M30,24q3,2 3,6M37,29.4q4,0.6 5,4M45,30q4,-0.4 5,3.4M52,28.6q3,-1.4 4,2.4', $g['bright'], 0.6, 0.55)
                      . kscale_rows(33, 30, 56, 32, 8, 2, 1.0, $g['shadow'], 0.3),
            'belly'  => [[[28.6, 25], [33, 33.4], [40, 39], [48, 39.8], [56, 35.4], [61, 28]], 1.8, 14],
        ];

    /* 11 — Zömök test: hordó-has, rövid vastag nyak, csonka buzogányfarok */
    case 11:
        $tail = [[56.4, 35.4], [58.6, 34.2], [59.4, 31.6]];
        $spots = '';
        foreach ([[38, 27.6, 1.6], [44, 26.4, 2.0], [50, 27.8, 1.4], [41.6, 30.6, 1.0], [53.6, 31, 1.2], [34.6, 30, 1.0]] as [$x, $y, $r]) $spots .= kfill(kblob($x, $y, $r, $r * 0.8), $g['shadow'], 0.35);
        return [
            'masses' => [ktube([[26, 20], [27.6, 23.6], [29.4, 27], [32, 30.4]], [4, 5.8, 7.2], true, true, 10),
                         kblob(44, 33.4, 13.6, 10.6, 0.02), kblob(37, 31.6, 8, 7.6, -0.2),
                         ktube($tail, [5.6, 4.4, 3.4], true, true, 8)],
            'behind' => bd_spikes([[26.6, 16.4], [30, 21.6], [36, 23.6], [44, 22.8], [52, 24.4], [57, 28.6]], 7, 0.1, 0.9, fn($f) => 1.6 + sin($f * M_PI), 3, -0.2, 'nub'),
            'front'  => bd_tip('club', $tail, 1.0),
            'detail' => $spots . kfill(kblob(40, 25.6, 6, 2, -0.08), $g['spec'], 0.25),
            'belly'  => [[[30.6, 32], [36, 41.4], [46, 43.6], [55, 40.6]], 4.2, 7],
        ];

    /* 12 — Bordás test: kidomborodó bordakosár, tüskés gerinc, nyílhegy-farok */
    case 12:
        $tail = [[55, 32], [59.6, 30], [62.4, 23], [60, 14.6]];
        $ribs = '';
        for ($i = 0; $i < 7; $i++) {
            $x = 31.6 + $i * 3.1;
            $ribs .= 'M' . fmt($x + 1) . ',' . fmt(26.4 + abs($i - 3) * 0.3) . 'Q' . fmt($x - 2.6) . ',' . fmt(32) . ' ' . fmt($x + 0.6) . ',' . fmt(38.4 - abs($i - 3) * 0.3);
        }
        return [
            'masses' => bd_core([[26, 20], [29, 22.4], [31, 25.6], [33.4, 29.6]], [2.8, 3.6, 4.8], [38.6, 32.6, 9, 7.6, -0.05],
                                [[36, 33], [44, 34], [50, 34.6]], [6.4, 5, 6], [50.4, 34, 7.6, 7.2, 0.1], $tail, [4, 2.6, 1.4, 0.7]),
            'behind' => bd_spikes([[26.8, 17.8], [30.6, 22.4], [36, 24.6], [43, 25.6], [50, 26.4], [56, 28.4], [61.4, 23]], 10, 0.05, 0.92, fn($f) => 2.6 + 3.6 * sin($f * M_PI), 2.2, -0.2, 'horn')
                      . bd_tip('arrow', $tail),
            'detail' => kstroke($ribs, $g['shadow'], 2.0, 0.55) . kstroke($ribs, $g['spec'], 0.8, 0.6),
            'belly'  => [[[31, 30], [36, 38.6], [44, 39.6], [51, 39.6]], 2.0, 7, 0.4],
        ];

    /* 13 — Íves hát: magas púpos hát, széles vitorla, legyezőfarok */
    case 13:
        $tail = [[55.4, 31], [59.6, 28.4], [61.4, 21.6], [58.6, 14.6]];
        return [
            'masses' => [ktube([[26, 20], [29.6, 21.2], [32.6, 22.6], [35.4, 25.6]], [3, 4, 5.4], true, true, 10),
                         kblob(39, 30, 8.6, 8.4, -0.3), kblob(46, 28.6, 7.6, 7.6, 0), kblob(51, 32.6, 8.4, 7.8, 0.2),
                         ktube([[37, 34], [44, 35.4], [50, 35.4]], [5, 5, 5], true, true, 8), ktube($tail, [4.6, 3, 1.6, 0.8], true, true, 12)],
            'behind' => bd_sail([[29, 19.4], [35, 21.4], [41, 21], [47, 20.6], [53, 23.6], [57.6, 27]], 0.04, 0.98, fn($f) => 3 + 7 * sin($f * M_PI), 8, $g['mid'])
                      . bd_tip('fan', $tail, 1.15),
            'detail' => kscale_rows(33, 26, 56, 32, 8, 3, 1.2, $g['shadow'], 0.35),
            'belly'  => [[[31.6, 28], [36, 37.8], [44, 40], [52, 39.4]], 2.6, 8],
        ];

    /* 14 — Vasbordájú: hosszú, alacsony test, szegecselt vaspántok, tüskés farok */
    case 14:
        $tail = [[57, 34], [60.4, 31.6], [61.6, 26], [59, 19]];
        $bands = ''; $riv = '';
        foreach ([33, 38.6, 44.2, 49.8, 55.4] as $i => $x) {
            $bands .= kfill(kpoly([[$x - 1.6, 26.6 + ($i % 2) * 0.4], [$x + 1.6, 26.6], [$x + 1.2, 42], [$x - 2, 42]]), $g['light'], 0.85, $g['ink'], 0.6);
            foreach ([29.6, 33.4, 37.2] as $y) $riv .= kfill(kblob($x, $y, 0.55, 0.55), $g['spec'], 1, $g['ink'], 0.3);
        }
        return [
            'masses' => bd_core([[26, 20], [28.6, 23], [30.4, 27], [33, 31.6]], [3.2, 4.6, 6], [37, 34.6, 8, 7.4, -0.06],
                                [[34.5, 35.4], [44, 35.6], [53, 36.4]], [7.6, 7.4, 7.6], [53, 35.6, 8.8, 8, 0.05], $tail, [5, 3.4, 1.8, 0.8]),
            'behind' => bd_spikes([[26.6, 17.4], [30, 22.6], [36, 27.6], [44, 28.4], [52, 27.8], [59, 28.6], [62.6, 23]], 10, 0.08, 0.94, fn($f) => 2 + 2.4 * sin($f * M_PI), 3.2, -0.25, 'horn', $g['bright'])
                      . bd_tip('spiked', $tail),
            'detail' => $bands . $riv,
            'belly'  => [[[30, 32], [35, 41.4], [45, 43.4], [56, 42.6]], 2.4, 9, 0.4],
        ];

    /* 15 — Mohos test: hosszú, bozontos moha- és levélbunda, lelógó mohaszálak */
    case 15:
        $tail = [[57, 34], [60.4, 31.6], [61.6, 26], [59, 19]];
        $tufts = '';
        foreach ([[30, 23.4], [34.4, 26], [39, 26.4], [43.6, 26.6], [48.2, 26.2], [52.8, 26.6], [57, 28], [60.6, 25]] as $i => [$x, $y]) {
            $tufts .= kpiece(kflame([$x, $y + 2.6], [$x + 3.4, $y - 4 - ($i % 2) * 1.6], 4.2, 0.2), $i % 2 ? $g['mid'] : $g['light'], 1.1);
        }
        $hang = '';
        foreach ([34, 38.6, 43, 47.6, 52, 56] as $i => $x) $hang .= kflame([$x, 40.2], [$x + 1.4, 45 + ($i % 2) * 1.6], 2.2, 0.25);
        return [
            'masses' => bd_core([[26, 20], [28.6, 23], [30.4, 27], [33, 31.6]], [3.4, 4.8, 6.2], [37, 34.6, 8, 7.4, -0.06],
                                [[34.5, 35.4], [44, 35.6], [53, 36.4]], [7.6, 7.4, 7.6], [53, 35.6, 8.8, 8, 0.05], $tail, [5, 3.4, 1.8, 1]),
            'behind' => $tufts . bd_tip('tuft', $tail, 1.2),
            'front'  => kpiece($hang, $g['mid'], 1.0),
            'detail' => kstroke('M31,28q3,-2 5,1q3,-2 5,1q3,-2 5,1q3,-2 5,1q3,-2 5,1', $g['shadow'], 0.7, 0.5)
                      . kstroke('M31,33q3,-2 5,1q3,-2 5,1q3,-2 5,1q3,-2 5,1q3,-2 5,1', $g['shadow'], 0.7, 0.4)
                      . kfill(kblob(41, 30, 9, 2.4, 0), $g['bright'], 0.25),
        ];

    /* 16 — Ködtest: kígyózó test, ami a farka felé ködfoszlányokra bomlik */
    case 16:
        $body = [[26, 20], [28.4, 24.6], [32, 30], [38, 34], [45, 35], [52, 33.4], [57.6, 29], [60, 22.6], [58, 16]];
        $wisps = '';
        foreach ([[[52, 27], [62, 30.6], 3.2], [[50, 31.6], [58.6, 39], 2.6], [[45, 31], [49.6, 41.6], 2.2]] as [$b, $t, $w]) $wisps .= kpiece(kflame($b, $t, $w, 0.3), $g['bright'], 0.9);
        return [
            'masses' => [ktube($body, [3, 4.2, 5.4, 6, 6, 5.2, 4, 3, 2], true, true, 10),
                         kblob(38.6, 34, 6.4, 5.6, 0), kblob(49.8, 34.4, 6.4, 5.4, 0)],
            'behind' => $wisps . bd_tip('wisp', $body, 1.2),
            'detail' => kstroke('M30,25q4,4 8,4q5,0 8,-2M34,33q5,2 10,1q4,-0.6 7,-3M49,29q4,-1 6,-5', $g['spec'], 0.8, 0.45)
                      . kfill(kblob(44, 30, 8, 2, 0), $g['spec'], 0.18),
            'belly'  => [[[28.6, 25], [33, 33.4], [40, 38.6], [48, 39.4], [55, 35]], 1.8, 10, 0.4],
        ];

    /* 17 — Csontváz: csigolyalánc, különálló bordák, medence — a testen át a háttér látszik */
    case 17:
        $spine = [[26, 20], [29, 23], [33, 26.4], [40, 27.6], [47, 27.4], [53, 28.4], [58, 27.6], [61.4, 22], [61, 15], [58.6, 10]];
        $ribs = [];
        for ($i = 0; $i < 6; $i++) {
            $x = 34 + $i * 2.9;
            $ribs[] = ktube([[$x, 27.4], [$x - 2.6, 31.6], [$x - 1.4, 36], [$x + 1.6, 38.4 - abs($i - 2) * 0.4]], [1.2, 1.0, 0.8, 0.5], true, true, 6);
        }
        $verts = '';
        $vs = kspine($spine, 6);
        for ($i = 2; $i < count($vs) - 2; $i += 3) $verts .= kfill(kblob($vs[$i][0], $vs[$i][1], 1.25, 1.0, 0), $g['light'], 0.9, $g['ink'], 0.35);
        return [
            'masses' => array_merge([ktube($spine, [2.2, 2.4, 2.4, 2.2, 2.2, 2.2, 1.8, 1.4, 1, 0.6], true, true, 8),
                                     kblob(35.6, 30.6, 3.2, 4.6, 0.5), kblob(51, 32, 5, 4.4, 0.3)], $ribs,
                                    [ktube([[35, 38.6], [36, 36], [37.4, 33]], [1.6, 1.4], true, true, 4)]),
            'behind' => bd_spikes($spine, 11, 0.12, 0.8, fn($f) => 2.2 + 2.4 * sin($f * M_PI), 1.6, -0.35, 'shard', $g['light'], 0.8)
                      . bd_tip('arrow', $spine, 0.9),
            'detail' => kfill(kblob(51, 32.4, 2.2, 1.6, 0.3), $g['ink'], 0.85) . kstroke('M48,29.6l2,1.6M54,31l-1.6,2', $g['shadow'], 0.6, 0.7),
            'front'  => $verts,
        ];

    /* 18 — Vitorlás hát: spinoszaurusz-vitorla merevítő tüskékkel, uszonyos farok */
    default:
        $tail = [[55.5, 32], [60, 30], [62.5, 23], [60.4, 14]];
        return [
            'masses' => bd_core([[26, 20], [29, 22], [31, 25], [34, 29.5]], [3.2, 4.4, 5.6], [37.5, 33, 8.6, 8, -0.12],
                                [[35, 33], [43, 34.4], [50.5, 34.5]], [7.4, 7, 7.4], [50.5, 34, 9.2, 8.6, 0.1], $tail, [5, 3.2, 1.6, 0.8]),
            'behind' => bd_sail([[30, 22.6], [36, 25], [43, 26.6], [50, 25.4], [56, 27.4]], 0.02, 1.0, fn($f) => 2 + 13 * sin($f * M_PI) ** 1.3, 9, $g['mid'])
                      . bd_tip('fin', $tail),
            'detail' => kfill(kpoly([[33, 27], [38, 25], [41, 32]]), $g['spec'], 0.22) . kfill(kpoly([[44, 26.4], [50, 25.6], [48, 32]]), $g['spec'], 0.18)
                      . kscale_rows(31, 28.4, 56, 33, 8, 3, 1.2, $g['shadow'], 0.3),
            'belly'  => [[[30.4, 29.6], [35, 38.6], [44, 41.4], [52, 41]], 3.0, 9],
        ];
    }
}
