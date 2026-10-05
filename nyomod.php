<?php
/**
 * Testrész-katalógus exportálása JSON-ba (a Godot kliens táplálásához).
 *
 * Csak adminnak — korábban bárki lehívhatta.
 * Használat: nyomod.php?part=szarny|lab|fej|test   (vagy ?part=all)
 */
require_once __DIR__ . '/inc/bootstrap.php';

if (!is_admin()) {
    http_response_code(403);
    header('Content-Type: text/plain; charset=utf-8');
    exit('Nincs jogosultság.');
}

$part = (string)($_GET['part'] ?? '');

if ($part === 'all') {
    $data = [];
    foreach (array_keys(PART_TABLES) as $key) {
        $data[$key] = part_catalog($key);
    }
} elseif (isset(PART_TABLES[$part])) {
    $data = part_catalog($part);
} else {
    http_response_code(400);
    header('Content-Type: text/plain; charset=utf-8');
    exit("Érvénytelen 'part' paraméter. Lehetséges értékek: "
         . implode(', ', array_keys(PART_TABLES)) . ', all');
}

$filename = ($part === 'all' ? 'sarkanyok_reszek' : $part) . '.json';

header('Content-Type: application/json; charset=utf-8');
header("Content-Disposition: attachment; filename=\"{$filename}\"");

echo json_encode($data, JSON_PRETTY_PRINT | JSON_UNESCAPED_UNICODE);
