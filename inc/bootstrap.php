<?php
/**
 * Közös indítófájl: session, konfiguráció, adatbázis és segédfüggvények.
 * Minden oldal ezzel kezdődik (a header.php automatikusan behúzza).
 */

if (defined('SARKANYOK_BOOTSTRAPPED')) {
    return;
}
define('SARKANYOK_BOOTSTRAPPED', true);
define('APP_ROOT', dirname(__DIR__));

require_once APP_ROOT . '/db_connect.php';

// --- Hibakezelés --------------------------------------------------------
if (app_config('app.debug', false)) {
    ini_set('display_errors', '1');
    error_reporting(E_ALL);
} else {
    ini_set('display_errors', '0');
    error_reporting(E_ALL & ~E_DEPRECATED & ~E_NOTICE);
}

// --- Session ------------------------------------------------------------
if (session_status() === PHP_SESSION_NONE) {
    session_set_cookie_params([
        'lifetime' => 0,
        'path'     => '/',
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

/* =======================================================================
   Kimenet
   ===================================================================== */

/** HTML-escape rövidítés. */
function e($value): string
{
    return htmlspecialchars((string)$value, ENT_QUOTES | ENT_SUBSTITUTE, 'UTF-8');
}

/**
 * Statikus fájl hivatkozása a módosítás idejével kiegészítve.
 * Így a böngésző azonnal az új CSS/JS-t tölti be, nem a gyorsítótárazott régit.
 */
function asset(string $path): string
{
    $full = APP_ROOT . '/' . ltrim($path, '/');
    $ver  = is_file($full) ? filemtime($full) : 0;
    return e($path) . '?v=' . $ver;
}

/* =======================================================================
   Hitelesítés
   ===================================================================== */

function is_logged_in(): bool
{
    return !empty($_SESSION['logged_in']) && !empty($_SESSION['user_id']);
}

function is_admin(): bool
{
    return is_logged_in() && !empty($_SESSION['is_admin']);
}

function current_user_id(): int
{
    return (int)($_SESSION['user_id'] ?? 0);
}

/** Bejelentkezés kikényszerítése; átirányít a login oldalra. */
function require_login(): void
{
    if (!is_logged_in()) {
        $target = basename($_SERVER['PHP_SELF'] ?? 'index.php');
        header('Location: login.php?next=' . urlencode($target));
        exit;
    }
}

/** Belépteti a felhasználót (a sarkanyok_users egy sorával). */
function login_user(array $user): void
{
    session_regenerate_id(true);           // session fixation ellen
    $_SESSION['logged_in'] = true;
    $_SESSION['user_id']   = (int)$user['id'];
    $_SESSION['name']      = $user['name'];
    $_SESSION['email']     = $user['email'] ?? '';
    $_SESSION['is_admin']  = (int)($user['is_admin'] ?? 0);
}

/**
 * Jelszóellenőrzés a régi sha1-es hashekkel is.
 * Sikeres régi belépéskor csendben átírja modern hashre.
 */
function verify_password(string $plain, string $stored, int $userId): bool
{
    // Modern hash (password_hash)
    if (str_starts_with($stored, '$2y$') || str_starts_with($stored, '$argon')) {
        return password_verify($plain, $stored);
    }

    // Örökölt sha1 – ha stimmel, azonnal frissítjük
    if (strlen($stored) === 40 && hash_equals($stored, sha1($plain))) {
        $new  = password_hash($plain, PASSWORD_DEFAULT);
        $stmt = db()->prepare("UPDATE sarkanyok_users SET password = ? WHERE id = ?");
        $stmt->bind_param('si', $new, $userId);
        $stmt->execute();
        $stmt->close();
        return true;
    }

    return false;
}

/* =======================================================================
   CSRF
   ===================================================================== */

function csrf_token(): string
{
    if (empty($_SESSION['csrf'])) {
        $_SESSION['csrf'] = bin2hex(random_bytes(32));
    }
    return $_SESSION['csrf'];
}

/** Rejtett input mező a űrlapokhoz. */
function csrf_field(): string
{
    return '<input type="hidden" name="_csrf" value="' . e(csrf_token()) . '">';
}

function csrf_valid(): bool
{
    $sent = $_POST['_csrf'] ?? $_GET['_csrf'] ?? '';
    return is_string($sent) && $sent !== '' && hash_equals(csrf_token(), $sent);
}

/** Érvénytelen token esetén megszakítja a kérést. */
function csrf_check(): void
{
    if (!csrf_valid()) {
        http_response_code(403);
        exit('Érvénytelen vagy lejárt űrlap-token. Töltsd újra az oldalt.');
    }
}

/* =======================================================================
   Sárkány-segédek
   ===================================================================== */

/** A testrész-táblák neve alkatrész-kulcs szerint. */
const PART_TABLES = [
    'fej'    => 'sarkanyok_fej',
    'test'   => 'sarkanyok_test',
    'lab'    => 'sarkanyok_lab',
    'szarny' => 'sarkanyok_szarny',
];

/**
 * A testrészképek mappája.
 *
 * Ha létezik a nagy felbontású változat (dragons/hd/), azt használjuk;
 * ha nem, visszaesünk az eredeti 64×64-es rajzokra. A fájlnevek mindkét
 * mappában azonosak, így máshol semmit nem kell tudni erről.
 */
function part_dir(): string
{
    return part_set()['dir'];
}

/** A testrészképek kiterjesztése ('svg' vagy 'png'). */
function part_ext(): string
{
    return part_set()['ext'];
}

/**
 * Melyik készletet használjuk. Sorrendben: vektoros → nagy felbontású
 * raszter → eredeti pixelgrafika. Az első létező nyer.
 */
function part_set(): array
{
    static $set = null;
    if ($set === null) {
        foreach ([['dragons/svg/', 'svg'], ['dragons/hd/', 'png'], ['dragons/', 'png']] as [$dir, $ext]) {
            if (is_dir(APP_ROOT . '/' . rtrim($dir, '/'))) {
                $set = ['dir' => $dir, 'ext' => $ext];
                break;
            }
        }
    }
    return $set;
}

/**
 * Egy testrészkép teljes elérési útja.
 * A katalógus `image` oszlopa .png-ben tárolja a nevet, ezért a
 * kiterjesztést a tényleges készlethez igazítjuk.
 */
function part_src(string $filename): string
{
    $base = preg_replace('/\.(png|svg)$/i', '', $filename);
    $path = part_dir() . $base . '.' . part_ext();

    // Verzió a módosítás idejéből: újragenerálás után a böngésző
    // különben a régi rajzot mutatná a gyorsítótárból.
    $full = APP_ROOT . '/' . $path;
    return $path . '?v=' . (is_file($full) ? filemtime($full) : 0);
}

/**
 * A TITKOS sárkány testrészeinek azonosítója minden katalógusban.
 * Erre épül az about.php easter egg (secret-save.php), ezért nem
 * szerepelhet a szabadon választható részek között.
 */
const SECRET_PART_ID = 9;

/**
 * Egy katalógus szabadon használható azonosítói (a titkos nélkül).
 * Adatbázisból jön, így a katalógus bővítésekor magától követi.
 *
 * @return int[]
 */
function normal_part_ids(string $part): array
{
    static $cache = [];
    if (isset($cache[$part])) return $cache[$part];

    if (!isset(PART_TABLES[$part])) return $cache[$part] = [];

    $table = PART_TABLES[$part];        // whitelistből, nem user inputból
    $res = db()->query("SELECT id FROM {$table} WHERE id <> " . SECRET_PART_ID . " ORDER BY id");
    $ids = [];
    while ($res && $row = $res->fetch_row()) {
        $ids[] = (int)$row[0];
    }
    return $cache[$part] = $ids;
}

/** Érvényes-e egy szabadon választható testrész-azonosító? */
function is_normal_part(string $part, int $id): bool
{
    return in_array($id, normal_part_ids($part), true);
}

/** A dragons/ mappa fájlnév-előtagjai. */
const PART_FILES = [
    'fej'    => 'head',
    'test'   => 'body',
    'lab'    => 'legs',
    'szarny' => 'wings',
];

/**
 * Egy testrész hp/dmg értéke. Ismeretlen id esetén nullák.
 */
function part_stats(string $part, int $id): array
{
    if (!isset(PART_TABLES[$part]) || $id <= 0) {
        return ['hp' => 0, 'dmg' => 0];
    }
    $table = PART_TABLES[$part];               // whitelistből, nem user inputból
    $stmt  = db()->prepare("SELECT hp, dmg FROM {$table} WHERE id = ?");
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $stmt->bind_result($hp, $dmg);
    $found = $stmt->fetch();
    $stmt->close();

    return $found ? ['hp' => (int)$hp, 'dmg' => (int)$dmg] : ['hp' => 0, 'dmg' => 0];
}

/** A négy testrészből számolt összesített statok. */
function dragon_totals(int $fej, int $test, int $lab, int $szarny): array
{
    $hp = $dmg = 0;
    foreach (['fej' => $fej, 'test' => $test, 'lab' => $lab, 'szarny' => $szarny] as $part => $id) {
        $s    = part_stats($part, $id);
        $hp  += $s['hp'];
        $dmg += $s['dmg'];
    }
    return ['hp' => $hp, 'dmg' => $dmg];
}

/** Egy testrész-katalógus összes sora (id szerint rendezve). */
function part_catalog(string $part): array
{
    if (!isset(PART_TABLES[$part])) {
        return [];
    }
    $table = PART_TABLES[$part];
    $res   = db()->query("SELECT id, nev, image, hp, dmg, ritka FROM {$table} ORDER BY id ASC");
    return $res ? $res->fetch_all(MYSQLI_ASSOC) : [];
}

/**
 * Egy sárkány rétegezett képe.
 *
 * @param array $d   Sor a `sarkanyok` táblából
 * @param bool  $float Lebegő animáció
 */
function dragon_render(array $d, bool $float = true): string
{
    $id    = (int)($d['id'] ?? 0);
    $color = (string)($d['szin'] ?? '#ff0000');
    $fid   = 'dragonTint' . $id;

    $html  = '<div class="dragon-render' . ($float ? ' floating' : '') . '"'
           . ' style="filter:url(#' . e($fid) . ')">';
    $html .= '<svg class="tint-def" aria-hidden="true"><filter id="' . e($fid) . '" '
           . 'color-interpolation-filters="sRGB">'
           . '<feColorMatrix type="matrix" values="' . e(color_matrix($color)) . '"/>'
           . '</filter></svg>';

    foreach (['test' => 'test_id', 'lab' => 'lab_id', 'fej' => 'fej_id', 'szarny' => 'szarny_id'] as $part => $col) {
        $pid = (int)($d[$col] ?? 0);
        if ($pid > 0) {
            $file = PART_FILES[$part] . '[' . $pid . ']';
            $html .= '<img src="' . e(part_src($file)) . '" alt="" loading="lazy">';
        }
    }

    return $html . '</div>';
}

/**
 * feColorMatrix mátrix egy hex színből (a szürkeárnyalatos PNG-k színezéséhez).
 */
function color_matrix(string $hex): string
{
    $hex = ltrim(trim($hex), '#');
    if (strlen($hex) === 3) {
        $hex = $hex[0] . $hex[0] . $hex[1] . $hex[1] . $hex[2] . $hex[2];
    }
    if (strlen($hex) !== 6 || !ctype_xdigit($hex)) {
        $hex = 'ff0000';
    }

    $factor = 1.3;
    $r = min(hexdec(substr($hex, 0, 2)) / 255 * $factor, 1);
    $g = min(hexdec(substr($hex, 2, 2)) / 255 * $factor, 1);
    $b = min(hexdec(substr($hex, 4, 2)) / 255 * $factor, 1);

    return sprintf('%.4f 0 0 0 0  0 %.4f 0 0 0  0 0 %.4f 0 0  0 0 0 1 0', $r, $g, $b);
}

/** Sárkány „erő" pontszáma — rangsorhoz és megjelenítéshez. */
function dragon_power(array $d): int
{
    return (int)round(((int)$d['hp']) * 0.6 + ((int)$d['dmg']) * 4);
}
