<?php
/**
 * Adatbázis-kapcsolat.
 *
 * A régi kód mindenhol a globális $conn (mysqli) változót várja, ezért az
 * továbbra is elérhető. Újabb kódban használd a db() függvényt.
 */

if (!function_exists('app_config')) {
    /**
     * A config.php tartalmát adja vissza (egyszer töltődik be).
     *
     * @param string|null $path Pontokkal tagolt útvonal, pl. "db.host".
     */
    function app_config(?string $path = null, $default = null)
    {
        static $config = null;
        if ($config === null) {
            $config = require __DIR__ . '/config.php';
        }
        if ($path === null) {
            return $config;
        }
        $value = $config;
        foreach (explode('.', $path) as $key) {
            if (!is_array($value) || !array_key_exists($key, $value)) {
                return $default;
            }
            $value = $value[$key];
        }
        return $value;
    }
}

if (!function_exists('db')) {
    /**
     * Megnyitja (vagy visszaadja) az adatbázis-kapcsolatot.
     */
    function db(): mysqli
    {
        static $conn = null;

        if ($conn instanceof mysqli) {
            return $conn;
        }

        $cfg = app_config('db');

        // Kivételt dobjon hiba esetén, ne csak warningot – így nem fut tovább
        // a kód félkész állapotban.
        mysqli_report(MYSQLI_REPORT_ERROR | MYSQLI_REPORT_STRICT);

        try {
            // Időkorláttal: távoli adatbázisnál, ha a szerver nem érhető el,
            // az oldal ne lógjon percekig, hanem adja a hibaoldalt
            $conn = mysqli_init();
            $conn->options(MYSQLI_OPT_CONNECT_TIMEOUT, 5);
            $conn->real_connect(
                $cfg['host'],
                $cfg['user'],
                $cfg['pass'],
                $cfg['name'],
                (int)$cfg['port']
            );
            $conn->set_charset($cfg['charset']);
        } catch (mysqli_sql_exception $e) {
            db_fail($e->getMessage());
        }

        return $conn;
    }
}

if (!function_exists('db_fail')) {
    /**
     * Barátságos hibaoldal, ha nincs adatbázis (pl. még nincs telepítve).
     */
    function db_fail(string $message): void
    {
        if (!headers_sent()) {
            header('HTTP/1.1 503 Service Unavailable');
            header('Content-Type: text/html; charset=utf-8');
        }
        $debug  = app_config('app.debug', false);
        $detail = $debug ? '<pre class="db-detail">' . htmlspecialchars($message) . '</pre>' : '';
        echo <<<HTML
<!doctype html><html lang="hu"><head><meta charset="utf-8">
<title>Nincs adatbázis-kapcsolat</title>
<style>
 body{margin:0;min-height:100vh;display:grid;place-items:center;background:#05070d;
      color:#e8eefc;font-family:system-ui,Segoe UI,sans-serif;padding:24px}
 .card{max-width:620px;background:#0d1322;border:1px solid #23304d;border-radius:18px;
       padding:34px 38px;box-shadow:0 24px 60px rgba(0,0,0,.6)}
 h1{margin:0 0 10px;font-size:1.6rem;color:#ff7a45}
 p{line-height:1.65;color:#a9b6d3}
 a{color:#4fc3f7}
 code{background:#121a2e;padding:2px 7px;border-radius:6px;color:#ffd479}
 .db-detail{background:#121a2e;padding:12px;border-radius:10px;overflow:auto;
            font-size:.82rem;color:#ff9a9a;white-space:pre-wrap}
</style></head><body><div class="card">
<h1>🐉 Nincs adatbázis-kapcsolat</h1>
<p>Az oldal nem éri el a MySQL adatbázist. Ha most telepíted a projektet:</p>
<p>1. Indítsd el a XAMPP-ban az <strong>Apache</strong> és a <strong>MySQL</strong> szolgáltatást.<br>
2. Nyisd meg a <a href="install.php">install.php</a> oldalt — létrehozza az adatbázist és feltölti az alapadatokat.</p>
<p>Az adatok a <code>config.php</code> fájlban állíthatók (vagy egy saját <code>config.local.php</code>-ban).</p>
{$detail}
</div></body></html>
HTML;
        exit;
    }
}

// Visszafelé kompatibilitás: a régi oldalak $conn-t használnak.
$conn = db();
