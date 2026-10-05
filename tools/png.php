<?php
/**
 * Minimális, tiszta PHP PNG olvasó/író.
 *
 * A GD kiterjesztés nincs bekapcsolva ezen a gépen, viszont a zlib igen —
 * a PNG pedig nem más, mint zlib-tömörített, soronként szűrt képpontsor.
 * Csak azt kezeli, amire itt szükség van: 8 bites RGBA, nem interlace-elt.
 */

/** Egy dekódolt kép: szélesség, magasság és RGBA bájtok. */
final class Bitmap
{
    public int $w;
    public int $h;
    /** @var array<int,float> r,g,b,a csatornánként, 0..1 */
    public array $r = [];
    public array $g = [];
    public array $b = [];
    public array $a = [];

    public function __construct(int $w, int $h)
    {
        $this->w = $w;
        $this->h = $h;
        $n = $w * $h;
        $this->r = array_fill(0, $n, 0.0);
        $this->g = array_fill(0, $n, 0.0);
        $this->b = array_fill(0, $n, 0.0);
        $this->a = array_fill(0, $n, 0.0);
    }

    public function idx(int $x, int $y): int
    {
        return $y * $this->w + $x;
    }
}

/**
 * PNG beolvasása Bitmap-be.
 */
function png_read(string $path): Bitmap
{
    $data = file_get_contents($path);
    if ($data === false || substr($data, 0, 8) !== "\x89PNG\r\n\x1a\n") {
        throw new RuntimeException("Nem PNG: $path");
    }

    $pos  = 8;
    $idat = '';
    $w = $h = 0;
    $bit = $color = $interlace = 0;

    while ($pos + 8 <= strlen($data)) {
        $len  = unpack('N', substr($data, $pos, 4))[1];
        $type = substr($data, $pos + 4, 4);
        $body = substr($data, $pos + 8, $len);
        $pos += 12 + $len;

        if ($type === 'IHDR') {
            $ihdr = unpack('Nw/Nh/Cbit/Ccolor/Ccomp/Cfilter/Cinterlace', $body);
            $w = $ihdr['w'];
            $h = $ihdr['h'];
            $bit = $ihdr['bit'];
            $color = $ihdr['color'];
            $interlace = $ihdr['interlace'];
        } elseif ($type === 'IDAT') {
            $idat .= $body;
        } elseif ($type === 'IEND') {
            break;
        }
    }

    if ($bit !== 8 || $color !== 6 || $interlace !== 0) {
        throw new RuntimeException("Csak 8 bites, nem interlace-elt RGBA támogatott ($path)");
    }

    $raw = @zlib_decode($idat);
    if ($raw === false) {
        throw new RuntimeException("Hibás IDAT: $path");
    }

    $bpp    = 4;                       // bájt/képpont
    $stride = $w * $bpp;
    $img    = new Bitmap($w, $h);
    $prev   = array_fill(0, $stride, 0);

    $p = 0;
    for ($y = 0; $y < $h; $y++) {
        $filter = ord($raw[$p++]);
        $line   = array_values(unpack('C*', substr($raw, $p, $stride)));
        $p += $stride;

        // A PNG soronkénti előrejelző szűrőinek visszafejtése
        for ($i = 0; $i < $stride; $i++) {
            $a = $i >= $bpp ? $line[$i - $bpp] : 0;   // bal
            $b = $prev[$i];                            // fent
            $c = $i >= $bpp ? $prev[$i - $bpp] : 0;    // bal-fent

            $x = $line[$i];
            switch ($filter) {
                case 0: break;                              // None
                case 1: $x = ($x + $a) & 0xFF; break;       // Sub
                case 2: $x = ($x + $b) & 0xFF; break;       // Up
                case 3: $x = ($x + (($a + $b) >> 1)) & 0xFF; break; // Average
                case 4:                                     // Paeth
                    $pp = $a + $b - $c;
                    $pa = abs($pp - $a);
                    $pb = abs($pp - $b);
                    $pc = abs($pp - $c);
                    $pr = ($pa <= $pb && $pa <= $pc) ? $a : (($pb <= $pc) ? $b : $c);
                    $x = ($x + $pr) & 0xFF;
                    break;
                default:
                    throw new RuntimeException("Ismeretlen sorszűrő: $filter");
            }
            $line[$i] = $x;
        }
        $prev = $line;

        for ($x = 0; $x < $w; $x++) {
            $i = $y * $w + $x;
            $o = $x * 4;
            $img->r[$i] = $line[$o]     / 255;
            $img->g[$i] = $line[$o + 1] / 255;
            $img->b[$i] = $line[$o + 2] / 255;
            $img->a[$i] = $line[$o + 3] / 255;
        }
    }

    return $img;
}

/**
 * Bitmap kiírása 8 bites RGBA PNG-ként.
 */
function png_write(Bitmap $img, string $path): void
{
    $raw = '';
    for ($y = 0; $y < $img->h; $y++) {
        $raw .= "\x00";                  // szűrő: None (a zlib így is jól tömöríti)
        $line = '';
        for ($x = 0; $x < $img->w; $x++) {
            $i = $y * $img->w + $x;
            $line .= chr(_clamp255($img->r[$i]))
                   . chr(_clamp255($img->g[$i]))
                   . chr(_clamp255($img->b[$i]))
                   . chr(_clamp255($img->a[$i]));
        }
        $raw .= $line;
    }

    $ihdr = pack('NNCCCCC', $img->w, $img->h, 8, 6, 0, 0, 0);

    $png  = "\x89PNG\r\n\x1a\n";
    $png .= _png_chunk('IHDR', $ihdr);
    $png .= _png_chunk('IDAT', zlib_encode($raw, ZLIB_ENCODING_DEFLATE, 9));
    $png .= _png_chunk('IEND', '');

    file_put_contents($path, $png);
}

function _clamp255(float $v): int
{
    $n = (int)round($v * 255);
    return $n < 0 ? 0 : ($n > 255 ? 255 : $n);
}

function _png_chunk(string $type, string $body): string
{
    return pack('N', strlen($body)) . $type . $body . pack('N', crc32($type . $body));
}
