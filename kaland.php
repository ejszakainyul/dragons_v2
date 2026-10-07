<?php
/**
 * A Sárkányok Völgye — kalandjáték (Phaser 3).
 *
 * Bejárható térkép barlangokkal (harc), fészkekkel (tenyésztés a meglévő
 * sárkányok testrészeiből), a hosszúházzal (pihenés, csapat) és a
 * Gyakorlótérrel (technikák, edzés, párbaj). A saga fejezetekben halad.
 *
 *   Kliens:  script/game/*.js   (belépő: main.js)
 *   Szerver: kaland_api.php + inc/game.php
 *   Táblák:  sql/migrate_game.sql
 *
 * A jatek.php változatlanul a Godot-modul bejárata marad.
 */
require_once __DIR__ . '/inc/bootstrap.php';
require_login();

$pageTitle  = 'A Sárkányok Völgye — kaland';
$pageStyles = ['style/game.css'];
$bodyClass  = 'game-page';
require __DIR__ . '/header.php';

/* Az importmap minden játékmodult verziózza: egy javítás után se a
   böngésző gyorsítótárából fusson a régi kód. */
$importMap = ['imports' => []];
foreach (glob(__DIR__ . '/script/game/*.js') ?: [] as $file) {
    $name = basename($file);
    $importMap['imports']['./script/game/' . $name] = './script/game/' . $name . '?v=' . filemtime($file);
}
?>
<div class="game-shell" id="gameShell">
  <div class="game-canvas" id="gameCanvas"></div>

  <div class="game-hud">
    <div class="hud-left">
      <div class="hud-party" id="hudParty" aria-label="A csapatod"></div>
      <button class="hud-quest" id="hudQuest" type="button" title="A saga — kattints a krónikáért"></button>
    </div>

    <div class="hud-res">
      <span class="hud-chip hud-clock" id="hudClock" title="A völgy órája"><b>☀ Nappal</b></span>
      <span class="hud-chip" title="Rúnaszilánk — ebből fizetsz a tojásrakásért és a szelídítésért">
        <i class="hud-rune">ᚱ</i><b id="hudShards">0</b>
      </span>
      <span class="hud-chip" title="Gyógyfű — harcban a legsebesültebb társadat gyógyítja">
        <i>🌿</i><b id="hudHerbs">0</b>
      </span>
      <button class="hud-icon-btn" id="hudBook" type="button" title="Krónika: a saga és a mellékszálak"><span class="rune-ico">ᛉ</span></button>
      <button class="hud-icon-btn" id="hudMusic" type="button" aria-label="Zene ki" title="Zene be/ki">♫</button>
      <button class="hud-icon-btn" id="hudMute" type="button" aria-label="Hang ki">🔊</button>
      <a class="hud-icon-btn" href="user.php" title="A gyűjteményed (profil)"><span class="rune-ico">ᛗ</span></a>
      <button class="hud-icon-btn hud-menu-btn" id="hudMenu" type="button" title="Menü (Esc)" aria-label="Menü"><span class="hud-burger" aria-hidden="true"><i></i><i></i><i></i></span></button>
    </div>

    <div class="hud-area" id="hudArea" aria-live="polite"></div>
    <div class="hud-map">
      <canvas class="hud-minimap" id="hudMinimap" title="Kistérkép — kattints, és oda indulsz"></canvas>
      <span class="hud-map-n" aria-hidden="true">É</span>
      <button class="hud-map-btn" id="hudMapBtn" type="button" title="Világtérkép (M)">⛶</button>
    </div>
    <div class="hud-prompt" id="hudPrompt" hidden></div>
    <div class="hud-compass" id="hudCompass" hidden aria-hidden="true"><i></i></div>
    <div class="hud-toasts" id="hudToasts" aria-live="polite"></div>

    <div class="battle-panel" id="battlePanel" hidden>
      <div class="bp-top">
        <div class="bp-order" aria-label="Sorrend"></div>
        <div class="bp-chorus" hidden title="Harci ének — üss, kapj, győzz: ha megtelt, jöhet a Sárkánykórus">
          <span>ᛟ Harci ének</span><div class="bar"><i></i><em></em></div>
        </div>
      </div>
      <div class="bp-hint" hidden></div>
      <div class="bp-actions" hidden></div>
      <div class="bp-log" aria-live="polite"></div>
    </div>
  </div>

  <div class="cine-bars" aria-hidden="true"><i></i><i></i></div>

  <div class="game-modal" id="gameModal" hidden role="dialog" aria-modal="true">
    <div class="game-modal-card" id="gameModalCard"></div>
  </div>

  <div class="game-loading" id="gameLoading">
    <div class="gl-sigil" aria-hidden="true">
      <img src="<?= realm_img('ring-ember.svg') ?>" alt="">
      <span>ᛟ</span>
    </div>
    <h1 class="gl-title" data-norune>A Sárkányok Völgye</h1>
    <p class="gl-text" data-text>Betöltés…</p>
    <div class="gl-bar"><i data-bar></i></div>
  </div>

  <noscript><p class="game-noscript">A játékhoz JavaScript szükséges.</p></noscript>
</div>

<script>
  window.GAME = {
    api:  'kaland_api.php',
    csrf: <?= json_encode(csrf_token()) ?>,
  };
</script>
<script type="importmap"><?= json_encode($importMap, JSON_UNESCAPED_SLASHES) ?></script>
<script src="<?= asset('vendor/phaser/phaser.min.js') ?>" defer></script>
<script type="module" src="<?= asset('script/game/main.js') ?>"></script>

<?php require __DIR__ . '/footer.php'; ?>
