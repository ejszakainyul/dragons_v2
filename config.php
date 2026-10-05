<?php
/**
 * Központi konfiguráció.
 *
 * NE írd bele éles jelszavakat/kulcsokat: hozz létre egy config.local.php-t
 * ugyanilyen szerkezettel, az felülírja az itt lévő alapértékeket, és
 * nem kerül be a verziókövetésbe.
 */

$config = [
    // --- Adatbázis (alapértelmezés: XAMPP helyi MySQL) -----------------
    'db' => [
        'host'    => '127.0.0.1',
        'user'    => 'root',
        'pass'    => '',
        'name'    => 'sarkanyok',
        'port'    => 3306,
        'charset' => 'utf8mb4',
    ],

    // --- Alkalmazás ---------------------------------------------------
    'app' => [
        // true esetén a hibák megjelennek a képernyőn (csak fejlesztéshez!)
        'debug'          => true,
        // Hány történetet generálhat egy felhasználó
        'story_limit'    => 3,
        // A visszaállító linkek alapcíme
        'base_url'       => 'http://localhost/sarkanyok',
        'mail_from'      => 'admin@nightnet.hu',
    ],

    // --- OpenAI -------------------------------------------------------
    // Üresen hagyva a story.php beépített, offline történetgenerátort használ,
    // így kulcs nélkül is működik az oldal.
    'openai' => [
        'api_key' => getenv('OPENAI_API_KEY') ?: '',
        'model'   => 'gpt-4o-mini',
    ],
];

// Helyi felülírások
if (is_file(__DIR__ . '/config.local.php')) {
    $local = require __DIR__ . '/config.local.php';
    if (is_array($local)) {
        foreach ($local as $section => $values) {
            if (is_array($values) && isset($config[$section]) && is_array($config[$section])) {
                $config[$section] = array_merge($config[$section], $values);
            } else {
                $config[$section] = $values;
            }
        }
    }
}

return $config;
