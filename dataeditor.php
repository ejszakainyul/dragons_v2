<?php
/**
 * Admin adatkezelő: a táblák böngészése, lapozással.
 * Csak olvasás — a jelszó-hash és a reset token soha nem jelenik meg.
 */
require_once __DIR__ . '/inc/bootstrap.php';
require_login();

if (!is_admin()) {
    http_response_code(403);
    $pageTitle = 'Nincs jogosultság';
    require __DIR__ . '/header.php';
    echo '<div class="wrap"><div class="alert alert-error">'
       . '<span aria-hidden="true">⛔</span><span>Nincs jogosultságod az oldal megtekintéséhez.</span>'
       . '</div></div>';
    require __DIR__ . '/footer.php';
    exit;
}

$conn = db();

/** Csak ezek a táblák nézhetők — a nevük soha nem user inputból kerül az SQL-be. */
$tables = [
    'sarkanyok'         => 'Sárkányok',
    'sarkanyok_users'   => 'Felhasználók',
    'sarkanyok_story'   => 'Történetek',
    'sarkanyok_friends' => 'Barátságok',
    'sarkanyok_battles' => 'Csaták',
    'sarkanyok_fej'     => 'Fejek',
    'sarkanyok_test'    => 'Testek',
    'sarkanyok_lab'     => 'Lábak',
    'sarkanyok_szarny'  => 'Szárnyak',
];

/** Sosem jelenítjük meg ezeket az oszlopokat. */
$hiddenColumns = ['password', 'reset_token'];

$selected = $_GET['table'] ?? array_key_first($tables);
if (!array_key_exists($selected, $tables)) {
    $selected = array_key_first($tables);
}

$perPage = 25;
$page    = max(1, (int)($_GET['p'] ?? 1));
$offset  = ($page - 1) * $perPage;

$total = (int)$conn->query("SELECT COUNT(*) AS c FROM `{$selected}`")->fetch_assoc()['c'];
$pages = max(1, (int)ceil($total / $perPage));
if ($page > $pages) {
    $page   = $pages;
    $offset = ($page - 1) * $perPage;
}

$stmt = $conn->prepare("SELECT * FROM `{$selected}` ORDER BY 1 DESC LIMIT ? OFFSET ?");
$stmt->bind_param('ii', $perPage, $offset);
$stmt->execute();
$result  = $stmt->get_result();
$columns = array_map(static fn($f) => $f->name, $result->fetch_fields());
$rows    = $result->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$visibleColumns = array_values(array_diff($columns, $hiddenColumns));

/* Táblánkénti darabszám a fülekhez */
$counts = [];
foreach (array_keys($tables) as $t) {
    $counts[$t] = (int)$conn->query("SELECT COUNT(*) AS c FROM `{$t}`")->fetch_assoc()['c'];
}

$pageTitle  = 'Adatkezelő — Sárkányok és Vikingek';
$pageStyles = ['style/admin.css'];
require __DIR__ . '/header.php';
?>

<div class="wrap admin-wrap">
  <header class="admin-head">
    <div>
      <h1>Adatkezelő</h1>
      <p class="muted mb-0">Bejelentkezve: <strong><?= e($_SESSION['email'] ?? '') ?></strong> · csak olvasás</p>
    </div>
    <span class="badge badge-ember">admin</span>
  </header>

  <nav class="admin-tabs">
    <?php foreach ($tables as $key => $label): ?>
      <a href="?table=<?= e($key) ?>" class="<?= $selected === $key ? 'active' : '' ?>">
        <?= e($label) ?><span class="tab-count"><?= $counts[$key] ?></span>
      </a>
    <?php endforeach; ?>
  </nav>

  <div class="card admin-card">
    <header class="admin-card-head">
      <h2><?= e($tables[$selected]) ?> <code><?= e($selected) ?></code></h2>
      <span class="muted"><?= $total ?> sor · <?= $page ?>. oldal / <?= $pages ?></span>
    </header>

    <?php if (!$rows): ?>
      <p class="muted">Nincsenek adatok ebben a táblában.</p>
    <?php else: ?>
      <div class="table-scroll">
        <table>
          <thead>
            <tr><?php foreach ($visibleColumns as $col): ?><th><?= e($col) ?></th><?php endforeach; ?></tr>
          </thead>
          <tbody>
            <?php foreach ($rows as $row): ?>
              <tr>
                <?php foreach ($visibleColumns as $col):
                  $value = (string)($row[$col] ?? '');
                  $short = mb_strlen($value) > 90 ? mb_substr($value, 0, 90) . '…' : $value; ?>
                  <td <?= $short !== $value ? 'title="' . e($value) . '"' : '' ?>>
                    <?php if ($col === 'szin' && preg_match('/^#[0-9a-f]{6}$/i', $value)): ?>
                      <span class="swatch" style="background:<?= e($value) ?>"></span><?= e($value) ?>
                    <?php else: ?>
                      <?= e($short) ?>
                    <?php endif; ?>
                  </td>
                <?php endforeach; ?>
              </tr>
            <?php endforeach; ?>
          </tbody>
        </table>
      </div>

      <?php if ($pages > 1): ?>
        <nav class="admin-pager">
          <?php for ($i = 1; $i <= $pages; $i++): ?>
            <a href="?table=<?= e($selected) ?>&p=<?= $i ?>"
               class="<?= $i === $page ? 'active' : '' ?>"><?= $i ?></a>
          <?php endfor; ?>
        </nav>
      <?php endif; ?>
    <?php endif; ?>
  </div>

  <?php if (in_array('hp', $columns, true) && in_array('dmg', $columns, true)): ?>
    <p class="muted" style="margin-top:18px;font-size:.88rem">
      Tipp: a testrészek statjait a <code>sql/seed.sql</code> fájlban szerkesztheted,
      majd futtasd újra az <a href="install.php">install.php</a>-t.
    </p>
  <?php endif; ?>
</div>

<?php require __DIR__ . '/footer.php';
