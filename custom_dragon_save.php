<?php
/**
 * A műhelyben összerakott sárkány mentése.
 *
 * Korábban a user_id POST-ból jött (és az URL-ben utazott *7.384 formában),
 * így bárki menthetett bárki nevében. Most kizárólag a session dönt.
 */
require_once __DIR__ . '/inc/bootstrap.php';

header('Content-Type: application/json; charset=utf-8');

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

$user_id = current_user_id();

/**
 * 0 = nincs ilyen alkatrész felhelyezve.
 * A titkos (9-es) részek itt nem használhatók: azok csak az easter eggből
 * szerezhetők meg, ezért nem szerepelnek a normal_part_ids() listájában.
 */
function part_id(string $part, string $key): int
{
    $id = (int)($_POST[$key] ?? 0);
    if ($id === 0) return 0;

    if (!is_normal_part($part, $id)) {
        respond(['error' => 'Ez a testrész nem használható.'], 403);
    }
    return $id;
}

$head  = part_id('fej',    'head');
$body  = part_id('test',   'body');
$legs  = part_id('lab',    'legs');
$wings = part_id('szarny', 'wings');

if (!$head && !$body && !$legs && !$wings) {
    respond(['error' => 'Legalább egy testrészt helyezz el!'], 400);
}

$dragonName = mb_substr(trim((string)($_POST['dragonName'] ?? '')), 0, 60);
if ($dragonName === '') {
    $dragonName = 'Sárkány';
}

$color = (string)($_POST['color'] ?? '');
if (!preg_match('/^#[0-9a-f]{6}$/i', $color)) {
    $color = '#ffffff';
}

$totals = dragon_totals($head, $body, $legs, $wings);

try {
    $stmt = db()->prepare(
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
} catch (mysqli_sql_exception $ex) {
    respond(['error' => app_config('app.debug') ? $ex->getMessage() : 'Adatbázis hiba.'], 500);
}

respond([
    'success'   => true,
    'dragon_id' => $dragonId,
    'hp'        => $totals['hp'],
    'dmg'       => $totals['dmg'],
]);
