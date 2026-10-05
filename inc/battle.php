<?php
/**
 * Körökre osztott csataszimuláció.
 *
 * Determinisztikus egy adott mag (seed) mellett, így a lementett napló
 * bármikor újrajátszható, és a kliens nem tudja befolyásolni az eredményt.
 */

const BATTLE_MAX_ROUNDS = 24;

/**
 * Lefuttat egy csatát két sárkány között.
 *
 * @param array $a  Támadó (sarkanyok sor + owner)
 * @param array $b  Védő
 * @return array{winner:string,rounds:int,log:array,hp:array}
 */
function battle_simulate(array $a, array $b, ?int $seed = null): array
{
    $seed ??= random_int(1, PHP_INT_MAX);
    mt_srand($seed);

    $hpA = max(1, (int)$a['hp']);
    $hpB = max(1, (int)$b['hp']);
    $maxA = $hpA;
    $maxB = $hpB;

    $dmgA = max(1, (int)$a['dmg']);
    $dmgB = max(1, (int)$b['dmg']);

    // A gyorsabb (nagyobb sebzésű) kezd; döntetlennél a támadó
    $firstIsA = $dmgA >= $dmgB;

    $log   = [];
    $round = 0;

    while ($hpA > 0 && $hpB > 0 && $round < BATTLE_MAX_ROUNDS) {
        $round++;

        $order = $firstIsA ? [['a', 'b'], ['b', 'a']] : [['b', 'a'], ['a', 'b']];

        foreach ($order as [$att, $def]) {
            if ($hpA <= 0 || $hpB <= 0) {
                break;
            }

            $attacker = $att === 'a' ? $a : $b;
            $defender = $def === 'a' ? $a : $b;
            $baseDmg  = $att === 'a' ? $dmgA : $dmgB;

            // 12% esély kitérésre, 15% kritikus találatra
            $roll = mt_rand(1, 100);

            if ($roll <= 12) {
                $log[] = [
                    'round'  => $round,
                    'side'   => $att,
                    'type'   => 'miss',
                    'amount' => 0,
                    'text'   => "{$defender['nev']} félrelibben — {$attacker['nev']} csapása célt téveszt.",
                ];
                continue;
            }

            $variance = mt_rand(85, 118) / 100;
            $amount   = (int)round($baseDmg * $variance);
            $crit     = $roll > 85;

            if ($crit) {
                $amount = (int)round($amount * 1.6);
            }
            $amount = max(1, $amount);

            if ($def === 'a') {
                $hpA = max(0, $hpA - $amount);
            } else {
                $hpB = max(0, $hpB - $amount);
            }

            $log[] = [
                'round'  => $round,
                'side'   => $att,
                'type'   => $crit ? 'crit' : 'hit',
                'amount' => $amount,
                'hpA'    => $hpA,
                'hpB'    => $hpB,
                'text'   => $crit
                    ? "💥 {$attacker['nev']} kritikus csapást mér {$defender['nev']}-ra: {$amount} sebzés!"
                    : "{$attacker['nev']} lecsap: {$amount} sebzés.",
            ];
        }
    }

    // Győztes
    if ($hpA > 0 && $hpB <= 0) {
        $winner = 'a';
    } elseif ($hpB > 0 && $hpA <= 0) {
        $winner = 'b';
    } else {
        // Körlimit: a nagyobb megmaradt életerő-arány nyer
        $ratioA = $hpA / $maxA;
        $ratioB = $hpB / $maxB;
        $winner = $ratioA === $ratioB ? 'a' : ($ratioA > $ratioB ? 'a' : 'b');
        $log[]  = [
            'round' => $round,
            'side'  => 'sys',
            'type'  => 'timeout',
            'text'  => 'Kimerültek — a kevésbé sebzett fél viszi el a győzelmet.',
        ];
    }

    $log[] = [
        'round' => $round,
        'side'  => 'sys',
        'type'  => 'end',
        'text'  => '🏆 ' . ($winner === 'a' ? $a['nev'] : $b['nev']) . ' győzött!',
    ];

    return [
        'winner' => $winner,
        'rounds' => $round,
        'log'    => $log,
        'hp'     => ['a' => $hpA, 'b' => $hpB, 'maxA' => $maxA, 'maxB' => $maxB],
        'seed'   => $seed,
    ];
}

/**
 * Elmenti a csata eredményét, és frissíti a győzelem/vereség számlálókat.
 */
function battle_record(array $a, array $b, array $result): void
{
    $conn     = db();
    $winnerId = (int)($result['winner'] === 'a' ? $a['id'] : $b['id']);
    $loserId  = (int)($result['winner'] === 'a' ? $b['id'] : $a['id']);

    $stmt = $conn->prepare(
        "INSERT INTO sarkanyok_battles (attacker_id, defender_id, winner_id, rounds, log)
         VALUES (?, ?, ?, ?, ?)"
    );
    $json = json_encode($result['log'], JSON_UNESCAPED_UNICODE);
    $aid  = (int)$a['id'];
    $bid  = (int)$b['id'];
    $stmt->bind_param('iiiis', $aid, $bid, $winnerId, $result['rounds'], $json);
    $stmt->execute();
    $stmt->close();

    $upd = $conn->prepare("UPDATE sarkanyok SET wins = wins + 1 WHERE id = ?");
    $upd->bind_param('i', $winnerId);
    $upd->execute();
    $upd->close();

    $upd = $conn->prepare("UPDATE sarkanyok SET losses = losses + 1 WHERE id = ?");
    $upd->bind_param('i', $loserId);
    $upd->execute();
    $upd->close();
}
