<?php
/**
 * Nyílt nap — a kódkártyák PDF-ben (külső könyvtár nélkül).
 *
 * Egy A4-es oldal, 4 × 4 vágható kártya: ikon, felirat, nagy kód, a fiók
 * neve és a belépési cím. Betűk: a PDF beépített Helvetica-családja
 * (WinAnsi kódolás), kép: az oldal ikonja (GD-vel, ha elérhető).
 */

/** Helvetica szélességek (1/1000 em) a 32–126 tartományra; ékezetes betűnél az alapbetűé. */
const PDF_HELV = [278,278,355,556,556,889,667,191,333,333,389,584,278,333,278,278,556,556,556,556,556,556,556,556,556,556,
    278,278,584,584,584,556,1015,667,667,722,722,667,611,778,722,278,500,667,556,833,722,778,667,778,722,667,611,722,667,944,
    667,667,611,278,278,278,469,556,333,556,556,500,556,556,278,556,556,222,222,500,222,833,556,556,556,556,333,500,278,556,
    500,722,500,500,500,334,260,334,584];

function pdf_text_width(string $utf8, float $size, bool $bold = false): float
{
    $plain = strtr($utf8, ['á' => 'a', 'é' => 'e', 'í' => 'i', 'ó' => 'o', 'ö' => 'o', 'ő' => 'o', 'ú' => 'u', 'ü' => 'u', 'ű' => 'u',
        'Á' => 'A', 'É' => 'E', 'Í' => 'I', 'Ó' => 'O', 'Ö' => 'O', 'Ő' => 'O', 'Ú' => 'U', 'Ü' => 'U', 'Ű' => 'U', 'ý' => 'y', 'ð' => 'd', '·' => '.', '—' => '-']);
    $w = 0;
    foreach (str_split($plain) as $ch) {
        $o = ord($ch);
        $w += ($o >= 32 && $o <= 126) ? PDF_HELV[$o - 32] : 556;
    }
    return $w * $size / 1000 * ($bold ? 1.06 : 1);
}

/** UTF-8 → WinAnsi, PDF-szövegként escape-elve (ő/ű helyett ö/ü, mert a WinAnsi nem ismeri). */
function pdf_str(string $utf8): string
{
    $utf8 = strtr($utf8, ['ő' => 'ö', 'ű' => 'ü', 'Ő' => 'Ö', 'Ű' => 'Ü', '—' => '-']);
    $s = @iconv('UTF-8', 'CP1252//TRANSLIT', $utf8);
    if ($s === false) $s = preg_replace('/[^\x20-\x7e]/', '?', $utf8);
    return '(' . strtr($s, ['\\' => '\\\\', '(' => '\\(', ')' => '\\)']) . ')';
}

/** Az ikon RGB-képként (fehér háttéren), vagy null, ha nincs GD. */
function pdf_icon(string $file): ?array
{
    if (!function_exists('imagecreatefrompng') || !is_file($file)) return null;
    $src = @imagecreatefrompng($file);
    if (!$src) return null;
    $w = imagesx($src); $h = imagesy($src);
    $dst = imagecreatetruecolor($w, $h);
    imagefill($dst, 0, 0, imagecolorallocate($dst, 255, 255, 255));
    imagealphablending($dst, true);
    imagecopy($dst, $src, 0, 0, 0, 0, $w, $h);
    $raw = '';
    for ($y = 0; $y < $h; $y++) for ($x = 0; $x < $w; $x++) {
        $c = imagecolorat($dst, $x, $y);
        $raw .= chr(($c >> 16) & 255) . chr(($c >> 8) & 255) . chr($c & 255);
    }
    return ['w' => $w, 'h' => $h, 'data' => gzcompress($raw, 9)];
}

/**
 * @param array  $accounts [['code' => '482', 'name' => 'Thor'], …]
 * @param string $entry    a belépési cím
 * @return string a PDF fájl tartalma
 */
function openday_cards_pdf(array $accounts, string $entry): string
{
    $W = 595.28; $H = 841.89; $M = 28;                      // A4, pontban
    $cols = 4; $rows = 4;
    $cw = ($W - 2 * $M) / $cols; $ch = ($H - 2 * $M - 14) / $rows;
    $icon = pdf_icon(APP_ROOT . '/img/icon/icon-192.png');

    $c = [];
    $c[] = 'BT /F1 7 Tf 0.45 g ' . sprintf('%.2f %.2f Td ', $M, $H - $M + 6) . pdf_str('Sárkányok és Vikingek - nyílt nap: belépőkártyák (vágd szét a szaggatott vonalak mentén)') . ' Tj ET';
    // vágóvonalak
    $c[] = '0.7 G 0.5 w [3 3] 0 d';
    for ($i = 0; $i <= $cols; $i++) $c[] = sprintf('%.2f %.2f m %.2f %.2f l S', $M + $i * $cw, $M, $M + $i * $cw, $M + $rows * $ch);
    for ($j = 0; $j <= $rows; $j++) $c[] = sprintf('%.2f %.2f m %.2f %.2f l S', $M, $M + $j * $ch, $M + $cols * $cw, $M + $j * $ch);
    $c[] = '[] 0 d';

    $center = static function (string $txt, float $size, float $cx, float $y, string $font, string $color, bool $bold = false) use (&$c): void {
        $x = $cx - pdf_text_width($txt, $size, $bold) / 2;
        $c[] = sprintf('BT /%s %.1f Tf %s %.2f %.2f Td %s Tj ET', $font, $size, $color, $x, $y, pdf_str($txt));
    };

    foreach (array_values($accounts) as $k => $a) {
        if ($k >= $cols * $rows) break;
        $col = $k % $cols; $row = intdiv($k, $cols);
        $x0 = $M + $col * $cw; $top = $H - $M - 14 - $row * $ch;
        $cx = $x0 + $cw / 2;
        $y = $top - 18;
        if ($icon) {
            $s = 46;
            $c[] = sprintf('q %.2f 0 0 %.2f %.2f %.2f cm /Im1 Do Q', $s, $s, $cx - $s / 2, $y - $s);
            $y -= $s + 12;
        }
        $center('SÁRKÁNYOK ÉS VIKINGEK - NYÍLT NAP', 5.6, $cx, $y, 'F2', '0.48 0.29 0.1 rg', true);
        $y -= 40;
        $center((string)$a['code'], 40, $cx, $y, 'F2', '0.07 g', true);
        $y -= 17;
        $center($a['name'] . ' fiókja', 9, $cx, $y, 'F1', '0.35 g');
        $y -= 16;
        $center('Nyisd meg ezt a címet:', 7, $cx, $y, 'F1', '0.2 g');
        // a cím tördelése a kártya szélességére
        $line = ''; $lines = [];
        foreach (preg_split('/(?<=[\/.?=&])/', $entry) as $part) {
            if ($line !== '' && pdf_text_width($line . $part, 7.2, true) > $cw - 16) { $lines[] = $line; $line = ''; }
            $line .= $part;
        }
        if ($line !== '') $lines[] = $line;
        foreach ($lines as $ln) { $y -= 9; $center($ln, 7.2, $cx, $y, 'F2', '0.1 g', true); }
        $y -= 11;
        $center('és írd be a fenti kódot.', 7, $cx, $y, 'F1', '0.2 g');
    }
    $stream = implode("\n", $c);

    // --- objektumok ---
    $objs = [];
    $objs[1] = '<< /Type /Catalog /Pages 2 0 R >>';
    $objs[2] = '<< /Type /Pages /Kids [3 0 R] /Count 1 >>';
    $res = '/Font << /F1 4 0 R /F2 5 0 R >>' . ($icon ? ' /XObject << /Im1 6 0 R >>' : '');
    $objs[3] = sprintf('<< /Type /Page /Parent 2 0 R /MediaBox [0 0 %.2f %.2f] /Resources << %s >> /Contents 7 0 R >>', $W, $H, $res);
    $objs[4] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica /Encoding /WinAnsiEncoding >>';
    $objs[5] = '<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica-Bold /Encoding /WinAnsiEncoding >>';
    $objs[6] = $icon
        ? sprintf("<< /Type /XObject /Subtype /Image /Width %d /Height %d /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /FlateDecode /Length %d >>\nstream\n%s\nendstream",
            $icon['w'], $icon['h'], strlen($icon['data']), $icon['data'])
        : '<< >>';
    $z = gzcompress($stream, 6);
    $objs[7] = sprintf("<< /Length %d /Filter /FlateDecode >>\nstream\n%s\nendstream", strlen($z), $z);
    $objs[8] = '<< /Title ' . pdf_str('Nyílt nap - kódkártyák') . ' /Producer (Sarkanyok es Vikingek) >>';

    $pdf = "%PDF-1.4\n%\xE2\xE3\xCF\xD3\n";
    $off = [];
    foreach ($objs as $n => $body) { $off[$n] = strlen($pdf); $pdf .= "{$n} 0 obj\n{$body}\nendobj\n"; }
    $xref = strlen($pdf);
    $pdf .= 'xref' . "\n0 " . (count($objs) + 1) . "\n0000000000 65535 f \n";
    foreach ($objs as $n => $_) $pdf .= sprintf("%010d 00000 n \n", $off[$n]);
    $pdf .= 'trailer << /Size ' . (count($objs) + 1) . " /Root 1 0 R /Info 8 0 R >>\nstartxref\n{$xref}\n%%EOF\n";
    return $pdf;
}
