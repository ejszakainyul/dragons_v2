<?php
/**
 * Easter egg: a rólunk oldal rejtett ikonja adja a titkos (9-es szett) sárkányt.
 * Felhasználónként egyszer.
 */
require_once __DIR__ . '/inc/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    respond(['error' => 'Csak POST kérés engedélyezett.'], 405);
}

if (!is_logged_in()) {
    respond(['error' => 'Nincs jogosultság — jelentkezz be.'], 401);
}

if (!csrf_valid()) {
    respond(['error' => 'Érvénytelen űrlap-token. Töltsd újra az oldalt.'], 403);
}

$conn    = db();
$user_id = current_user_id();

$stmt = $conn->prepare(
    "SELECT COUNT(*) AS c FROM sarkanyok
      WHERE user_id = ? AND test_id = 9 AND fej_id = 9 AND lab_id = 9 AND szarny_id = 9"
);
$stmt->bind_param('i', $user_id);
$stmt->execute();
$already = (int)$stmt->get_result()->fetch_assoc()['c'];
$stmt->close();

if ($already > 0) {
    respond(['error' => 'Már megtaláltad a titkos sárkányt.'], 409);
}

// A statokat a katalógusból számoljuk, hogy a seed-del összhangban maradjon
$totals = dragon_totals(9, 9, 9, 9);
$name   = 'Titkos Sárkány';
$color  = '#9d7bff';

try {
    $stmt = $conn->prepare(
        "INSERT INTO sarkanyok (user_id, nev, szin, test_id, szarny_id, lab_id, fej_id, hp, dmg)
         VALUES (?, ?, ?, 9, 9, 9, 9, ?, ?)"
    );
    $stmt->bind_param('issii', $user_id, $name, $color, $totals['hp'], $totals['dmg']);
    $stmt->execute();
    $dragonId = $stmt->insert_id;
    $stmt->close();
} catch (mysqli_sql_exception $ex) {
    respond(['error' => app_config('app.debug') ? $ex->getMessage() : 'Adatbázis hiba.'], 500);
}

respond([
    'success'   => true,
    'dragon_id' => $dragonId,
    'hp'        => $totals['hp'],
    'dmg'       => $totals['dmg'],
]);
