<?php
/**
 * FEJ — 18 kézzel tervezett fej, mindegyik saját sziluettel.
 *
 * Minden fej a nyak tövénél (26, 20) csatlakozik és balra néz. A formák
 * a katalógus `shape` értékéhez igazodnak (az adja a harci képességet),
 * de azonos formán belül is más a rajz: kölyökfej, bikaszarvú
 * bulldogpofa, triceratopsz-gallér, csupasz koponya, ragadozócsőr,
 * agancs, viperafej, kristálykorona, sörényes keleti sárkány, vadkan,
 * szakállas öreg, vassisak, lángsörény...
 *
 * Rétegek alulról: túloldali szarv → hátsó díszek → szájüreg →
 * állkapocs (+ alsó fogak) → koponya-tömegek (+ részletek) → elöl
 * (felső fogak, szem, orr, előre álló szarvak).
 */

function draw_head(int $n, array $p): string
{
    $id = "h$n";
    $g  = DG;
    $D  = array_merge([
        'masses' => [], 'jaw' => [], 'mouth' => '', 'far' => '', 'behind' => '',
        'jawFront' => '', 'detail' => '', 'front' => '', 'eye' => null,
    ], head_design($n, $p));

    $jaw = $D['jaw']
        ? assemble($id . '-jaw', $D['jaw'], 'url(#' . $id . '-volV)', kfill(kblob(12, 26, 14, 4), $g['bright'], 0.25), '', '', 1.8)
        : '';
    $mouth = $D['mouth'] !== '' ? kfill($D['mouth'], '#262626', 1, $g['ink'], 1.2) . kfill($D['mouth'], '#4a4a4a', 0.5) : '';

    [$ex, $ey, $er, $es] = $D['eye'] ?? [15, 13, 1.4, 'normal'];
    // Szemgödör-árnyék: enélkül a szem ráfestettnek hat
    $socket = $es === 'hollow' ? '' : kfill(kblob($ex + 0.5, $ey + 0.4, $er * 2.6, $er * 2.1), $g['shadow'], 0.4);

    return '<g id="' . $id . '">'
         . $D['far']
         . $D['behind']
         . $mouth
         . $jaw
         . $D['jawFront']
         . assemble($id, $D['masses'], 'url(#' . $id . '-vol)', $socket . $D['detail'], '', $D['front'] . keye($ex, $ey, $er, $es), 2.0)
         . '</g>';
}

/* ---------------------------------------------------------------------
   Közös darabok
   --------------------------------------------------------------------- */

/** Klasszikus koponya + pofa + pofazacskó. */
function hd_skull(array $cran, array $snoutPts, array $snoutW, array $cheek): array
{
    return [
        kblob(...$cran),
        ktube($snoutPts, $snoutW, true, true, 10),
        kblob(...$cheek),
    ];
}

/** Csukott vagy nyitott állkapocs csőként. */
function hd_jaw(array $pts, array $w): array
{
    return [ktube($pts, $w, true, true, 10)];
}

/** Szájüreg nyitott állkapocshoz: a felső ajak és az áll közti ék. */
function hd_mouth(array $upper, array $lower, array $corner): string
{
    return ksmooth(array_merge($upper, [$corner], array_reverse($lower)), true, 0.6);
}

/** Bőrredők, pikkelyek a koponyán és a pofán. */
function hd_skin(float $cx, float $cy, float $sx0, float $sx1, float $sy): string
{
    $g = DG;
    return kscale_rows($sx1, $sy - 1.2, $sx0, $sy + 0.4, 4, 2, 0.9, $g['shadow'], 0.35)
         . kstroke('M' . fmt($cx - 3) . ',' . fmt($cy + 3.6) . 'q2,1.4 4,0m-0.8,2q2,1.3 4,0', $g['shadow'], 0.55, 0.4);
}

function hd_nostril(float $x, float $y, float $s = 1.0): string
{
    return kfill(kblob($x, $y, 0.95 * $s, 0.65 * $s, -0.3), DG['ink'], 0.8);
}

/** Ajakvonal a csukott szájhoz. */
function hd_lip(array $pts): string
{
    return kstroke(ksmooth($pts, false), DG['ink'], 0.8, 0.75);
}

/** Szarv tintával + gyűrűkkel. */
function hd_horn(array $b, array $t, float $w, float $bend, string $fill = '', int $rings = 3): string
{
    $g = DG;
    $fill = $fill ?: $g['light'];
    return kpiece(khorn($b, $t, $w, $bend), $fill, 1.3)
         . ($rings ? kstroke(khorn_rings($b, $t, $w, $bend, $rings), $g['dark'], 0.5, 0.6) : '')
         . kfill(khorn([$b[0] - 0.2, $b[1] - 0.2], [$t[0] - 0.2, $t[1] - 0.2], $w * 0.35, $bend), $g['spec'], 0.35);
}

/** Szilánk (kristály) két tónusban. */
function hd_shard(array $b, array $t, float $w, string $fill = ''): string
{
    $g = DG;
    return kpiece(kshard($b, $t, $w), $fill ?: $g['light'], 1.2) . kfill(kshard_lit($b, $t, $w), $g['spec'], 0.55);
}

/* ---------------------------------------------------------------------
   A 18 fej
   --------------------------------------------------------------------- */

function head_design(int $n, array $p): array
{
    $g = DG;
    switch ($n) {

    /* 1 — Kölyökfej: nagy kerek koponya, pici pofa, hatalmas szem */
    case 1:
        return [
            'masses' => [kblob(19, 13, 8.6, 8.0, -0.1), kblob(10.6, 16.6, 5.6, 4.2, 0.05), kblob(22, 19, 5, 4.4)],
            'behind' => hd_horn([20.5, 6.6], [23.5, 2.0], 2.8, 0.25, '', 1) . hd_horn([15.6, 6.8], [16.4, 2.6], 2.3, 0.2, '', 1),
            'detail' => kfill(kblob(11, 20, 5.4, 1.6), $g['bright'], 0.45)
                      . kfill(kblob(21.5, 17.5, 2.4, 1.4), $g['spec'], 0.25),
            'front'  => hd_nostril(6.6, 15.4) . hd_lip([[6, 18.4], [9.5, 19.6], [13.5, 19.4]]),
            'eye'    => [15.4, 12.2, 2.7, 'cute'],
        ];

    /* 2 — Szarvas fej: a klasszikus sárkány, két hátrahajló szarv */
    case 2:
        return [
            'masses' => hd_skull([20.5, 13.2, 6.8, 5.8, -0.15], [[16, 12.6], [11, 13.2], [7, 14], [4, 15.2]], [4.4, 3.6, 2.6], [22.5, 18, 4.6, 4.2]),
            'jaw'    => hd_jaw([[24, 20.6], [18, 21.6], [11, 21.2], [5.4, 18.8]], [3.2, 2.6, 1.6]),
            'far'    => hd_horn([17.5, 8.8], [28.5, 2.2], 2.4, -0.18, $g['mid']),
            'behind' => hd_horn([21.5, 9.2], [35, 4.2], 3.0, -0.22),
            'detail' => hd_skin(20, 13, 6, 14, 12.4),
            'front'  => hd_nostril(5.4, 13.8) . hd_lip([[4.4, 17.4], [10, 18.4], [17, 18.6]]) . kteeth([7, 18], [15, 18.6], 3, 1.8),
            'eye'    => [15.2, 12.4, 1.5, 'fierce'],
        ];

    /* 3 — Tüskés fej: tüskekorona sugarasan, tátott száj */
    case 3:
        $spikes = '';
        foreach ([[-1.95, 9], [-1.55, 11], [-1.15, 12], [-0.75, 11.5], [-0.35, 10.5], [0.05, 9.5], [0.42, 7.5]] as [$a, $len]) {
            $c = [23, 13.8];
            $b = [$c[0] + cos($a) * 5.2, $c[1] + sin($a) * 5.2];
            $t = [$c[0] + cos($a) * $len, $c[1] + sin($a) * $len];
            $spikes .= hd_horn($b, [$t[0] + 2.2, $t[1]], 2.6, -0.08, '', 0);
        }
        $spikes .= hd_horn([24.5, 21], [31, 25], 2.4, 0.1, '', 0);
        return [
            'masses' => hd_skull([20.5, 14, 7, 6, -0.1], [[15.5, 13.6], [11, 13.6], [7, 13.8], [3.6, 14.6]], [4.6, 3.8, 2.6], [23, 18.6, 4.8, 4.2]),
            'jaw'    => hd_jaw([[24.5, 20.6], [19, 23.6], [12, 26], [5.6, 26.8]], [3.4, 2.6, 1.6]),
            'mouth'  => hd_mouth([[4.6, 16.8], [12, 18], [20, 19.4]], [[6, 25.4], [13, 24.2], [20, 22.2]], [24, 21]),
            'behind' => $spikes,
            'jawFront' => kteeth([7, 25.2], [19, 22.8], 5, 2.6, -1),
            'detail' => hd_skin(20, 13.6, 6, 14, 12.6),
            'front'  => hd_nostril(5, 13.4) . kteeth([5.6, 17.2], [18, 18.6], 6, 3.0),
            'eye'    => [15, 12.8, 1.4, 'fierce'],
        ];

    /* 4 — Jégagyar: csiszolt, szögletes fej, felfelé álló jégagyarak */
    case 4:
        return [
            'masses' => [kpoly([[26, 20.5], [27, 13], [23, 7], [15, 7.2], [8, 10], [3, 13.4], [3.6, 16.6], [9, 18], [16, 19.2], [21, 22.6]])],
            'jaw'    => [kpoly([[24, 21], [16, 21.8], [8, 20.6], [4, 18.6], [8.6, 23.2], [17, 24.6], [24.4, 23.6]])],
            'behind' => hd_shard([17.5, 8.4], [19.5, 0.6], 3.2) . hd_shard([22, 8.6], [28.5, 1.2], 3.6) . hd_shard([25.4, 11.4], [33.5, 6.4], 3.0),
            'detail' => kfill(kpoly([[15, 7.2], [23, 7], [19, 12.2]]), $g['spec'], 0.4)
                      . kfill(kpoly([[8, 10], [15, 7.2], [19, 12.2], [11.5, 13.6]]), $g['bright'], 0.35)
                      . kfill(kpoly([[19, 12.2], [27, 13], [26, 20.5], [21, 22.6]]), $g['shadow'], 0.35)
                      . kfill(kpoly([[3, 13.4], [11.5, 13.6], [9, 18], [3.6, 16.6]]), $g['dark'], 0.3)
                      . kstroke(kline([[8, 10], [11.5, 13.6], [19, 12.2], [23, 7]]) . kline([[11.5, 13.6], [16, 19.2]]), $g['spec'], 0.55, 0.6),
            'front'  => hd_shard([7.6, 21.4], [5.6, 12.4], 2.4, $g['bright']) . hd_shard([11.6, 21.8], [11, 15.6], 1.8, $g['bright'])
                      . hd_nostril(4.8, 14.2),
            'eye'    => [15.2, 11.8, 1.35, 'glow'],
        ];

    /* 5 — Lávapofa: bulldog-állkapocs, előreálló alsó agyarak, bikaszarv, izzó repedések */
    case 5:
        return [
            'masses' => [kblob(20, 12.4, 7.4, 6.2, -0.1), kblob(10.6, 13.8, 6.6, 4.6, 0.02), kblob(22.5, 17.4, 5.2, 4.6)],
            'jaw'    => [kblob(12.4, 21.4, 9.6, 4.4, 0.04)],
            'mouth'  => kpoly([[4, 17.4], [16, 17.8], [22, 19], [16, 19.8], [4, 19.4]]),
            'far'    => hd_horn([17.6, 7.4], [10.4, 1.6], 2.6, 0.4, $g['mid']),
            'behind' => hd_horn([21.4, 7.6], [13.6, 0.6], 3.6, 0.42),
            'jawFront' => kteeth([5, 19.2], [16, 19.4], 5, 1.8, -1, 0.2),
            'detail' => kstroke('M8,11l2.4,2.2l-1,2.6M13.6,9.6l1.6,2.4l2.6,0.4l1,2.4M21,8.6l-0.8,2.6l2,1.6M24,14.4l-2,2l0.6,2.4', $g['spec'], 0.75, 0.85)
                      . kstroke('M8,11l2.4,2.2l-1,2.6M13.6,9.6l1.6,2.4l2.6,0.4l1,2.4M21,8.6l-0.8,2.6l2,1.6M24,14.4l-2,2l0.6,2.4', $g['spec'], 2.2, 0.18),
            'front'  => hd_shard([4.8, 19.6], [4, 13.8], 2.2, $g['bright']) . hd_shard([9.4, 20], [9.2, 15.6], 1.8, $g['bright'])
                      . hd_nostril(5.6, 12.6, 1.2) . hd_nostril(8.4, 12.2, 1.0),
            'eye'    => [16.4, 11.2, 1.2, 'fierce'],
        ];

    /* 6 — Viharszem: karcsú, hosszú fej, hátrasöpört szarvak közt hártya */
    case 6:
        return [
            'masses' => hd_skull([21.5, 13, 6.2, 4.8, -0.2], [[17, 13.2], [12, 14], [7.5, 15], [2.6, 16.4]], [3.6, 2.8, 1.8], [23, 17.4, 4, 3.6]),
            'jaw'    => hd_jaw([[24, 19.8], [17, 20.2], [9, 19.4], [3.6, 18]], [2.6, 2.0, 1.2]),
            'behind' => kfill(ksmooth([[20.5, 10], [30, 5], [37.5, 3.4], [39.6, 6.2], [31, 9.6], [24.5, 12.6]]), $g['dark'], 1, $g['ink'], 1.2)
                      . kstroke('M24,10.4L33,5.4M26.5,11.4L36,6.6', $g['light'], 0.5, 0.6)
                      . hd_horn([19, 9.6], [36.5, 2.2], 2.0, -0.12, '', 0) . hd_horn([22.5, 9.6], [40.5, 6.4], 2.6, -0.1, '', 4),
            'detail' => kstroke('M19,15.6l2.4,-1.4l-0.6,2.2l2.6,-1.2', $g['spec'], 0.7, 0.85)
                      . kscale_rows(7, 13.4, 16, 14.2, 4, 2, 0.8, $g['shadow'], 0.3),
            'front'  => hd_nostril(3.8, 15.4, 0.8) . hd_lip([[3.2, 17.4], [10, 18.2], [18, 18]]),
            'eye'    => [15.6, 12.6, 1.4, 'narrow'],
        ];

    /* 7 — Ősi koponya: csontgallér, orrszarv, előreálló homlokszarvak */
    case 7:
        $frill = [];
        $spk = '';
        for ($i = 0; $i <= 10; $i++) {
            $a = -2.1 + 2.9 * $i / 10;
            $r = 11.2 + ($i % 2) * 2.4;
            $frill[] = [27.5 + cos($a) * $r, 13 + sin($a) * $r * 0.92];
        }
        $frill[] = [24, 22]; $frill[] = [22, 9];
        $rays = '';
        for ($i = 0; $i < 6; $i++) {
            $a = -1.9 + 2.5 * $i / 5;
            $rays .= 'M' . fmt(27.5 + cos($a) * 4) . ',' . fmt(13 + sin($a) * 4) . 'L' . fmt(27.5 + cos($a) * 10) . ',' . fmt(13 + sin($a) * 9.2);
            $spk .= kfill(kblob(27.5 + cos($a) * 9.2, 13 + sin($a) * 8.4, 1.1, 1.1), $g['bright'], 0.8, $g['ink'], 0.4);
        }
        return [
            'masses' => hd_skull([20, 14, 7.4, 6.4, -0.1], [[15.5, 14.2], [11, 14.6], [7, 15], [3.4, 15.8]], [5, 4, 2.8], [22.5, 18.8, 5.4, 4.6]),
            'jaw'    => hd_jaw([[24.5, 21], [18, 23.2], [11, 24.4], [5, 24.2]], [3.4, 2.8, 1.8]),
            'mouth'  => hd_mouth([[4.4, 18], [12, 19], [20, 20]], [[5.4, 22.8], [12, 22.6], [20, 21.8]], [24, 21.2]),
            'behind' => kpiece(ksmooth($frill, true, 0.7), $g['mid'], 1.4) . kstroke($rays, $g['shadow'], 0.8, 0.6) . $spk,
            'jawFront' => kteeth([7, 22.6], [18, 22], 4, 1.8, -1),
            'detail' => hd_skin(20, 14, 6, 14, 12.8),
            'front'  => hd_horn([8, 12.2], [6.4, 4.6], 3.4, -0.18, $g['bright'], 2) . hd_horn([18, 9.6], [5.6, 3.6], 3.0, 0.22, $g['bright'], 4)
                      . hd_nostril(4.6, 14.8) . kteeth([6, 18.2], [16, 19.2], 4, 2.0),
            'eye'    => [16.4, 13, 1.35, 'fierce'],
        ];

    /* 8 — Árnyékfej: csupasz koponya, üres szemgödör, ajak nélküli fogsor */
    case 8:
        $upper = kteeth([5.2, 16.4], [18, 18.4], 8, 2.6, 1, 0.3);
        return [
            'masses' => [kblob(20.5, 13.4, 7, 5.8, -0.15), ktube([[16, 13.6], [11, 14], [6.5, 14.6], [3.2, 15.4]], [4.2, 3.4, 2.2], true, true, 10), kblob(22, 17.6, 3.8, 3.2)],
            'jaw'    => hd_jaw([[24, 20], [18, 22.6], [11, 24.6], [4.6, 25]], [2.4, 1.8, 1.2]),
            'mouth'  => hd_mouth([[4.6, 16.6], [12, 17.6], [20, 18.6]], [[5.4, 23.8], [12, 23.2], [20, 21.4]], [23.6, 20]),
            'far'    => hd_horn([18.5, 8.4], [31, 2.6], 2.2, -0.2, $g['dark'], 0),
            'behind' => hd_horn([22, 9], [36, 7.4], 2.8, -0.2, $g['mid'], 0) . kstroke('M27,7.6l1.4,1.4l-0.6,1.2M31.5,7.8l1,1.4', $g['ink'], 0.6, 0.8),
            'jawFront' => kteeth([6.4, 23.2], [19.6, 21.4], 7, 2.4, -1, 0.3),
            'detail' => kfill(kblob(19.2, 17.6, 2.4, 1.4, -0.1), $g['ink'], 0.85)
                      . kfill(teardrop(6.8, 12.4, 5.8, 15.2, 1.1), $g['ink'], 0.85)
                      . kstroke('M22,8.6l-1.4,2.4l1,1.4l-1.6,2M12,12.4l1.6,0.8', $g['ink'], 0.6, 0.7)
                      . kstroke('M8,17.2L18,18.4', $g['shadow'], 0.6, 0.6),
            'front'  => $upper,
            'eye'    => [15.4, 12.6, 1.8, 'hollow'],
        ];

    /* 9 — Titkos fej: királyi gallér-legyező, kristályszarvak, állszilánkok */
    case 9:
        $tips = []; $rays = '';
        for ($i = 0; $i <= 6; $i++) {
            $a = -1.55 + 2.6 * $i / 6;
            $r = 12.5 - abs($i - 2.6) * 0.6;
            $tips[] = [25 + cos($a) * $r, 15 + sin($a) * $r];
            $rays .= 'M25,15L' . fmt(25 + cos($a) * $r) . ',' . fmt(15 + sin($a) * $r);
        }
        $fan = 'M25,15';
        foreach ($tips as $i => $t) {
            if ($i === 0) { $fan .= 'L' . fmtp($t); continue; }
            $prev = $tips[$i - 1];
            $mid = [($prev[0] + $t[0]) / 2, ($prev[1] + $t[1]) / 2];
            $in = [25 + ($mid[0] - 25) * 0.78, 15 + ($mid[1] - 15) * 0.78];
            $fan .= 'Q' . fmtp($in) . ' ' . fmtp($t);
        }
        $fan .= 'Z';
        return [
            'masses' => hd_skull([20.5, 13, 6.4, 5.6, -0.18], [[16, 13], [11.5, 13.6], [7.5, 14.4], [3.6, 15.6]], [4, 3.2, 2.2], [22.5, 17.6, 4.4, 4]),
            'jaw'    => hd_jaw([[23.5, 20], [17, 21], [10, 20.6], [4.6, 18.4]], [2.8, 2.2, 1.4]),
            'behind' => kpiece($fan, $g['dark'], 1.3) . kstroke($rays, $g['bright'], 0.7, 0.7)
                      . hd_shard([18.6, 8.6], [23, 0.6], 2.8, $g['bright']) . hd_shard([22.4, 9], [31, 2.6], 3.2, $g['bright']),
            'jawFront' => hd_shard([12, 21.6], [14, 26], 1.6) . hd_shard([16, 22], [19, 26.4], 1.8) . hd_shard([20, 21.6], [23.6, 25.6], 1.6),
            'detail' => kfill(kpoly([[14, 9], [20, 8], [22, 12], [16, 12.4]]), $g['spec'], 0.25) . hd_skin(20, 13, 6, 14, 12.4),
            'front'  => hd_nostril(5, 14) . hd_lip([[4, 17.2], [10, 18.4], [17, 18.4]]),
            'eye'    => [15.2, 12.4, 1.45, 'glow'],
        ];

    /* 10 — Csőrös fej: ragadozócsőr, tollbóbita */
    case 10:
        $beakU = ksmooth([[15.4, 9.4], [9, 10], [4.4, 12.6], [2.2, 16.8], [3.4, 19.8], [5, 17.2], [8, 15.8], [14, 16.6], [17.4, 15]]);
        $beakL = ksmooth([[16.5, 17.6], [10, 18], [6.2, 18.6], [5.2, 20.2], [9, 21.4], [16, 21], [19.4, 19.6]]);
        $feathers = '';
        foreach ([[[22.6, 8.4], [32.5, 0.8], 2.4], [[24, 9.6], [36.5, 3.6], 2.8], [[25, 11.4], [38.5, 8.6], 2.8], [[25, 13.6], [37, 14], 2.4]] as [$b, $t, $w]) {
            $feathers .= kpiece(kleaf($b, $t, $w), $g['mid'], 1.2) . kstroke(kline([$b, $t]), $g['bright'], 0.45, 0.7);
        }
        return [
            'masses' => [kblob(20.5, 13.4, 6.8, 6.2, -0.1), kblob(22.5, 18, 4.6, 4.2)],
            'behind' => $feathers,
            'jawFront' => kpiece($beakL, $g['light'], 1.4),
            'detail' => kscale_rows(17, 8.6, 25, 11, 3, 2, 1.0, $g['shadow'], 0.35),
            'front'  => kpiece($beakU, $g['bright'], 1.5)
                      . kfill(ksmooth([[14.6, 10.2], [9, 10.8], [5.4, 13.4], [8.4, 12.6], [14, 12]]), $g['spec'], 0.55)
                      . kstroke('M7.6,12.8q1.6,-0.8 2.8,-0.4', $g['ink'], 0.8, 0.85)
                      . kstroke('M5,17.4Q10,16.2 16.6,16.8', $g['ink'], 0.6, 0.7),
            'eye'    => [16, 12.4, 1.45, 'fierce'],
        ];

    /* 11 — Taréjos fej: elágazó agancs, fülhártya, fejtaréj */
    case 11:
        $antler = function (array $b, float $s, string $fill) {
            $beam = khorn($b, [$b[0] + 10 * $s, $b[1] - 8.4 * $s], 2.4 * $s, -0.22);
            $t1 = khorn([$b[0] + 3.2 * $s, $b[1] - 3.6 * $s], [$b[0] + 1.6 * $s, $b[1] - 8.6 * $s], 1.6 * $s, 0.1);
            $t2 = khorn([$b[0] + 6.4 * $s, $b[1] - 6.2 * $s], [$b[0] + 5.6 * $s, $b[1] - 11.4 * $s], 1.4 * $s, 0.15);
            $t3 = khorn([$b[0] + 5, $b[1] - 4 * $s], [$b[0] + 11.6 * $s, $b[1] - 3.8 * $s], 1.4 * $s, -0.1);
            return kpiece($beam . $t1 . $t2 . $t3, $fill, 1.2);
        };
        return [
            'masses' => hd_skull([20.5, 13.5, 6.6, 5.8, -0.12], [[16, 13.6], [11.5, 14], [7.5, 14.8], [4, 15.8]], [4.2, 3.4, 2.4], [22.5, 18, 4.6, 4.2]),
            'jaw'    => hd_jaw([[24, 20.4], [18, 21.4], [11, 21], [5.4, 19]], [3, 2.4, 1.4]),
            'far'    => $antler([17, 8.8], 0.85, $g['mid']),
            'behind' => $antler([20.5, 8.8], 1.0, $g['light'])
                      . kpiece(kleaf([24, 12], [31.5, 14.8], 3.2), $g['mid'], 1.2) . kstroke('M24.6,12.4L30,14.4', $g['shadow'], 0.5, 0.7)
                      . kpiece(ksmooth([[13, 9], [15, 5.6], [18, 6.6], [19.6, 8.6]]), $g['mid'], 1.1),
            'detail' => hd_skin(20, 13.4, 6, 14, 12.8),
            'front'  => hd_nostril(5.2, 14.6) . hd_lip([[4.4, 17.8], [10, 18.8], [17, 18.8]]),
            'eye'    => [15.4, 12.8, 1.4, 'normal'],
        ];

    /* 12 — Kígyófej: lapos, széles háromszögfej, méregfogak, villás nyelv */
    case 12:
        return [
            'masses' => [ksmooth([[26, 19.6], [27.2, 13.4], [24, 9.2], [17, 8.6], [10, 10.4], [4.6, 13], [3, 15.8], [5, 17.8], [11, 18.2], [18, 20], [22, 22.8]]), kblob(22.6, 17.4, 5.6, 5.2)],
            'jaw'    => hd_jaw([[23.6, 21], [17, 23.8], [10, 25], [4.4, 24.4]], [3, 2.2, 1.2]),
            'mouth'  => hd_mouth([[4.2, 17.6], [12, 18.6], [20, 20]], [[5.2, 23.4], [12, 23.2], [20, 21.8]], [23.6, 21.2]),
            'jawFront' => kstroke('M9,22.6Q4,24 1,24.4M1.8,24.2l-1.6,-1.4M1.8,24.4l-1.4,1.6', $g['ink'], 1.6) . kstroke('M9,22.6Q4,24 1,24.4M1.8,24.2l-1.6,-1.4M1.8,24.4l-1.4,1.6', $g['dark'], 0.7),
            'detail' => kstroke('M8,11.4l4,-1.6l4.6,0.4l4,1.6M12,9.8l0.6,3M16.6,10.2l-0.4,3', $g['shadow'], 0.6, 0.55)
                      . kfill(kblob(22, 13, 3.4, 1.2, -0.2), $g['bright'], 0.4)
                      . kfill(kblob(6.4, 15.4, 0.7, 0.55), $g['ink'], 0.8),
            'front'  => kpiece(khorn([6.6, 17.4], [7.6, 23.4], 1.5, 0.12), $g['spec'], 0.8) . kpiece(khorn([9.4, 17.8], [10.2, 22.4], 1.2, 0.1), $g['spec'], 0.8)
                      . hd_nostril(4, 14.4, 0.8),
            'eye'    => [14.6, 11.8, 1.6, 'slit'],
        ];

    /* 13 — Kristályfej: a koponyából kristályfürt nő, orrkristály */
    case 13:
        $cl = hd_shard([17, 9], [15.6, 1.6], 2.6) . hd_shard([20.4, 8.4], [21.6, 0.6], 3.4) . hd_shard([23.4, 9.4], [28.8, 2.4], 3.2)
            . hd_shard([25, 12], [33.4, 8.6], 2.8) . hd_shard([25.4, 15], [31.6, 16.8], 2.2);
        return [
            'masses' => hd_skull([20.5, 14, 7, 6, -0.12], [[16, 14], [11.5, 14.4], [7.5, 15], [4, 15.6]], [4.4, 3.6, 2.6], [22.5, 18.4, 4.8, 4.4]),
            'jaw'    => hd_jaw([[24, 20.8], [18, 21.8], [11, 21.4], [5.4, 19.4]], [3, 2.4, 1.4]),
            'behind' => $cl,
            'detail' => kfill(kpoly([[16, 9.4], [22, 8.6], [25, 13], [19, 14]]), $g['spec'], 0.2)
                      . kstroke('M16,9.4L19,14L25,13M19,14L17,19', $g['spec'], 0.5, 0.45),
            'front'  => hd_shard([8.6, 12.4], [8.2, 7.2], 2.0, $g['bright']) . hd_shard([11.6, 11.8], [12.8, 8.2], 1.4, $g['bright'])
                      . hd_nostril(5, 14.8) . hd_lip([[4.4, 18], [10, 19.2], [17, 19.2]]),
            'eye'    => [15.6, 13, 1.4, 'glow'],
        ];

    /* 14 — Sörényes fej: keleti sárkány, hullámzó sörény, bajusz, orrbütyök */
    case 14:
        $mane = '';
        foreach ([[[21, 7.6], [30, 0.8], 3.6], [[23.6, 8.6], [35, 3.6], 4.0], [[25, 11], [38, 9], 4.2], [[25.6, 14], [38, 15.6], 4.0], [[25, 17.4], [35, 22], 3.6], [[23.6, 20.4], [31, 27], 3.2]] as [$b, $t, $w]) {
            $mane .= kpiece(kflame($b, $t, $w, 0.12), $g['mid'], 1.2) . kstroke(kline([$b, [($b[0] + $t[0]) / 2, ($b[1] + $t[1]) / 2 + 0.6]]), $g['bright'], 0.45, 0.6);
        }
        $whisk = 'M5.4,16Q9,22 15.6,25.6Q19,27.6 20.4,30M3.6,15.6Q1.4,20 2.6,24.6Q3.6,27.6 1.4,30';
        return [
            'masses' => [kblob(20.5, 13.2, 6.6, 5.8, -0.1), ktube([[16, 13.6], [11, 14], [6.5, 14.4], [3.4, 14.4]], [4.4, 3.8, 3.4], true, true, 10), kblob(4.4, 13.4, 2.9, 2.7), kblob(22.5, 18, 4.6, 4.2)],
            'jaw'    => hd_jaw([[24, 20.4], [18, 21.4], [11, 21], [5, 19]], [3, 2.4, 1.6]),
            'behind' => $mane . hd_horn([19.6, 8.4], [27.6, 1.0], 2.4, -0.3, $g['bright'], 3) . hd_horn([23.4, 5.2], [26, 1.6], 1.2, 0.2, $g['bright'], 0),
            'detail' => hd_skin(20, 13, 7, 15, 12.6),
            'front'  => kstroke($whisk, $g['ink'], 1.5) . kstroke($whisk, $g['light'], 0.7)
                      . kpiece(kleaf([19, 9.4], [12, 10.6], 2.2), $g['bright'], 0.9)
                      . hd_nostril(3.4, 12.8, 1.1) . hd_lip([[4.2, 17.4], [10, 18.6], [17, 18.6]]) . kteeth([6, 17.4], [9, 17.8], 2, 1.6),
            'eye'    => [15.2, 12.6, 1.4, 'normal'],
        ];

    /* 15 — Agyaras fej: vadkanpofa, felfelé görbülő agyarak, hegyes fül */
    case 15:
        $bristle = '';
        for ($i = 0; $i < 7; $i++) $bristle .= 'M' . fmt(16 + $i * 1.8) . ',' . fmt(7.4 + abs($i - 2) * 0.4) . 'l' . fmt(1.4) . ',' . fmt(-2.6);
        return [
            'masses' => [kblob(20.5, 12.8, 7.4, 6.6, -0.06), ktube([[15.5, 13.4], [11, 14], [7, 15]], [5.6, 5.0, 4.6], true, true, 10), kblob(22.8, 18, 5.4, 5)],
            'jaw'    => [kblob(13.4, 21.6, 8.2, 3.4, 0.04)],
            'mouth'  => kpoly([[5, 19], [16, 19.4], [21.6, 20.2], [16, 20.6], [6, 20.6]]),
            'behind' => kstroke($bristle, $g['ink'], 1.3) . kstroke($bristle, $g['mid'], 0.6)
                      . kpiece(kleaf([22.6, 8.4], [28.4, 1.6], 3.4, 0.35), $g['mid'], 1.2) . kfill(kleaf([23, 8.2], [27.4, 3], 1.4, 0.35), $g['shadow'], 0.6)
                      . hd_horn([18.6, 7.4], [22.6, 1.8], 2.2, 0.15, '', 0),
            'detail' => kstroke('M10,10.6q3,-1 6,0.4M9.6,12.6q3,-0.8 5.6,0.4', $g['shadow'], 0.55, 0.45),
            'front'  => kpiece(ksmooth([[2.6, 12.2], [4.6, 11], [5.8, 15], [4.6, 19], [2.6, 18]]), $g['light'], 1.2)
                      . kfill(kblob(3.8, 13.6, 0.8, 1.1), $g['ink']) . kfill(kblob(3.8, 16.6, 0.8, 1.1), $g['ink'])
                      . hd_horn([8.4, 21], [9.6, 10.6], 2.6, 0.32, $g['spec'], 3) . hd_horn([12.6, 21.4], [13.6, 15.6], 1.8, 0.25, $g['spec'], 0),
            'eye'    => [16.6, 11.2, 1.15, 'fierce'],
        ];

    /* 16 — Bölcs koponya: hosszú szakáll, lelógó szemöldök, öreg agancs */
    case 16:
        $beard = ksmooth([[7, 19.4], [12, 20.4], [18, 20.6], [21, 21.6], [18.6, 25], [15.4, 29], [12.6, 33], [11.6, 29.4], [9, 25.6]], true, 0.9);
        $brow = 'M18.6,10.8Q24,8.6 31,10.4Q27,9.8 23.4,11.4M18,11.6Q24,11.2 29.4,14';
        return [
            'masses' => hd_skull([21, 13.4, 6.4, 5.4, -0.14], [[16.5, 13.6], [11.5, 14.4], [7, 15.4], [3.4, 16.6]], [4, 3.2, 2.2], [22.5, 17.6, 4.4, 4]),
            'jaw'    => hd_jaw([[23.6, 20], [17, 21], [10, 20.6], [4.4, 18.6]], [2.8, 2.2, 1.4]),
            'far'    => hd_horn([17.6, 8.6], [24, 1.6], 1.8, -0.3, $g['mid'], 0),
            'behind' => hd_horn([21, 8.8], [29.6, 1.4], 2.4, -0.35, '', 0) . hd_horn([24.6, 5.4], [29.4, 6.4], 1.2, -0.2, '', 0)
                      . kpiece(ksmooth([[24, 12], [30, 11], [33, 15], [30, 20], [25, 19]]), $g['dark'], 1.2)
                      . kstroke('M25,13.4L31,13M25,16L32,17M25,18.4L29.6,20', $g['light'], 0.5, 0.6),
            'jawFront' => kpiece($beard, $g['bright'], 1.3) . kstroke('M10,22q2,4 2,9M14,22q1,4 -0.4,8M18,22.4q-1,3 -3,6', $g['mid'], 0.55, 0.8),
            'detail' => hd_skin(20, 13.4, 7, 15, 13) . kstroke('M9,13.6q2,-0.6 4,0M8,15.6q2,-0.6 4,0', $g['shadow'], 0.5, 0.4),
            'front'  => kstroke($brow, $g['ink'], 1.8) . kstroke($brow, $g['spec'], 0.9)
                      . hd_nostril(5, 15) . hd_lip([[4, 18], [10, 19.2], [17, 19.2]]),
            'eye'    => [15.6, 12.8, 1.4, 'sleepy'],
        ];

    /* 17 — Vasálarc: szegecselt sisaklemez szemréssel, arcvéd, tüskekorona */
    case 17:
        $plate = ksmooth([[26, 9.4], [22, 6.4], [15, 7], [8, 10], [3.2, 13.4], [4.4, 15], [10, 12.8], [14, 12.6], [19, 13.6], [23, 15], [26.8, 14]]);
        $guard = kpoly([[18.6, 15.4], [26.4, 15.2], [25.6, 21.4], [21, 22.2], [18.2, 19.2]]);
        $rivets = '';
        foreach ([[7, 11.4], [11, 9.4], [16, 8.4], [21, 8.2], [24.6, 10.6], [20.2, 16.6], [24.6, 16.6], [24.2, 20], [20.6, 20.4]] as [$x, $y]) {
            $rivets .= kfill(kblob($x, $y, 0.6, 0.6), $g['spec'], 1, $g['ink'], 0.35);
        }
        $crown = '';
        foreach ([[15.4, 7.4], [18.6, 6.8], [21.8, 7], [24.6, 8.4]] as $i => [$x, $y]) $crown .= hd_horn([$x, $y], [$x + 1.6, $y - 4.4 - ($i % 2)], 2.0, 0.05, $g['bright'], 0);
        return [
            'masses' => hd_skull([20.5, 13.6, 7, 6, -0.1], [[16, 13.8], [11, 14.2], [7, 14.8], [3.6, 15.6]], [4.6, 3.8, 2.8], [22.5, 18.2, 4.8, 4.4]),
            'jaw'    => hd_jaw([[24, 20.6], [18, 21.6], [11, 21.2], [5.4, 19.2]], [3.2, 2.6, 1.6]),
            'behind' => $crown,
            'front'  => kpiece($plate, $g['light'], 1.4) . kfill(ksmooth([[22, 7.2], [15, 7.8], [8.4, 10.6], [14, 9.2], [21, 8.6]]), $g['spec'], 0.55)
                      . kfill(kpoly([[11.6, 11.6], [19.6, 11.2], [19.4, 12.6], [12, 12.8]]), $g['ink'])
                      . kpiece($guard, $g['mid'], 1.2) . kstroke('M19.4,18L25.4,18', $g['shadow'], 0.6, 0.6)
                      . $rivets . hd_nostril(4.6, 16) . hd_lip([[4.4, 18], [10, 19], [17, 19]]),
            'eye'    => [16, 12, 0.9, 'glow'],
        ];

    /* 18 — Parázsfej: karcsú, nyitott száj, hátracsapó lángsörény */
    default:
        $fl = '';
        foreach ([[[20, 9], [31, 0.8], 3.0], [[23, 10.2], [36.6, 4.6], 3.4], [[25, 13.4], [38.6, 12], 3.2], [[25, 17], [35, 20.4], 2.6]] as [$b, $t, $w]) {
            $fl .= kpiece(kflame($b, $t, $w, 0.2), $g['light'], 1.2) . kfill(kflame([$b[0] + 0.6, $b[1]], [$t[0] - 3, $t[1] + 0.4], $w * 0.4, 0.2), $g['spec'], 0.55);
        }
        return [
            'masses' => hd_skull([21, 13.6, 6, 5, -0.15], [[16.5, 13.8], [12, 14.6], [7.5, 15.6], [3, 16.6]], [3.6, 2.8, 1.8], [23, 18, 4.2, 3.8]),
            'jaw'    => hd_jaw([[23.5, 20], [17, 22.8], [10, 24.4], [4, 24.2]], [2.6, 2.0, 1.2]),
            'mouth'  => hd_mouth([[3.6, 18], [11, 19], [19, 19.8]], [[4.6, 23], [11, 22.6], [19, 21.2]], [23, 20.4]),
            'behind' => $fl,
            'jawFront' => kteeth([6, 22.6], [17, 21.6], 4, 2.0, -1),
            'detail' => kstroke('M9,13.6l3,1.2l3,-0.8l3,1.2', $g['spec'], 0.7, 0.75) . kscale_rows(8, 13.6, 16, 14.6, 3, 2, 0.8, $g['shadow'], 0.3),
            'front'  => hd_nostril(4, 15.4, 0.85) . kteeth([5, 18.2], [16, 19.2], 5, 2.4),
            'eye'    => [15.4, 12.6, 1.35, 'slit'],
        ];
    }
}
