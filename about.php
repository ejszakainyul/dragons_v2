<?php
require_once __DIR__ . '/inc/bootstrap.php';

$pageTitle  = 'Rólunk — Sárkányok és Vikingek';
$pageStyles = ['style/about.css'];
require __DIR__ . '/header.php';
?>

<div class="wrap about-wrap">

  <header class="section-head">
    <h1>Projektbemutató</h1>
    <p>Mi van a pixelek mögött — és hogyan épül fel az egész.</p>
  </header>

  <section class="card about-card reveal">
    <h2>Bevezetés</h2>
    <p class="muted">
      A <strong>Sárkányok és Vikingek</strong> egy interaktív világ, ahol a játékosok
      egyedi sárkányokat hívnak elő, gondozzák és fejlesztik őket, stratégiai
      csatákban mérkőznek, és AI-vezérelt történeteket élnek át.
    </p>
  </section>

  <div class="grid grid-3">
    <?php
    $blocks = [
      ['⚙️', 'Technológiák', [
        'PHP 8 + MySQL (prepared statement-ek, tranzakciók)',
        'HTML5, CSS3 (design rendszer CSS-változókkal)',
        'Vanilla JavaScript — keretrendszer nélkül',
        'Godot Engine a WebAssembly játékmodulhoz',
      ]],
      ['🗄️', 'Adatmodell', [
        '<code>sarkanyok_users</code> — fiókok, jogosultság, kvíz-állapot',
        '<code>sarkanyok</code> — a sárkányok testrész-hivatkozásokkal',
'<code>sarkanyok_fej/test/lab/szarny</code> — 18-18 testrész katalógusonként',
        '<code>sarkanyok_story</code>, <code>_friends</code>, <code>_battles</code>',
      ]],
      ['🛡️', 'Biztonság', [
        'Jelszavak <code>password_hash</code>-sel (a régi sha1 automatikusan frissül)',
        'CSRF-token minden módosító művelethez',
        'Session-alapú jogosultság — nincs URL-ben utazó user_id',
        'Minden felhasználói input prepared statement-en keresztül',
      ]],
    ];
    foreach ($blocks as $i => [$icon, $title, $items]): ?>
      <section class="card card-spotlight about-block reveal" data-delay="<?= $i * 90 ?>">
        <span class="about-icon" aria-hidden="true"><?= $icon ?></span>
        <h3><?= e($title) ?></h3>
        <ul class="feature-list">
          <?php foreach ($items as $item): ?>
            <li><?= $item ?></li>
          <?php endforeach; ?>
        </ul>
      </section>
    <?php endforeach; ?>
  </div>

  <section class="card about-card reveal">
    <h2>Hogyan áll össze egy sárkány?</h2>
    <p class="muted">
      Négy réteg — test, láb, fej, szárny — egymásra rajzolva, azonos
      64 egységes rácson. A rajzok vektorosak: egy generátor átfedő
      anatómiai tömegekből — mellkas, far, koponya, állkapocs, comb —
      olvasztja össze őket, és maszkkal teszi rájuk a peremfényt, így a
      vaskosabb test, a hosszabb farok vagy a más szarv csak paraméter.
      Emiatt bármekkora méretben élesek maradnak. A színezés SVG <code>feColorMatrix</code>
      szűrővel történik valós időben, így ugyanabból a grafikából végtelen
      variáció készül. A statisztikák nem
      véletlenszámok: minden testrész hoz magával egy HP és egy DMG értéket a
      katalógusból, és ezek összege adja a sárkány erejét.
    </p>

    <div class="layer-demo" aria-hidden="true">
      <?php foreach ([['test', 'body', 'Test'], ['lab', 'legs', 'Láb'], ['fej', 'head', 'Fej'], ['szarny', 'wings', 'Szárny']] as [$k, $f, $label]): ?>
        <figure>
          <img src="<?= e(part_src($f . '[7]')) ?>" alt="" loading="lazy">
          <figcaption><?= e($label) ?></figcaption>
        </figure>
        <span class="layer-plus">+</span>
      <?php endforeach; ?>
      <figure class="layer-result">
        <?= dragon_render(['id' => 'about', 'szin' => '#ff8a3d',
                           'test_id' => 7, 'lab_id' => 7, 'fej_id' => 7, 'szarny_id' => 7], false) ?>
        <figcaption>Ősi Nyughatatlan</figcaption>
      </figure>
    </div>
  </section>

  <!-- Titkos ikon: rejtett sárkány -->
  <div class="secret-zone">
    <button type="button" class="secret-icon" id="secretIcon"
            title="…mintha mozdulna valami" aria-label="Rejtett tartalom">🐉</button>
    <p class="secret-msg" id="secretMsg" hidden></p>
  </div>
</div>

<script>
  (() => {
    const icon = document.getElementById('secretIcon');
    const msg  = document.getElementById('secretMsg');
    const csrf = <?= json_encode(csrf_token()) ?>;
    const loggedIn = <?= is_logged_in() ? 'true' : 'false' ?>;

    const show = (text, kind) => {
      msg.textContent = text;
      msg.className = `secret-msg is-${kind}`;
      msg.hidden = false;
    };

    icon.addEventListener('click', () => {
      if (!loggedIn) {
        show('Ehhez be kell jelentkezned.', 'error');
        return;
      }

      icon.disabled = true;
      icon.classList.add('awakening');

      const body = new FormData();
      body.append('_csrf', csrf);

      fetch('secret-save.php', { method: 'POST', body, credentials: 'same-origin' })
        .then((r) => r.json())
        .then((data) => {
          if (data.error) throw new Error(data.error);
          show('A titkos sárkány a tiéd! 🐉 Nézd meg a gyűjteményedben.', 'success');
        })
        .catch((err) => {
          show(err.message, 'error');
          icon.classList.remove('awakening');
        })
        .finally(() => { icon.disabled = false; });
    });
  })();
</script>

<?php require __DIR__ . '/footer.php';
