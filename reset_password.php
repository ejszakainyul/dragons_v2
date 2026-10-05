<?php
require_once __DIR__ . '/inc/bootstrap.php';

$token     = trim($_GET['token'] ?? $_POST['token'] ?? '');
$error     = '';
$success   = '';
$tokenOk   = false;
$userId    = 0;

if ($token === '') {
    $error = 'Hiányzó token! Kérj új visszaállító linket.';
} else {
    $stmt = db()->prepare(
        "SELECT id, reset_expires FROM sarkanyok_users WHERE reset_token = ?"
    );
    $stmt->bind_param('s', $token);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();

    if (!$row) {
        $error = 'Érvénytelen vagy már felhasznált token!';
    } elseif (strtotime((string)$row['reset_expires']) <= time()) {
        $error = 'A token lejárt! Kérj új visszaállító linket.';
    } else {
        $tokenOk = true;
        $userId  = (int)$row['id'];
    }
}

if ($tokenOk && $_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $new     = $_POST['new_password'] ?? '';
    $confirm = $_POST['confirm_password'] ?? '';

    if ($new === '' || $confirm === '') {
        $error = 'Add meg az új jelszót és annak megerősítését!';
    } elseif ($new !== $confirm) {
        $error = 'A két jelszó nem egyezik!';
    } elseif (strlen($new) < 8) {
        $error = 'A jelszó legalább 8 karakter hosszú legyen!';
    } else {
        $hash = password_hash($new, PASSWORD_DEFAULT);
        $stmt = db()->prepare(
            "UPDATE sarkanyok_users
                SET password = ?, reset_token = NULL, reset_expires = NULL
              WHERE id = ?"
        );
        $stmt->bind_param('si', $hash, $userId);
        $stmt->execute();
        $stmt->close();

        $success = 'A jelszó sikeresen megváltozott! Most már bejelentkezhetsz.';
        $tokenOk = false;   // a token elhasználódott, az űrlapot elrejtjük
    }
}

$pageTitle  = 'Új jelszó — Sárkányok és Vikingek';
$pageStyles = ['style/auth.css'];
$bodyClass  = 'page-body auth';
require __DIR__ . '/header.php';
?>

<div class="auth-shell">
  <aside class="auth-aside">
    <div>
      <h2>Új kulcs a kapuhoz</h2>
      <p>Válassz erős jelszót — a sárkányaid megérdemlik.</p>
    </div>

    <?= dragon_render(['id' => 'reset', 'szin' => '#2dd4a7',
                       'test_id' => 3, 'szarny_id' => 3, 'lab_id' => 3, 'fej_id' => 3]) ?>

    <ul class="auth-points">
      <li>Minimum 8 karakter</li>
      <li>A régi jelszó azonnal érvénytelenné válik</li>
    </ul>
  </aside>

  <form class="auth-form" method="post" action="reset_password.php">
    <h1>Új jelszó megadása</h1>
    <p class="auth-sub">Add meg kétszer az új jelszavadat.</p>

    <?php if ($error): ?>
      <div class="alert alert-error"><span aria-hidden="true">⚠</span><span><?= e($error) ?></span></div>
    <?php endif; ?>
    <?php if ($success): ?>
      <div class="alert alert-success"><span aria-hidden="true">✓</span><span><?= e($success) ?></span></div>
    <?php endif; ?>

    <?php if ($tokenOk): ?>
      <?= csrf_field() ?>
      <input type="hidden" name="token" value="<?= e($token) ?>">

      <div class="field">
        <label for="new_password">Új jelszó</label>
        <input type="password" id="new_password" name="new_password"
               required minlength="8" autocomplete="new-password" autofocus>
      </div>

      <div class="field">
        <label for="confirm_password">Jelszó megerősítése</label>
        <input type="password" id="confirm_password" name="confirm_password"
               required minlength="8" autocomplete="new-password">
      </div>

      <button class="btn btn-primary" type="submit">Jelszó mentése</button>
    <?php endif; ?>

    <div class="auth-foot">
      <a href="login.php">Bejelentkezés</a>
      <a href="forgot_password.php">Új link kérése</a>
    </div>
  </form>
</div>

<?php require __DIR__ . '/footer.php';
