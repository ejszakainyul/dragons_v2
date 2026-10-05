<?php
/**
 * A műhely: testrészekből összerakható sárkány.
 *
 * A korábbi verzió a user_id-t az URL-ből olvasta (*7.384 „kódolással"),
 * így bárki menthetett bárki nevében — most a session dönt, és a mentés
 * CSRF-tokennel védett.
 */
require_once __DIR__ . '/inc/bootstrap.php';
require_login();

$catalog = [
    'fej'    => part_catalog('fej'),
    'szarny' => part_catalog('szarny'),
    'lab'    => part_catalog('lab'),
    'test'   => part_catalog('test'),
];

// A titkos darabok itt nem választhatók
foreach ($catalog as $key => $rows) {
    $catalog[$key] = array_values(array_filter(
        $rows, static fn($r) => (int)$r['id'] !== SECRET_PART_ID
    ));
}

$empty = !array_filter($catalog);

$panels = [
    'fej'    => ['Fejek',    'head',  'list-top-left'],
    'szarny' => ['Szárnyak', 'wings', 'list-top-right'],
    'lab'    => ['Lábak',    'legs',  'list-bottom-left'],
    'test'   => ['Testek',   'body',  'list-bottom-right'],
];

$pageTitle  = 'A műhely — Sárkányok és Vikingek';
$pageStyles = ['style/custom_dragon.css'];
$bodyClass  = 'page-body workshop';
require __DIR__ . '/header.php';
?>

<div class="wrap">
  <header class="section-head" style="margin-bottom:30px">
    <h1>A műhely</h1>
    <p>Húzd a testrészeket a kör közepére — vagy kattints rájuk. A statisztikák azonnal frissülnek.</p>
  </header>

  <?php if ($empty): ?>
    <div class="alert alert-error">
      <span aria-hidden="true">⚠</span>
      <span>A testrész-katalógus üres. Futtasd le az <a href="install.php">install.php</a>-t,
            hogy feltöltse az adatbázist.</span>
    </div>
  <?php else: ?>

  <div class="workshop-layout">

    <!-- ===== Bal oldali listák ===== -->
    <aside class="parts-column">
      <?php foreach (['fej', 'szarny'] as $key):
        [$label, $folder] = $panels[$key]; ?>
        <section class="parts-panel">
          <h2><?= e($label) ?></h2>
          <div class="parts-list" data-slot="<?= e($folder) ?>">
            <?php foreach ($catalog[$key] as $p): ?>
              <button type="button" class="part-item" draggable="true"
                      id="part-<?= e($folder) ?>-<?= (int)$p['id'] ?>"
                      data-slot="<?= e($folder) ?>" data-id="<?= (int)$p['id'] ?>"
                      data-hp="<?= (int)$p['hp'] ?>" data-dmg="<?= (int)$p['dmg'] ?>"
                      title="<?= e($p['nev']) ?>">
                <img src="<?= e(part_src($p['image'])) ?>" alt="" loading="lazy">
                <span class="part-name"><?= e($p['nev']) ?></span>
                <span class="part-meta">❤<?= (int)$p['hp'] ?> ⚔<?= (int)$p['dmg'] ?></span>
              </button>
            <?php endforeach; ?>
          </div>
        </section>
      <?php endforeach; ?>
    </aside>

    <!-- ===== Színpad ===== -->
    <main class="workshop-stage">
      <svg class="tint-def" aria-hidden="true">
        <filter id="workshopTint" color-interpolation-filters="sRGB">
          <feColorMatrix type="matrix" values="1 0 0 0 0  0 1 0 0 0  0 0 1 0 0  0 0 0 1 0"/>
        </filter>
      </svg>

      <div class="dragon-area" id="dragonArea">
        <div class="area-ring" aria-hidden="true"></div>
        <div class="dragon-render" id="dragonImage" style="filter:url(#workshopTint)">
          <img id="slot-body"  alt="" hidden>
          <img id="slot-legs"  alt="" hidden>
          <img id="slot-head"  alt="" hidden>
          <img id="slot-wings" alt="" hidden>
        </div>
        <p class="area-hint" id="areaHint">Húzd ide a testrészeket</p>
      </div>

      <div class="placed-chips" id="placedChips"></div>

      <div class="workshop-stats">
        <div class="wstat">
          <span class="wstat-label">❤ Életerő</span>
          <b id="totalHP">0</b>
          <div class="stat-bar hp"><span id="barHP" style="width:0"></span></div>
        </div>
        <div class="wstat">
          <span class="wstat-label">⚔ Sebzés</span>
          <b id="totalDMG">0</b>
          <div class="stat-bar dmg"><span id="barDMG" style="width:0"></span></div>
        </div>
      </div>

      <form class="workshop-save" id="saveForm">
        <div class="field">
          <label for="dragonName">Sárkány neve</label>
          <input type="text" id="dragonName" maxlength="60" placeholder="pl. Zafír" required>
        </div>
        <div class="field color-field">
          <label for="colorPicker">Szín</label>
          <input type="color" id="colorPicker" value="#ff8a3d">
        </div>
        <button class="btn btn-primary" type="submit" id="saveDragonBtn">Sárkány mentése</button>
        <button class="btn btn-ghost" type="button" id="resetBtn">Újrakezdés</button>
      </form>

      <p class="workshop-msg" id="workshopMsg" hidden></p>
    </main>

    <!-- ===== Jobb oldali listák ===== -->
    <aside class="parts-column">
      <?php foreach (['lab', 'test'] as $key):
        [$label, $folder] = $panels[$key]; ?>
        <section class="parts-panel">
          <h2><?= e($label) ?></h2>
          <div class="parts-list" data-slot="<?= e($folder) ?>">
            <?php foreach ($catalog[$key] as $p): ?>
              <button type="button" class="part-item" draggable="true"
                      id="part-<?= e($folder) ?>-<?= (int)$p['id'] ?>"
                      data-slot="<?= e($folder) ?>" data-id="<?= (int)$p['id'] ?>"
                      data-hp="<?= (int)$p['hp'] ?>" data-dmg="<?= (int)$p['dmg'] ?>"
                      title="<?= e($p['nev']) ?>">
                <img src="<?= e(part_src($p['image'])) ?>" alt="" loading="lazy">
                <span class="part-name"><?= e($p['nev']) ?></span>
                <span class="part-meta">❤<?= (int)$p['hp'] ?> ⚔<?= (int)$p['dmg'] ?></span>
              </button>
            <?php endforeach; ?>
          </div>
        </section>
      <?php endforeach; ?>
    </aside>

  </div>

  <script>
    window.WORKSHOP = {
      saveUrl:  'custom_dragon_save.php',
      partsDir: <?= json_encode(part_dir()) ?>,
      partsExt: <?= json_encode(part_ext()) ?>,
      csrf:     <?= json_encode(csrf_token()) ?>
    };
  </script>
  <?php endif; ?>
</div>

<?php
$pageScripts = $empty ? [] : ['script/workshop.js'];
require __DIR__ . '/footer.php';
