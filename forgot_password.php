<?php
require_once __DIR__ . '/inc/bootstrap.php';

$error   = '';
$success = '';
$email   = '';
$devLink = '';   // fejlesztői módban megmutatjuk a linket, mert nincs mailer

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $email = trim($_POST['email'] ?? '');

    if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Érvénytelen email cím!';
    } else {
        $conn = db();

        $stmt = $conn->prepare("SELECT id, name FROM sarkanyok_users WHERE LOWER(email) = LOWER(?)");
        $stmt->bind_param('s', $email);
        $stmt->execute();
        $user = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if ($user) {
            $token   = bin2hex(random_bytes(32));
            $expires = date('Y-m-d H:i:s', time() + 3600);

            $upd = $conn->prepare(
                "UPDATE sarkanyok_users SET reset_token = ?, reset_expires = ? WHERE id = ?"
            );
            $upd->bind_param('ssi', $token, $expires, $user['id']);
            $upd->execute();
            $upd->close();

            $link = rtrim(app_config('app.base_url', ''), '/') . '/reset_password.php?token=' . $token;
            send_reset_mail($email, (string)$user['name'], $link);

            if (app_config('app.debug', false)) {
                $devLink = $link;
            }
        }

        // Egységes válasz: ne lehessen kideríteni, mely emailek vannak regisztrálva
        $success = 'Ha létezik fiók ezzel az email címmel, elküldtük rá a visszaállító linket. '
                 . 'A link 1 órán át érvényes.';
    }
}

function send_reset_mail(string $email, string $name, string $link): void
{
    $from    = app_config('app.mail_from', 'admin@localhost');
    $subject = 'Jelszó visszaállítási kérelem';

    $message = '<html><body style="font-family:sans-serif">'
             . '<p>Kedves <strong>' . e($name) . '</strong>,</p>'
             . '<p>Valaki (reméljük Te) kérte a jelszavad visszaállítását.</p>'
             . '<p><a href="' . e($link) . '">' . e($link) . '</a></p>'
             . '<p>A link 1 órán át érvényes. Ha nem te kérted, hagyd figyelmen kívül ezt a levelet.</p>'
             . '<p><strong>NOVA — minden jog fenntartva.</strong></p>'
             . '</body></html>';

    $headers = "MIME-Version: 1.0\r\n"
             . "Content-Type: text/html; charset=UTF-8\r\n"
             . "From: {$from}\r\n";

    @mail($email, $subject, $message, $headers);
}

$pageTitle  = 'Elfelejtett jelszó — Sárkányok és Vikingek';
$pageStyles = ['style/auth.css'];
$bodyClass  = 'page-body auth';
require __DIR__ . '/header.php';
?>

<div class="auth-shell">
  <aside class="auth-aside">
    <div>
      <h2>Elveszett a kulcs?</h2>
      <p>Küldünk egy egyszer használatos linket, amivel új jelszót adhatsz meg.</p>
    </div>

    <?= dragon_render(['id' => 'forgot', 'szin' => '#9d7bff',
                       'test_id' => 6, 'szarny_id' => 6, 'lab_id' => 6, 'fej_id' => 6]) ?>

    <ul class="auth-points">
      <li>A link 1 óráig érvényes</li>
      <li>Egyszeri használat után érvénytelenné válik</li>
    </ul>
  </aside>

  <form class="auth-form" method="post" action="forgot_password.php">
    <h1>Jelszó visszaállítása</h1>
    <p class="auth-sub">Add meg a regisztrált email címedet.</p>

    <?php if ($error): ?>
      <div class="alert alert-error"><span aria-hidden="true">⚠</span><span><?= e($error) ?></span></div>
    <?php endif; ?>
    <?php if ($success): ?>
      <div class="alert alert-success"><span aria-hidden="true">✓</span><span><?= e($success) ?></span></div>
    <?php endif; ?>
    <?php if ($devLink): ?>
      <div class="alert alert-info">
        <span aria-hidden="true">🔧</span>
        <span>Fejlesztői mód — a levélküldés helyett itt a link:<br>
          <a href="<?= e($devLink) ?>"><?= e($devLink) ?></a></span>
      </div>
    <?php endif; ?>

    <?= csrf_field() ?>

    <div class="field">
      <label for="email">Email cím</label>
      <input type="email" id="email" name="email" value="<?= e($email) ?>" required autocomplete="email" autofocus>
    </div>

    <button class="btn btn-primary" type="submit">Link küldése</button>

    <div class="auth-foot">
      <a href="login.php">Vissza a bejelentkezéshez</a>
    </div>
  </form>
</div>

<?php require __DIR__ . '/footer.php';
