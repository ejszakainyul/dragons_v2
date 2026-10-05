<?php
/**
 * A kalandjáték végpontja.
 *
 *   GET  ?action=state               a teljes induló állapot
 *   POST action=save    payload=…    játékállás mentése (JSON)
 *   POST action=starter              kezdő sárkány, ha még egy sincs
 *   POST action=breed   nest,a,b,pick[fej|test|lab|szarny]=a|b|r
 *   POST action=hatch   nest,name    kikelés (csak ha letelt az idő)
 *   POST action=tame    tier,fej,test,lab,szarny,szin,name
 *   POST action=xp      payload={"<id>": xp, …}
 *
 * Minden POST-hoz kell a _csrf token (lásd inc/bootstrap.php).
 */
require_once __DIR__ . '/inc/game.php';

header('Content-Type: application/json; charset=utf-8');
header('Cache-Control: no-store');

function out(array $payload, int $status = 200): never
{
    http_response_code($status);
    echo json_encode($payload, JSON_UNESCAPED_UNICODE | JSON_UNESCAPED_SLASHES);
    exit;
}

function fail(string $msg, int $status = 400): never
{
    out(['error' => $msg], $status);
}

if (!is_logged_in()) fail('Jelentkezz be a játékhoz.', 401);

$uid    = current_user_id();
$action = (string)($_GET['action'] ?? $_POST['action'] ?? 'state');

if ($_SERVER['REQUEST_METHOD'] === 'POST' && !csrf_valid()) {
    fail('Lejárt a munkamenet. Töltsd újra az oldalt.', 403);
}

try {
    switch ($action) {

    /* ------------------------------------------------------------------ */
    case 'state':
        // A mentést OBJEKTUMKÉNT dekódoljuk: asszociatív tömbként az üres
        // {} tömbbé ([]) válna, és a JS-ben az „x,y" kulcsú bejegyzések
        // (leszedett gyógyfüvek) a következő mentéskor elvesznének.
        $stmt = db()->prepare('SELECT allas FROM sarkanyok_jatek WHERE user_id = ?');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $raw = $stmt->get_result()->fetch_column();
        $stmt->close();
        $save = $raw ? json_decode((string)$raw) : null;
        out([
            'now'     => time(),
            'player'  => (string)($_SESSION['name'] ?? 'Viking'),
            'dragons' => game_dragons($uid),
            'catalog' => game_catalog(),
            'tiers'   => game_tiers(),
            'traits'  => GAME_TRAITS,
            'eggs'    => game_eggs($uid),
            'save'    => $save,
            'rules'   => [
                'maxDragons'   => GAME_MAX_DRAGONS,
                'mutationPct'  => GAME_MUTATION_PCT,
                'nests'        => GAME_NESTS,
                'tameCooldown' => GAME_TAME_COOLDOWN,
            ],
        ]);

    /* ------------------------------------------------------------------ */
    case 'save':
        $json = (string)($_POST['payload'] ?? '');
        if (strlen($json) > 200000) fail('Túl nagy mentés.');
        $data = json_decode($json, true);
        if (!is_array($data) || ($data['v'] ?? null) !== 1) fail('Hibás mentés.');
        game_store_save($uid, $json);
        out(['ok' => true]);

    /* ------------------------------------------------------------------ */
    case 'starter':
        // Csak annak, akinek egyáltalán nincs sárkánya — egy tojás a völgy szellemétől
        if (game_dragon_count($uid) > 0) fail('Már van sárkányod.');
        $tiers = game_tiers();
        // A II. fok testrészeiből: az első barlangban is legyen esélye
        $pick = fn(string $s) => $tiers[$s][2][array_rand($tiers[$s][2])];
        $d = game_insert_dragon($uid, [
            'nev' => 'Első Láng', 'szin' => '#ff8a3d',
            'fej' => $pick('fej'), 'test' => $pick('test'), 'lab' => $pick('lab'), 'szarny' => $pick('szarny'),
            'gen' => 0, 'traits' => [],
        ]);
        out(['dragon' => $d]);

    /* ------------------------------------------------------------------ */
    case 'breed':
        $nest = (int)($_POST['nest'] ?? 0);
        if ($nest < 1 || $nest > GAME_NESTS) fail('Nincs ilyen fészek.');

        $a = game_dragon($uid, (int)($_POST['a'] ?? 0));
        $b = game_dragon($uid, (int)($_POST['b'] ?? 0));
        if (!$a || !$b) fail('A szülőknek a te sárkányaidnak kell lenniük.', 403);
        if ($a['id'] === $b['id']) fail('Két különböző sárkány kell.');
        if (game_dragon_count($uid) >= GAME_MAX_DRAGONS) fail('Megtelt a barlangod — engedj szabadon néhány sárkányt a profilodon.');

        $pick = [];
        foreach (GAME_SLOTS as $slot => $_) {
            $v = (string)($_POST['pick'][$slot] ?? 'r');
            $pick[$slot] = in_array($v, ['a', 'b', 'r'], true) ? $v : 'r';
        }

        $child = game_breed($a, $b, $pick);
        $secs  = game_incubation_seconds($child['gen']);
        $traits  = implode(',', $child['traits']);
        $mutated = implode(',', $child['mutated']);

        // A fészek egyszerre egy tojást tart (UNIQUE kulcs) — foglalt fészekre hiba
        $stmt = db()->prepare(
            'INSERT INTO sarkanyok_tojasok
               (user_id, feszek, szulo_a, szulo_b, fej_id, test_id, lab_id, szarny_id, szin, generacio, vonasok, mutacio, kesz)
             VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, NOW() + INTERVAL ? SECOND)'
        );
        $stmt->bind_param('iissiiiisissi', $uid, $nest, $a['nev'], $b['nev'],
            $child['fej'], $child['test'], $child['lab'], $child['szarny'],
            $child['szin'], $child['gen'], $traits, $mutated, $secs);
        try {
            $stmt->execute();
        } catch (mysqli_sql_exception $e) {
            if ((int)$e->getCode() === 1062) fail('Ebben a fészekben már van tojás.');
            throw $e;
        }
        $stmt->close();

        out(['eggs' => game_eggs($uid), 'cost' => game_breed_cost($child['gen']), 'now' => time()]);

    /* ------------------------------------------------------------------ */
    case 'hatch':
        $nest = (int)($_POST['nest'] ?? 0);
        $stmt = db()->prepare(
            'SELECT id, fej_id, test_id, lab_id, szarny_id, szin, generacio, vonasok, mutacio, (kesz <= NOW()) AS ready
               FROM sarkanyok_tojasok WHERE user_id = ? AND feszek = ?'
        );
        $stmt->bind_param('ii', $uid, $nest);
        $stmt->execute();
        $egg = $stmt->get_result()->fetch_assoc();
        $stmt->close();

        if (!$egg) fail('Ebben a fészekben nincs tojás.');
        if (!(int)$egg['ready']) fail('A tojás még nem kelt ki. Türelem, viking.');

        $conn = db();
        $conn->begin_transaction();
        $del = $conn->prepare('DELETE FROM sarkanyok_tojasok WHERE id = ? AND user_id = ?');
        $eid = (int)$egg['id'];
        $del->bind_param('ii', $eid, $uid);
        $del->execute();
        $gone = $del->affected_rows === 1;       // két párhuzamos kérésből csak egy kelhet ki
        $del->close();
        if (!$gone) { $conn->rollback(); fail('Ez a tojás már kikelt.'); }

        $dragon = game_insert_dragon($uid, [
            'nev'    => (string)($_POST['name'] ?? '') ?: 'Fióka',
            'szin'   => (string)$egg['szin'],
            'fej'    => (int)$egg['fej_id'], 'test' => (int)$egg['test_id'],
            'lab'    => (int)$egg['lab_id'], 'szarny' => (int)$egg['szarny_id'],
            'gen'    => (int)$egg['generacio'],
            'traits' => array_filter(explode(',', (string)$egg['vonasok'])),
        ]);
        $conn->commit();

        out(['dragon' => $dragon, 'mutated' => array_values(array_filter(explode(',', (string)$egg['mutacio'])))]);

    /* ------------------------------------------------------------------ */
    case 'tame':
        $tier = (int)($_POST['tier'] ?? 0);
        if ($tier < 1 || $tier > 4) fail('Ez a sárkány nem szelídíthető.');   // az 5. fok ura sosem hajol meg

        // Csak olyan barlang lakóját, ahová a játékos már eljutott
        if ($tier > min(5, game_max_cleared($uid) + 1)) fail('Ezt a barlangot még nem jártad be.', 403);
        if (game_dragon_count($uid) >= GAME_MAX_DRAGONS) fail('Megtelt a barlangod — engedj szabadon néhány sárkányt a profilodon.');

        $save = game_load_save($uid);
        if (!empty($save['_tamedAt']) && time() - strtotime((string)$save['_tamedAt']) < GAME_TAME_COOLDOWN) {
            fail('A sárkányok még nyugtalanok — próbáld kicsit később.', 429);
        }

        // Minden testrésznek a barlang fokához illőnek kell lennie
        $tiers = game_tiers();
        $parts = [];
        foreach (GAME_SLOTS as $slot => $_) {
            $id = (int)($_POST[$slot] ?? 0);
            if (!in_array($id, $tiers[$slot][$tier], true)) fail('Ez a sárkány nem ebből a barlangból való.', 403);
            $parts[$slot] = $id;
        }
        $color = (string)($_POST['szin'] ?? '');
        if (!preg_match('/^#[0-9a-f]{6}$/i', $color)) $color = '#8fb3ff';

        // Vad vérből néha különleges vonás is jön
        $traits = random_int(1, 100) <= 15 ? [game_random_trait([])] : [];

        $dragon = game_insert_dragon($uid, $parts + [
            'nev' => (string)($_POST['name'] ?? '') ?: 'Vad sárkány',
            'szin' => $color, 'gen' => 0, 'traits' => $traits,
        ]);

        $stmt = db()->prepare(
            "INSERT INTO sarkanyok_jatek (user_id, allas, szelidites) VALUES (?, '{\"v\":1}', NOW())
             ON DUPLICATE KEY UPDATE szelidites = NOW()"
        );
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $stmt->close();

        out(['dragon' => $dragon]);

    /* ------------------------------------------------------------------ */
    case 'xp':
        $data = json_decode((string)($_POST['payload'] ?? ''), true);
        if (!is_array($data)) fail('Hibás adat.');
        $stmt = db()->prepare('UPDATE sarkanyok SET xp = LEAST(xp + ?, 999999) WHERE id = ? AND user_id = ?');
        foreach (array_slice($data, 0, 6, true) as $id => $xp) {
            $id = (int)$id;
            $xp = max(0, min(3000, (int)$xp));      // egy csata legfeljebb ennyit ad
            $stmt->bind_param('iii', $xp, $id, $uid);
            $stmt->execute();
        }
        $stmt->close();
        out(['ok' => true]);

    default:
        fail('Ismeretlen művelet.');
    }
} catch (Throwable $e) {
    error_log('[kaland_api] ' . $e->getMessage());
    fail('Szerverhiba — próbáld újra.', 500);
}
