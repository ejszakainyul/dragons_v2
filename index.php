<?php
require_once __DIR__ . '/inc/bootstrap.php';

$conn = db();

/* --- Élő statisztikák a főoldali számlálókhoz ------------------------ */
$stats = [
    'dragons' => 0,
    'users'   => 0,
    'stories' => 0,
    'battles' => 0,
];
foreach ([
    'dragons' => 'sarkanyok',
    'users'   => 'sarkanyok_users',
    'stories' => 'sarkanyok_story',
    'battles' => 'sarkanyok_battles',
] as $key => $table) {
    $res = $conn->query("SELECT COUNT(*) AS c FROM {$table}");
    if ($res) {
        $stats[$key] = (int)$res->fetch_assoc()['c'];
    }
}

/* --- Ranglista: a legerősebb sárkányok ------------------------------ */
$topDragons = [];
$res = $conn->query(
    "SELECT d.id, d.nev, d.szin, d.test_id, d.szarny_id, d.lab_id, d.fej_id,
            d.hp, d.dmg, d.wins, u.name AS owner
       FROM sarkanyok d
       JOIN sarkanyok_users u ON u.id = d.user_id
      ORDER BY (d.hp * 0.6 + d.dmg * 4) DESC, d.id ASC
      LIMIT 4"
);
if ($res) {
    $topDragons = $res->fetch_all(MYSQLI_ASSOC);
}

/* --- Hero sárkány: a legerősebb, vagy egy szép alapértelmezés -------- */
$heroDragon = $topDragons[0] ?? [
    'id' => 0, 'nev' => 'Ősi Nyughatatlan', 'szin' => '#ff8a3d',
    'test_id' => 7, 'szarny_id' => 7, 'lab_id' => 7, 'fej_id' => 7,
    'hp' => 230, 'dmg' => 45, 'owner' => 'a legenda',
];

$pageTitle  = 'Sárkányok és Vikingek — nevelj, alkoss, harcolj';
$pageStyles = ['style/home.css'];
$bodyClass  = 'home';
require __DIR__ . '/header.php';
?>

<!-- ================= HERO ================= -->
<section class="hero">

  <div class="wrap hero-grid">
    <div class="hero-copy">
      <span class="badge badge-ember reveal">ᛟ Északi legendák · AI · sárkánykovácsolás</span>

      <h1 class="reveal" data-delay="80">
        Nevelj sárkányt.<br>
        Írd meg a <span class="text-gradient">sagádat</span>.
      </h1>

      <p class="hero-lead reveal" data-delay="160">
        Egy kérdőív eldönti, milyen sárkány talál rád. Utána a műhelyben testrészről
        testrészre építed tovább, az arénában megméretteted, és az AI megírja a legendáját.
      </p>

      <div class="hero-cta reveal" data-delay="240">
        <?php if (is_logged_in()): ?>
          <a class="btn btn-primary" href="quiz.php"><span class="btn-rune" aria-hidden="true">ᛈ</span> Sárkányt hívok</a>
          <a class="btn" href="user.php">A gyűjteményem</a>
        <?php else: ?>
          <a class="btn btn-primary" href="register.php">Kezdjük el</a>
          <a class="btn" href="login.php">Van már fiókom</a>
        <?php endif; ?>
      </div>

      <dl class="hero-stats reveal" data-delay="320">
        <div><dt>Kikelt sárkány</dt><dd><span data-count-to="<?= $stats['dragons'] ?>">0</span></dd></div>
        <div><dt>Viking</dt>        <dd><span data-count-to="<?= $stats['users'] ?>">0</span></dd></div>
        <div><dt>Legenda</dt>       <dd><span data-count-to="<?= $stats['stories'] ?>">0</span></dd></div>
        <div><dt>Csata</dt>         <dd><span data-count-to="<?= $stats['battles'] ?>">0</span></dd></div>
      </dl>
    </div>

    <div class="hero-stage reveal" data-delay="120">
      <div class="hero-halo" aria-hidden="true">
        <img src="<?= realm_img('ring-ember.svg') ?>" alt="">
      </div>
      <div class="hero-altar" aria-hidden="true">
        <img class="altar-ring altar-ring-1" src="<?= realm_img('ring-ice.svg') ?>" alt="">
        <img class="altar-ring altar-ring-2" src="<?= realm_img('ring-ember.svg') ?>" alt="">
      </div>
      <div class="hero-dragon" id="heroDragon">
        <?= dragon_render($heroDragon) ?>
      </div>
      <div class="hero-plate">
        <strong><?= e($heroDragon['nev']) ?></strong>
        <span class="muted">a rangsor élén · <?= e($heroDragon['owner']) ?></span>
        <div class="hero-plate-stats">
          <span class="badge badge-ice">❤ <?= (int)$heroDragon['hp'] ?> HP</span>
          <span class="badge badge-ember">⚔ <?= (int)$heroDragon['dmg'] ?> DMG</span>
        </div>
      </div>
    </div>
  </div>

  <a class="hero-scroll" href="#utak" aria-label="Tovább görgetés">
    <span></span>
  </a>
</section>

<!-- ================= UTAK ================= -->
<section class="section" id="utak">
  <div class="wrap">
    <header class="section-head reveal">
      <h2>Öt út a legendához</h2>
      <p>Mindegyik önmagában is játszható — együtt viszont egy egész világ.</p>
    </header>

    <div class="grid grid-3">
      <?php
      $paths = [
        ['quiz.php',    'ᛈ', 'A jóslat',  'Öt kérdés az északi ködben. A válaszaid döntik el, melyik sárkány választ téged — a sorsodat nem te osztod.', 'Kérdőív indítása'],
        ['nyitott.php', 'ᚲ', 'A műhely',  'Fej, test, láb, szárny — húzd össze a sajátodat. Minden darabnak saját HP és sebzés értéke van.', 'Műhelybe'],
        ['arena.php',   'ᛏ', 'Az aréna',  'Ereszd össze a sárkányaidat egymással vagy a barátaidéval. Körről körre, élő csatanaplóval.', 'Harcba'],
        ['kaland.php',  'ᚹ', 'A völgy',  'Járd be a Sárkányok Völgyét: harcolj a barlangokban, és tenyéssz új sárkányokat a fészkekben a sajátjaid testrészeiből.', 'Kalandra fel'],
        ['story.php',   'ᚨ', 'A saga',    'Add meg a neved, a származásod és a fegyvered — a mesélő megírja a te viking történetedet.', 'Történetet írok'],
      ];
      foreach ($paths as $i => [$href, $icon, $title, $text, $cta]): ?>
        <a class="card card-spotlight path-card reveal" data-delay="<?= $i * 90 ?>" href="<?= e($href) ?>">
          <span class="path-icon rune-medal" aria-hidden="true"><?= $icon ?></span>
          <h3><?= e($title) ?></h3>
          <p class="muted"><?= e($text) ?></p>
          <span class="path-cta"><?= e($cta) ?> <span aria-hidden="true">→</span></span>
        </a>
      <?php endforeach; ?>
    </div>
  </div>
</section>

<!-- ================= RANGLISTA ================= -->
<?php if ($topDragons): ?>
<section class="section section-alt">
  <div class="wrap">
    <header class="section-head reveal">
      <h2>A csarnok legerősebbjei</h2>
      <p>A rangsor a testrészekből számolt életerő és sebzés alapján áll össze.</p>
    </header>

    <div class="grid grid-4">
      <?php foreach ($topDragons as $i => $d):
        $power = dragon_power($d);
        $maxHp = 400; $maxDmg = 80; ?>
        <article class="card card-spotlight dragon-card reveal" data-delay="<?= $i * 80 ?>">
          <span class="rank-badge">#<?= $i + 1 ?></span>
          <?= dragon_render($d) ?>
          <h3 class="dragon-name"><?= e($d['nev']) ?></h3>
          <p class="dragon-owner muted"><?= e($d['owner']) ?> sárkánya</p>

          <div class="dragon-stat">
            <span>❤ Életerő</span><b><?= (int)$d['hp'] ?></b>
            <div class="stat-bar hp"><span data-fill="<?= min(100, round($d['hp'] / $maxHp * 100)) ?>"></span></div>
          </div>
          <div class="dragon-stat">
            <span>⚔ Sebzés</span><b><?= (int)$d['dmg'] ?></b>
            <div class="stat-bar dmg"><span data-fill="<?= min(100, round($d['dmg'] / $maxDmg * 100)) ?>"></span></div>
          </div>

          <footer class="dragon-foot">
            <span class="badge badge-rare">Erő <?= $power ?></span>
            <?php if ((int)$d['wins'] > 0): ?>
              <span class="badge">🏆 <?= (int)$d['wins'] ?> győzelem</span>
            <?php endif; ?>
          </footer>
        </article>
      <?php endforeach; ?>
    </div>
  </div>
</section>
<?php endif; ?>

<!-- ================= MI EZ? ================= -->
<section class="section">
  <div class="wrap about-split">
    <div class="reveal">
      <h2>Mi ez az oldal?</h2>
      <p class="muted">
        Egy összetett, AI-alapú sárkánynevelő világ. A sárkányod nem statikus kép:
        testrészekből áll össze, minden darab hoz magával életerőt és sebzést,
        és a színezés valós idejű SVG-szűrővel történik — ugyanaz a pixelgrafika
        végtelen variációban.
      </p>
      <ul class="feature-list">
        <li><b>Moduláris sárkányok</b> — 17-17 fej, test, láb és szárny, 83 500 kombináció.</li>
        <li><b>Valódi statisztikák</b> — a HP és a DMG a katalógusból jön, nem véletlenszám.</li>
        <li><b>Aréna</b> — körökre osztott csata élő naplóval, győzelmi statisztikával.</li>
        <li><b>Barátok</b> — kérelem, elfogadás, és a barátok sárkányainak kihívása.</li>
        <li><b>Rejtett tartalom</b> — van egy sárkány, amit csak az talál meg, aki figyel. 🐉</li>
      </ul>
      <a class="btn" href="about.php">További részletek</a>
    </div>

    <div class="about-visual reveal" data-delay="140" aria-hidden="true">
      <?php
      // Kis vitrin a testrész-katalógusból
      $showcase = array_slice(part_catalog('fej'), 0, 6);
      foreach ($showcase as $p): ?>
        <div class="showcase-chip">
          <img src="<?= e(part_src($p['image'])) ?>" alt="" loading="lazy">
          <small><?= e($p['nev']) ?></small>
        </div>
      <?php endforeach; ?>
      <?php if (!$showcase): ?>
        <p class="muted">A testrész-katalógus üres — futtasd le az <a href="install.php">install.php</a>-t.</p>
      <?php endif; ?>
    </div>
  </div>
</section>

<!-- ================= ZÁRÓ CTA ================= -->
<section class="section">
  <div class="wrap">
    <div class="cta-banner reveal">
      <h2>A ködben valami mozdul.</h2>
      <p class="muted">Öt kérdés választ el attól, hogy megtudd, melyik sárkány a tiéd.</p>
      <?php if (is_logged_in()): ?>
        <a class="btn btn-primary" href="quiz.php">Belépek a ködbe</a>
      <?php else: ?>
        <a class="btn btn-primary" href="register.php">Csatlakozom</a>
      <?php endif; ?>
    </div>
  </div>
</section>

<?php
$pageScripts = ['script/home.js'];
require __DIR__ . '/footer.php';
