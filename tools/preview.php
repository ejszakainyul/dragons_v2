<?php
/**
 * Fejlesztői előnézet a testrész-grafikákhoz.
 *
 *   ?dir=svg&ext=svg        — a vektoros készlet (alapértelmezés)
 *   ?mix=1                  — véletlen keverékek (a műhelyben ilyenek jönnek ki)
 *   ?part=head              — csak egy résztípus összes változata
 *
 * Egymásra rakva mutatja a rétegeket, ugyanabban a sorrendben, mint az oldal,
 * és színezve is — így egy képernyőn látszik, hogy illeszkednek-e.
 */
$dir  = preg_replace('/[^a-z0-9_\/]/i', '', $_GET['dir'] ?? 'svg');
$ext  = preg_replace('/[^a-z0-9]/i', '', $_GET['ext'] ?? 'svg');
$mix  = !empty($_GET['mix']);
$only = preg_replace('/[^a-z]/', '', $_GET['part'] ?? '');

$base = $dir === '' ? '../dragons' : "../dragons/$dir";
$layers = ['body', 'legs', 'head', 'wings'];

/** Hány változat van? A fájlok alapján. */
$ids = [];
foreach (glob(__DIR__ . "/$base/body[[]*[]].$ext") as $f) {
    if (preg_match('/\[(\d+)\]/', basename($f), $m)) $ids[] = (int)$m[1];
}
sort($ids);
if (!$ids) $ids = range(1, 9);

$colors = ['#ff8a3d', '#4fd6ff', '#9d7bff', '#2dd4a7', '#ffc46b', '#ff5d6c',
           '#bcd9ff', '#e2e2e2', '#8fd14f', '#ff9ecd', '#7ce7ff', '#c9b6ff'];

function matrix(string $hex): string {
    $h = ltrim($hex, '#');
    $c = fn($i) => min(1, hexdec(substr($h, $i, 2)) / 255 * 1.3);
    return sprintf('%.3f 0 0 0 0  0 %.3f 0 0 0  0 0 %.3f 0 0  0 0 0 1 0', $c(0), $c(2), $c(4));
}

/** A megjelenítendő kombinációk listája. */
$rows = [];
if ($only) {
    foreach ($ids as $n) $rows[] = ['label' => "$only $n", 'parts' => [$only => $n]];
} elseif ($mix) {
    mt_srand(4242);                                    // ismételhető keverék
    for ($i = 0; $i < 24; $i++) {
        $p = [];
        foreach ($layers as $l) $p[$l] = $ids[mt_rand(0, count($ids) - 1)];
        $rows[] = ['label' => implode('/', $p), 'parts' => $p];
    }
} else {
    foreach ($ids as $n) {
        $rows[] = ['label' => "szett $n", 'parts' => array_fill_keys($layers, $n)];
    }
}
?>
<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<title>Testrész-előnézet — <?= htmlspecialchars("$dir/*.$ext") ?></title>
<style>
  body { margin:0; padding:24px; background:#0b1020; color:#e9eefb; font-family:system-ui,sans-serif; }
  h1 { font-size:1.05rem; margin:0 0 4px; }
  p  { color:#97a6c6; font-size:.85rem; margin:0 0 16px; }
  .row { display:flex; gap:12px; align-items:center; margin-bottom:18px; flex-wrap:wrap; font-size:.9rem; }
  a { color:#4fd6ff; }
  .grid { display:grid; grid-template-columns:repeat(auto-fill,minmax(190px,1fr)); gap:16px; }
  figure { margin:0; background:#111a30; border:1px solid #23304d; border-radius:14px; padding:10px; }
  .stack { position:relative; aspect-ratio:1; }
  .stack img { position:absolute; inset:0; width:100%; height:100%; object-fit:contain; }
  figcaption { text-align:center; font-size:.74rem; color:#97a6c6; margin-top:6px; }
</style>
</head>
<body>
<h1>Testrész-előnézet — <code><?= htmlspecialchars("dragons/$dir/*.$ext") ?></code> · <?= count($ids) ?> változat</h1>
<p>Rétegsorrend: test → láb → fej → szárny, pont úgy, ahogy az oldal rakja össze.</p>
<div class="row">
  <a href="?dir=svg&amp;ext=svg">SVG szettek</a> ·
  <a href="?dir=svg&amp;ext=svg&amp;mix=1">véletlen keverékek</a> ·
  <?php foreach ($layers as $l): ?>
    <a href="?dir=svg&amp;ext=svg&amp;part=<?= $l ?>"><?= $l ?></a> ·
  <?php endforeach; ?>
  <a href="?dir=hd&amp;ext=png">HD PNG</a> ·
  <a href="?dir=&amp;ext=png">eredeti 64px</a>
</div>

<svg width="0" height="0" style="position:absolute">
  <?php foreach ($colors as $i => $c): ?>
    <filter id="t<?= $i ?>" color-interpolation-filters="sRGB">
      <feColorMatrix type="matrix" values="<?= matrix($c) ?>"/>
    </filter>
  <?php endforeach; ?>
</svg>

<div class="grid">
<?php foreach ($rows as $i => $r): ?>
  <figure>
    <div class="stack" style="filter:url(#t<?= $i % count($colors) ?>)">
      <?php foreach ($layers as $p): if (!isset($r['parts'][$p])) continue; ?>
        <?php $f = "$base/{$p}[{$r['parts'][$p]}].$ext";
              $v = @filemtime(__DIR__ . "/$f") ?: 0; ?>
        <img src="<?= "$f?v=$v" ?>" alt="" loading="lazy">
      <?php endforeach; ?>
    </div>
    <figcaption><?= htmlspecialchars($r['label']) ?></figcaption>
  </figure>
<?php endforeach; ?>
</div>
</body>
</html>
