<?php
require_once __DIR__ . '/inc/bootstrap.php';

if (is_logged_in()) {
    header('Location: index.php');
    exit;
}

$error = '';
$email = '';
$next  = preg_replace('/[^a-z0-9_.-]/i', '', $_GET['next'] ?? '') ?: 'index.php';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $email    = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($email === '' || $password === '') {
        $error = 'Kérlek töltsd ki mindkét mezőt!';
    } else {
        $stmt = db()->prepare(
            "SELECT id, name, email, password, is_admin
               FROM sarkanyok_users
              WHERE LOWER(email) = LOWER(?)"
        );
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($user && verify_password($password, (string)$user['password'], (int)$user['id'])) {
            login_user($user);
            header('Location: ' . $next);
            exit;
        }

        // Szándékosan nem áruljuk el, hogy az email vagy a jelszó volt hibás
        $error = 'Hibás email cím vagy jelszó!';
    }
}

$pageTitle  = 'Bejelentkezés — Sárkányok és Vikingek';
$pageStyles = ['style/auth.css'];
$bodyClass  = 'page-body auth';
require __DIR__ . '/header.php';
?>

<div class="auth-shell">
  <aside class="auth-aside">
    <div>
      <h2>Üdv újra, viking!</h2>
      <p>A sárkányaid vártak rád. A műhely nyitva, az aréna homokja felszántva.</p>
    </div>

    <?= dragon_render(['id' => 'login', 'szin' => '#ff8a3d',
                       'test_id' => 7, 'szarny_id' => 7, 'lab_id' => 7, 'fej_id' => 7]) ?>

    <ul class="auth-points">
      <li>A gyűjteményed és a történeteid megmaradnak</li>
      <li>Barátokat hívhatsz ki az arénában</li>
      <li>A rejtett sárkány csak belépve szerezhető meg</li>
    </ul>
  </aside>

  <form class="auth-form" method="post" action="login.php?next=<?= e($next) ?>">
    <h1>Bejelentkezés</h1>
    <p class="auth-sub">Lépj be a fiókodba, és folytasd a sagádat.</p>

    <?php if ($error): ?>
      <div class="alert alert-error"><span aria-hidden="true">⚠</span><span><?= e($error) ?></span></div>
    <?php endif; ?>

    <?= csrf_field() ?>

    <div class="field">
      <label for="email">Email cím</label>
      <input type="email" id="email" name="email" value="<?= e($email) ?>" required autocomplete="email" autofocus>
    </div>

    <div class="field">
      <label for="password">Jelszó</label>
      <input type="password" id="password" name="password" required autocomplete="current-password">
    </div>

    <button class="btn btn-primary" type="submit">Belépés</button>

    <div class="auth-foot">
      <a href="forgot_password.php">Elfelejtetted a jelszavad?</a>
      <span>Még nincs fiókod? <a href="register.php">Regisztrálj</a></span>
    </div>
  </form>
</div>

<?php require __DIR__ . '/footer.php';
