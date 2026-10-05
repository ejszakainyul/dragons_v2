<?php
require_once __DIR__ . '/inc/bootstrap.php';

// A régi, URL-ben továbbadott azonosítókat használó sütik takarítása
foreach (['user_id', 'user_name'] as $legacy) {
    if (isset($_COOKIE[$legacy])) {
        setcookie($legacy, '', time() - 3600, '/');
    }
}

$_SESSION = [];

if (ini_get('session.use_cookies')) {
    $p = session_get_cookie_params();
    setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], $p['secure'], $p['httponly']);
}

session_destroy();

header('Location: index.php');
exit;
