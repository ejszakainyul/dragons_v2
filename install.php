<?php
/**
 * Telepítő / adatbázis-helyreállító.
 *
 * Létrehozza a `sarkanyok` adatbázist, lefuttatja a sql/schema.sql és
 * sql/seed.sql fájlokat, majd opcionálisan létrehoz egy admin felhasználót.
 *
 * Ha kész a telepítés, töröld ezt a fájlt (vagy állítsd az INSTALL_LOCKED-et true-ra).
 */

const INSTALL_LOCKED = false;

$cfg = require __DIR__ . '/config.php';
$db  = $cfg['db'];

$log      = [];
$errors   = [];
$done     = false;
$adminMsg = null;

function step(array &$log, string $text, bool $ok = true): void
{
    $log[] = ['text' => $text, 'ok' => $ok];
}

/**
 * Egy .sql fájlt bont fel utasításokra és futtat le.
 * Egyszerű splitter: elég a saját, kommentezett sémafájljainkhoz.
 */
function run_sql_file(mysqli $conn, string $file, array &$log, array &$errors): void
{
    $sql = file_get_contents($file);
    if ($sql === false) {
        $errors[] = "Nem olvasható: $file";
        return;
    }

    // Sorkommentek eltávolítása
    $sql = preg_replace('/^\s*--.*$/m', '', $sql);

    $statements = array_filter(
        array_map('trim', explode(';', $sql)),
        static fn($s) => $s !== ''
    );

    foreach ($statements as $stmt) {
        try {
            $conn->query($stmt);
        } catch (mysqli_sql_exception $e) {
            $errors[] = basename($file) . ': ' . $e->getMessage();
            return;
        }
    }
    step($log, basename($file) . ' lefuttatva (' . count($statements) . ' utasítás)');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !INSTALL_LOCKED) {
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

    try {
        $conn = new mysqli($db['host'], $db['user'], $db['pass'], '', (int)$db['port']);
        $conn->set_charset('utf8mb4');
        step($log, "Kapcsolódva a MySQL szerverhez ({$db['host']}:{$db['port']})");

        run_sql_file($conn, __DIR__ . '/sql/schema.sql', $log, $errors);

        if (!$errors) {
            $conn->select_db($db['name']);
            run_sql_file($conn, __DIR__ . '/sql/seed.sql', $log, $errors);
        }

        // --- Admin felhasználó -------------------------------------------
        $adminName  = trim($_POST['admin_name'] ?? '');
        $adminEmail = trim($_POST['admin_email'] ?? '');
        $adminPass  = $_POST['admin_pass'] ?? '';

        if (!$errors && $adminName !== '' && $adminEmail !== '' && $adminPass !== '') {
            $hash = password_hash($adminPass, PASSWORD_DEFAULT);
            $stmt = $conn->prepare(
                "INSERT INTO sarkanyok_users (name, email, password, is_admin)
                 VALUES (?, ?, ?, 1)
                 ON DUPLICATE KEY UPDATE password = VALUES(password), is_admin = 1"
            );
            $stmt->bind_param('sss', $adminName, $adminEmail, $hash);
            $stmt->execute();
            $stmt->close();
            $adminMsg = "Admin felhasználó kész: <strong>" . htmlspecialchars($adminEmail) . "</strong>";
            step($log, 'Admin felhasználó létrehozva / frissítve');
        }

        // --- Meglévő data.json visszatöltése ------------------------------
        if (!$errors && !empty($_POST['import_json']) && is_file(__DIR__ . '/data.json')) {
            $rows = json_decode((string)file_get_contents(__DIR__ . '/data.json'), true);
            if (is_array($rows)) {
                // A sárkányokhoz kell felhasználó; hozzunk létre helyőrzőket.
                $userIds = [];
                foreach ($rows as $r) {
                    $uid = (int)($r['user_id'] ?? 0);
                    if ($uid > 0) {
                        $userIds[$uid] = true;
                    }
                }
                $ins = $conn->prepare(
                    "INSERT IGNORE INTO sarkanyok_users (id, name, email, password, is_admin)
                     VALUES (?, ?, ?, '', 0)"
                );
                foreach (array_keys($userIds) as $uid) {
                    $n = "jatekos$uid";
                    $e = "jatekos$uid@example.invalid";
                    $ins->bind_param('iss', $uid, $n, $e);
                    $ins->execute();
                }
                $ins->close();

                $ins = $conn->prepare(
                    "INSERT IGNORE INTO sarkanyok
                        (id, user_id, nev, szin, test_id, szarny_id, lab_id, fej_id, hp, dmg)
                     VALUES (?, ?, ?, ?, ?, ?, ?, ?, 0, 0)"
                );
                $imported = 0;
                foreach ($rows as $r) {
                    $id   = (int)($r['id'] ?? 0);
                    $uid  = (int)($r['user_id'] ?? 0);
                    $nev  = trim((string)($r['nev'] ?? ''), " \"\t\n");
                    if ($id <= 0 || $uid <= 0 || $nev === '') {
                        continue; // üres/hibás sorok kihagyása
                    }
                    $szin = (string)($r['szin'] ?? '#ff0000');
                    // A régi export néha színnevet tárolt hex helyett
                    $map  = ['piros' => '#e63946', 'kek' => '#457b9d', 'zold' => '#2a9d8f'];
                    $szin = $map[mb_strtolower($szin)] ?? $szin;
                    $t = max(1, (int)($r['test_id']   ?? 1));
                    $s = max(1, (int)($r['szarny_id'] ?? 1));
                    $l = max(1, (int)($r['lab_id']    ?? 1));
                    $f = max(1, (int)($r['fej_id']    ?? 1));
                    $ins->bind_param('iissiiii', $id, $uid, $nev, $szin, $t, $s, $l, $f);
                    $ins->execute();
                    $imported++;
                }
                $ins->close();

                // Statok újraszámolása a katalógusból
                $conn->query(
                    "UPDATE sarkanyok d
                        LEFT JOIN sarkanyok_test   t ON t.id = d.test_id
                        LEFT JOIN sarkanyok_szarny s ON s.id = d.szarny_id
                        LEFT JOIN sarkanyok_lab    l ON l.id = d.lab_id
                        LEFT JOIN sarkanyok_fej    f ON f.id = d.fej_id
                        SET d.hp  = COALESCE(t.hp,0)+COALESCE(s.hp,0)+COALESCE(l.hp,0)+COALESCE(f.hp,0),
                            d.dmg = COALESCE(t.dmg,0)+COALESCE(s.dmg,0)+COALESCE(l.dmg,0)+COALESCE(f.dmg,0)
                      WHERE d.hp = 0 AND d.dmg = 0"
                );
                step($log, "data.json visszatöltve ($imported sárkány)");
            }
        }

        if (!$errors) {
            $done = true;
        }
    } catch (mysqli_sql_exception $e) {
        $errors[] = $e->getMessage();
    }
}

// Állapot: létezik-e már az adatbázis?
$dbExists = false;
$tableCount = 0;
try {
    mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);
    $probe = new mysqli($db['host'], $db['user'], $db['pass'], $db['name'], (int)$db['port']);
    $dbExists = true;
    $res = $probe->query("SHOW TABLES LIKE 'sarkanyok%'");
    $tableCount = $res ? $res->num_rows : 0;
    $probe->close();
} catch (mysqli_sql_exception $e) {
    $dbExists = false;
}
?>
<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width,initial-scale=1">
<title>Telepítő — Sárkányok és Vikingek</title>
<link rel="stylesheet" href="style/theme.css">
<style>
  body{min-height:100vh;display:grid;place-items:start center;padding:40px 20px 80px}
  .install-card{width:min(720px,100%);background:var(--surface);border:1px solid var(--line);
                border-radius:var(--r-lg);padding:38px;box-shadow:var(--shadow-lg)}
  h1{margin:0 0 6px;font-size:1.9rem}
  .sub{color:var(--muted);margin:0 0 26px}
  .status{display:flex;gap:12px;align-items:center;padding:14px 16px;border-radius:var(--r-md);
          background:var(--surface-2);border:1px solid var(--line);margin-bottom:24px}
  .dot{width:10px;height:10px;border-radius:50%;flex:none}
  .dot.on{background:var(--ok);box-shadow:0 0 12px var(--ok)}
  .dot.off{background:var(--danger);box-shadow:0 0 12px var(--danger)}
  fieldset{border:1px solid var(--line);border-radius:var(--r-md);padding:18px 20px;margin:0 0 20px}
  legend{padding:0 8px;color:var(--accent);font-weight:600;letter-spacing:.04em}
  label{display:block;margin:12px 0 6px;color:var(--muted);font-size:.9rem}
  input[type=text],input[type=email],input[type=password]{width:100%}
  .checkline{display:flex;gap:10px;align-items:flex-start;margin-top:14px;color:var(--muted);font-size:.9rem}
  .log{list-style:none;padding:0;margin:0 0 20px}
  .log li{padding:9px 14px;border-radius:10px;background:var(--surface-2);margin-bottom:7px;
          border-left:3px solid var(--ok);font-size:.92rem}
  .log li.bad{border-left-color:var(--danger);color:#ffb4b4}
  .done{padding:20px;border-radius:var(--r-md);background:rgba(45,212,191,.1);
        border:1px solid var(--ok);margin-bottom:20px}
  .done a{display:inline-block;margin-top:10px}
</style>
</head>
<body>
<div class="install-card">
  <h1>🐉 Telepítő</h1>
  <p class="sub">Az adatbázis helyreállítása a <code>sql/</code> mappában lévő sémából.</p>

  <div class="status">
    <span class="dot <?= $dbExists ? 'on' : 'off' ?>"></span>
    <span>
      <?php if ($dbExists): ?>
        A(z) <code><?= htmlspecialchars($db['name']) ?></code> adatbázis létezik —
        <strong><?= $tableCount ?></strong> tábla található benne.
      <?php else: ?>
        A(z) <code><?= htmlspecialchars($db['name']) ?></code> adatbázis még nem létezik.
      <?php endif; ?>
    </span>
  </div>

  <?php foreach ($errors as $e): ?>
    <ul class="log"><li class="bad"><?= htmlspecialchars($e) ?></li></ul>
  <?php endforeach; ?>

  <?php if ($log): ?>
    <ul class="log">
      <?php foreach ($log as $l): ?>
        <li class="<?= $l['ok'] ? '' : 'bad' ?>"><?= $l['text'] ?></li>
      <?php endforeach; ?>
    </ul>
  <?php endif; ?>

  <?php if ($done): ?>
    <div class="done">
      <strong>Kész! Az adatbázis felállt.</strong>
      <?php if ($adminMsg): ?><br><?= $adminMsg ?><?php endif; ?>
      <br><a class="btn" href="index.php">Irány a főoldal</a>
      <p style="margin:14px 0 0;color:var(--muted);font-size:.86rem">
        Biztonsági okból töröld az <code>install.php</code> fájlt, vagy állítsd az
        <code>INSTALL_LOCKED</code> konstanst <code>true</code>-ra.
      </p>
    </div>
  <?php endif; ?>

  <?php if (INSTALL_LOCKED): ?>
    <p style="color:var(--danger)">A telepítő le van zárva (<code>INSTALL_LOCKED = true</code>).</p>
  <?php else: ?>
  <form method="post">
    <fieldset>
      <legend>Adatbázis</legend>
      <p style="color:var(--muted);margin:0;font-size:.9rem">
        Szerver: <code><?= htmlspecialchars($db['host'] . ':' . $db['port']) ?></code> ·
        Felhasználó: <code><?= htmlspecialchars($db['user']) ?></code> ·
        Adatbázis: <code><?= htmlspecialchars($db['name']) ?></code><br>
        Ezek a <code>config.php</code>-ban módosíthatók.
      </p>
      <label class="checkline">
        <input type="checkbox" name="import_json" value="1" <?= is_file(__DIR__ . '/data.json') ? 'checked' : 'disabled' ?>>
        <span>A megmaradt <code>data.json</code> sárkányainak visszatöltése (helyőrző játékosokkal)</span>
      </label>
    </fieldset>

    <fieldset>
      <legend>Admin felhasználó (opcionális)</legend>
      <label for="admin_name">Felhasználónév</label>
      <input type="text" id="admin_name" name="admin_name" value="admin">
      <label for="admin_email">E-mail</label>
      <input type="email" id="admin_email" name="admin_email" value="admin@localhost">
      <label for="admin_pass">Jelszó</label>
      <input type="password" id="admin_pass" name="admin_pass" placeholder="Hagyd üresen, ha nem kell admin">
    </fieldset>

    <button class="btn btn-primary" type="submit">Telepítés / frissítés indítása</button>
  </form>
  <?php endif; ?>
</div>
</body>
</html>
