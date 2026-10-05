<?php
/**
 * Az aréna: válassz sárkányt, válassz ellenfelet, és fuss le egy csatát.
 * A szimuláció szerveroldalon történik — a kliens nem tudja befolyásolni.
 */
require_once __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/battle.php';
require_login();

$conn    = db();
$user_id = current_user_id();
$error   = '';
$result  = null;
$myPick  = null;
$foePick = null;

/** Egy sárkány a tulajdonos nevével. */
function load_dragon(mysqli $conn, int $id): ?array
{
    $stmt = $conn->prepare(
        "SELECT d.*, u.name AS owner
           FROM sarkanyok d
           JOIN sarkanyok_users u ON u.id = d.user_id
          WHERE d.id = ?"
    );
    $stmt->bind_param('i', $id);
    $stmt->execute();
    $row = $stmt->get_result()->fetch_assoc();
    $stmt->close();
    return $row ?: null;
}

/* --- Saját sárkányok ------------------------------------------------ */
$stmt = $conn->prepare(
    "SELECT * FROM sarkanyok WHERE user_id = ? ORDER BY (hp * 0.6 + dmg * 4) DESC"
);
$stmt->bind_param('i', $user_id);
$stmt->execute();
$myDragons = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

/* --- Lehetséges ellenfelek ------------------------------------------ */
$vsUser = (int)($_GET['vs'] ?? 0);

if ($vsUser > 0) {
    $stmt = $conn->prepare(
        "SELECT d.*, u.name AS owner
           FROM sarkanyok d
           JOIN sarkanyok_users u ON u.id = d.user_id
          WHERE d.user_id = ?
          ORDER BY (d.hp * 0.6 + d.dmg * 4) DESC"
    );
    $stmt->bind_param('i', $vsUser);
} else {
    $stmt = $conn->prepare(
        "SELECT d.*, u.name AS owner
           FROM sarkanyok d
           JOIN sarkanyok_users u ON u.id = d.user_id
          WHERE d.user_id <> ?
          ORDER BY (d.hp * 0.6 + d.dmg * 4) DESC
          LIMIT 24"
    );
    $stmt->bind_param('i', $user_id);
}
$stmt->execute();
$foes = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

/* --- Csata ---------------------------------------------------------- */
if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    $mineId = (int)($_POST['mine'] ?? 0);
    $foeId  = (int)($_POST['foe'] ?? 0);

    $myPick  = load_dragon($conn, $mineId);
    $foePick = load_dragon($conn, $foeId);

    if (!$myPick || (int)$myPick['user_id'] !== $user_id) {
        $error = 'Válaszd ki a saját sárkányodat!';
    } elseif (!$foePick) {
        $error = 'Az ellenfél nem található.';
    } elseif ((int)$foePick['id'] === (int)$myPick['id']) {
        $error = 'Egy sárkány nem harcolhat önmagával.';
    } else {
        $myPick['owner'] = $_SESSION['name'] ?? 'Te';
        $result = battle_simulate($myPick, $foePick);
        battle_record($myPick, $foePick, $result);
    }
}

/* --- Korábbi csaták ------------------------------------------------- */
$stmt = $conn->prepare(
    "SELECT b.id, b.rounds, b.created_at, b.winner_id,
            da.nev AS a_nev, db.nev AS b_nev,
            da.user_id AS a_user, db.user_id AS b_user,
            w.user_id AS winner_user
       FROM sarkanyok_battles b
       JOIN sarkanyok da ON da.id = b.attacker_id
       JOIN sarkanyok db ON db.id = b.defender_id
       LEFT JOIN sarkanyok w ON w.id = b.winner_id
      WHERE da.user_id = ? OR db.user_id = ?
      ORDER BY b.id DESC
      LIMIT 8"
);
$stmt->bind_param('ii', $user_id, $user_id);
$stmt->execute();
$history = $stmt->get_result()->fetch_all(MYSQLI_ASSOC);
$stmt->close();

$pageTitle  = 'Az aréna — Sárkányok és Vikingek';
$pageStyles = ['style/arena.css'];
require __DIR__ . '/header.php';
?>

<div class="wrap">
  <header class="section-head" style="margin-bottom:30px">
    <h1>Az aréna</h1>
    <p>Válaszd ki a bajnokodat és az ellenfelét. A csata körökre oszlik — kitérés, kritikus találat, minden benne van.</p>
  </header>

  <?php if ($error): ?>
    <div class="alert alert-error"><span aria-hidden="true">⚠</span><span><?= e($error) ?></span></div>
  <?php endif; ?>

  <?php if ($result): ?>
    <!-- ===================== EREDMÉNY ===================== -->
    <?php
      $won   = $result['winner'] === 'a';
      $hp    = $result['hp'];
      $pctA  = $hp['maxA'] ? round($hp['a'] / $hp['maxA'] * 100) : 0;
      $pctB  = $hp['maxB'] ? round($hp['b'] / $hp['maxB'] * 100) : 0;
    ?>
    <section class="battle card <?= $won ? 'is-win' : 'is-loss' ?>">
      <div class="battle-banner">
        <?= $won ? '🏆 Győzelem!' : '💀 Vereség' ?>
      </div>

      <div class="battle-arena">
        <div class="fighter fighter-a <?= $won ? 'winner' : 'loser' ?>">
          <?= dragon_render($myPick) ?>
          <h3><?= e($myPick['nev']) ?></h3>
          <p class="muted"><?= e($myPick['owner']) ?></p>
          <div class="stat-bar hp"><span data-fill="<?= $pctA ?>"></span></div>
          <p class="fighter-hp"><?= (int)$hp['a'] ?> / <?= (int)$hp['maxA'] ?> HP · ⚔ <?= (int)$myPick['dmg'] ?></p>
        </div>

        <div class="battle-vs" aria-hidden="true">
          <span>VS</span>
          <small><?= (int)$result['rounds'] ?> kör</small>
        </div>

        <div class="fighter fighter-b <?= $won ? 'loser' : 'winner' ?>">
          <?= dragon_render($foePick) ?>
          <h3><?= e($foePick['nev']) ?></h3>
          <p class="muted"><?= e($foePick['owner']) ?></p>
          <div class="stat-bar hp"><span data-fill="<?= $pctB ?>"></span></div>
          <p class="fighter-hp"><?= (int)$hp['b'] ?> / <?= (int)$hp['maxB'] ?> HP · ⚔ <?= (int)$foePick['dmg'] ?></p>
        </div>
      </div>

      <h3 class="log-title">Csatanapló</h3>
      <ol class="battle-log" id="battleLog">
        <?php foreach ($result['log'] as $i => $entry): ?>
          <li class="log-<?= e($entry['side']) ?> log-type-<?= e($entry['type']) ?>"
              style="--i:<?= $i ?>">
            <span class="log-round"><?= $entry['side'] === 'sys' ? '—' : (int)$entry['round'] ?></span>
            <span class="log-text"><?= e($entry['text']) ?></span>
          </li>
        <?php endforeach; ?>
      </ol>

      <div class="flex-center mt-2">
        <a class="btn btn-primary" href="arena.php">Újabb csata</a>
        <a class="btn" href="user.php">Gyűjteményem</a>
      </div>
    </section>

  <?php elseif (!$myDragons): ?>
    <div class="card empty-state" style="text-align:center;padding:56px 30px">
      <span style="font-size:3.2rem;display:block;margin-bottom:14px">⚔️</span>
      <h2>Előbb kell egy sárkány</h2>
      <p class="muted">Töltsd ki a kérdőívet, vagy építs egyet a műhelyben — aztán irány az aréna.</p>
      <div class="flex-center mt-2">
        <a class="btn btn-primary" href="quiz.php">Kérdőív</a>
        <a class="btn" href="nyitott.php">Műhely</a>
      </div>
    </div>

  <?php else: ?>
    <!-- ===================== VÁLASZTÓ ===================== -->
    <form method="post" id="arenaForm">
      <?= csrf_field() ?>
      <input type="hidden" name="mine" id="pickMine" value="">
      <input type="hidden" name="foe"  id="pickFoe"  value="">

      <div class="picker-grid">
        <section>
          <h2 class="picker-title">A bajnokod</h2>
          <div class="picker-list" data-side="mine">
            <?php foreach ($myDragons as $d): ?>
              <button type="button" class="picker-card" data-id="<?= (int)$d['id'] ?>">
                <?= dragon_render($d, false) ?>
                <strong><?= e($d['nev']) ?></strong>
                <span class="picker-stats">❤<?= (int)$d['hp'] ?> ⚔<?= (int)$d['dmg'] ?></span>
                <?php if ((int)$d['wins'] || (int)$d['losses']): ?>
                  <small class="muted"><?= (int)$d['wins'] ?>Gy / <?= (int)$d['losses'] ?>V</small>
                <?php endif; ?>
              </button>
            <?php endforeach; ?>
          </div>
        </section>

        <section>
          <h2 class="picker-title">
            Az ellenfél
            <?php if ($vsUser > 0 && $foes): ?>
              <span class="badge badge-ice"><?= e($foes[0]['owner']) ?></span>
              <a class="badge" href="arena.php">összes ellenfél</a>
            <?php endif; ?>
          </h2>

          <?php if (!$foes): ?>
            <p class="muted">Nincs elérhető ellenfél. Hívj meg egy barátot, vagy várd meg,
               amíg más is nevel sárkányt!</p>
          <?php else: ?>
            <div class="picker-list" data-side="foe">
              <?php foreach ($foes as $d): ?>
                <button type="button" class="picker-card" data-id="<?= (int)$d['id'] ?>">
                  <?= dragon_render($d, false) ?>
                  <strong><?= e($d['nev']) ?></strong>
                  <span class="picker-owner muted"><?= e($d['owner']) ?></span>
                  <span class="picker-stats">❤<?= (int)$d['hp'] ?> ⚔<?= (int)$d['dmg'] ?></span>
                </button>
              <?php endforeach; ?>
            </div>
          <?php endif; ?>
        </section>
      </div>

      <div class="arena-launch">
        <p class="muted" id="launchHint">Válassz egy sárkányt mindkét oldalról.</p>
        <button class="btn btn-primary" type="submit" id="fightBtn" disabled>⚔ Csata indítása</button>
      </div>
    </form>
  <?php endif; ?>

  <!-- ===================== ELŐZMÉNYEK ===================== -->
  <?php if ($history): ?>
    <section class="section" style="padding-top:60px">
      <h2>Korábbi csatáid</h2>
      <ul class="history-list">
        <?php foreach ($history as $h):
          $mineWon = (int)$h['winner_user'] === $user_id;
        ?>
          <li class="<?= $mineWon ? 'won' : 'lost' ?>">
            <span class="history-mark" aria-hidden="true"><?= $mineWon ? '🏆' : '💀' ?></span>
            <span class="history-names"><?= e($h['a_nev']) ?> <em>vs</em> <?= e($h['b_nev']) ?></span>
            <span class="badge"><?= (int)$h['rounds'] ?> kör</span>
            <span class="muted"><?= e(date('Y. m. d. H:i', strtotime((string)$h['created_at']))) ?></span>
          </li>
        <?php endforeach; ?>
      </ul>
    </section>
  <?php endif; ?>
</div>

<script>
  (() => {
    const form = document.getElementById('arenaForm');
    if (!form) return;

    const btn  = document.getElementById('fightBtn');
    const hint = document.getElementById('launchHint');
    const pick = { mine: null, foe: null };

    document.querySelectorAll('.picker-list').forEach((list) => {
      const side = list.dataset.side;
      list.addEventListener('click', (e) => {
        const card = e.target.closest('.picker-card');
        if (!card) return;

        list.querySelectorAll('.picker-card').forEach((c) => c.classList.remove('selected'));
        card.classList.add('selected');

        pick[side] = card.dataset.id;
        document.getElementById(side === 'mine' ? 'pickMine' : 'pickFoe').value = card.dataset.id;

        const ready = Boolean(pick.mine && pick.foe);
        btn.disabled = !ready;
        hint.textContent = ready
          ? 'Készen álltok. A homok vár.'
          : 'Válassz egy sárkányt mindkét oldalról.';
      });
    });

    form.addEventListener('submit', () => {
      btn.disabled = true;
      btn.textContent = 'A homok felszáll…';
    });
  })();
</script>

<?php require __DIR__ . '/footer.php';
