<?php
/**
 * Profil: adatok, sárkánygyűjtemény, történetek, barátok.
 *
 * Minden művelet POST + CSRF-token, és minden lekérdezés prepared statement —
 * a korábbi verzióban a $_GET/$_POST értékek közvetlenül az SQL-be kerültek.
 */
require_once __DIR__ . '/inc/bootstrap.php';
require_login();

$conn    = db();
$user_id = current_user_id();
$error   = '';
$success = '';

/* =====================================================================
   Műveletek
   ===================================================================== */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();
    $action = $_POST['action'] ?? '';

    switch ($action) {

        case 'rename_user':
            $new = trim($_POST['new_username'] ?? '');
            if (mb_strlen($new) < 3 || mb_strlen($new) > 32) {
                $error = 'A név 3 és 32 karakter között legyen!';
                break;
            }
            $stmt = $conn->prepare("SELECT id FROM sarkanyok_users WHERE LOWER(name) = LOWER(?) AND id <> ?");
            $stmt->bind_param('si', $new, $user_id);
            $stmt->execute();
            $taken = $stmt->get_result()->num_rows > 0;
            $stmt->close();

            if ($taken) {
                $error = 'Ez a név már foglalt!';
                break;
            }
            $stmt = $conn->prepare("UPDATE sarkanyok_users SET name = ? WHERE id = ?");
            $stmt->bind_param('si', $new, $user_id);
            $stmt->execute();
            $stmt->close();
            $_SESSION['name'] = $new;
            $success = 'Név sikeresen módosítva!';
            break;

        case 'change_password':
            $current = $_POST['current_pass'] ?? '';
            $new     = $_POST['new_pass'] ?? '';

            if (strlen($new) < 8) {
                $error = 'Az új jelszó legalább 8 karakter legyen!';
                break;
            }
            $stmt = $conn->prepare("SELECT password FROM sarkanyok_users WHERE id = ?");
            $stmt->bind_param('i', $user_id);
            $stmt->execute();
            $stored = (string)($stmt->get_result()->fetch_assoc()['password'] ?? '');
            $stmt->close();

            if (!verify_password($current, $stored, $user_id)) {
                $error = 'Hibás jelenlegi jelszó!';
                break;
            }
            $hash = password_hash($new, PASSWORD_DEFAULT);
            $stmt = $conn->prepare("UPDATE sarkanyok_users SET password = ? WHERE id = ?");
            $stmt->bind_param('si', $hash, $user_id);
            $stmt->execute();
            $stmt->close();
            $success = 'Jelszó sikeresen megváltoztatva!';
            break;

        case 'rename_dragon':
            $did = (int)($_POST['dragon_id'] ?? 0);
            $nev = trim($_POST['new_name'] ?? '');
            if ($nev === '') {
                $error = 'A sárkány neve nem lehet üres!';
                break;
            }
            $stmt = $conn->prepare("UPDATE sarkanyok SET nev = ? WHERE id = ? AND user_id = ?");
            $stmt->bind_param('sii', $nev, $did, $user_id);
            $stmt->execute();
            $stmt->close();
            $success = 'Sárkány átnevezve!';
            break;

        case 'recolor_dragon':
            $did  = (int)($_POST['dragon_id'] ?? 0);
            $szin = (string)($_POST['szin'] ?? '');
            if (!preg_match('/^#[0-9a-f]{6}$/i', $szin)) {
                $error = 'Érvénytelen szín!';
                break;
            }
            $stmt = $conn->prepare("UPDATE sarkanyok SET szin = ? WHERE id = ? AND user_id = ?");
            $stmt->bind_param('sii', $szin, $did, $user_id);
            $stmt->execute();
            $stmt->close();
            $success = 'Sárkány átszínezve!';
            break;

        case 'delete_dragon':
            $did  = (int)($_POST['id'] ?? 0);
            $stmt = $conn->prepare("DELETE FROM sarkanyok WHERE id = ? AND user_id = ?");
            $stmt->bind_param('ii', $did, $user_id);
            $stmt->execute();
            $stmt->close();
            $success = 'Sárkány törölve.';
            break;

        case 'delete_story':
            $sid  = (int)($_POST['id'] ?? 0);
            $stmt = $conn->prepare("DELETE FROM sarkanyok_story WHERE id = ? AND user_id = ?");
            $stmt->bind_param('ii', $sid, $user_id);
            $stmt->execute();
            $stmt->close();
            $success = 'Történet törölve.';
            break;

        case 'add_friend':
            $fname = trim($_POST['friend_name'] ?? '');
            $stmt  = $conn->prepare("SELECT id FROM sarkanyok_users WHERE LOWER(name) = LOWER(?)");
            $stmt->bind_param('s', $fname);
            $stmt->execute();
            $friend = $stmt->get_result()->fetch_assoc();
            $stmt->close();

            if (!$friend) {
                $error = 'Nincs ilyen felhasználó!';
                break;
            }
            $fid = (int)$friend['id'];
            if ($fid === $user_id) {
                $error = 'Magadat nem jelölheted be.';
                break;
            }

            $stmt = $conn->prepare(
                "SELECT id FROM sarkanyok_friends
                  WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
            );
            $stmt->bind_param('iiii', $user_id, $fid, $fid, $user_id);
            $stmt->execute();
            $exists = $stmt->get_result()->num_rows > 0;
            $stmt->close();

            if ($exists) {
                $error = 'Már van közöttetek kapcsolat vagy függő kérelem!';
                break;
            }
            $stmt = $conn->prepare(
                "INSERT INTO sarkanyok_friends (user_id, friend_id, status) VALUES (?, ?, 0)"
            );
            $stmt->bind_param('ii', $user_id, $fid);
            $stmt->execute();
            $stmt->close();
            $success = 'Barátkérés elküldve!';
            break;

        case 'accept_friend':
            $fid  = (int)($_POST['id'] ?? 0);
            $stmt = $conn->prepare(
                "UPDATE sarkanyok_friends SET status = 1 WHERE user_id = ? AND friend_id = ? AND status = 0"
            );
            $stmt->bind_param('ii', $fid, $user_id);
            $stmt->execute();
            $stmt->close();
            $success = 'Barátkérés elfogadva!';
            break;

        case 'delete_friend':
            $fid  = (int)($_POST['id'] ?? 0);
            $stmt = $conn->prepare(
                "DELETE FROM sarkanyok_friends
                  WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)"
            );
            $stmt->bind_param('iiii', $user_id, $fid, $fid, $user_id);
            $stmt->execute();
            $stmt->close();
            $success = 'Kapcsolat törölve.';
            break;
    }

    // POST/Redirect/GET: az üzenetet a session viszi át, így frissítéskor
    // nem küldi újra a böngésző az űrlapot.
    $_SESSION['flash'] = ['error' => $error, 'success' => $success];
    header('Location: user.php' . (isset($_POST['return_tab']) ? '#' . preg_replace('/\W/', '', $_POST['return_tab']) : ''));
    exit;
}

if (!empty($_SESSION['flash'])) {
    $error   = $_SESSION['flash']['error']   ?? '';
    $success = $_SESSION['flash']['success'] ?? '';
    unset($_SESSION['flash']);
}

/* =====================================================================
   Adatok
   ===================================================================== */
$stmt = $conn->prepare("SELECT * FROM sarkanyok_users WHERE id = ?");
$stmt->bind_param('i', $user_id);
$stmt->execute();
$user = $stmt->get_result()->fetch_assoc();
$stmt->close();

if (!$user) {                       // a fiókot időközben törölték
    header('Location: logout.php');
    exit;
}

/** Egy paraméteres lekérdezés összes sora. */
function fetch_all_for_user(mysqli $conn, string $sql, int $id): array
{
    $stmt = $conn->prepare($sql);
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $rows = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
    $stmt->close();
    return $rows;
}

$dragons = fetch_all_for_user($conn,
    "SELECT id, nev, szin, test_id, szarny_id, lab_id, fej_id, hp, dmg, wins, losses
       FROM sarkanyok WHERE user_id = ? ORDER BY (hp * 0.6 + dmg * 4) DESC, id DESC", $user_id);

$stories = fetch_all_for_user($conn,
    "SELECT id, name, provenance, weapon, dragon, story, created_at
       FROM sarkanyok_story WHERE user_id = ? ORDER BY id DESC", $user_id);

// A barátlista három paramétert vár, ezért nem a segédfüggvényt használjuk
$stmt = $conn->prepare(
    "SELECT u.id, u.name,
            (SELECT COUNT(*) FROM sarkanyok d WHERE d.user_id = u.id) AS dragon_count
       FROM sarkanyok_friends f
       JOIN sarkanyok_users u
         ON u.id = IF(f.user_id = ?, f.friend_id, f.user_id)
      WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 1"
);
$stmt->bind_param('iii', $user_id, $user_id, $user_id);
$stmt->execute();
$friends = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$requests = fetch_all_for_user($conn,
    "SELECT u.id, u.name
       FROM sarkanyok_friends f
       JOIN sarkanyok_users u ON u.id = f.user_id
      WHERE f.friend_id = ? AND f.status = 0", $user_id);

$totalHp  = array_sum(array_column($dragons, 'hp'));
$totalDmg = array_sum(array_column($dragons, 'dmg'));
$totalWin = array_sum(array_column($dragons, 'wins'));

$pageTitle  = e($user['name']) . ' profilja — Sárkányok és Vikingek';
$pageStyles = ['style/profile.css'];
require __DIR__ . '/header.php';
?>

<div class="wrap profile-wrap">

  <!-- ===== Fejléc ===== -->
  <header class="profile-hero card">
    <div class="profile-avatar"><?= e(mb_substr((string)$user['name'], 0, 1)) ?></div>
    <div class="profile-ident">
      <h1><?= e($user['name']) ?></h1>
      <p class="muted mb-0">
        <?= e($user['email']) ?>
        <?php if ((int)$user['is_admin'] === 1): ?>
          · <span class="badge badge-ember">Admin</span>
        <?php endif; ?>
        <?php if ($user['created_at']): ?>
          · csatlakozott <?= e(date('Y. m. d.', strtotime((string)$user['created_at']))) ?>
        <?php endif; ?>
      </p>
    </div>
    <dl class="profile-kpis">
      <div><dt>Sárkány</dt>    <dd><span data-count-to="<?= count($dragons) ?>">0</span></dd></div>
      <div><dt>Összes HP</dt>  <dd><span data-count-to="<?= $totalHp ?>">0</span></dd></div>
      <div><dt>Összes DMG</dt> <dd><span data-count-to="<?= $totalDmg ?>">0</span></dd></div>
      <div><dt>Győzelem</dt>   <dd><span data-count-to="<?= $totalWin ?>">0</span></dd></div>
    </dl>
  </header>

  <?php if ($error): ?>
    <div class="alert alert-error"><span aria-hidden="true">⚠</span><span><?= e($error) ?></span></div>
  <?php endif; ?>
  <?php if ($success): ?>
    <div class="alert alert-success"><span aria-hidden="true">✓</span><span><?= e($success) ?></span></div>
  <?php endif; ?>

  <!-- ===== Fülek ===== -->
  <nav class="tabs" role="tablist">
    <button class="tab active" data-tab="dragons" role="tab">🐉 Sárkányaim <span class="tab-count"><?= count($dragons) ?></span></button>
    <button class="tab" data-tab="stories" role="tab">📜 Történetek <span class="tab-count"><?= count($stories) ?></span></button>
    <button class="tab" data-tab="friends" role="tab">🤝 Barátok <span class="tab-count"><?= count($friends) ?></span>
      <?php if ($requests): ?><span class="tab-dot" title="Függő kérelem"></span><?php endif; ?>
    </button>
    <button class="tab" data-tab="settings" role="tab">⚙️ Beállítások</button>
  </nav>

  <!-- ===== Sárkányok ===== -->
  <section class="tab-panel active" id="panel-dragons">
    <?php if (!$dragons): ?>
      <div class="card empty-state">
        <span class="empty-icon">🥚</span>
        <h3>Még nincs sárkányod</h3>
        <p class="muted">Töltsd ki a kérdőívet, vagy építs egyet a műhelyben.</p>
        <div class="flex-center">
          <a class="btn btn-primary" href="quiz.php">Kérdőív</a>
          <a class="btn" href="nyitott.php">Műhely</a>
        </div>
      </div>
    <?php else: ?>
      <div class="grid grid-4">
        <?php foreach ($dragons as $d):
          $power = dragon_power($d); ?>
          <article class="card card-spotlight my-dragon">
            <?= dragon_render($d) ?>

            <div class="my-dragon-stats">
              <span class="badge badge-ice">❤ <?= (int)$d['hp'] ?></span>
              <span class="badge badge-ember">⚔ <?= (int)$d['dmg'] ?></span>
              <span class="badge badge-rare">Erő <?= $power ?></span>
            </div>

            <?php if ((int)$d['wins'] || (int)$d['losses']): ?>
              <p class="my-dragon-record muted">
                🏆 <?= (int)$d['wins'] ?> Gy · 💀 <?= (int)$d['losses'] ?> V
              </p>
            <?php endif; ?>

            <form method="post" class="dragon-edit">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="rename_dragon">
              <input type="hidden" name="dragon_id" value="<?= (int)$d['id'] ?>">
              <input type="text" name="new_name" value="<?= e($d['nev']) ?>" maxlength="60" required>
              <button class="btn btn-sm" type="submit" title="Átnevezés">✓</button>
            </form>

            <div class="dragon-actions">
              <form method="post" class="recolor">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="recolor_dragon">
                <input type="hidden" name="dragon_id" value="<?= (int)$d['id'] ?>">
                <input type="color" name="szin" value="<?= e($d['szin']) ?>" title="Szín"
                       onchange="this.form.submit()">
              </form>

              <form method="post" onsubmit="return confirm('Biztosan törlöd ezt a sárkányt?');">
                <?= csrf_field() ?>
                <input type="hidden" name="action" value="delete_dragon">
                <input type="hidden" name="id" value="<?= (int)$d['id'] ?>">
                <button class="btn btn-sm btn-danger" type="submit">Törlés</button>
              </form>
            </div>
          </article>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </section>

  <!-- ===== Történetek ===== -->
  <section class="tab-panel" id="panel-stories">
    <?php if (!$stories): ?>
      <div class="card empty-state">
        <span class="empty-icon">📜</span>
        <h3>Még nincs történeted</h3>
        <p class="muted">A mesélő megírja a saját viking legendádat — legfeljebb hármat.</p>
        <a class="btn btn-primary" href="story.php">Történetet írok</a>
      </div>
    <?php else: ?>
      <div class="story-grid">
        <?php foreach ($stories as $s): ?>
          <article class="card story-card">
            <header class="story-head">
              <h3><?= e($s['name']) ?></h3>
              <span class="badge"><?= e($s['provenance']) ?></span>
            </header>
            <p class="story-meta muted">
              ⚔ <?= e($s['weapon']) ?> · 🐉 <?= e($s['dragon']) ?>
              <?php if ($s['created_at']): ?>
                · <?= e(date('Y. m. d.', strtotime((string)$s['created_at']))) ?>
              <?php endif; ?>
            </p>
            <p class="story-text"><?= nl2br(e($s['story'])) ?></p>
            <form method="post" onsubmit="return confirm('Biztosan törlöd ezt a történetet?');">
              <?= csrf_field() ?>
              <input type="hidden" name="action" value="delete_story">
              <input type="hidden" name="id" value="<?= (int)$s['id'] ?>">
              <button class="btn btn-sm btn-danger" type="submit">Törlés</button>
            </form>
          </article>
        <?php endforeach; ?>
      </div>
    <?php endif; ?>
  </section>

  <!-- ===== Barátok ===== -->
  <section class="tab-panel" id="panel-friends">
    <div class="friends-layout">
      <div class="card">
        <h3>Barát hozzáadása</h3>
        <form method="post" class="flex" style="align-items:flex-end">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="add_friend">
          <div style="flex:1">
            <label for="friend_name">Felhasználónév</label>
            <input type="text" id="friend_name" name="friend_name" placeholder="pl. Ragnar" required>
          </div>
          <button class="btn btn-primary" type="submit">Küldés</button>
        </form>
      </div>

      <?php if ($requests): ?>
        <div class="card">
          <h3>Függő kérelmek <span class="badge badge-ember"><?= count($requests) ?></span></h3>
          <ul class="friend-list">
            <?php foreach ($requests as $r): ?>
              <li>
                <span class="friend-avatar"><?= e(mb_substr((string)$r['name'], 0, 1)) ?></span>
                <span class="friend-name"><?= e($r['name']) ?></span>
                <form method="post">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="accept_friend">
                  <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
                  <button class="btn btn-sm btn-primary" type="submit">Elfogad</button>
                </form>
                <form method="post">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="delete_friend">
                  <input type="hidden" name="id" value="<?= (int)$r['id'] ?>">
                  <button class="btn btn-sm btn-danger" type="submit">Elutasít</button>
                </form>
              </li>
            <?php endforeach; ?>
          </ul>
        </div>
      <?php endif; ?>

      <div class="card">
        <h3>Barátaid <span class="badge"><?= count($friends) ?></span></h3>
        <?php if (!$friends): ?>
          <p class="muted mb-0">Még nincs barátod. Add hozzá valakit a neve alapján!</p>
        <?php else: ?>
          <ul class="friend-list">
            <?php foreach ($friends as $f): ?>
              <li>
                <span class="friend-avatar"><?= e(mb_substr((string)$f['name'], 0, 1)) ?></span>
                <span class="friend-name">
                  <?= e($f['name']) ?>
                  <small class="muted"><?= (int)$f['dragon_count'] ?> sárkány</small>
                </span>
                <a class="btn btn-sm" href="arena.php?vs=<?= (int)$f['id'] ?>">⚔ Kihívás</a>
                <form method="post" onsubmit="return confirm('Biztosan törlöd a barátot?');">
                  <?= csrf_field() ?>
                  <input type="hidden" name="action" value="delete_friend">
                  <input type="hidden" name="id" value="<?= (int)$f['id'] ?>">
                  <button class="btn btn-sm btn-danger" type="submit">Törlés</button>
                </form>
              </li>
            <?php endforeach; ?>
          </ul>
        <?php endif; ?>
      </div>
    </div>
  </section>

  <!-- ===== Beállítások ===== -->
  <section class="tab-panel" id="panel-settings">
    <div class="settings-layout">
      <div class="card">
        <h3>Felhasználónév</h3>
        <form method="post">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="rename_user">
          <div class="field">
            <label for="new_username">Új név</label>
            <input type="text" id="new_username" name="new_username"
                   value="<?= e($user['name']) ?>" minlength="3" maxlength="32" required>
          </div>
          <button class="btn btn-primary" type="submit">Mentés</button>
        </form>
      </div>

      <div class="card">
        <h3>Jelszó módosítása</h3>
        <form method="post">
          <?= csrf_field() ?>
          <input type="hidden" name="action" value="change_password">
          <div class="field">
            <label for="current_pass">Jelenlegi jelszó</label>
            <input type="password" id="current_pass" name="current_pass" required autocomplete="current-password">
          </div>
          <div class="field">
            <label for="new_pass">Új jelszó</label>
            <input type="password" id="new_pass" name="new_pass" required minlength="8" autocomplete="new-password">
          </div>
          <button class="btn btn-primary" type="submit">Jelszó cseréje</button>
        </form>
      </div>
    </div>
  </section>

</div>

<script>
  // Fülek
  (() => {
    const tabs   = document.querySelectorAll('.tab');
    const panels = document.querySelectorAll('.tab-panel');

    const show = (name) => {
      tabs.forEach((t)   => t.classList.toggle('active', t.dataset.tab === name));
      panels.forEach((p) => p.classList.toggle('active', p.id === `panel-${name}`));
      history.replaceState(null, '', `#${name}`);
    };

    tabs.forEach((t) => t.addEventListener('click', () => show(t.dataset.tab)));

    const initial = location.hash.slice(1);
    if (initial && document.getElementById(`panel-${initial}`)) show(initial);
  })();
</script>

<?php require __DIR__ . '/footer.php';
