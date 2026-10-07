<?php
/**
 * LÁB és SZÁRNY — 18 + 18 kézzel tervezett változat.
 *
 * Rögzített csatlakozási pontok (minden változatban azonosak):
 *   mellső csípő  (36, 38)      hátsó csípő (50, 38)      talaj ~ y 58
 *   szárnytő      (36, 27)
 *
 * A lábtípusok (a katalógus `shape`-je adja a harci értéküket):
 *   digit  — hüllőláb ujjakkal és karmokkal
 *   pillar — vaskos oszlopláb, kerek talp, körmök
 *   lanky  — hosszú, ujjon járó (fordított térdű) futóláb
 *   grasp  — markoló „kéz", hosszú ujjak, karmok
 *   hoof   — pata
 * Mindegyiken belül egyedi a rajz: kölyöktappancs, jégszilánk-karom,
 * lávatalp, kakassarkantyú, kecskepata, szőrös lópata, vaspáncél...
 */

/* =====================================================================
   LÁB
   ===================================================================== */

/** Az egyes lábak terve. */
function leg_spec(int $n, array $p): array
{
    $base = match ($p['shape']) {
        'pillar' => ['type' => 'pillar', 'thigh' => [6.2, 7.2], 'shin' => [5.0, 4.6], 'knee' => 9, 'ankle' => 16.4, 'foot' => 4.6],
        'lanky'  => ['type' => 'lanky',  'thigh' => [4.6, 6.0], 'shin' => [2.4, 1.8], 'knee' => 7.6, 'ankle' => 15.6, 'foot' => 5.4],
        'grasp'  => ['type' => 'grasp',  'thigh' => [5.4, 6.4], 'shin' => [3.4, 2.8], 'knee' => 8.6, 'ankle' => 15.2, 'foot' => 6.0],
        'hoof'   => ['type' => 'hoof',   'thigh' => [5.0, 6.4], 'shin' => [2.8, 2.0], 'knee' => 8.6, 'ankle' => 15.4, 'foot' => 2.6],
        default  => ['type' => 'digit',  'thigh' => [5.4, 6.4], 'shin' => [3.6, 2.8], 'knee' => 8.6, 'ankle' => 15.4, 'foot' => 4.8],
    };
    $extra = match ($n) {
        1  => ['thigh' => [6.4, 6.6], 'shin' => [4.4, 4.0], 'ankle' => 15.6, 'deco' => 'beans', 'claw' => 0.5],
        2  => ['deco' => 'scales', 'claw' => 1.15],
        3  => ['deco' => 'wrinkles'],
        4  => ['deco' => 'ice', 'claw' => 1.25],
        5  => ['deco' => 'lava'],
        6  => ['deco' => 'storm', 'spur' => 1],
        7  => ['thigh' => [7, 7.6], 'shin' => [5.6, 5.4], 'deco' => 'fur', 'claw' => 1.35],
        8  => ['thigh' => [4, 5.4], 'shin' => [1.8, 1.4], 'deco' => 'bone', 'claw' => 1.5, 'spur' => 1],
        9  => ['deco' => 'crystal', 'claw' => 1.2, 'spur' => 1],
        10 => ['deco' => 'goat'],
        11 => ['thigh' => [4, 5.4], 'shin' => [1.8, 1.4], 'knee' => 8.4, 'foot' => 6.4, 'deco' => 'scutes'],
        12 => ['deco' => 'rooster', 'claw' => 1.1, 'spur' => 2],
        13 => ['shin' => [3.8, 3.2], 'deco' => 'knuckles', 'claw' => 1.45],
        14 => ['thigh' => [6.8, 7.6], 'shin' => [5.8, 5.6], 'deco' => 'stone'],
        15 => ['deco' => 'spikes', 'claw' => 1.0],
        16 => ['shin' => [3.4, 2.8], 'deco' => 'feather'],
        17 => ['deco' => 'armor', 'claw' => 1.3],
        default => ['thigh' => [5.6, 7.0], 'shin' => [2.6, 2.0], 'deco' => 'runner', 'claw' => 1.1],
    };
    return array_merge(['claw' => 1.0, 'spur' => 0, 'deco' => ''], $base, $extra, ['bulk' => $p['bulk']]);
}

/**
 * Egy láb: [tömegek, elöl (karmok, díszek), részletek].
 * $back: hátsó láb (térd előre, csánk hátra).
 */
function leg_one(float $hx, float $hy, bool $back, array $s, float $k): array
{
    $g = DG;
    $ground = 58.0 - (58.0 - $hy) * (1 - $k) * 0.2;
    $type = $s['type'];
    $th = $s['thigh']; $sh = $s['shin'];

    $knee = [$hx + ($back ? -3.4 : -1.2), $hy + $s['knee']];
    $ankle = [$hx + ($back ? 1.6 : 0.6), $hy + $s['ankle']];
    if ($type === 'lanky') { $knee = [$hx + ($back ? -4.6 : -2.6), $hy + $s['knee']]; $ankle = [$hx + ($back ? 2.6 : 1.4), $hy + $s['ankle']]; }
    if ($type === 'pillar') { $knee = [$hx - 0.6, $hy + $s['knee']]; $ankle = [$hx - 0.2, $hy + $s['ankle']]; }
    $ankle[1] = min($ankle[1], $ground - 3.4);

    $thigh = kblob($hx + ($back ? 0.6 : -0.2), $hy + 2.6, $th[0] * $k, $th[1] * $k, $back ? 0.2 : -0.1);
    $shin = ktube([[$hx, $hy + 3], $knee, $ankle], [$sh[0] * $k, $sh[1] * $k * 1.05, $sh[1] * $k], true, true, 8);
    $masses = [$thigh, $shin];
    $front = $detail = '';
    $toe = [$ankle[0] - $s['foot'], $ground - 1.0];

    switch ($type) {
        case 'pillar':
            $masses[] = ktube([[$ankle[0], $ankle[1] - 2], [$ankle[0] - 0.4, $ground - 2.6]], [$sh[1] * $k, $sh[1] * $k * 1.12], true, false, 4);
            $masses[] = kblob($ankle[0] - 0.8, $ground - 2.2, $sh[1] * $k * 1.28, 2.4, 0);
            for ($i = 0; $i < 3; $i++) {
                $x = $ankle[0] - 4.6 * $k + $i * 2.6 * $k;
                $front .= kfill('M' . fmt($x - 1.1) . ',' . fmt($ground - 0.6) . 'q1.1,-2.2 2.2,0Z', $g['spec'], 1, $g['ink'], 0.5);
            }
            break;

        case 'hoof':
            $masses[] = ktube([$ankle, [$ankle[0] - 0.8, $ground - 3]], [$sh[1] * $k, $sh[1] * $k * 0.9], true, true, 4);
            $hoof = kpoly([[$ankle[0] - 3.2, $ground - 3.4], [$ankle[0] + 1.4, $ground - 3.4], [$ankle[0] + 2.0, $ground], [$ankle[0] - 4.4, $ground]]);
            $front .= kpiece($hoof, $g['dark'], 1.0) . kstroke('M' . fmt($ankle[0] - 1.2) . ',' . fmt($ground - 3.2) . 'L' . fmt($ankle[0] - 1.4) . ',' . fmt($ground), $g['ink'], 0.7)
                    . kfill(kpoly([[$ankle[0] - 3, $ground - 3.2], [$ankle[0] - 1.6, $ground - 3.2], [$ankle[0] - 2.6, $ground - 0.4]]), $g['light'], 0.4);
            $toe = [$ankle[0] - 1.6, $ground];
            break;

        case 'grasp':
            $masses[] = kblob($ankle[0] - 1.4, $ground - 2.8, 3.6 * $k, 2.6, 0);
            for ($i = 0; $i < 4; $i++) {
                $bx = $ankle[0] - 2.4 - $i * 1.1; $by = $ground - 3.2 + $i * 0.2;
                $tip = [$bx - 3.4 - (2 - abs($i - 1.5)) * 0.8, $ground - 0.4];
                $masses[] = ktube([[$bx + 1, $by], [$tip[0] + 1, $tip[1] - 1.2], $tip], [1.2, 1.0, 0.8], true, true, 4);
                $front .= kpiece(khorn([$tip[0] + 0.3, $tip[1] - 0.6], [$tip[0] - 2.2 * $s['claw'], $tip[1] + 1.2], 1.2, 0.35), $g['spec'], 0.7);
            }
            break;

        case 'lanky':
            $masses[] = ktube([$ankle, [$ankle[0] - 0.8, $ground - 2]], [$sh[1] * $k, $sh[1] * $k], true, true, 4);
            foreach ([[-$s['foot'], -0.2], [-$s['foot'] * 0.75, 0.6], [1.8, 0.2]] as $i => [$dx, $dy]) {
                $tip = [$ankle[0] - 0.8 + $dx, $ground - 0.6 + $dy];
                $masses[] = ktube([[$ankle[0] - 0.8, $ground - 2], $tip], [1.4 * $k, 1.0 * $k], true, true, 4);
                if ($s['claw'] > 0.01) $front .= kpiece(khorn([$tip[0] + ($dx < 0 ? 0.4 : -0.4), $tip[1] - 0.2], [$tip[0] + ($dx < 0 ? -2 : 1.6) * $s['claw'], $tip[1] + 0.8], 1.1, $dx < 0 ? 0.3 : -0.3), $g['spec'], 0.6);
            }
            break;

        default: // digit
            $masses[] = ktube([[$ankle[0] + 0.6, $ankle[1] - 0.6], [$ankle[0], $ground - 2.2], $toe], [$sh[1] * $k, $sh[1] * $k * 0.95, $sh[1] * $k * 0.9], true, true, 6);
            for ($i = 0; $i < 3; $i++) {
                $cx = $toe[0] + $i * 1.9; $cy = $ground - 0.4 - abs($i - 1) * 0.3;
                $front .= kpiece(khorn([$cx + 0.8, $cy - 1.2], [$cx - 2.0 * $s['claw'], $cy + 1.4 * $s['claw']], 1.6, 0.3), $g['spec'], 0.7);
            }
    }

    /* --- Egyedi díszítés --- */
    $mid = [($knee[0] + $ankle[0]) / 2, ($knee[1] + $ankle[1]) / 2];
    switch ($s['deco']) {
        case 'beans':
            $detail .= kfill(kblob($ankle[0] - 1, $ground - 2.4, 2.4, 1.2), $g['spec'], 0.4);
            break;
        case 'scales':
        case 'scutes':
            for ($i = 0; $i < 5; $i++) {
                $y = $knee[1] + ($ankle[1] - $knee[1]) * $i / 4;
                $x = $knee[0] + ($ankle[0] - $knee[0]) * $i / 4;
                $detail .= kstroke('M' . fmt($x - 2.2) . ',' . fmt($y) . 'q2.2,1.4 4.4,0', $g['shadow'], 0.6, 0.55);
            }
            break;
        case 'wrinkles':
            foreach ([0.2, 0.45, 0.7] as $f) {
                $y = $knee[1] + ($ground - $knee[1]) * $f;
                $detail .= kstroke('M' . fmt($ankle[0] - 3.4) . ',' . fmt($y) . 'q3.4,1.2 6.4,-0.4', $g['shadow'], 0.6, 0.5);
            }
            break;
        case 'ice':
            $front .= kpiece(kshard([$knee[0] + 1.4, $knee[1] - 1], [$knee[0] + 5.6, $knee[1] - 4.2], 2.0), $g['light'], 1.0)
                    . kpiece(kshard([$mid[0] + 1, $mid[1]], [$mid[0] + 5, $mid[1] - 1.6], 1.6), $g['light'], 1.0);
            $detail .= kstroke(kline([[$knee[0] - 2, $knee[1] - 3], [$knee[0] + 1, $knee[1] + 1], [$ankle[0] - 1, $ankle[1]]]), $g['spec'], 0.5, 0.6);
            break;
        case 'lava':
            $c = 'M' . fmt($hx - 3) . ',' . fmt($hy + 2) . 'l2,2.4l-0.8,2.6l1.6,2M' . fmt($ankle[0] - 2) . ',' . fmt($knee[1] + 1) . 'l1.4,2.4l-1,2.4';
            $detail .= kstroke($c, $g['spec'], 1.8, 0.2) . kstroke($c, $g['spec'], 0.6, 0.85)
                     . kfill(kblob($ankle[0] - 0.8, $ground - 1.6, 4.4, 1.2), $g['shadow'], 0.6);
            break;
        case 'storm':
            $detail .= kstroke('M' . fmt($hx - 2) . ',' . fmt($hy + 1) . 'l2.4,2l-1.4,1.2l2.6,2.4', $g['spec'], 0.7, 0.8);
            break;
        case 'fur':
            for ($i = 0; $i < 4; $i++) $front .= kpiece(kflame([$ankle[0] - 3 + $i * 1.8, $ankle[1] - 1], [$ankle[0] - 4.4 + $i * 2, $ankle[1] + 4.2], 2.0, 0.2), $i % 2 ? $g['mid'] : $g['light'], 0.8);
            break;
        case 'bone':
            $detail .= kstroke('M' . fmt($knee[0] - 1.6) . ',' . fmt($knee[1] - 4) . 'L' . fmt($knee[0] + 0.4) . ',' . fmt($knee[1] + 3), $g['bright'], 0.7, 0.6)
                     . kfill(kblob($knee[0], $knee[1], 1.6, 1.4), $g['bright'], 0.5);
            break;
        case 'crystal':
            $front .= kpiece(kshard([$hx + 2, $hy + 3], [$hx + 6.6, $hy + 0.6], 2.2), $g['bright'], 1.0) . kfill(kshard_lit([$hx + 2, $hy + 3], [$hx + 6.6, $hy + 0.6], 2.2), $g['spec'], 0.5);
            break;
        case 'goat':
        case 'feather':
            $big = $s['deco'] === 'feather';
            for ($i = 0; $i < ($big ? 5 : 3); $i++) {
                $bx = $ankle[0] - 2.8 + $i * 1.4;
                $front .= kpiece(kflame([$bx, $ankle[1] - ($big ? 2.4 : 0.6)], [$bx - 1.4 + $i * 0.5, $ground - ($big ? 0.6 : 2.0)], $big ? 2.4 : 1.8, 0.25), $i % 2 ? $g['bright'] : $g['light'], 0.8);
            }
            break;
        case 'rooster':
            for ($i = 0; $i < 5; $i++) {
                $y = $knee[1] + 1 + ($ankle[1] - $knee[1]) * $i / 5;
                $x = $knee[0] + ($ankle[0] - $knee[0]) * $i / 5;
                $detail .= kstroke('M' . fmt($x - 2) . ',' . fmt($y) . 'L' . fmt($x + 2) . ',' . fmt($y + 0.4), $g['shadow'], 0.7, 0.6);
            }
            break;
        case 'knuckles':
            for ($i = 0; $i < 4; $i++) $detail .= kfill(kblob($ankle[0] - 2.8 - $i * 1.1, $ground - 3.2, 0.8, 0.6), $g['spec'], 0.5);
            break;
        case 'stone':
            $detail .= kfill(kpoly([[$hx - 4, $hy + 7], [$hx + 2, $hy + 6], [$hx + 3, $hy + 11], [$hx - 3, $hy + 12]]), $g['shadow'], 0.25)
                     . kstroke('M' . fmt($hx - 4.6) . ',' . fmt($hy + 12.4) . 'L' . fmt($hx + 4) . ',' . fmt($hy + 11.8) . 'M' . fmt($hx - 4.6) . ',' . fmt($hy + 6.6) . 'L' . fmt($hx + 3.6) . ',' . fmt($hy + 5.6), $g['ink'], 0.6, 0.55);
            break;
        case 'spikes':
            for ($i = 0; $i < 3; $i++) {
                $f = 0.2 + $i * 0.3;
                $b = [$knee[0] + ($ankle[0] - $knee[0]) * $f + 1.6, $knee[1] + ($ankle[1] - $knee[1]) * $f];
                $front .= kpiece(khorn($b, [$b[0] + 3.2, $b[1] - 2.4], 1.6, -0.1), $g['light'], 0.9);
            }
            $front .= kpiece(khorn([$hx + 3.4, $hy + 2], [$hx + 7, $hy - 0.6], 2.0, -0.1), $g['light'], 0.9);
            break;
        case 'armor':
            foreach ([[$hx, $hy + 3, 4.6], [$mid[0], $mid[1], 3.6]] as [$x, $y, $r]) {
                $plate = ksmooth([[$x - $r, $y - 2.4], [$x + $r, $y - 2.8], [$x + $r * 0.9, $y + 2.6], [$x - $r * 0.9, $y + 2.8]], true, 0.6);
                $front .= kpiece($plate, $g['light'], 0.9) . kfill(kblob($x - $r * 0.5, $y - 1.4, 0.5, 0.5), $g['spec']) . kfill(kblob($x + $r * 0.5, $y - 1.6, 0.5, 0.5), $g['spec']);
            }
            break;
        case 'runner':
            $detail .= kstroke('M' . fmt($hx - 3) . ',' . fmt($hy + 4) . 'q2,4 0.6,7', $g['shadow'], 0.7, 0.5);
            break;
    }

    // Sarkantyú
    if ($s['spur']) {
        $len = $s['spur'] > 1 ? 4.6 : 3.4;
        $front .= kpiece(khorn([$ankle[0] + 1, $ankle[1] + 0.6], [$ankle[0] + 1 + $len, $ankle[1] + 2.4], 1.6, -0.25), $g['bright'], 0.8);
    }

    // Térdhajlat
    $detail .= kstroke('M' . fmt($knee[0] - 2.6 * $k) . ',' . fmt($knee[1]) . 'q2.6,1.6 5.2,-0.4', $g['shadow'], 0.7, 0.4);

    return [$masses, $front, $detail];
}

function draw_legs(int $n, array $p): string
{
    $id = "l$n";
    $g  = DG;
    $s  = leg_spec($n, $p);
    $k  = $s['bulk'];

    $near = $far = [];
    $front = $detail = $farFront = '';

    // Túloldali pár: hátrébb és feljebb, sötétebben — ez adja a mélységet
    foreach ([[39.6, 36.6, false], [53.6, 36.6, true]] as [$hx, $hy, $back]) {
        [$m, $f] = leg_one($hx, $hy, $back, $s, $k * 0.88);
        $far = array_merge($far, $m);
        $farFront .= $f;
    }
    foreach ([[36.0, 38.0, false], [50.0, 38.0, true]] as [$hx, $hy, $back]) {
        [$m, $f, $d] = leg_one($hx, $hy, $back, $s, $k);
        $near = array_merge($near, $m);
        $front .= $f;
        $detail .= $d;
    }

    $farLayer = silhouette($id . '-far-clip', $far, $g['dark'], 1.7);

    return '<g id="' . $id . '">'
         . '<defs>' . $farLayer['defs'] . '</defs>'
         . '<g opacity="0.78">' . $farLayer['draw'] . '<g opacity="0.7">' . $farFront . '</g></g>'
         . assemble($id, $near, 'url(#' . $id . '-volV)', $detail, '', $front, 1.9)
         . '</g>';
}

/* =====================================================================
   SZÁRNY
   ---------------------------------------------------------------------
   A szárny a vállból (36, 27) FELFELÉ és hátra nyílik, hogy ne takarja
   el a hátat (és a hátdíszeket). A játék a szárnytő körül forgatja.
   ===================================================================== */

const WROOT = [36.0, 27.0];

/**
 * Denevérszárny: kar (váll → könyök → csukló), ujjak a csuklóból,
 * köztük ívesen behúzott hártya, ami a hátra (attach) fut vissza.
 */
function wing_bat(string $id, array $o): string
{
    $g = DG;
    $o = array_merge(['elbow' => [40, 18], 'wrist' => [45, 10], 'tips' => [], 'attach' => [53, 25.6],
                      'scallop' => 0.3, 'arm' => [1.7, 1.15], 'finger' => 0.75, 'claws' => true, 'thumb' => true,
                      'holes' => [], 'tears' => [], 'tatters' => 0, 'veins' => true, 'facets' => false, 'far' => false,
                      'fill' => '', 'jag' => 0], $o);
    $R = WROOT; $W = $o['wrist'];
    $tips = $o['tips'];

    // Hártya körvonala
    $d = 'M' . fmtp($R) . 'L' . fmtp($o['elbow']) . 'L' . fmtp($W) . 'L' . fmtp($tips[0]);
    $edge = array_merge(array_slice($tips, 1), [$o['attach']]);
    $prev = $tips[0];
    foreach ($edge as $i => $t) {
        $mid = [($prev[0] + $t[0]) / 2, ($prev[1] + $t[1]) / 2];
        $c = [$mid[0] + ($W[0] - $mid[0]) * $o['scallop'], $mid[1] + ($W[1] - $mid[1]) * $o['scallop']];
        if ($o['jag']) {
            // szakadozott szél: apró cikkcakk a két csúcs között
            $steps = 4;
            for ($k = 1; $k <= $steps; $k++) {
                $f = $k / $steps; $u = 1 - $f;
                $q = [$u * $u * $prev[0] + 2 * $u * $f * $c[0] + $f * $f * $t[0], $u * $u * $prev[1] + 2 * $u * $f * $c[1] + $f * $f * $t[1]];
                $j = ($k % 2 ? 1 : -0.6) * $o['jag'];
                $d .= 'L' . fmt($q[0] + ($W[0] - $q[0]) * 0.05 * $j) . ',' . fmt($q[1] + ($W[1] - $q[1]) * 0.05 * $j + $j * 0.6);
            }
        } else {
            $d .= 'Q' . fmtp($c) . ' ' . fmtp($t);
        }
        $prev = $t;
    }
    $d .= 'Q' . fmt(($o['attach'][0] + $R[0]) / 2) . ',' . fmt(($o['attach'][1] + $R[1]) / 2 + 2.4) . ' ' . fmtp($R) . 'Z';

    // Erezet és díszek a hártyán
    $det = '';
    if ($o['veins']) {
        $v = '';
        foreach ($edge as $i => $t) {
            $m = [($W[0] + $t[0]) / 2, ($W[1] + $t[1]) / 2];
            $v .= 'M' . fmt($W[0] + ($m[0] - $W[0]) * 0.3) . ',' . fmt($W[1] + ($m[1] - $W[1]) * 0.3)
                . 'Q' . fmt($m[0] + 1.2) . ',' . fmt($m[1] + 1.2) . ' ' . fmt($t[0] + ($W[0] - $t[0]) * 0.25) . ',' . fmt($t[1] + ($W[1] - $t[1]) * 0.25);
        }
        $det .= kstroke($v, $g['shadow'], 0.5, 0.45);
    }
    if ($o['facets']) {
        $f = '';
        $prevT = $tips[0];
        foreach (array_merge(array_slice($tips, 1), [$o['attach']]) as $i => $t) {
            $f .= kfill(kpoly([$W, $prevT, [($prevT[0] + $t[0]) / 2 + ($W[0] - $t[0]) * 0.2, ($prevT[1] + $t[1]) / 2 + ($W[1] - $t[1]) * 0.2]]), $i % 2 ? $g['spec'] : $g['shadow'], $i % 2 ? 0.35 : 0.25);
            $prevT = $t;
        }
        $det .= $f;
    }
    foreach ($o['holes'] as [$x, $y, $r]) {
        $det .= kfill(ksmooth([[$x - $r, $y], [$x - $r * 0.3, $y - $r * 0.8], [$x + $r, $y - $r * 0.3], [$x + $r * 0.6, $y + $r * 0.8], [$x - $r * 0.4, $y + $r * 0.7]]), $g['ink'], 0.85)
              . kstroke(ksmooth([[$x - $r, $y], [$x - $r * 0.3, $y - $r * 0.8], [$x + $r, $y - $r * 0.3], [$x + $r * 0.6, $y + $r * 0.8], [$x - $r * 0.4, $y + $r * 0.7]]), $g['spec'], 0.6, 0.7);
    }
    foreach ($o['tears'] as [$a, $b]) {
        $det .= kfill(kpoly([$a, [($a[0] + $b[0]) / 2 + 0.8, ($a[1] + $b[1]) / 2], $b, [($a[0] + $b[0]) / 2 - 0.6, ($a[1] + $b[1]) / 2 + 0.4]]), $g['ink'], 0.8);
    }

    // Hártyamezők: az ujjak közti panelek felváltva világosabbak — ettől
    // látszik feszesnek a hártya
    $pan = '';
    $prevT = $tips[0];
    foreach ($edge as $i => $t) {
        $pan .= kfill(kpoly([$W, $prevT, $t]), $i % 2 ? $g['spec'] : $g['shadow'], $i % 2 ? 0.14 : 0.12);
        $prevT = $t;
    }
    $det = $pan . $det;

    // Lógó cafatok a hártya alsó szélén
    $tat = '';
    for ($i = 0; $i < $o['tatters']; $i++) {
        $f = ($i + 0.5) / $o['tatters'];
        $a = $tips[count($tips) - 1]; $b = $o['attach'];
        $p0 = [$a[0] + ($b[0] - $a[0]) * $f, $a[1] + ($b[1] - $a[1]) * $f];
        $tat .= kpiece(kflame($p0, [$p0[0] + 1.6, $p0[1] + 4.6 + ($i % 2) * 2], 2.2, 0.3), $g['dark'], 0.9);
    }

    // Csontok
    $bones = kpiece(ktube([[$R[0] + 0.6, $R[1] - 1.6], $o['elbow'], $W], [$o['arm'][0], $o['arm'][1] * 1.1, $o['arm'][1]], true, true, 8), $g['mid'], 1.2)
           . kstroke(kline([[$R[0] + 0.6, $R[1] - 2], $o['elbow'], $W]), $g['bright'], 0.5, 0.6);
    foreach ($tips as $t) {
        $bones .= kpiece(ktube([$W, [($W[0] + $t[0]) / 2 + 0.5, ($W[1] + $t[1]) / 2 + 0.3], $t], [1.1 * $o['finger'], 0.8 * $o['finger'], 0.35], true, true, 6), $g['mid'], 0.9);
    }
    $bones .= kfill(kblob($W[0], $W[1], 1.15, 1.0), $g['light'], 1, $g['ink'], 0.7);
    if ($o['thumb']) $bones .= kpiece(khorn([$W[0] - 0.6, $W[1] - 0.6], [$W[0] - 3.6, $W[1] - 2.4], 1.4, -0.3), $g['spec'], 0.8);
    if ($o['claws']) foreach ($tips as $t) $bones .= kpiece(khorn($t, [$t[0] + ($t[0] - $W[0]) * 0.14, $t[1] + ($t[1] - $W[1]) * 0.14], 1.0, 0.2), $g['spec'], 0.6);

    // Túloldali szárny: ugyanaz sötéten, kissé elforgatva — mélység
    $far = '';
    if ($o['far']) {
        $far = '<g transform="rotate(-16 ' . fmt($R[0]) . ' ' . fmt($R[1]) . ') translate(-1.6,-1.2)" opacity="0.8">'
             . kfill($d, $g['ink'], 1, $g['ink'], 1.6) . kfill($d, $g['shadow']) . '</g>';
    }

    return $far . assemble($id, [$d], 'url(#' . ($o['gid'] ?? $id) . '-vol)', $det, '', $tat . $bones, 1.7);
}

/** Tollas szárny: fedőtollak, evezőtollak rétegekben. */
function wing_feathers(string $id, array $o): string
{
    $g = DG;
    $o = array_merge(['n' => 7, 'len' => 22, 'spread' => [-1.25, -0.15], 'arm' => [[41, 17], [47, 10]], 'jag' => false, 'far' => false], $o);
    $R = WROOT;
    [$E, $W] = $o['arm'];
    $prim = $sec = $cov = '';
    $farD = '';
    for ($i = 0; $i < $o['n']; $i++) {
        $f = $i / max(1, $o['n'] - 1);
        $a = $o['spread'][0] + ($o['spread'][1] - $o['spread'][0]) * $f;
        $base = [$W[0] + ($R[0] + 6 - $W[0]) * $f * 0.9, $W[1] + ($R[1] - 2 - $W[1]) * $f * 0.9];
        $L = $o['len'] * (1 - $f * 0.45);
        $tip = [$base[0] + cos($a) * $L, $base[1] + sin($a) * $L];
        $leaf = kleaf($base, $tip, 3.4 - $f * 0.6, 0.55);
        if ($o['jag']) {
            $mid = [($base[0] + $tip[0]) / 2, ($base[1] + $tip[1]) / 2];
            $leaf = kpoly([[$base[0] - 1.4, $base[1] + 1], [$mid[0] + 1.6, $mid[1] - 0.4], [$mid[0] + 0.2, $mid[1] + 1.4], $tip, [$mid[0] - 1.4, $mid[1] - 1.6], [$base[0] + 1.4, $base[1] - 1]]);
        }
        $prim .= kpiece($leaf, $i % 2 ? $g['light'] : $g['bright'], 1.1) . kstroke(kline([$base, [($base[0] * 0.3 + $tip[0] * 0.7), ($base[1] * 0.3 + $tip[1] * 0.7)]]), $g['dark'], 0.45, 0.6);
        $farD .= kleaf([$base[0] - 2, $base[1] - 1], [$tip[0] - 3, $tip[1] - 1], 3.2, 0.55);
    }
    // Fedőtollak két sorban a kar mentén
    for ($r = 0; $r < 2; $r++) {
        for ($i = 0; $i < 5; $i++) {
            $f = $i / 4;
            $base = [$E[0] + ($W[0] - $E[0]) * $f * 0.8 - $r * 1.6, $E[1] + ($W[1] - $E[1]) * $f * 0.8 + 1.2 + $r * 2.4];
            $tip = [$base[0] + 6 - $r, $base[1] + 4.4 + $r];
            $cov .= kpiece(kleaf($base, $tip, 2.8, 0.5), $r ? $g['mid'] : $g['light'], 0.9);
        }
    }
    $arm = kpiece(ktube([[$R[0] + 0.6, $R[1] - 1.6], $E, $W], [2.0, 1.7, 1.3], true, true, 8), $g['mid'], 1.2);
    $far = $o['far'] ? '<g transform="rotate(-14 36 27)" opacity="0.75">' . kfill($farD, $g['shadow'], 1, $g['ink'], 1.1) . '</g>' : '';
    return $far . $prim . $cov . $arm;
}

/** Rovarszárny: hosszú, keskeny hártyák sűrű erezettel (két pár). */
function wing_insect(string $id, array $pairs): string
{
    $g = DG;
    $out = '';
    foreach ($pairs as $j => [$tip, $w, $curve, $fill]) {
        $R = [WROOT[0] + $j * 0.8, WROOT[1] + $j * 0.6];
        $shape = khorn($R, $tip, $w, $curve);
        $dx = $tip[0] - $R[0]; $dy = $tip[1] - $R[1];
        $vein = '';
        for ($k = 1; $k < 7; $k++) {
            $f = $k / 7;
            $c = [$R[0] + $dx * $f, $R[1] + $dy * $f];
            $vein .= 'M' . fmt($c[0] - $dy * 0.08) . ',' . fmt($c[1] + $dx * 0.08) . 'L' . fmt($c[0] + $dy * 0.08) . ',' . fmt($c[1] - $dx * 0.08);
        }
        $vein .= kline([$R, $tip]);
        $out .= kfill($shape, $g['ink'], 1, $g['ink'], 1.3) . kfill($shape, $fill, 0.9)
              . kfill(khorn([$R[0] - 0.3, $R[1] - 0.3], [$tip[0] - 1, $tip[1] - 0.6], $w * 0.4, $curve), $g['spec'], 0.4)
              . kstroke($vein, $g['dark'], 0.45, 0.7);
    }
    return $out . kfill(kblob(WROOT[0] + 0.6, WROOT[1], 2.2, 1.8), $g['light'], 1, $g['ink'], 1.0);
}

/** Úszószárny: legyező alakú, merevítő sugarakkal. */
function wing_fin(string $id, float $s, int $rays, float $a0, float $a1, bool $far = true): string
{
    $g = DG;
    $R = WROOT;
    $pts = [$R];
    $rayD = '';
    for ($i = 0; $i <= $rays; $i++) {
        $a = $a0 + ($a1 - $a0) * $i / $rays;
        $L = $s * (0.75 + 0.25 * sin(M_PI * $i / $rays));
        $t = [$R[0] + cos($a) * $L, $R[1] + sin($a) * $L];
        if ($i) {
            $am = $a - ($a1 - $a0) / $rays / 2;
            $pts[] = [$R[0] + cos($am) * $L * 0.86, $R[1] + sin($am) * $L * 0.86];
        }
        $pts[] = $t;
        $rayD .= 'M' . fmt($R[0] + cos($a) * 2) . ',' . fmt($R[1] + sin($a) * 2) . 'L' . fmtp($t);
    }
    $d = kpoly($pts);
    $farS = $far ? '<g transform="rotate(-18 36 27)" opacity="0.75">' . kfill($d, $g['shadow'], 1, $g['ink'], 1.3) . '</g>' : '';
    return $farS . assemble($id, [$d], 'url(#' . $id . '-membrane)', kstroke($rayD, $g['ink'], 1.1, 0.8) . kstroke($rayD, $g['bright'], 0.5, 0.9), '', '', 1.6);
}

/** Kristályszárny: legyezőbe rendezett prizmák. */
function wing_crystals(string $id, array $list): string
{
    $g = DG;
    $out = '';
    foreach ($list as [$tip, $w, $from]) {
        $b = $from ?? WROOT;
        $out .= kpiece(kshard($b, $tip, $w), $g['light'], 1.3) . kfill(kshard_lit($b, $tip, $w), $g['spec'], 0.6)
              . kstroke(kline([$b, $tip]), $g['spec'], 0.4, 0.5);
    }
    return $out . kfill(kblob(WROOT[0], WROOT[1], 2.6, 2.2), $g['bright'], 1, $g['ink'], 1.0);
}

function draw_wings(int $n, array $p): string
{
    $id = "w$n";
    $g  = DG;
    $body = match ($n) {
        1  => wing_bat($id, ['elbow' => [38.6, 21], 'wrist' => [42, 16.6], 'tips' => [[39.6, 10.4], [46.6, 11.4], [50.4, 16.6]], 'attach' => [47, 25], 'scallop' => 0.25, 'arm' => [2.0, 1.5], 'finger' => 1.0, 'claws' => false, 'far' => false]),
        2  => wing_bat($id, ['elbow' => [38.8, 19.4], 'wrist' => [43, 13], 'tips' => [[44, 1.2], [54, 3], [60.6, 10.6]], 'attach' => [56, 25]]),
        3  => wing_bat($id, ['elbow' => [38.6, 18.6], 'wrist' => [42.6, 12], 'tips' => [[40.4, 0.8], [50.6, 0.6], [59, 4.6], [63, 13], [62, 21.4]], 'attach' => [57, 26], 'scallop' => 0.34]),
        4  => wing_crystals($id, [[[41, 1.6], 3.6, null], [[48.6, 2.4], 4.0, null], [[55.6, 7.4], 3.8, null], [[59.6, 14.4], 3.2, null], [[57.4, 21], 2.6, null], [[45, 9], 2.6, [40, 18]]]),
        5  => wing_bat($id, ['elbow' => [38.8, 19], 'wrist' => [43, 12.6], 'tips' => [[42, 1], [52, 1.6], [59.6, 7.6], [62, 16.4]], 'attach' => [56, 25], 'jag' => 2.0,
                             'holes' => [[49, 10.4, 1.6], [53.4, 15.6, 1.2], [46.4, 17, 1.0]], 'veins' => false]),
        6  => wing_feathers($id, ['n' => 7, 'len' => 21, 'jag' => true, 'spread' => [-1.35, -0.1]]),
        7  => wing_bat($id, ['elbow' => [38.4, 18], 'wrist' => [42.4, 10.6], 'tips' => [[38.6, 0.6], [48.6, 0.4], [57.6, 3], [62.8, 10.6], [63, 19.6]], 'attach' => [58, 26.4], 'arm' => [2.5, 1.8], 'finger' => 1.0,
                             'tears' => [[[52, 14], [55.6, 17]]]]),
        8  => wing_bat($id, ['elbow' => [38.8, 19], 'wrist' => [43, 12.6], 'tips' => [[42.4, 1], [52.4, 1.6], [59.6, 7.6], [62, 15.6]], 'attach' => [56, 24.6], 'jag' => 2.6, 'tatters' => 5, 'veins' => false]),
        9  => wing_bat($id, ['elbow' => [38.8, 18.6], 'wrist' => [43, 12], 'tips' => [[41.6, 0.6], [52, 1], [60, 6.6], [63, 15]], 'attach' => [57, 25], 'scallop' => 0.22, 'facets' => true, 'veins' => false]),
        10 => wing_feathers($id, ['n' => 8, 'len' => 22, 'spread' => [-1.4, -0.05]]),
        11 => wing_insect($id, [[[52, 3], 4.4, 0.06, $g['bright']], [[58.6, 10.6], 4.2, 0.08, $g['light']], [[60, 19], 3.4, 0.05, $g['bright']]]),
        12 => wing_fin($id, 16, 7, -2.0, -0.35),
        13 => wing_bat($id . 'a', ['elbow' => [38.4, 21.6], 'wrist' => [43, 18.4], 'tips' => [[47, 14.6], [53.4, 17.4], [56, 22.6]], 'attach' => [51, 26.4], 'arm' => [1.7, 1.2], 'far' => false, 'gid' => $id])
            . wing_bat($id, ['elbow' => [39.4, 17.4], 'wrist' => [43.6, 10.4], 'tips' => [[39.6, 3.4], [48, 4.4], [52.4, 10]], 'attach' => [49, 22], 'far' => false]),
        14 => wing_crystals($id, [[[38.6, 0.8], 3.2, [37, 24]], [[45, 0.4], 4.2, null], [[52.4, 3.2], 4.6, null], [[58.6, 8.6], 4.4, null], [[61.6, 15.6], 3.8, null], [[60, 21.6], 3, null], [[51, 10], 3.0, [44, 16]]]),
        15 => wing_bat($id, ['elbow' => [38.8, 18.8], 'wrist' => [43, 12.4], 'tips' => [[42, 1], [52, 1.4], [59.6, 7.4], [62.4, 15.4]], 'attach' => [56.4, 25],
                             'holes' => [[47.6, 6.6, 1.8], [53.6, 12.6, 2.2], [49.6, 18.4, 1.4]], 'tears' => [[[42.4, 5], [45, 9.6]], [[57, 10.6], [54.6, 15]]], 'scallop' => 0.42]),
        16 => wing_bat($id, ['elbow' => [37.6, 23.6], 'wrist' => [40, 20.6], 'tips' => [[39.6, 16.4], [44, 17.6], [45.6, 21.4]], 'attach' => [43, 26.4], 'arm' => [1.7, 1.2], 'finger' => 1.1, 'claws' => false, 'thumb' => false, 'far' => false, 'veins' => false]),
        17 => wing_insect($id, [[[56, 4.4], 6.4, -0.32, $g['light']], [[61, 14.6], 5.2, -0.3, $g['mid']]]),
        default => wing_bat($id, ['elbow' => [38.4, 18.4], 'wrist' => [42.4, 11.6], 'tips' => [[38.6, 0.8], [47.4, 0.4], [55.4, 2.4], [61, 8.4], [63.2, 17], [62, 26]], 'attach' => [57, 31], 'scallop' => 0.2]),
    };
    return '<g id="' . $id . '">' . $body . '</g>';
}
