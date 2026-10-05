<?php
/**
 * A háttérvilág: éjszakai fjord sarkfénnyel, rúnakövekkel, hosszúházzal,
 * drakkarral és lebegő tárgyakkal. A header.php illeszti be minden oldalra.
 *
 * A képek statikusak (tools/build_realm.php rajzolja őket); ami mozog, az
 * itt külön elem, és csak transform/opacity animációt kap (style/realm.css).
 * A parallaxist a script/realm.js adja a --px/--py/--sy változókkal.
 *
 * Az elemek helyét determinisztikus álvéletlen adja: így minden oldalon
 * ugyanott vannak, és nem kell hozzá JavaScript.
 */

/** Egy realm-kép URL-je, módosítási idővel verziózva. */
function realm_img(string $name): string
{
    $rel  = 'img/realm/' . $name;
    $full = APP_ROOT . '/' . $rel;
    return $rel . '?v=' . (is_file($full) ? filemtime($full) : 0);
}

/** Kis, rögzített magú álvéletlen — a lebegő elemek elrendezéséhez. */
$realmRng = (static function () {
    $s = 20260928;
    return static function (float $a, float $b) use (&$s): float {
        $s = (1103515245 * $s + 12345) & 0x7fffffff;
        return $a + ($b - $a) * ($s / 0x7fffffff);
    };
})();

/* --- Pislákoló fényes csillagok ------------------------------------ */
$twinkles = [];
for ($i = 0; $i < 16; $i++) {
    $twinkles[] = sprintf(
        '--x:%.1f%%;--y:%.1f%%;--d:%.1fs;--delay:%.1fs;--s:%.2f',
        $realmRng(2, 98), $realmRng(2, 48), $realmRng(3, 7.5), $realmRng(-7, 0), $realmRng(0.6, 1.3)
    );
}

/* --- Lebegő tárgyak: rúnák, parázs és „szellemtárgyak" -------------- */
$runeGlyphs = ['ᚠ', 'ᚢ', 'ᚦ', 'ᚨ', 'ᚱ', 'ᚲ', 'ᚷ', 'ᚹ', 'ᚺ', 'ᚾ', 'ᛁ', 'ᛃ', 'ᛇ', 'ᛈ', 'ᛉ', 'ᛊ', 'ᛏ', 'ᛒ', 'ᛖ', 'ᛗ', 'ᛚ', 'ᛜ', 'ᛞ', 'ᛟ'];
$artifacts  = ['mjolnir', 'shield', 'axe', 'horn', 'valknut', 'helm', 'raven'];

$drift = [];
// Rúnák
for ($i = 0; $i < 9; $i++) {
    $drift[] = [
        'kind'  => 'rune',
        'body'  => $runeGlyphs[(int)$realmRng(0, count($runeGlyphs) - 0.01)],
        'style' => sprintf('--x:%.1f%%;--dur:%.0fs;--delay:%.1fs;--sway:%.0fpx;--spin:%.2fturn;--rot:%.0fdeg;--op:%.2f;--size:%.0fpx',
            $realmRng(3, 97), $realmRng(34, 58), $realmRng(-58, 0), $realmRng(-90, 90),
            $realmRng(-0.6, 0.6), $realmRng(-40, 40), $realmRng(0.35, 0.7), $realmRng(15, 28)),
    ];
}
// Parázs
for ($i = 0; $i < 8; $i++) {
    $drift[] = [
        'kind'  => 'ember',
        'body'  => '',
        'style' => sprintf('--x:%.1f%%;--dur:%.0fs;--delay:%.1fs;--sway:%.0fpx;--spin:0turn;--rot:0deg;--op:%.2f;--size:%.1fpx',
            $realmRng(5, 95), $realmRng(18, 30), $realmRng(-30, 0), $realmRng(-120, 120),
            $realmRng(0.4, 0.85), $realmRng(2, 4)),
    ];
}
// Szellemtárgyak — lassan forognak a térben (rotateY), ettől lesz mélységük
foreach ($artifacts as $i => $name) {
    $drift[] = [
        'kind'  => 'artifact',
        'body'  => $name,
        'style' => sprintf('--x:%.1f%%;--dur:%.0fs;--delay:%.1fs;--sway:%.0fpx;--spin:%.2fturn;--rot:%.0fdeg;--op:%.2f;--size:%.0fpx',
            $realmRng(4, 96), $realmRng(48, 76), $realmRng(-76, 0), $realmRng(-70, 70),
            ($i % 2 ? 1 : -1) * $realmRng(0.8, 1.6), $realmRng(-25, 25), $realmRng(0.22, 0.4), $realmRng(22, 38)),
    ];
}
?>
<div class="realm" id="realm" aria-hidden="true">
  <div class="realm-sky" style="background-image:url('<?= realm_img('sky.svg') ?>')"></div>
  <div class="realm-aurora" style="background-image:url('<?= realm_img('aurora.svg') ?>')"></div>

  <div class="realm-twinkle">
    <?php foreach ($twinkles as $st): ?><i style="<?= $st ?>"></i><?php endforeach; ?>
  </div>

  <div class="realm-moon">
    <div class="realm-moon-disc"></div>
    <img class="realm-moon-ring" src="<?= realm_img('ring-ice.svg') ?>" alt="" decoding="async">
  </div>

  <div class="realm-land">
    <div class="realm-layer realm-far">
      <img src="<?= realm_img('far.svg') ?>" alt="" decoding="async">
    </div>

    <div class="realm-layer realm-mid">
      <img src="<?= realm_img('mid.svg') ?>" alt="" decoding="async">
      <!-- Drakkar a fjordon — külön elem, hogy ringatózhasson -->
      <div class="realm-at realm-ship" style="--x:640;--y:818;--w:230">
        <img src="<?= realm_img('ship.svg') ?>" alt="" decoding="async">
      </div>
    </div>

    <div class="realm-mist realm-mist-back"></div>

    <div class="realm-layer realm-near">
      <img src="<?= realm_img('near.svg') ?>" alt="" decoding="async">
      <!-- A hosszúház tűzfénye pislákol -->
      <i class="realm-at realm-hearth" style="--x:1300;--y:790;--w:260"></i>
      <!-- Rúnakövek: a fényük lassan lüktet -->
      <div class="realm-at realm-stone" style="--x:104;--y:804;--w:86;--pulse:6.5s;--pd:0s">
        <i class="realm-stone-glow"></i>
        <img src="<?= realm_img('stone1.svg') ?>" alt="" decoding="async">
      </div>
      <div class="realm-at realm-stone" style="--x:200;--y:798;--w:64;--pulse:8s;--pd:-2.5s">
        <i class="realm-stone-glow"></i>
        <img src="<?= realm_img('stone2.svg') ?>" alt="" decoding="async">
      </div>
      <div class="realm-at realm-stone" style="--x:975;--y:880;--w:60;--pulse:7.2s;--pd:-4s">
        <i class="realm-stone-glow"></i>
        <img src="<?= realm_img('stone3.svg') ?>" alt="" decoding="async">
      </div>
    </div>

    <div class="realm-mist realm-mist-front"></div>
  </div>

  <div class="realm-drift">
    <?php foreach ($drift as $d): ?>
      <?php if ($d['kind'] === 'rune'): ?>
        <span class="drift-rune" style="<?= $d['style'] ?>"><?= $d['body'] ?></span>
      <?php elseif ($d['kind'] === 'ember'): ?>
        <i class="drift-ember" style="<?= $d['style'] ?>"></i>
      <?php else: ?>
        <svg class="drift-artifact drift-<?= $d['body'] ?>" style="<?= $d['style'] ?>" viewBox="0 0 64 64"><use href="#rs-<?= $d['body'] ?>"/></svg>
      <?php endif; ?>
    <?php endforeach; ?>
  </div>

  <div class="realm-vignette"></div>

  <!-- A lebegő tárgyak rajzai (egyszer definiálva, <use> hivatkozik rájuk) -->
  <svg class="realm-sprites" width="0" height="0" focusable="false">
    <defs>
      <symbol id="rs-mjolnir" viewBox="0 0 64 64">
        <path d="M14 10h36l-4 18H18z" fill="currentColor" opacity=".9"/>
        <path d="M18 17h28M19 22h26" stroke="#0b1020" stroke-width="1.6" opacity=".6"/>
        <path d="M22 13l3 3 3-3 3 3 3-3 3 3 3-3 3 3" fill="none" stroke="#0b1020" stroke-width="1.2" opacity=".5"/>
        <rect x="29" y="28" width="6" height="22" rx="2" fill="currentColor"/>
        <path d="M29 33h6M29 38h6M29 43h6" stroke="#0b1020" stroke-width="1.2" opacity=".55"/>
        <circle cx="32" cy="55" r="4.5" fill="none" stroke="currentColor" stroke-width="2.4"/>
      </symbol>
      <symbol id="rs-shield" viewBox="0 0 64 64">
        <circle cx="32" cy="32" r="27" fill="currentColor" opacity=".85"/>
        <circle cx="32" cy="32" r="27" fill="none" stroke="currentColor" stroke-width="3"/>
        <path d="M32 5v54M5 32h54M13 13l38 38M51 13L13 51" stroke="#0b1020" stroke-width="1.3" opacity=".45"/>
        <circle cx="32" cy="32" r="8" fill="currentColor" stroke="#0b1020" stroke-width="1.6"/>
        <circle cx="32" cy="32" r="3" fill="#0b1020" opacity=".5"/>
      </symbol>
      <symbol id="rs-axe" viewBox="0 0 64 64">
        <rect x="30" y="8" width="5" height="52" rx="2" fill="currentColor"/>
        <path d="M34 12c14 0 22 6 22 16-6-3-12-3-16 2l-6 6z" fill="currentColor" opacity=".9"/>
        <path d="M34 12c-6 2-8 8-8 14 3-2 6-3 8-3z" fill="currentColor" opacity=".6"/>
      </symbol>
      <symbol id="rs-horn" viewBox="0 0 64 64">
        <path d="M8 16c10 0 20 4 30 14s16 22 18 26c-8-2-18-10-26-18S12 22 8 16z" fill="currentColor" opacity=".9"/>
        <path d="M14 18l4 6M24 24l4 6M34 32l4 7" stroke="#0b1020" stroke-width="2" opacity=".5"/>
        <ellipse cx="9" cy="17" rx="3" ry="5" fill="#0b1020" opacity=".4" transform="rotate(-40 9 17)"/>
      </symbol>
      <symbol id="rs-valknut" viewBox="0 0 64 64">
        <g fill="none" stroke="currentColor" stroke-width="3.2" stroke-linejoin="round">
          <path d="M32 6L50 38H14z"/>
          <path d="M22 20L40 52H4z"/>
          <path d="M42 20L60 52H24z"/>
        </g>
      </symbol>
      <symbol id="rs-helm" viewBox="0 0 64 64">
        <path d="M12 36c0-15 9-26 20-26s20 11 20 26z" fill="currentColor" opacity=".9"/>
        <path d="M32 10v26M12 30h40" stroke="#0b1020" stroke-width="1.5" opacity=".5"/>
        <path d="M12 36h40v4H12z" fill="currentColor"/>
        <path d="M29 40h6v16h-6z" fill="currentColor"/>
        <path d="M17 40c0 6 4 9 10 9M47 40c0 6-4 9-10 9" fill="none" stroke="currentColor" stroke-width="3"/>
      </symbol>
      <symbol id="rs-raven" viewBox="0 0 64 64">
        <path d="M6 30c8-10 20-12 28-8 4-6 10-8 16-6l8 2-8 3c2 6 0 12-6 16l6 12-10-8c-8 4-18 2-24-4l-12 2 8-6c-4-2-6-2-6-3z" fill="currentColor" opacity=".9"/>
        <circle cx="48" cy="20" r="1.4" fill="#0b1020"/>
      </symbol>
    </defs>
  </svg>
</div>
