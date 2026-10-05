<?php
/**
 * Bemutató adatok: néhány viking, sárkányaik és egy admin fiók.
 * Csak fejlesztéshez / bemutatóhoz.
 *
 *   php sql/demo_seed.php
 */

require __DIR__ . '/../inc/bootstrap.php';

if (PHP_SAPI !== 'cli') {
    exit('Csak parancssorból futtatható.');
}

$conn = db();

$users = [
    ['admin',    'admin@localhost',  'admin123', 1],
    ['Ragnar',   'ragnar@saga.hu',   'proba123', 0],
    ['Lagertha', 'lagertha@saga.hu', 'proba123', 0],
    ['Bjorn',    'bjorn@saga.hu',    'proba123', 0],
];

$stmt = $conn->prepare(
    "INSERT INTO sarkanyok_users (name, email, password, is_admin)
     VALUES (?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE password = VALUES(password), is_admin = VALUES(is_admin)"
);

$ids = [];
foreach ($users as [$name, $email, $pass, $admin]) {
    $hash = password_hash($pass, PASSWORD_DEFAULT);
    $stmt->bind_param('sssi', $name, $email, $hash, $admin);
    $stmt->execute();

    $q = $conn->prepare("SELECT id FROM sarkanyok_users WHERE email = ?");
    $q->bind_param('s', $email);
    $q->execute();
    $ids[$name] = (int)$q->get_result()->fetch_assoc()['id'];
    $q->close();

    echo "✔ felhasználó: $name (#{$ids[$name]})\n";
}
$stmt->close();

$dragons = [
    ['Ragnar',   'Vasfog',      '#e05c2a', 7, 7, 7, 7],
    ['Ragnar',   'Ködfutó',     '#4fd6ff', 3, 6, 3, 2],
    ['Lagertha', 'Pajzsszárny', '#9d7bff', 4, 4, 4, 4],
    ['Lagertha', 'Hajnalpír',   '#ffb347', 5, 5, 5, 8],
    ['Bjorn',    'Vasbordájú',  '#2dd4a7', 3, 3, 3, 7],
    ['Bjorn',    'Éjkarom',     '#8b5cf6', 8, 8, 8, 8],
];

$ins = $conn->prepare(
    "INSERT INTO sarkanyok (user_id, nev, szin, test_id, szarny_id, lab_id, fej_id, hp, dmg, wins)
     VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?)"
);

foreach ($dragons as [$owner, $nev, $szin, $test, $szarny, $lab, $fej]) {
    $uid = $ids[$owner];

    // Van már ilyen nevű sárkánya?
    $chk = $conn->prepare("SELECT id FROM sarkanyok WHERE user_id = ? AND nev = ?");
    $chk->bind_param('is', $uid, $nev);
    $chk->execute();
    $exists = $chk->get_result()->num_rows > 0;
    $chk->close();
    if ($exists) {
        echo "· kihagyva (már létezik): $nev\n";
        continue;
    }

    $t    = dragon_totals($fej, $test, $lab, $szarny);
    $wins = random_int(0, 7);
    $ins->bind_param('issiiiiiii', $uid, $nev, $szin, $test, $szarny, $lab, $fej, $t['hp'], $t['dmg'], $wins);
    $ins->execute();
    echo "✔ sárkány: $nev — {$t['hp']} HP / {$t['dmg']} DMG\n";
}
$ins->close();

// A kvíz jelölése, hogy a demo felhasználók ne akadjanak el
$conn->query("UPDATE sarkanyok_users SET quiz_taken = 1 WHERE name IN ('Ragnar','Lagertha','Bjorn')");

echo "\nKész. Belépés: admin@localhost / admin123\n";
