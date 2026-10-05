<?php
/**
 * LÁB és SZÁRNY — ugyanazzal a tömeg-elvvel.
 *
 * A láb nem cső: comb (izomtömeg), lábszár és lábfej külön alakzat,
 * egy sziluetté olvasztva. A szárnynak van vaskos karcsontja, nem csak
 * egy lapos háromszög.
 *
 * Rögzített csatlakozási pontok (minden változatban azonosak):
 *   mellső csípő  (36, 38)      hátsó csípő (50, 38)
 *   szárnytő      (36, 27)
 */

/* =====================================================================
   LÁB
   ===================================================================== */

/** [combméret, térd, boka, talphossz, lábszárvastagság] */
function leg_anatomy(string $shape): array
{
    return match ($shape) {
        'pillar' => [[6.0, 7.0], 8.0, 15.0, 4.6, [4.6, 4.0]],
        'lanky'  => [[4.0, 5.4], 9.4, 17.0, 5.0, [2.4, 1.9]],
        'hoof'   => [[5.0, 6.2], 8.6, 16.0, 3.0, [3.0, 2.0]],
        'grasp'  => [[5.4, 6.4], 8.4, 15.4, 6.2, [3.4, 2.6]],
        default  => [[5.2, 6.2], 8.6, 15.6, 4.6, [3.4, 2.5]],   // digit
    };
}

/** Egy láb tömegei: comb + lábszár + lábfej. */
function leg_shapes(float $hx, float $hy, int $kneeDir, array $p, float $k): array
{
    [$thigh, $kneeD, $ankleD, $toeLen, $shank] = leg_anatomy($p['shape']);

    $knee  = [$hx + $kneeDir * 4.2, $hy + $kneeD];
    $ankle = [$hx + $kneeDir * 1.2, $hy + $ankleD];
    $toe   = [$ankle[0] - $toeLen, $ankle[1] + 4.0];

    // Comb: izomtömeg a csípőnél, enyhén megdöntve
    $thighM = ellipse_path($hx + $kneeDir * 1.0, $hy + 2.4,
                           $thigh[0] * $k, $thigh[1] * $k, $kneeDir * 0.18);

    // Lábszár: a combtól a bokáig
    $shankSp = spine([[
        [$hx + $kneeDir * 1.4, $hy + 3.0],
        [$knee[0], $knee[1] - 2.6],
        [$knee[0], $knee[1] + 2.2],
        $ankle,
    ]], 10);
    $shankM = outline_path($shankSp, wsteps([$shank[0] * $k, $shank[1] * $k, $shank[1] * $k]), true, true);

    // Lábfej
    $footSp = spine([[
        [$ankle[0] + 0.6, $ankle[1] - 1.0],
        [$ankle[0] + 0.2, $ankle[1] + 2.4],
        [$toe[0] + 2.4, $toe[1] - 1.0],
        $toe,
    ]], 8);
    $footM = outline_path($footSp, wsteps([$shank[1] * $k, $shank[1] * 0.95 * $k, $shank[1] * 1.05 * $k]), true, true);

    return [[$thighM, $shankM, $footM], $knee, $ankle, $toe];
}

function draw_legs(int $n, array $p): string
{
    $id = "l$n";
    $g  = DG;
    $k  = $p['bulk'];
    $claw = $p['claw'];

    $near = $far = [];
    $claws = $detail = '';

    // Túloldali pár: hátrébb és feljebb, sötétebben — ez adja a mélységet
    foreach ([[36.0 + 3.6, 38.0 - 1.4, -1], [50.0 + 3.6, 38.0 - 1.4, +1]] as [$hx, $hy, $dir]) {
        [$shapes] = leg_shapes($hx, $hy, $dir, $p, $k * 0.86);
        $far = array_merge($far, $shapes);
    }

    foreach ([[36.0, 38.0, -1], [50.0, 38.0, +1]] as [$hx, $hy, $dir]) {
        [$shapes, $knee, $ankle, $toe] = leg_shapes($hx, $hy, $dir, $p, $k);
        $near = array_merge($near, $shapes);

        // Karmok / pata
        if ($p['shape'] === 'hoof') {
            $claws .= '<path d="M' . fmt($toe[0] + 1.6) . ',' . fmt($toe[1] - 1.6)
                    . 'L' . fmt($toe[0] + 2.8) . ',' . fmt($toe[1] + 2.6)
                    . 'L' . fmt($toe[0] - 3.0) . ',' . fmt($toe[1] + 2.6)
                    . 'L' . fmt($toe[0] - 2.2) . ',' . fmt($toe[1] - 1.6) . 'Z" fill="' . $g['bright']
                    . '" stroke="' . $g['ink'] . '" stroke-width="0.9" stroke-linejoin="round"/>';
        } elseif ($claw > 0.01) {
            $count = $p['shape'] === 'grasp' ? 4 : 3;
            $d = '';
            for ($i = 0; $i < $count; $i++) {
                $cx = $toe[0] + $i * 1.9;
                $cy = $toe[1] + 1.4 - abs($i - 1) * 0.35;
                $d .= 'M' . fmt($cx + 1.0) . ',' . fmt($cy - 1.8)
                    . 'Q' . fmt($cx - 1.2) . ',' . fmt($cy - 0.6) . ' '
                    . fmt($cx - 2.4 * $claw) . ',' . fmt($cy + 2.0 * $claw)
                    . 'Q' . fmt($cx - 0.6) . ',' . fmt($cy + 0.4) . ' '
                    . fmt($cx + 1.2) . ',' . fmt($cy) . 'Z';
            }
            $claws .= '<path d="' . $d . '" fill="' . $g['bright'] . '" stroke="' . $g['ink']
                    . '" stroke-width="0.7" stroke-linejoin="round"/>';
        }

        // Sarkantyú
        if (!empty($p['spur'])) {
            $claws .= '<path d="M' . fmt($ankle[0] + 1.4) . ',' . fmt($ankle[1] - 1.2)
                    . 'L' . fmt($ankle[0] + 5.2) . ',' . fmt($ankle[1] + 1.4)
                    . 'L' . fmt($ankle[0] + 1.2) . ',' . fmt($ankle[1] + 2.0) . 'Z" fill="' . $g['light']
                    . '" stroke="' . $g['ink'] . '" stroke-width="0.7" stroke-linejoin="round"/>';
        }

        // Térdhajlat és ínszalag
        $detail .= '<path d="M' . fmt($knee[0] - 3.0 * $k) . ',' . fmt($knee[1])
                 . 'q3,1.8 6,-0.4" fill="none" stroke="' . $g['shadow']
                 . '" stroke-width="0.8" opacity="0.45" stroke-linecap="round"/>';
        $detail .= '<path d="M' . fmt($ankle[0] - 1.6) . ',' . fmt($ankle[1] - 3.0)
                 . 'q1.6,2.4 0.6,4.4" fill="none" stroke="' . $g['shadow']
                 . '" stroke-width="0.7" opacity="0.4" stroke-linecap="round"/>';
    }

    $farLayer = silhouette($id . '-far-clip', $far, $g['dark'], 1.7);

    return '<g id="' . $id . '">'
         . '<defs>' . $farLayer['defs'] . '</defs>'
         . '<g opacity="0.72">' . $farLayer['draw'] . '</g>'
         . assemble($id, $near, 'url(#' . $id . '-volV)', $detail, '', $claws, 1.9)
         . '</g>';
}

/* =====================================================================
   SZÁRNY
   ===================================================================== */

function draw_wings(int $n, array $p): string
{
    $id = "w$n";
    $root = [36.0, 27.0];
    $size = $p['size'];
    $fingers = max(2, (int)$p['fingers']);

    return '<g id="' . $id . '">' . match ($p['shape']) {
        'feather' => wing_feather_m($id, $root, $size, $fingers),
        'insect'  => wing_insect_m($id, $root, $size),
        'fin'     => wing_fin_m($id, $root, $size, $fingers),
        'crystal' => wing_crystal_m($id, $root, $size, $fingers),
        'double'  => wing_bat_m($id . '-b', [$root[0] + 3.4, $root[1] + 5.4], $size * 0.72, $fingers, false, true)
                   . wing_bat_m($id . '-a', $root, $size * 0.92, $fingers, false),
        'torn'    => wing_bat_m($id, $root, $size, $fingers, true),
        default   => wing_bat_m($id, $root, $size, $fingers, false),
    } . '</g>';
}

/**
 * Sugarak legyezőben, a tőből. Az uszony- és kristályszárnyé — azoknál
 * tényleg a tőből indul minden sugár. A bőrszárny NEM ilyen: ott a
 * membránt egy csuklóból szétnyíló ujjköteg feszíti, lásd wing_frame().
 */
function wing_tips(array $root, float $size, int $fingers, float $reach = 24.0): array
{
    $tips = [];
    $d = max(1, $fingers - 1);
    for ($i = 0; $i < $fingers; $i++) {
        $a = -1.30 + 1.55 * $i / $d;
        $len = $reach * $size * (1.0 - 0.30 * $i / $d);
        $tips[] = [$root[0] + cos($a) * $len, $root[1] + sin($a) * $len];
    }
    return $tips;
}

/**
 * A bőrszárny váza.
 *
 * Két korábbi zsákutca után:
 *   1. minden ujj a vállból  -> legyező lett, nem szárny
 *   2. fix hosszú ujjak a csuklóból -> elfért a dobozban, de apró lett
 *
 * Itt az ujjhegyek a RAJZTERÜLET PEREMÉRE vetülnek: minden irányban
 * addig nyúlnak, ameddig a 64x64-es viewBox engedi (ellipszis-metszés),
 * és csak a `size` skálázza vissza őket. Így a nagy szárnyak tényleg
 * nagyok, a kicsik meg arányosan kicsik, de egyik sem lóg ki.
 *
 * A felépítés anatómiai: a felkar a vállból fölfelé-hátra ível egy
 * magasan ülő csuklóig, és az ujjak onnan sepernek szét hátra-lefelé.
 */
function wing_frame(array $root, float $size, int $fingers): array
{
    $fingers = max(2, $fingers);
    $d = $fingers - 1;

    $elbow = [$root[0] + 1.4 * $size, $root[1] -  6.2 * $size];
    $wrist = [$root[0] + 7.6 * $size, $root[1] - 12.4 * $size];

    // Meddig mehetünk a csuklóból? (2 egység szegélyt hagyva)
    $rx  = max(6.0, 62.0 - $wrist[0]);
    $ryU = max(6.0, $wrist[1] -  1.5);
    $ryD = max(6.0, 46.0 - $wrist[1]);

    // 0.55-ös szárny ~0.77, az 1.25-ös 1.0 arányban tölti ki a helyet
    $fill = 0.58 + 0.34 * $size;

    $tips = [];
    for ($i = 0; $i < $fingers; $i++) {
        $a  = -0.70 + 2.16 * $i / $d;
        $ca = cos($a);
        $sa = sin($a);
        $ry = $sa < 0 ? $ryU : $ryD;
        // Az irányhoz tartozó peremtávolság
        $L  = 1.0 / sqrt(($ca / $rx) ** 2 + ($sa / $ry) ** 2);
        $L *= $fill * (1.0 - 0.06 * $i / $d);
        $tips[] = [$wrist[0] + $ca * $L, $wrist[1] + $sa * $L];
    }

    // A vitorla hátsó sarka: a háton ül, oda fut le a szegélye
    $heel = [$root[0] + 1.0, $root[1] + 6.0 * $size];

    return ['elbow' => $elbow, 'wrist' => $wrist, 'tips' => $tips, 'heel' => $heel];
}

/**
 * Bőrszárny.
 *
 * Rétegek alulról: membrán -> panelárnyékok -> csontváz (felkar + ujjak)
 * -> karom. A membrán szegélye az ujjhegyek között BEHÚZÓDIK a csukló
 * felé; ettől lesz csipkés a kontúr a korábbi egyenes szakaszok helyett.
 *
 * $plain: csak a vitorla, csontváz és karom nélkül. A kettős szárny
 * HÁTSÓ lebenyéhez kell — ott a második csontváz sűrű fekete pókhálót
 * rajzolt az elsőre. Távolabbi szárny amúgy sem mutatja a bordáit.
 */
function wing_bat_m(string $id, array $root, float $size, int $fingers,
                    bool $torn, bool $plain = false): string
{
    $g = DG;
    $f = wing_frame($root, $size, $fingers);
    $tips  = $f['tips'];
    $elbow = $f['elbow'];
    $wrist = $f['wrist'];
    $heel  = $f['heel'];
    $last  = count($tips) - 1;

    /* --- Membrán --- */
    // Vezetőél: váll -> felkar-ív -> csukló -> első ujjhegy
    $m = 'M' . fmtp($root)
       . 'Q' . fmtp($elbow) . ' ' . fmtp($wrist)
       . 'Q' . fmt($wrist[0] + ($tips[0][0] - $wrist[0]) * 0.45 - 1.4) . ','
             . fmt($wrist[1] + ($tips[0][1] - $wrist[1]) * 0.45 - 1.4) . ' '
             . fmtp($tips[0]);

    // Csipkeívek: a vezérlőpont a csukló felé húzva -> homorú szegély
    for ($i = 1; $i <= $last; $i++) {
        $a = $tips[$i - 1]; $b = $tips[$i];
        $mx = ($a[0] + $b[0]) / 2;
        $my = ($a[1] + $b[1]) / 2;
        $m .= 'Q' . fmt($mx + ($wrist[0] - $mx) * 0.22) . ','
                  . fmt($my + ($wrist[1] - $my) * 0.22) . ' ' . fmtp($b);
    }

    // Hátsó szegély: utolsó ujjhegy -> sarok -> váll
    $m .= 'Q' . fmt(($tips[$last][0] + $heel[0]) / 2 + 2.6) . ','
              . fmt(($tips[$last][1] + $heel[1]) / 2 + 1.6) . ' ' . fmtp($heel)
        . 'Q' . fmt($root[0] - 1.6) . ',' . fmt($root[1] + 3.4) . ' ' . fmtp($root) . 'Z';

    if ($torn) {
        for ($i = 0; $i < $last; $i++) {
            $a = $tips[$i]; $b = $tips[$i + 1];
            $c = [($a[0] + $b[0]) / 2, ($a[1] + $b[1]) / 2];
            $m .= 'M' . fmt($c[0] + 0.6) . ',' . fmt($c[1] + 0.6)
                . 'L' . fmt($c[0] + ($wrist[0] - $c[0]) * 0.55) . ','
                      . fmt($c[1] + ($wrist[1] - $c[1]) * 0.55)
                . 'L' . fmt($c[0] - 0.8) . ',' . fmt($c[1] + 3.4 * $size) . 'Z';
        }
    }

    // Panelenkénti árnyalás: enélkül a membrán egyetlen lapos folt
    $panels = '';
    foreach ($tips as $t) {
        $panels .= 'M' . fmtp($wrist) . 'L' . fmtp($t);
    }
    $panels .= 'M' . fmtp($root) . 'L' . fmtp($wrist);

    if ($plain) {
        return '<path d="' . $m . '" fill-rule="evenodd" fill="' . $g['mid'] . '" stroke="' . $g['ink']
             . '" stroke-width="1.2" stroke-linejoin="round" opacity="0.9"/>';
    }

    $membrane = '<defs><clipPath id="' . $id . '-mclip"><path d="' . $m . '" clip-rule="evenodd"/></clipPath></defs>'
        . '<path d="' . $m . '" fill-rule="evenodd" fill="url(#' . $id . '-membrane)" stroke="' . $g['ink']
        . '" stroke-width="1.6" stroke-linejoin="round"/>'
        . '<g clip-path="url(#' . $id . '-mclip)">'
        . '<path d="' . $m . '" fill-rule="evenodd" fill="none" stroke="' . $g['ink']
        . '" stroke-width="5" opacity="0.10"/>'
        . '<path d="' . $panels . '" fill="none" stroke="' . $g['shadow']
        . '" stroke-width="2.2" opacity="0.13"/>'
        . '<path d="' . $panels . '" fill="none" stroke="' . $g['bright']
        . '" stroke-width="0.6" opacity="0.4"/>'
        . '</g>';

    /* --- Csontváz: a felkar és az ujjak saját tömegként --- */
    $armSp = spine([[
        $root,
        [$root[0] + 1.0 * $size, $root[1] - 4.0 * $size],
        [$elbow[0] + 1.0 * $size, $elbow[1] - 2.0 * $size],
        $wrist,
    ]], 10);
    $bones = [outline_path($armSp, wsteps([2.6 * $size, 1.9 * $size, 1.5 * $size]), true, true)];

    foreach ($tips as $i => $t) {
        // Az ujjak enyhén hátrahajlanak — az egyenes pálcika merev
        $bend = 1.6 * $size * (1.0 - $i / max(1, $last));
        $sp = spine([[
            $wrist,
            [$wrist[0] + ($t[0] - $wrist[0]) * 0.35 + $bend,
             $wrist[1] + ($t[1] - $wrist[1]) * 0.35 - $bend],
            [$wrist[0] + ($t[0] - $wrist[0]) * 0.72 + $bend * 0.5,
             $wrist[1] + ($t[1] - $wrist[1]) * 0.72 - $bend * 0.5],
            $t,
        ]], 10);
        $bones[] = outline_path($sp, wsteps([1.55 * $size, 1.0 * $size, 0.42 * $size]), true, true);
    }

    // Hüvelykkarom a csuklón
    $claw = '<path d="M' . fmt($wrist[0] - 0.8) . ',' . fmt($wrist[1] - 1.4)
          . 'Q' . fmt($wrist[0] + 1.8) . ',' . fmt($wrist[1] - 3.4) . ' '
          . fmt($wrist[0] + 3.2) . ',' . fmt($wrist[1] - 4.8)
          . 'Q' . fmt($wrist[0] + 1.6) . ',' . fmt($wrist[1] - 2.2) . ' '
          . fmt($wrist[0] + 1.3) . ',' . fmt($wrist[1] - 0.4) . 'Z" fill="' . $g['bright']
          . '" stroke="' . $g['ink'] . '" stroke-width="0.7" stroke-linejoin="round"/>';

    // Vékony körvonal: 1.3-nál a tinta többet foglalt, mint maga a csont,
    // és a szárny fekete kuszaságnak látszott a színezett sárkányon.
    return $membrane . assemble($id . '-arm', $bones, 'url(#' . $id . '-vol)', '', '', $claw, 0.85);
}

/** Tollas szárny: egymásra csúsztatott tollak, saját árnyékkal. */
function wing_feather_m(string $id, array $root, float $size, int $fingers): string
{
    $g = DG;
    $count = max(6, $fingers + 2);
    $shapes = [];

    for ($i = $count - 1; $i >= 0; $i--) {
        $a = -1.44 + 1.30 * $i / ($count - 1);
        $len = 27.0 * $size * (1.0 - 0.17 * $i / ($count - 1));
        $tip = [$root[0] + cos($a) * $len, $root[1] + sin($a) * $len];
        $shapes[] = teardrop($root[0], $root[1], $tip[0], $tip[1], 3.2 * $size, 0.55);
    }

    $shoulder = ellipse_path($root[0], $root[1], 3.4 * $size, 3.0 * $size, 0);

    // Tollanként külön körvonal, hogy elváljanak egymástól
    $out = '';
    foreach ($shapes as $s) {
        $out .= '<path d="' . $s . '" fill="url(#' . $id . '-membrane)" stroke="' . $g['ink']
              . '" stroke-width="1.1" stroke-linejoin="round"/>';
    }
    // A szárnytőnél nem korong van, hanem a tollak alá bújó izomtömeg
    return '<path d="' . $shoulder . '" fill="' . $g['dark'] . '" stroke="' . $g['ink']
         . '" stroke-width="1.2" stroke-linejoin="round"/>' . $out;
}

/** Rovarszárny: két áttetsző lebeny, sűrű erezettel. */
function wing_insect_m(string $id, array $root, float $size): string
{
    $g = DG;
    $lobes = $veins = '';

    foreach ([[-1.28, 26.0, 6.6], [-0.58, 20.5, 5.4]] as [$a, $len, $w]) {
        $L = $len * $size;
        $tip = [$root[0] + cos($a) * $L, $root[1] + sin($a) * $L];
        $lobes .= teardrop($root[0], $root[1], $tip[0], $tip[1], $w * $size, 0.5);

        for ($i = 1; $i <= 4; $i++) {
            $f = $i / 5;
            $veins .= 'M' . fmtp($root) . 'Q'
                    . fmt($root[0] + ($tip[0] - $root[0]) * 0.55 - sin($a) * $w * $size * (0.7 - $f)) . ','
                    . fmt($root[1] + ($tip[1] - $root[1]) * 0.55 + cos($a) * $w * $size * (0.7 - $f)) . ' '
                    . fmt($root[0] + ($tip[0] - $root[0]) * (0.5 + $f * 0.5)) . ','
                    . fmt($root[1] + ($tip[1] - $root[1]) * (0.5 + $f * 0.5));
        }
    }

    return '<path d="' . $lobes . '" fill="url(#' . $id . '-membrane)" opacity="0.8" stroke="' . $g['ink']
         . '" stroke-width="1.3" stroke-linejoin="round"/>'
         . '<path d="' . $veins . '" fill="none" stroke="' . $g['bright'] . '" stroke-width="0.5" opacity="0.65"/>';
}

/** Uszonyszárny: rövid, széles, vaskos sugarakkal. */
function wing_fin_m(string $id, array $root, float $size, int $fingers): string
{
    $g = DG;
    $tips = wing_tips($root, $size, max(3, $fingers), 16.0);

    $m = 'M' . fmtp($root) . 'Q' . fmt($root[0] - 1.2) . ',' . fmt($root[1] - 10.0 * $size) . ' ' . fmtp($tips[0]);
    for ($i = 1; $i < count($tips); $i++) {
        $a = $tips[$i - 1]; $b = $tips[$i];
        $mx = ($a[0] + $b[0]) / 2 - ($b[1] - $a[1]) * 0.3;
        $my = ($a[1] + $b[1]) / 2 + ($b[0] - $a[0]) * 0.3;
        $m .= 'Q' . fmt($mx) . ',' . fmt($my) . ' ' . fmtp($b);
    }
    $m .= 'Z';

    $rays = [];
    foreach ($tips as $t) {
        $sp = spine([[$root, [$root[0] + 1, $root[1] - 2], [$t[0], $t[1] + 2], $t]], 6);
        $rays[] = outline_path($sp, wsteps([1.6 * $size, 1.0 * $size, 0.5 * $size]), true, true);
    }

    return '<path d="' . $m . '" fill="url(#' . $id . '-membrane)" stroke="' . $g['ink']
         . '" stroke-width="1.5" stroke-linejoin="round"/>'
         . assemble($id . '-rays', $rays, $g['light'], '', '', '', 1.2);
}

/** Kristályszárny: csiszolt lapok, élükön csillanással. */
function wing_crystal_m(string $id, array $root, float $size, int $fingers): string
{
    $g = DG;
    $tips = wing_tips($root, $size, max(3, $fingers), 23.5);

    $facets = '';
    foreach ($tips as $i => $t) {
        $prev = $i > 0 ? $tips[$i - 1] : [$root[0] - 2, $root[1] - 8 * $size];
        $mid = [($root[0] + $prev[0] + $t[0]) / 3 + 1.4, ($root[1] + $prev[1] + $t[1]) / 3];
        $facets .= 'M' . fmtp($root) . 'L' . fmtp($prev) . 'L' . fmtp($mid) . 'L' . fmtp($t) . 'Z';
    }

    $edges = '';
    foreach ($tips as $t) $edges .= 'M' . fmtp($root) . 'L' . fmtp($t);

    return '<path d="' . $facets . '" fill="url(#' . $id . '-membrane)" stroke="' . $g['ink']
         . '" stroke-width="1.4" stroke-linejoin="round"/>'
         . '<path d="' . $edges . '" fill="none" stroke="' . $g['spec'] . '" stroke-width="0.9" opacity="0.7"/>';
}
