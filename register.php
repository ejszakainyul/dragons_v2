<?php
require_once __DIR__ . '/inc/bootstrap.php';

if (is_logged_in()) {
    header('Location: index.php');
    exit;
}

$error    = '';
$username = '';
$email    = '';

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $username = trim($_POST['username'] ?? '');
    $email    = trim($_POST['email'] ?? '');
    $password = $_POST['password'] ?? '';

    if ($username === '' || $email === '' || $password === '') {
        $error = 'Kérlek töltsd ki az összes mezőt!';
    } elseif (mb_strlen($username) < 3 || mb_strlen($username) > 32) {
        $error = 'A felhasználónév 3 és 32 karakter között legyen!';
    } elseif (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
        $error = 'Kérlek adj meg egy érvényes email címet!';
    } elseif (strlen($password) < 8) {
        $error = 'A jelszó legalább 8 karakter hosszú legyen!';
    } else {
        $conn = db();

        $stmt = $conn->prepare(
            "SELECT id FROM sarkanyok_users
              WHERE LOWER(email) = LOWER(?) OR LOWER(name) = LOWER(?)"
        );
        $stmt->bind_param('ss', $email, $username);
        $stmt->execute();
        $taken = $stmt->get_result()->num_rows > 0;
        $stmt->close();

        if ($taken) {
            $error = 'Ez az email cím vagy felhasználónév már foglalt!';
        } else {
            $hash = password_hash($password, PASSWORD_DEFAULT);

            try {
                $stmt = $conn->prepare(
                    "INSERT INTO sarkanyok_users (name, email, password, is_admin)
                     VALUES (?, ?, ?, 0)"
                );
                $stmt->bind_param('sss', $username, $email, $hash);
                $stmt->execute();
                $newId = $stmt->insert_id;
                $stmt->close();

                send_welcome_mail($username, $email);

                login_user([
                    'id'       => $newId,
                    'name'     => $username,
                    'email'    => $email,
                    'is_admin' => 0,
                ]);

                header('Location: quiz.php');
                exit;
            } catch (mysqli_sql_exception $e) {
                // Versenyhelyzet: a két kérés között foglalták le a nevet
                $error = 'Ez az email cím vagy felhasználónév már foglalt!';
            }
        }
    }
}

/** Üdvözlő levél — ha nincs beállítva mailer, csendben kihagyja. */
function send_welcome_mail(string $username, string $email): void
{
    $from    = app_config('app.mail_from', 'admin@localhost');
    $subject = 'Regisztráció megerősítése';

    $message = '<html><body style="font-family:sans-serif">'
             . '<p>Kedves <strong>' . e($username) . '</strong>,</p>'
             . '<p>Sikeresen regisztráltál a <strong>Sárkányok és Vikingek</strong> világába!</p>'
             . '<ul>'
             . '<li><strong>Felhasználónév:</strong> ' . e($username) . '</li>'
             . '<li><strong>E-mail cím:</strong> ' . e($email) . '</li>'
             . '<li><strong>Regisztráció:</strong> ' . date('Y-m-d H:i') . '</li>'
             . '</ul>'
             . '<p>Üdvözlünk a közösségben!</p>'
             . '<p><strong>NOVA — minden jog fenntartva.</strong></p>'
             . '</body></html>';

    $headers = "MIME-Version: 1.0\r\n"
             . "Content-Type: text/html; charset=UTF-8\r\n"
             . "From: {$from}\r\n";

    // A @ elnyeli a hibát, ha a szerveren nincs beállítva levélküldés
    @mail($email, $subject, $message, $headers);
}

$pageTitle  = 'Regisztráció — Sárkányok és Vikingek';
$pageStyles = ['style/auth.css'];
$bodyClass  = 'page-body auth';
require __DIR__ . '/header.php';
?>

<div class="auth-shell">
  <aside class="auth-aside">
    <div>
      <h2>Kezdd el a sagádat</h2>
      <p>Egy fiók, és máris a tiéd az első sárkány — a kérdőív dönti el, melyik.</p>
    </div>

    <?= dragon_render(['id' => 'reg', 'szin' => '#4fd6ff',
                       'test_id' => 4, 'szarny_id' => 4, 'lab_id' => 4, 'fej_id' => 4]) ?>

    <ul class="auth-points">
      <li>Saját sárkánygyűjtemény, korlátlan műhelymunkával</li>
      <li>Aréna, barátlista és ranglista</li>
      <li>Három AI-történet a saját viking karakteredről</li>
    </ul>
  </aside>

  <form class="auth-form" method="post" action="register.php">
    <h1>Regisztráció</h1>
    <p class="auth-sub">Pár másodperc, és indulhat a kaland.</p>

    <?php if ($error): ?>
      <div class="alert alert-error"><span aria-hidden="true">⚠</span><span><?= e($error) ?></span></div>
    <?php endif; ?>

    <?= csrf_field() ?>

    <div class="field">
      <label for="username">Felhasználónév</label>
      <input type="text" id="username" name="username" value="<?= e($username) ?>"
             required minlength="3" maxlength="32" autocomplete="username" autofocus>
    </div>

    <div class="field">
      <label for="email">Email cím</label>
      <input type="email" id="email" name="email" value="<?= e($email) ?>" required autocomplete="email">
    </div>

    <div class="field">
      <label for="password">Jelszó</label>
      <input type="password" id="password" name="password" required minlength="8" autocomplete="new-password">
      <div class="pw-meter" id="pwMeter" data-score="0"><i></i><i></i><i></i><i></i></div>
      <p class="pw-hint">Legalább 8 karakter. Kis- és nagybetű, szám, jel erősíti.</p>
    </div>

    <button class="btn btn-primary" type="submit">Fiók létrehozása</button>

    <div class="auth-foot">
      <span>Van már fiókod? <a href="login.php">Lépj be</a></span>
    </div>
  </form>
</div>

<script>
  // Egyszerű jelszóerősség-visszajelzés
  (() => {
    const input = document.getElementById('password');
    const meter = document.getElementById('pwMeter');
    if (!input || !meter) return;

    input.addEventListener('input', () => {
      const v = input.value;
      let score = 0;
      if (v.length >= 8)                score++;
      if (/[a-z]/.test(v) && /[A-Z]/.test(v)) score++;
      if (/\d/.test(v))                 score++;
      if (/[^\w\s]/.test(v) || v.length >= 14) score++;
      meter.dataset.score = v ? String(score) : '0';
    });
  })();
</script>

<?php require __DIR__ . '/footer.php';
