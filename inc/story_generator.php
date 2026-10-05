<?php
/**
 * Történetgenerálás.
 *
 * Ha van OpenAI kulcs a konfigurációban, azt használja; ha nincs (vagy hibázik),
 * a beépített, sablonos mesélő ugrik be — így az oldal kulcs nélkül is működik.
 */

/**
 * @return array{story:string,source:string}  source: 'ai' | 'local'
 */
function generate_story(string $name, string $provenance, string $weapon, string $dragon): array
{
    $key = (string)app_config('openai.api_key', '');

    if ($key !== '') {
        $ai = openai_story($key, $name, $provenance, $weapon, $dragon);
        if ($ai !== null) {
            return ['story' => $ai, 'source' => 'ai'];
        }
    }

    return ['story' => local_story($name, $provenance, $weapon, $dragon), 'source' => 'local'];
}

/**
 * OpenAI hívás. Hiba esetén null — a hívó a helyi generátorra vált.
 */
function openai_story(string $key, string $name, string $provenance, string $weapon, string $dragon): ?string
{
    $payload = [
        'model'    => app_config('openai.model', 'gpt-4o-mini'),
        'messages' => [
            [
                'role'    => 'system',
                'content' => 'Segítőkész mesélő vagy, aki norvég mitológia stílusában ír '
                           . 'rövid viking történeteket magyarul, 500–700 karakter között.',
            ],
            [
                'role'    => 'user',
                'content' => "Írj egy rövid viking történetet a következő paraméterekkel: "
                           . "Név: {$name}, származása: {$provenance}, "
                           . "fegyver típusa: {$weapon}, sárkányának neve: {$dragon}.",
            ],
        ],
        'max_tokens'  => 400,
        'temperature' => 0.85,
    ];

    $ch = curl_init('https://api.openai.com/v1/chat/completions');
    curl_setopt_array($ch, [
        CURLOPT_RETURNTRANSFER => true,
        CURLOPT_POST           => true,
        CURLOPT_TIMEOUT        => 25,
        CURLOPT_HTTPHEADER     => [
            'Content-Type: application/json',
            'Authorization: Bearer ' . $key,
        ],
        CURLOPT_POSTFIELDS     => json_encode($payload, JSON_UNESCAPED_UNICODE),
    ]);

    $response = curl_exec($ch);
    $status   = curl_getinfo($ch, CURLINFO_HTTP_CODE);
    curl_close($ch);

    if ($response === false || $status !== 200) {
        return null;
    }

    $data = json_decode((string)$response, true);
    $text = $data['choices'][0]['message']['content'] ?? null;

    return is_string($text) && trim($text) !== '' ? trim($text) : null;
}

/**
 * Helyi mesélő: variálható mondatelemekből épít összefüggő sagát.
 * Nem AI, de mindig működik, és mindig más.
 */
function local_story(string $name, string $provenance, string $weapon, string $dragon): string
{
    $openings = [
        "A köd úgy ült meg {$provenance} partjain, mint a jóslat, amit senki nem mert kimondani.",
        "{$provenance} fjordjai fölött aznap éjjel nem kelt fel a hold.",
        "Három telet vártak {$provenance} népei arra a hajnalra, amelyen {$name} vízre szállt.",
        "Amikor a jég megrepedt {$provenance} öblében, a vének tudták: valami hazatér.",
    ];

    $heroes = [
        "{$name} nem a legerősebb volt a hajón, de ő volt az egyetlen, aki nem fordult vissza.",
        "{$name} úgy tartotta a kormánylapátot, ahogy más az imát: két kézzel, mozdulatlanul.",
        "{$name} nevét a tengerre írták, nem a kőbe — és a tenger nem felejt.",
        "{$name} minden sebhelyéhez tartozott egy név, és minden névhez egy adósság.",
    ];

    $weapons = [
        "A {$weapon} nem egyszerű fegyver volt: a nyelébe rúnákat vésett egy asszony, akinek a nevét {$name} soha nem árulta el.",
        "A {$weapon} súlyát nem a vas adta, hanem az, amit {$name} vele elvesztett.",
        "A {$weapon} élén megcsillant a sarki fény, és a legenda szerint ilyenkor Odin is odanézett.",
        "A {$weapon} már három gazdát temetett el — {$name} volt a negyedik, aki felemelte.",
    ];

    $dragons = [
        "És ott volt {$dragon}. A sárkány, aki nem szolgált, csak választott.",
        "{$dragon} szárnycsapása olyan volt, mint a mennydörgés visszhangja a szoroson.",
        "{$dragon} nem a tűzért félték, hanem a csöndért, ami a tüze előtt járt.",
        "{$dragon} pikkelyein úgy tört meg a fény, mintha a világ minden reggelét egyszerre hordaná.",
    ];

    $trials = [
        "A viharban {$name} elvesztette a hajó felét, de {$dragon} kiemelte a mélyből azt, amit a tenger már magáénak hitt.",
        "Amikor a jötunok kőbe vájt hadserege elzárta a szorost, {$dragon} egyetlen ívben égette ki az utat.",
        "A hetedik éjszakán a legénység fellázadt. {$name} nem emelte rá a {$weapon}-t — csak várt, amíg {$dragon} árnyéka rájuk vetült.",
        "A jóslat azt mondta, hogy {$name} a tengeren hal meg. {$dragon} úgy döntött, a jóslat téved.",
    ];

    $endings = [
        "Ma is éneklik {$provenance} csarnokaiban: ahol {$name} járt, ott a víz sosem lett újra sima.",
        "{$name} nem tért vissza — de {$dragon} minden tavasszal átrepül {$provenance} fölött, és ez elég.",
        "A saga végén nincs csata, csak egy üres part, egy {$weapon} a homokba szúrva, és két nyomvonal, ami a tenger felé vezet.",
        "Azt mondják, aki {$provenance} partján hajnalban kimondja {$dragon} nevét, meghallja a szárnyakat. Legtöbben nem merik.",
    ];

    $parts = [
        $openings[array_rand($openings)],
        $heroes[array_rand($heroes)],
        $weapons[array_rand($weapons)],
        $dragons[array_rand($dragons)],
        $trials[array_rand($trials)],
        $endings[array_rand($endings)],
    ];

    return implode("\n\n", $parts);
}
