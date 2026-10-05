<?php
/**
 * A kérdőív eredményének mentése. JSON-választ ad.
 */
require_once __DIR__ . '/inc/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

/** JSON válasz és kilépés. */
function respond(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE);
    exit;
}

if (!is_logged_in()) {
    respond(['error' => 'Nincs jogosultság — jelentkezz be.'], 401);
}

if (!csrf_valid()) {
    respond(['error' => 'Érvénytelen űrlap-token. Töltsd újra az oldalt.'], 403);
}

$conn    = db();
$user_id = current_user_id();

// Egy játékos egyszer tölti ki a kérdőívet
$stmt = $conn->prepare("SELECT quiz_taken FROM sarkanyok_users WHERE id = ?");
$stmt->bind_param('i', $user_id);
$stmt->execute();
$quizTaken = (int)($stmt->get_result()->fetch_assoc()['quiz_taken'] ?? 0);
$stmt->close();

if ($quizTaken) {
    respond(['error' => 'Már kitöltötted a kérdőívet.'], 409);
}

foreach (['body', 'head', 'legs', 'wings', 'color', 'dragonName'] as $field) {
    if (!isset($_POST[$field])) {
        respond(['error' => "Hiányzó mező: {$field}"], 400);
    }
}

$dragonName = trim((string)$_POST['dragonName']);
if ($dragonName === '') {
    $dragonName = 'Sárkány';
}
$dragonName = mb_substr($dragonName, 0, 60);

$color = (string)$_POST['color'];
if (!preg_match('/^#[0-9a-f]{6}$/i', $color)) {
    $color = '#ff8a3d';
}

// A kérdőív a katalógus bármelyik szabad darabját kioszthatja —
// a titkos (9-es) részeket kivéve, azok csak az easter eggből járnak.
$body  = (int)$_POST['body'];
$head  = (int)$_POST['head'];
$legs  = (int)$_POST['legs'];
$wings = (int)$_POST['wings'];

foreach (['test' => $body, 'fej' => $head, 'lab' => $legs, 'szarny' => $wings] as $part => $pid) {
    if (!is_normal_part($part, $pid)) {
        respond(['error' => 'Érvénytelen testrész.'], 400);
    }
}

$totals = dragon_totals($head, $body, $legs, $wings);

$conn->begin_transaction();
try {
    $stmt = $conn->prepare(
        "INSERT INTO sarkanyok (user_id, nev, szin, test_id, szarny_id, lab_id, fej_id, hp, dmg)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)"
    );
    $stmt->bind_param(
        'issiiiiii',
        $user_id, $dragonName, $color,
        $body, $wings, $legs, $head,
        $totals['hp'], $totals['dmg']
    );
    $stmt->execute();
    $dragonId = $stmt->insert_id;
    $stmt->close();

    $upd = $conn->prepare("UPDATE sarkanyok_users SET quiz_taken = 1 WHERE id = ?");
    $upd->bind_param('i', $user_id);
    $upd->execute();
    $upd->close();

    $conn->commit();
} catch (mysqli_sql_exception $ex) {
    $conn->rollback();
    respond(['error' => app_config('app.debug') ? $ex->getMessage() : 'Adatbázis hiba.'], 500);
}

respond([
    'success'   => true,
    'dragon_id' => $dragonId,
    'hp'        => $totals['hp'],
    'dmg'       => $totals['dmg'],
]);
