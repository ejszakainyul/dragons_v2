<?php
/**
 * Közös lábléc: lezárja a <main>-t, kirajzolja a footert és betölti a
 * közös scripteket. Minden oldal ezzel végződik.
 *
 * Opcionális: $pageScripts = ['script/valami.js'];
 */
$pageScripts = $pageScripts ?? [];
?>
</main>

<footer class="site-footer">
  <div class="footer-runeband" aria-hidden="true">
    <span>ᛊᚨᚱᚲᚨᚾᛃᛟᚲ᛫ᛖᛊ᛫ᚹᛁᚲᛁᛜᛖᚲ</span>
    <i>ᛟ</i>
    <span>ᛏᚢᛉ᛫ᛖᛊ᛫ᛃᛖᚷ᛫ᛞᚨᛚᚨ</span>
  </div>
  <div class="wrap footer-inner">
    <div class="footer-brand">
      <span class="footer-sigil" aria-hidden="true">ᛟ</span>
      <div>
        <strong>Sárkányok és Vikingek</strong>
        <p class="muted mb-0">Nevelj, alkoss, harcolj — írd meg a saját sagádat.</p>
      </div>
    </div>

    <nav class="footer-links" aria-label="Lábléc navigáció">
      <a href="index.php">Főoldal</a>
      <a href="quiz.php">Kérdőív</a>
      <a href="nyitott.php">Műhely</a>
      <a href="arena.php">Aréna</a>
      <a href="kaland.php">Kaland</a>
      <a href="story.php">Történet</a>
      <a href="about.php">Rólunk</a>
    </nav>

    <p class="footer-copy muted">© <?= date('Y') ?> · NOVA — minden jog fenntartva.</p>
  </div>
</footer>

<script src="<?= asset('script/audio.js') ?>" defer></script>
<script src="<?= asset('script/ui.js') ?>" defer></script>
<script src="<?= asset('script/realm.js') ?>" defer></script>
<script src="<?= asset('script/forge.js') ?>" defer></script>
<?php foreach ($pageScripts as $js): ?>
<script src="<?= asset($js) ?>" defer></script>
<?php endforeach; ?>
</body>
</html>
