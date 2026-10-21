<?php
/**
 * Nyílt nap — a látogatók bejárata és a túra kezdőlapja.
 *
 *   Belépve nem:   egyetlen mező, a kártyán lévő háromjegyű kód (pl. 482)
 *   Belépve:       a túra öt állomása, a látogató sárkányai és sagája
 *   ?api=ping      JSON a nyitott oldalaknak (nullázták-e közben a fiókot)
 *
 * Lásd: inc/openday.php, nyiltnap_admin.php
 */
require_once __DIR__ . '/inc/bootstrap.php';

/* --- Élő jelzés a nyitott oldalaknak ------------------------------------ */
if (($_GET['api'] ?? '') === 'ping') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    if (!is_demo()) exit(json_encode(['demo' => false]));
    $uid  = current_user_id();
    $go   = openday_take_send($uid);              // a vezérlő továbbküldte (≤ 5 mp)
    $row  = openday_row($uid, true);
    $done = openday_done($row);
    exit(json_encode(['demo' => true, 'epoch' => (int)($row['korszak'] ?? 0), 'done' => $done, 'next' => openday_next($done), 'go' => $go]));
}

/* --- Belépés kóddal ------------------------------------------------------- */
$error = '';
if ($_SERVER['REQUEST_METHOD'] === 'POST' && isset($_POST['kod'])) {
    csrf_check();
    if (is_logged_in() && !is_demo()) {
        $error = 'Most egy saját fiókkal vagy belépve. Előbb lépj ki, ha bemutató kóddal szeretnél belépni.';
    } elseif (openday_login((string)$_POST['kod'])) {
        header('Location: nyiltnap.php');
        exit;
    } else {
        usleep(400000);   // a találgatás lassítása
        $error = 'Ezt a kódot nem ismerjük — nézd meg még egyszer a kártyádon.';
    }
}

$demo = is_demo();
$row  = $demo ? openday_row(current_user_id(), true) : null;
$done = openday_done($row);
$next = openday_next($done);
$all  = $demo && $next === null;

$dragons = [];
$story   = null;
if ($demo) {
    $uid  = current_user_id();
    $stmt = db()->prepare('SELECT * FROM sarkanyok WHERE user_id = ? ORDER BY id LIMIT 6');
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $dragons = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    $stmt = db()->prepare('SELECT * FROM sarkanyok_story WHERE user_id = ? ORDER BY id DESC LIMIT 1');
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $story = $stmt->get_result()->fetch_assoc() ?: null;
    $stmt->close();
}

$pageTitle  = 'Nyílt nap — Sárkányok és Vikingek';
$pageStyles = ['style/auth.css', 'style/openday.css'];
$bodyClass  = 'page-body openday';
require __DIR__ . '/header.php';
?>

<?php if (!$demo): ?>

<div class="od-gate">
  <form class="od-gate-card" method="post" action="nyiltnap.php" autocomplete="off">
    <?= csrf_field() ?>
    <p class="od-kicker">ᛟ Nyílt nap</p>
    <h1>Lépj be a Völgybe</h1>
    <p class="od-lead">Írd be a kártyádon lévő <b>kódot</b> — jelszó nem kell.</p>

    <?php if ($error): ?>
      <div class="alert alert-error"><span aria-hidden="true">⚠</span><span><?= e($error) ?></span></div>
    <?php elseif (isset($_GET['ki'])): ?>
      <div class="alert alert-info"><span aria-hidden="true">ᛟ</span><span>Ez a bemutató fiók most szünetel. Kérj új kártyát a segítőktől.</span></div>
    <?php endif; ?>

    <label class="od-code-field">
      <input type="text" name="kod" maxlength="8" required autofocus inputmode="numeric" autocomplete="off"
             spellcheck="false" placeholder="482" aria-label="Belépőkód">
    </label>
    <button class="btn btn-primary od-go" type="submit">Belépés ᛞ</button>

    <ol class="od-preview">
      <?php foreach (OPENDAY_STEPS as $k => [$title, , $rune, $min]): ?>
        <li><i><?= $rune ?></i><span><?= e($title) ?></span><small>~<?= $min ?> perc</small></li>
      <?php endforeach; ?>
    </ol>
    <?php if (is_admin()): ?>
      <p class="od-admin-link"><a href="nyiltnap_admin.php">ᛉ A nyílt nap vezérlője</a></p>
    <?php endif; ?>
  </form>
</div>

<?php else: ?>

<div class="wrap od-hub">
  <header class="od-hero">
    <div>
      <p class="od-kicker">ᛟ Nyílt nap · <b><?= e($row['kod'] ?? '') ?></b></p>
      <h1><?= $all ? 'Végigjártad a Völgyet, ' : 'Üdv a Völgyben, ' ?><?= e($_SESSION['name'] ?? 'viking') ?>!</h1>
      <p class="od-lead">
        <?php if ($all): ?>
          Megvan a sárkányod, harcoltál az arénában, a mesterséges intelligencia megírta a sagádat,
          és megtisztítottad a Mohos barlangot. Köszönjük, hogy itt voltál!
        <?php else: ?>
          Öt állomás, kb. negyedóra. A sorrend számít: minden lépés a következőre épít.
        <?php endif; ?>
      </p>
    </div>
    <div class="od-ring" style="--p:<?= count($done) / count(OPENDAY_STEPS) ?>" aria-label="<?= count($done) ?> / <?= count(OPENDAY_STEPS) ?> állomás kész">
      <b><?= count($done) ?></b><span>/ <?= count(OPENDAY_STEPS) ?></span>
    </div>
  </header>

  <ol class="od-steps">
    <?php $i = 0; foreach (OPENDAY_STEPS as $k => [$title, $page, $rune, $min, $desc]): $i++;
      $isDone = in_array($k, $done, true); $isNext = $k === $next; ?>
      <li class="od-step <?= $isDone ? 'is-done' : ($isNext ? 'is-next' : 'is-later') ?>">
        <span class="od-step-rune" aria-hidden="true"><?= $isDone ? '✓' : $rune ?></span>
        <div class="od-step-body">
          <p class="od-step-n"><?= $i ?>. állomás · ~<?= $min ?> perc<?= $k === 'story' ? ' · <b class="od-ai">AI</b>' : '' ?></p>
          <h2><?= e($title) ?></h2>
          <p><?= e($desc) ?></p>
        </div>
        <?php if ($isNext): ?>
          <a class="btn btn-primary" href="<?= e($page) ?>">Indulás →</a>
        <?php elseif ($isDone): ?>
          <a class="btn btn-sm btn-ghost" href="<?= e($page) ?>">Újra megnézem</a>
        <?php else: ?>
          <span class="od-step-later">később</span>
        <?php endif; ?>
      </li>
    <?php endforeach; ?>
  </ol>

  <?php if ($dragons): ?>
    <section class="od-section">
      <h2 class="od-h2">A sárkányaid</h2>
      <div class="od-dragons">
        <?php foreach ($dragons as $d): ?>
          <figure class="od-dragon">
            <?= dragon_render($d) ?>
            <figcaption><b><?= e($d['nev']) ?></b><small>❤ <?= (int)$d['hp'] ?> · ⚔ <?= (int)$d['dmg'] ?></small></figcaption>
          </figure>
        <?php endforeach; ?>
      </div>
    </section>
  <?php endif; ?>

  <?php if ($story): ?>
    <section class="od-section">
      <h2 class="od-h2">A sagád <span class="od-ai">AI</span></h2>
      <article class="card od-story">
        <p class="muted"><?= e($story['name']) ?> · <?= e($story['provenance']) ?> · ⚔ <?= e($story['weapon']) ?> · 🐉 <?= e($story['dragon']) ?></p>
        <div><?= nl2br(e($story['story'])) ?></div>
      </article>
    </section>
  <?php endif; ?>

  <?php if ($all): ?>
    <p class="od-thanks">ᛟ Szólj a segítőnek, és a fiókod tisztán várja a következő vikinget. ᛟ</p>
  <?php endif; ?>
</div>

<?php endif; ?>

<?php require __DIR__ . '/footer.php';
