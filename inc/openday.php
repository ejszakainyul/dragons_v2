<?php
/**
 * Nyílt nap — vezetett, korlátozott mód 16 bemutató fiókkal.
 *
 *   Belépés:   nyiltnap.php — csak egy rövid kód (pl. THOR), jelszó nincs
 *   Túra:      jóslat → műhely → aréna → AI-saga → egy barlang a kalandban
 *   Vezérlő:   nyiltnap_admin.php — haladás élőben, nullázás kiléptetés nélkül
 *
 * A nullázás a fiók „korszakát" (korszak) lépteti: a látogató nyitott
 * oldala ezt figyeli, és magától visszaugrik a túra elejére; a játék
 * régi korszakú mentését a szerver elutasítja, így semmi nem íródik vissza.
 */

/** A túra lépései sorrendben: kulcs => [cím, oldal, rúna, perc, leírás]. */
const OPENDAY_STEPS = [
    'quiz'     => ['A jóslat',  'quiz.php',    'ᛈ', 2,  'Néhány kérdés a ködben — a válaszaidból születik meg a saját sárkányod.'],
    'workshop' => ['A műhely',  'nyitott.php', 'ᚲ', 2,  'Rakj össze egy második sárkányt fejből, testből, lábból és szárnyból.'],
    'arena'    => ['Az aréna',  'arena.php',   'ᛏ', 1,  'Állítsd ki a bajnokodat egy másik viking sárkánya ellen.'],
    'story'    => ['A saga',    'story.php',   'ᚨ', 1,  'A mesterséges intelligencia megírja a te viking történetedet.'],
    'game'     => ['A kaland',  'kaland.php',  'ᚹ', 9,  'Lépj be a Sárkányok Völgyébe, és tisztítsd meg a Mohos barlangot.'],
];

/**
 * A 16 fiók: a kód eleje => megjelenő név (északi istenek). A létrehozáskor
 * a kód kap egy véletlen számjegyet (pl. THOR4): így is pár karakter, de a
 * nyilvános forrásból nem tudható — csak az adatbázisban és a kártyákon van.
 */
const OPENDAY_ACCOUNTS = [
    'ODIN' => 'Odin',  'THOR' => 'Thor',  'LOKI' => 'Loki',  'FREY' => 'Freyr',
    'FRIG' => 'Frigg', 'TYR'  => 'Týr',   'SIF'  => 'Sif',   'HEL'  => 'Hel',
    'ULL'  => 'Ullr',  'IDUN' => 'Iðunn', 'VALI' => 'Váli',  'SAGA' => 'Sága',
    'RAN'  => 'Rán',   'EIR'  => 'Eir',   'BRAG' => 'Bragi', 'NJOR' => 'Njörðr',
];

/** A nyílt napi táblák (idempotens — az első használatkor magától létrejön). */
function openday_install(): void
{
    static $done = false;
    if ($done) return;
    $done = true;
    db()->query(
        "CREATE TABLE IF NOT EXISTS `sarkanyok_nyiltnap` (
           `user_id`  INT(11)     NOT NULL,
           `kod`      VARCHAR(8)  NOT NULL,
           `aktiv`    TINYINT(1)  NOT NULL DEFAULT 1,
           `korszak`  INT         NOT NULL DEFAULT 1,
           `lepesek`  VARCHAR(80) NOT NULL DEFAULT '',
           `utoljara` DATETIME    NULL DEFAULT NULL,
           PRIMARY KEY (`user_id`),
           UNIQUE KEY `uq_nyiltnap_kod` (`kod`),
           CONSTRAINT `fk_nyiltnap_user` FOREIGN KEY (`user_id`)
             REFERENCES `sarkanyok_users` (`id`) ON DELETE CASCADE
         ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci"
    );
}

/** Nyílt napi fiókkal van-e belépve a látogató. */
function is_demo(): bool
{
    return is_logged_in() && !empty($_SESSION['demo']);
}

/** A fiók nyílt napi sora (kérésenként egyszer olvassuk). */
function openday_row(int $uid, bool $fresh = false): ?array
{
    static $cache = [];
    if ($fresh || !array_key_exists($uid, $cache)) {
        $stmt = db()->prepare('SELECT * FROM sarkanyok_nyiltnap WHERE user_id = ?');
        $stmt->bind_param('i', $uid);
        $stmt->execute();
        $cache[$uid] = $stmt->get_result()->fetch_assoc() ?: null;
        $stmt->close();
    }
    return $cache[$uid];
}

/** A teljesített lépések kulcsai. */
function openday_done(?array $row): array
{
    return $row ? array_values(array_filter(explode(',', (string)$row['lepesek']))) : [];
}

/** A következő teljesítendő lépés kulcsa (null: kész a túra). */
function openday_next(array $done): ?string
{
    foreach (array_keys(OPENDAY_STEPS) as $k) if (!in_array($k, $done, true)) return $k;
    return null;
}

/** Egy lépés teljesítése (csak nyílt napi fióknál; többször hívható). */
function openday_mark(string $step): void
{
    if (!is_demo() || !isset(OPENDAY_STEPS[$step])) return;
    $uid  = current_user_id();
    $done = openday_done(openday_row($uid, true));
    if (!in_array($step, $done, true)) $done[] = $step;
    $list = implode(',', array_values(array_intersect(array_keys(OPENDAY_STEPS), $done)));
    $stmt = db()->prepare('UPDATE sarkanyok_nyiltnap SET lepesek = ?, utoljara = NOW() WHERE user_id = ?');
    $stmt->bind_param('si', $list, $uid);
    $stmt->execute();
    $stmt->close();
    openday_row($uid, true);
}

/** Aktivitás jelzése a vezérlőnek (ki hol tart éppen). */
function openday_touch(): void
{
    if (!is_demo()) return;
    $uid = current_user_id();
    $stmt = db()->prepare('UPDATE sarkanyok_nyiltnap SET utoljara = NOW() WHERE user_id = ?');
    $stmt->bind_param('i', $uid);
    $stmt->execute();
    $stmt->close();
}

/** Belépés kóddal. Siker esetén a felhasználó sora, különben null. */
function openday_login(string $code): ?array
{
    openday_install();
    $code = strtoupper(preg_replace('/[^a-z0-9]/i', '', $code));
    if ($code === '') return null;
    $stmt = db()->prepare(
        'SELECT u.id, u.name, u.email, u.is_admin, n.aktiv, n.korszak
           FROM sarkanyok_nyiltnap n JOIN sarkanyok_users u ON u.id = n.user_id
          WHERE n.kod = ?'
    );
    $stmt->bind_param('s', $code);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    if (!$row || !(int)$row['aktiv']) return null;
    $row['is_admin'] = 0;                      // bemutató fiók sosem admin
    login_user($row);
    $_SESSION['demo'] = 1;
    $_SESSION['demo_epoch'] = (int)$row['korszak'];
    openday_touch();
    return $row;
}

/**
 * A korlátozott mód őre: a bemutató fiók csak a túra oldalait éri el.
 * Minden más oldal a túra kezdőlapjára visz (a fejléc és a lábléc
 * linkjei így sem vezetnek ki a túrából).
 */
function openday_guard(): void
{
    if (!is_demo()) return;
    $row = openday_row(current_user_id());
    if (!$row || !(int)$row['aktiv']) {           // a fiókot kikapcsolták: vissza a kódhoz
        $_SESSION = [];
        session_regenerate_id(true);
        header('Location: nyiltnap.php?ki=1');
        exit;
    }
    $page = basename($_SERVER['SCRIPT_NAME'] ?? '');
    $allowed = ['nyiltnap.php', 'quiz.php', 'nyitott.php', 'arena.php', 'story.php', 'kaland.php',
                'kaland_api.php', 'save_dragon.php', 'custom_dragon_save.php', 'logout.php'];
    if ($page !== '' && !in_array($page, $allowed, true)) {
        header('Location: nyiltnap.php');
        exit;
    }
}

/** Egy fiók haladásának teljes törlése; a belépés megmarad, a korszak lép. */
function openday_reset(int $uid): void
{
    $conn = db();
    $conn->begin_transaction();
    try {
        $q = static function (string $sql) use ($conn, $uid): void {
            $stmt = $conn->prepare($sql);
            $stmt->bind_param('i', $uid);
            $stmt->execute();
            $stmt->close();
        };
        // a sárkányai csatái (a csatanapló nem hivatkozik idegen kulccsal)
        $q('DELETE b FROM sarkanyok_battles b JOIN sarkanyok d ON d.id = b.attacker_id WHERE d.user_id = ?');
        $q('DELETE b FROM sarkanyok_battles b JOIN sarkanyok d ON d.id = b.defender_id WHERE d.user_id = ?');
        $q('DELETE FROM sarkanyok WHERE user_id = ?');
        $q('DELETE FROM sarkanyok_story WHERE user_id = ?');
        $q('DELETE FROM sarkanyok_jatek WHERE user_id = ?');
        $q('DELETE FROM sarkanyok_tojasok WHERE user_id = ?');
        $q('DELETE FROM sarkanyok_friends WHERE user_id = ? OR friend_id = ' . (int)$uid);
        $q('UPDATE sarkanyok_users SET quiz_taken = 0 WHERE id = ?');
        $q("UPDATE sarkanyok_nyiltnap SET lepesek = '', korszak = korszak + 1, utoljara = NULL WHERE user_id = ?");
        $conn->commit();
    } catch (Throwable $e) {
        $conn->rollback();
        throw $e;
    }
}

/** A hiányzó bemutató fiókok létrehozása (a meglévőket nem bántja). Visszaad: hány új. */
function openday_create_accounts(): int
{
    openday_install();
    $conn = db();
    $made = 0;
    foreach (OPENDAY_ACCOUNTS as $prefix => $name) {
        $pattern = '^' . $prefix . '[0-9]$';
        $stmt = $conn->prepare('SELECT user_id FROM sarkanyok_nyiltnap WHERE kod REGEXP ?');
        $stmt->bind_param('s', $pattern);
        $stmt->execute();
        $exists = $stmt->get_result()->fetch_row();
        $stmt->close();
        if ($exists) continue;
        $code = $prefix . random_int(2, 9);

        // egyedi név és email (ha már van ilyen nevű valódi játékos, kap egy jelzőt)
        $email = strtolower($prefix) . '@nyiltnap.local';
        $nick  = $name;
        for ($i = 0; $i < 20; $i++) {
            $stmt = $conn->prepare('SELECT COUNT(*) FROM sarkanyok_users WHERE name = ? OR email = ?');
            $stmt->bind_param('ss', $nick, $email);
            $stmt->execute();
            $taken = (int)$stmt->get_result()->fetch_row()[0];
            $stmt->close();
            if (!$taken) break;
            $nick  = $name . ' ᚾ' . ($i + 2);
            $email = strtolower($prefix) . ($i + 2) . '@nyiltnap.local';
        }
        $pass = password_hash(bin2hex(random_bytes(16)), PASSWORD_DEFAULT);   // jelszóval nem lehet belépni
        $stmt = $conn->prepare('INSERT INTO sarkanyok_users (name, email, password, is_admin) VALUES (?, ?, ?, 0)');
        $stmt->bind_param('sss', $nick, $email, $pass);
        $stmt->execute();
        $uid = (int)$conn->insert_id;
        $stmt->close();
        $stmt = $conn->prepare('INSERT INTO sarkanyok_nyiltnap (user_id, kod) VALUES (?, ?)');
        $stmt->bind_param('is', $uid, $code);
        $stmt->execute();
        $stmt->close();
        $made++;
    }
    return $made;
}

/** A vezérlő listája: minden fiók a haladásával. */
function openday_list(): array
{
    openday_install();
    $rows = db()->query(
        "SELECT n.user_id, n.kod, n.aktiv, n.korszak, n.lepesek, n.utoljara, u.name,
                (SELECT COUNT(*) FROM sarkanyok d WHERE d.user_id = n.user_id) AS sarkanyok,
                (SELECT COUNT(*) FROM sarkanyok_story s WHERE s.user_id = n.user_id) AS sagak
           FROM sarkanyok_nyiltnap n JOIN sarkanyok_users u ON u.id = n.user_id"
    )->fetch_all(MYSQLI_ASSOC);
    $order = array_flip(array_keys(OPENDAY_ACCOUNTS));
    $rank  = static fn($kod) => $order[preg_replace('/\d+$/', '', (string)$kod)] ?? 99;
    usort($rows, static fn($a, $b) => $rank($a['kod']) <=> $rank($b['kod']));
    foreach ($rows as &$r) {
        $r['done'] = openday_done($r);
        $r['next'] = openday_next($r['done']);
        $r['ago']  = $r['utoljara'] ? max(0, time() - strtotime((string)$r['utoljara'])) : null;
    }
    return $rows;
}
