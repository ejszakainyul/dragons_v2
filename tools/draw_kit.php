<?php
/**
 * Rajzkészlet a testrészekhez: kézzel tervezett formákhoz kis, tömör
 * segédek (sokszög, sima görbe, kúpos szarv, szem, fogsor...).
 *
 * Az árnyalás (körvonal, belső árnyék, peremfény) továbbra is az
 * assemble() dolga — itt csak a FORMÁK születnek. Minden rész a 64-es
 * rácson marad, a csatlakozási pontok változatlanok:
 *
 *     nyak töve (26, 20) · csípők (36, 38) és (50, 38) · szárnytő (36, 27)
 */

/** Sokszög (szögletes). */
function kpoly(array $pts): string
{
    $d = '';
    foreach ($pts as $i => $p) $d .= ($i ? 'L' : 'M') . fmtp($p);
    return $d . 'Z';
}

/** Sima zárt (vagy nyitott) görbe a pontokon át. */
function ksmooth(array $pts, bool $closed = true, float $tension = 1.0): string
{
    return catmull_path($pts, $closed, $tension);
}

/** Nyitott töröttvonal. */
function kline(array $pts): string
{
    $d = '';
    foreach ($pts as $i => $p) $d .= ($i ? 'L' : 'M') . fmtp($p);
    return $d;
}

/** Cső: Bézier-pontsor + vastagságlista (nyak, farok, pofa, lábszár). */
function ktube(array $pts, array $widths, bool $r0 = true, bool $r1 = true, int $per = 14): string
{
    // Ha csak pontokat kaptunk, Catmull-Rom görbén mintavételezünk
    $sp = kspine($pts, $per);
    return outline_path($sp, wsteps($widths), $r0, $r1);
}

/** Pontsor → sűrű gerinc (Catmull-Rom). */
function kspine(array $pts, int $per = 14): array
{
    $n = count($pts);
    if ($n < 2) return $pts;
    $out = [];
    for ($i = 0; $i < $n - 1; $i++) {
        $p0 = $pts[max(0, $i - 1)]; $p1 = $pts[$i]; $p2 = $pts[$i + 1]; $p3 = $pts[min($n - 1, $i + 2)];
        for ($k = ($i ? 1 : 0); $k <= $per; $k++) {
            $t = $k / $per; $t2 = $t * $t; $t3 = $t2 * $t;
            $out[] = [
                0.5 * ((2 * $p1[0]) + (-$p0[0] + $p2[0]) * $t + (2 * $p0[0] - 5 * $p1[0] + 4 * $p2[0] - $p3[0]) * $t2 + (-$p0[0] + 3 * $p1[0] - 3 * $p2[0] + $p3[0]) * $t3),
                0.5 * ((2 * $p1[1]) + (-$p0[1] + $p2[1]) * $t + (2 * $p0[1] - 5 * $p1[1] + 4 * $p2[1] - $p3[1]) * $t2 + (-$p0[1] + 3 * $p1[1] - 3 * $p2[1] + $p3[1]) * $t3),
            ];
        }
    }
    return $out;
}

function kblob(float $cx, float $cy, float $rx, float $ry, float $rot = 0.0): string
{
    return ellipse_path($cx, $cy, $rx, $ry, $rot);
}

/**
 * Kúpos, ívelt szarv/tüske/karom: talp középpontja → hegy.
 * $bend: az ív mértéke a hossz arányában (+ = a haladási irányhoz képest balra).
 */
function khorn(array $base, array $tip, float $w, float $bend = 0.0): string
{
    $dx = $tip[0] - $base[0]; $dy = $tip[1] - $base[1];
    $len = sqrt($dx * $dx + $dy * $dy) ?: 1;
    $tx = $dx / $len; $ty = $dy / $len; $nx = -$ty; $ny = $tx;
    $m = [$base[0] + $dx * 0.5 + $nx * $bend * $len, $base[1] + $dy * 0.5 + $ny * $bend * $len];
    $a = [$base[0] + $nx * $w / 2, $base[1] + $ny * $w / 2];
    $b = [$base[0] - $nx * $w / 2, $base[1] - $ny * $w / 2];
    $ma = [$m[0] + $nx * $w * 0.32, $m[1] + $ny * $w * 0.32];
    $mb = [$m[0] - $nx * $w * 0.32, $m[1] - $ny * $w * 0.32];
    return 'M' . fmtp($a) . 'Q' . fmtp($ma) . ' ' . fmtp($tip) . 'Q' . fmtp($mb) . ' ' . fmtp($b) . 'Z';
}

/** Gyűrűk keresztben a szarvon (barázdák). */
function khorn_rings(array $base, array $tip, float $w, float $bend, int $n, float $from = 0.15, float $to = 0.7): string
{
    $dx = $tip[0] - $base[0]; $dy = $tip[1] - $base[1];
    $len = sqrt($dx * $dx + $dy * $dy) ?: 1;
    $tx = $dx / $len; $ty = $dy / $len; $nx = -$ty; $ny = $tx;
    $d = '';
    for ($i = 0; $i < $n; $i++) {
        $t = $from + ($to - $from) * ($n > 1 ? $i / ($n - 1) : 0);
        // a quadratic Bézier középvonal közelítése
        $mx = $base[0] + $dx * 0.5 + $nx * $bend * $len; $my = $base[1] + $dy * 0.5 + $ny * $bend * $len;
        $u = 1 - $t;
        $cx = $u * $u * $base[0] + 2 * $u * $t * $mx + $t * $t * $tip[0];
        $cy = $u * $u * $base[1] + 2 * $u * $t * $my + $t * $t * $tip[1];
        $hw = $w / 2 * (1 - $t) * 0.95;
        $d .= 'M' . fmt($cx + $nx * $hw) . ',' . fmt($cy + $ny * $hw) . 'L' . fmt($cx - $nx * $hw) . ',' . fmt($cy - $ny * $hw);
    }
    return $d;
}

/** Kristályszilánk: négyszög hegyes véggel, két lappal. */
function kshard(array $base, array $tip, float $w): string
{
    $dx = $tip[0] - $base[0]; $dy = $tip[1] - $base[1];
    $len = sqrt($dx * $dx + $dy * $dy) ?: 1;
    $nx = -$dy / $len; $ny = $dx / $len;
    $sh = [$base[0] + $dx * 0.72, $base[1] + $dy * 0.72];
    return kpoly([
        [$base[0] + $nx * $w / 2, $base[1] + $ny * $w / 2],
        [$sh[0] + $nx * $w / 2, $sh[1] + $ny * $w / 2],
        $tip,
        [$sh[0] - $nx * $w / 2, $sh[1] - $ny * $w / 2],
        [$base[0] - $nx * $w / 2, $base[1] - $ny * $w / 2],
    ]);
}

/** Szilánk világos (napos) fele — a fazetta. */
function kshard_lit(array $base, array $tip, float $w): string
{
    $dx = $tip[0] - $base[0]; $dy = $tip[1] - $base[1];
    $len = sqrt($dx * $dx + $dy * $dy) ?: 1;
    $nx = -$dy / $len; $ny = $dx / $len;
    $sh = [$base[0] + $dx * 0.72, $base[1] + $dy * 0.72];
    // a bal-felső (fény felőli) oldal
    $s = ($nx * -1 + $ny * -1) > 0 ? 1 : -1;
    return kpoly([
        $base, [$base[0] + $s * $nx * $w / 2, $base[1] + $s * $ny * $w / 2],
        [$sh[0] + $s * $nx * $w / 2, $sh[1] + $s * $ny * $w / 2], $tip,
    ]);
}

/** Lángnyelv / hajtincs: S-ívű, kihegyesedő forma. */
function kflame(array $base, array $tip, float $w, float $wave = 0.22): string
{
    $dx = $tip[0] - $base[0]; $dy = $tip[1] - $base[1];
    $len = sqrt($dx * $dx + $dy * $dy) ?: 1;
    $nx = -$dy / $len; $ny = $dx / $len;
    $p = fn(float $t, float $off) => [$base[0] + $dx * $t + $nx * $off, $base[1] + $dy * $t + $ny * $off];
    $wv = $wave * $len;
    return ksmooth([
        $p(0, $w / 2), $p(0.3, $w * 0.55 + $wv * 0.6), $p(0.62, $w * 0.3 - $wv * 0.5), $tip,
        $p(0.62, -$w * 0.25 - $wv * 0.5), $p(0.3, -$w * 0.45 + $wv * 0.6), $p(0, -$w / 2),
    ], true, 0.9);
}

/** Toll / levél: csepp alak középérrel (a teardrop() a svglib-ben). */
function kleaf(array $base, array $tip, float $w, float $bulge = 0.4): string
{
    return teardrop($base[0], $base[1], $tip[0], $tip[1], $w, $bulge);
}

/* ---------------------------------------------------------------------
   Elemek (kész SVG-darabok)
   --------------------------------------------------------------------- */

function kfill(string $d, string $fill, float $op = 1.0, ?string $stroke = null, float $sw = 0.8, string $extra = ''): string
{
    if ($d === '') return '';
    return '<path d="' . $d . '" fill="' . $fill . '"'
        . ($op < 1 ? ' opacity="' . fmt($op) . '"' : '')
        . ($stroke ? ' stroke="' . $stroke . '" stroke-width="' . fmt($sw) . '" stroke-linejoin="round" stroke-linecap="round"' : '')
        . $extra . '/>';
}

function kstroke(string $d, string $col, float $w, float $op = 1.0, string $extra = ''): string
{
    if ($d === '') return '';
    return '<path d="' . $d . '" fill="none" stroke="' . $col . '" stroke-width="' . fmt($w) . '"'
        . ($op < 1 ? ' opacity="' . fmt($op) . '"' : '')
        . ' stroke-linecap="round" stroke-linejoin="round"' . $extra . '/>';
}

/**
 * Önálló, tintával körvonalazott díszelem (szarv, karom, tüske), lágy
 * hosszanti árnyalással: a hegye felé sötétedik.
 */
function kpiece(string $d, string $fill, float $sw = 1.3): string
{
    return kfill($d, DG['ink'], 1, DG['ink'], $sw) . kfill($d, $fill);
}

/**
 * Szem. Stílusok: normal, cute, fierce, slit, glow, narrow, sleepy, hollow.
 */
function keye(float $x, float $y, float $r, string $style = 'normal'): string
{
    $g = DG;
    $ink = $g['ink'];
    $out = '';
    switch ($style) {
        case 'hollow':
            return kfill(kblob($x, $y, $r * 1.7, $r * 1.45, -0.15), $ink)
                 . kfill(kblob($x - $r * 0.15, $y + $r * 0.1, $r * 0.42, $r * 0.42), $g['spec'], 0.95)
                 . kfill(kblob($x - $r * 0.15, $y + $r * 0.1, $r * 0.9, $r * 0.9), $g['spec'], 0.18);

        case 'cute':
            $out .= kfill(kblob($x, $y, $r * 1.05, $r * 1.15), $g['spec'], 1, $ink, 0.7);
            $out .= kfill(kblob($x - $r * 0.15, $y + $r * 0.12, $r * 0.7, $r * 0.82), $ink);
            $out .= kfill(kblob($x - $r * 0.42, $y - $r * 0.3, $r * 0.3, $r * 0.3), $g['spec']);
            $out .= kfill(kblob($x + $r * 0.12, $y + $r * 0.42, $r * 0.14, $r * 0.14), $g['spec']);
            return $out;

        case 'slit':
            $out .= kfill(kblob($x, $y, $r * 1.25, $r * 0.95, -0.12), $g['bright'], 1, $ink, 0.7);
            $out .= kfill(kblob($x, $y, $r * 0.2, $r * 0.88), $ink);
            $out .= kfill(kblob($x - $r * 0.55, $y - $r * 0.35, $r * 0.22, $r * 0.22), $g['spec']);
            return $out;

        case 'glow':
            $out .= kfill(kblob($x, $y, $r * 2.2, $r * 1.8), $g['spec'], 0.22);
            $out .= kfill(kblob($x, $y, $r * 1.25, $r * 0.95, -0.12), $g['spec'], 1, $ink, 0.7);
            $out .= kfill(kblob($x, $y, $r * 0.38, $r * 0.38), $g['dark']);
            return $out;

        case 'narrow':
            $out .= kfill('M' . fmt($x - $r * 1.6) . ',' . fmt($y + $r * 0.2)
                . 'Q' . fmt($x) . ',' . fmt($y - $r * 1.0) . ' ' . fmt($x + $r * 1.5) . ',' . fmt($y - $r * 0.25)
                . 'Q' . fmt($x) . ',' . fmt($y + $r * 0.9) . ' ' . fmt($x - $r * 1.6) . ',' . fmt($y + $r * 0.2) . 'Z',
                $g['spec'], 1, $ink, 0.7);
            $out .= kfill(kblob($x - $r * 0.1, $y - $r * 0.05, $r * 0.24, $r * 0.62), $ink);
            return $out;

        case 'sleepy':
            $out .= kfill(kblob($x, $y, $r * 1.2, $r * 0.95), $g['spec'], 1, $ink, 0.7);
            $out .= kfill(kblob($x - $r * 0.2, $y + $r * 0.2, $r * 0.42, $r * 0.62), $ink);
            // nehéz szemhéj
            $out .= kfill('M' . fmt($x - $r * 1.35) . ',' . fmt($y + $r * 0.1)
                . 'Q' . fmt($x) . ',' . fmt($y - $r * 1.6) . ' ' . fmt($x + $r * 1.35) . ',' . fmt($y - $r * 0.1)
                . 'Q' . fmt($x) . ',' . fmt($y - $r * 0.15) . ' ' . fmt($x - $r * 1.35) . ',' . fmt($y + $r * 0.1) . 'Z',
                $g['light'], 1, $ink, 0.6);
            return $out;

        default: // normal, fierce
            $out .= kfill(kblob($x, $y, $r * 1.2, $r * 1.0, -0.1), $g['spec'], 1, $ink, 0.7);
            $out .= kfill(kblob($x - $r * 0.2, $y + $r * 0.05, $r * 0.36, $r * 0.86), $ink);
            $out .= kfill(kblob($x - $r * 0.6, $y - $r * 0.42, $r * 0.26, $r * 0.26), $g['spec']);
            if ($style === 'fierce') {
                // dühös szemöldökpajzs: ék a szem fölött
                $out .= kfill(kpoly([[$x - $r * 1.7, $y - $r * 1.5], [$x + $r * 1.8, $y - $r * 0.4],
                    [$x + $r * 1.6, $y - $r * 1.6], [$x - $r * 0.6, $y - $r * 2.3]]), $g['dark'], 1, $ink, 0.6);
            }
            return $out;
    }
}

/** Fogsor háromszögekből két pont között ($dir: +1 lefelé, -1 felfelé mutat). */
function kteeth(array $a, array $b, int $n, float $h, int $dir = 1, float $taper = 0.4): string
{
    $d = '';
    for ($i = 0; $i < $n; $i++) {
        $f = $n > 1 ? $i / ($n - 1) : 0.5;
        $x = $a[0] + ($b[0] - $a[0]) * $f;
        $y = $a[1] + ($b[1] - $a[1]) * $f;
        $hh = $h * (1 - $taper * $f);
        $w = 0.75 + 0.25 * (1 - $f);
        $d .= 'M' . fmt($x - $w) . ',' . fmt($y) . 'L' . fmt($x) . ',' . fmt($y + $dir * $hh) . 'L' . fmt($x + $w) . ',' . fmt($y) . 'Z';
    }
    return kfill($d, DG['spec'], 1, DG['ink'], 0.45);
}

/** Pikkelyívek egy sávban (díszítés a sziluetten belül). */
function kscale_rows(float $x0, float $y0, float $x1, float $y1, int $cols, int $rows, float $size, string $col, float $op): string
{
    $d = '';
    for ($r = 0; $r < $rows; $r++) {
        for ($c = 0; $c < $cols; $c++) {
            $fx = ($c + ($r % 2) * 0.5) / max(1, $cols);
            $x = $x0 + ($x1 - $x0) * $fx;
            $y = $y0 + ($y1 - $y0) * ($rows > 1 ? $r / ($rows - 1) : 0);
            $d .= 'M' . fmt($x - $size) . ',' . fmt($y) . 'q' . fmt($size) . ',' . fmt($size * 1.2) . ' ' . fmt($size * 2) . ',0';
        }
    }
    return kstroke($d, $col, 0.5, $op);
}

/**
 * Világos hasoldal: a sziluetten belül egy sáv az alsó peremen, rajta
 * keresztirányú hasi pajzsokkal.
 */
function kbelly(array $pts, float $w, int $plates, float $op = 0.55): string
{
    $g = DG;
    $sp = kspine($pts, 10);
    $band = outline_path($sp, wsteps([$w * 0.6, $w, $w, $w * 0.6]), true, true);
    $out = kfill($band, $g['bright'], $op);
    $d = '';
    $n = count($sp);
    for ($i = 1; $i < $plates; $i++) {
        $j = (int)round($i / $plates * ($n - 1));
        [$tx, $ty] = tangent_at($sp, $j);
        $nx = -$ty; $ny = $tx;
        $c = $sp[$j];
        $d .= 'M' . fmt($c[0] - $nx * $w) . ',' . fmt($c[1] - $ny * $w) . 'L' . fmt($c[0] + $nx * $w) . ',' . fmt($c[1] + $ny * $w);
    }
    return $out . kstroke($d, $g['dark'], 0.5, 0.45);
}
