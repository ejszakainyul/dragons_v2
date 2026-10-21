<?php
/**
 * Nyílt nap — a segítők vezérlője (csak adminnak).
 *
 *   - a 16 bemutató fiók élő haladása (5 mp-enként frissül)
 *   - nullázás fiókonként vagy egyszerre: a látogató bent marad, az oldala
 *     magától visszaugrik a túra elejére
 *   - fiókok ki/be kapcsolása (a nap végén: mind ki)
 *   - ?print=1  nyomtatható kódkártyák
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

openday_install();

/** A listát a böngésző ezzel a formával kapja. */
function od_admin_payload(): array
{
    $rows = array_map(static fn($r) => [
        'id'      => (int)$r['user_id'],
        'code'    => $r['kod'],
        'name'    => $r['name'],
        'active'  => (bool)$r['aktiv'],
        'done'    => $r['done'],
        'next'    => $r['next'],
        'ago'     => $r['ago'],
        'dragons' => (int)$r['sarkanyok'],
        'stories' => (int)$r['sagak'],
        'resets'  => max(0, (int)$r['korszak'] - 1),
    ], openday_list());
    return ['accounts' => $rows, 'now' => time()];
}

/* --- Műveletek (JSON) ------------------------------------------------------ */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    header('Content-Type: application/json; charset=utf-8');
    if (!csrf_valid()) { http_response_code(403); exit(json_encode(['error' => 'Lejárt az oldal — töltsd újra.'])); }
    $act = (string)($_POST['act'] ?? '');
    $uid = (int)($_POST['id'] ?? 0);
    $ids = array_map(static fn($r) => (int)$r['user_id'], openday_list());
    try {
        switch ($act) {
            case 'create':
                $made = openday_create_accounts();
                $msg  = $made ? "{$made} új fiók elkészült." : 'Mind a 16 fiók megvan.';
                break;
            case 'reset':
                if (!in_array($uid, $ids, true)) throw new RuntimeException('Nincs ilyen bemutató fiók.');
                openday_reset($uid);
                $msg = 'Nullázva.';
                break;
            case 'reset_all':
                foreach ($ids as $id) openday_reset($id);
                $msg = 'Minden fiók nullázva.';
                break;
            case 'toggle':
            case 'all_on':
            case 'all_off':
                if ($act === 'toggle' && !in_array($uid, $ids, true)) throw new RuntimeException('Nincs ilyen bemutató fiók.');
                $sql = $act === 'toggle' ? 'UPDATE sarkanyok_nyiltnap SET aktiv = 1 - aktiv WHERE user_id = ?'
                     : 'UPDATE sarkanyok_nyiltnap SET aktiv = ' . ($act === 'all_on' ? 1 : 0);
                $stmt = db()->prepare($sql);
                if ($act === 'toggle') $stmt->bind_param('i', $uid);
                $stmt->execute();
                $stmt->close();
                $msg = $act === 'all_off' ? 'Minden fiók kikapcsolva — a kódok nem működnek.' : 'Kész.';
                break;
            default:
                throw new RuntimeException('Ismeretlen művelet.');
        }
        exit(json_encode(['ok' => true, 'msg' => $msg] + od_admin_payload(), JSON_UNESCAPED_UNICODE));
    } catch (Throwable $e) {
        http_response_code(400);
        exit(json_encode(['error' => $e instanceof RuntimeException || app_config('app.debug') ? $e->getMessage() : 'Adatbázis hiba.'], JSON_UNESCAPED_UNICODE));
    }
}

if (($_GET['api'] ?? '') === 'list') {
    header('Content-Type: application/json; charset=utf-8');
    header('Cache-Control: no-store');
    exit(json_encode(od_admin_payload(), JSON_UNESCAPED_UNICODE));
}

$data  = od_admin_payload();
// a kártyára az a cím kerül, ahonnan a vezérlőt épp megnyitották
$https = ($_SERVER['HTTPS'] ?? '') !== '' && ($_SERVER['HTTPS'] ?? '') !== 'off';
$dir   = rtrim(str_replace('\\', '/', dirname($_SERVER['SCRIPT_NAME'] ?? '/')), '/');
$entry = ($https ? 'https://' : 'http://') . ($_SERVER['HTTP_HOST'] ?? 'localhost') . $dir . '/nyiltnap.php';

/* --- Nyomtatható kártyák -------------------------------------------------- */
if (isset($_GET['print'])) { ?>
<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<title>Nyílt nap — kódkártyák</title>
<link rel="icon" href="favicon.ico">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@700;900&family=Inter:wght@400;600&family=Noto+Sans+Runic&display=swap">
<link rel="stylesheet" href="<?= asset('style/openday.css') ?>">
</head>
<body class="od-print">
  <p class="od-print-hint">Nyomtatás: Ctrl+P · A4, álló · 16 kártya, vágd szét a vonalak mentén.</p>
  <div class="od-cards">
    <?php foreach ($data['accounts'] as $a): ?>
      <section class="od-pcard">
        <img src="img/icon/icon-192.png" alt="">
        <p class="od-pk">ᛟ Sárkányok és Vikingek · nyílt nap</p>
        <p class="od-pcode"><?= e($a['code']) ?></p>
        <p class="od-pname"><?= e($a['name']) ?> fiókja</p>
        <p class="od-purl">Nyisd meg: <b><?= e($entry) ?></b><br>és írd be a fenti kódot.</p>
      </section>
    <?php endforeach; ?>
  </div>
  <?php if (!$data['accounts']): ?><p>Még nincsenek fiókok — hozd létre őket a vezérlőben.</p><?php endif; ?>
</body>
</html>
<?php exit; }

$pageTitle  = 'Nyílt nap vezérlő — Sárkányok és Vikingek';
$pageStyles = ['style/openday.css'];
$bodyClass  = 'page-body openday-admin';
require __DIR__ . '/header.php';
?>

<div class="wrap od-admin">
  <header class="od-admin-head">
    <div>
      <p class="od-kicker">ᛉ Algiz — a segítők asztala</p>
      <h1>Nyílt nap vezérlő</h1>
      <p class="muted">Belépés a látogatóknak: <a href="nyiltnap.php"><b>nyiltnap.php</b></a> — csak a kártyán lévő kód kell.
        A nullázás nem lépteti ki a látogatót: az oldala pár másodperc múlva magától a túra elejére ugrik.</p>
    </div>
    <div class="od-admin-actions">
      <button class="btn btn-sm" type="button" data-act="create">＋ Fiókok létrehozása</button>
      <a class="btn btn-sm" href="nyiltnap_admin.php?print=1" target="_blank" rel="noopener">🖶 Kódkártyák</a>
      <button class="btn btn-sm" type="button" data-act="all_on">Mind be</button>
      <button class="btn btn-sm" type="button" data-act="all_off">Mind ki</button>
      <button class="btn btn-sm btn-danger" type="button" data-act="reset_all">⟲ Mind nullázása</button>
    </div>
  </header>

  <?php if ((string)app_config('openai.api_key', '') !== ''): ?>
    <p class="od-ai-status is-on"><span class="od-ai">AI</span> A saga-állomáson a mesterséges intelligencia ír (OpenAI, <?= e(app_config('openai.model', '')) ?>).</p>
  <?php else: ?>
    <p class="od-ai-status"><span class="od-ai">AI</span> <b>Nincs beállítva OpenAI-kulcs</b> — most a beépített mesélő írja a sagákat.
      A nyílt nap előtt add meg a kulcsot az <code>OPENAI_API_KEY</code> környezeti változóban, vagy a
      <code>config.local.php</code> fájlban: <code>'openai' =&gt; ['api_key' =&gt; '…']</code>.</p>
  <?php endif; ?>
  <div class="od-stats" id="odStats"></div>
  <div class="od-toast" id="odToast" role="status" aria-live="polite"></div>
  <div class="od-grid" id="odGrid"></div>
</div>

<script>
  window.OD_ADMIN = {
    csrf: <?= json_encode(csrf_token()) ?>,
    steps: <?= json_encode(array_map(static fn($s) => [$s[0], $s[2]], OPENDAY_STEPS), JSON_UNESCAPED_UNICODE) ?>,
    data: <?= json_encode($data, JSON_UNESCAPED_UNICODE) ?>,
  };
</script>
<?php $pageScripts = ['script/openday_admin.js']; require __DIR__ . '/footer.php';
