<?php
/**
 * Történetgenerátor.
 *
 * A korábbi verzióban az OpenAI kulcs bele volt írva a forrásba — most a
 * konfigurációból jön, és ha nincs kulcs, a beépített mesélő veszi át.
 */
require_once __DIR__ . '/inc/bootstrap.php';
require_once __DIR__ . '/inc/story_generator.php';
require_login();

$conn    = db();
$user_id = current_user_id();
$limit   = (int)app_config('app.story_limit', 3);

$stmt = $conn->prepare("SELECT COUNT(*) AS c FROM sarkanyok_story WHERE user_id = ?");
$stmt->bind_param('i', $user_id);
$stmt->execute();
$used = (int)$stmt->get_result()->fetch_assoc()['c'];
$stmt->close();

$error  = '';
$story  = '';
$source = '';
$form   = ['name' => '', 'provenance' => '', 'weapon' => '', 'dragon' => ''];

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    csrf_check();

    foreach ($form as $key => $_) {
        $form[$key] = mb_substr(trim((string)($_POST[$key] ?? '')), 0, 80);
    }

    if ($used >= $limit) {
        $error = "Elérted a maximális {$limit} történetet.";
    } elseif (in_array('', $form, true)) {
        $error = 'Kérlek tölts ki minden mezőt!';
    } else {
        $generated = generate_story($form['name'], $form['provenance'], $form['weapon'], $form['dragon']);
        $story     = $generated['story'];
        $source    = $generated['source'];

        $stmt = $conn->prepare(
            "INSERT INTO sarkanyok_story (user_id, name, provenance, weapon, dragon, story)
             VALUES (?, ?, ?, ?, ?, ?)"
        );
        $stmt->bind_param(
            'isssss',
            $user_id, $form['name'], $form['provenance'], $form['weapon'], $form['dragon'], $story
        );
        $stmt->execute();
        $stmt->close();

        $used++;
    }
}

$remaining = max(0, $limit - $used);

$pageTitle  = 'A saga — Sárkányok és Vikingek';
$pageStyles = ['style/story.css'];
require __DIR__ . '/header.php';
?>

<div class="wrap story-wrap">
  <header class="section-head">
    <h1>A saga</h1>
    <p>Add meg a viking karaktered adatait, és a mesélő megírja a legendádat.</p>
    <p class="story-quota">
      <span class="badge <?= $remaining ? 'badge-ice' : 'badge-ember' ?>">
        <?= $remaining ?> / <?= $limit ?> történet maradt
      </span>
    </p>
  </header>

  <?php if ($error): ?>
    <div class="alert alert-error"><span aria-hidden="true">⚠</span><span><?= e($error) ?></span></div>
  <?php endif; ?>

  <?php if ($remaining > 0): ?>
    <form class="card story-form" method="post">
      <?= csrf_field() ?>
      <div class="story-fields">
        <div class="field">
          <label for="name">Neved</label>
          <input type="text" id="name" name="name" value="<?= e($form['name']) ?>"
                 placeholder="pl. Ragnar" maxlength="80" required>
        </div>
        <div class="field">
          <label for="provenance">Származásod</label>
          <input type="text" id="provenance" name="provenance" value="<?= e($form['provenance']) ?>"
                 placeholder="pl. Kattegat" maxlength="80" required>
        </div>
        <div class="field">
          <label for="weapon">Fegyvered</label>
          <input type="text" id="weapon" name="weapon" value="<?= e($form['weapon']) ?>"
                 placeholder="pl. csatabárd" maxlength="80" required>
        </div>
        <div class="field">
          <label for="dragon">Sárkányod neve</label>
          <input type="text" id="dragon" name="dragon" value="<?= e($form['dragon']) ?>"
                 placeholder="pl. Zafír" maxlength="80" required>
        </div>
      </div>
      <button class="btn btn-primary" type="submit">📜 Történet írása</button>
    </form>
  <?php else: ?>
    <div class="card empty-state" style="text-align:center;padding:48px 30px">
      <span style="font-size:3rem;display:block;margin-bottom:12px">📜</span>
      <h2>Elfogytak a pergamenjeid</h2>
      <p class="muted">Mind a <?= $limit ?> történetedet megírtad. A profilodban bármelyiket elolvashatod
        — és ha helyet szabadítasz fel, újat írhatsz.</p>
      <a class="btn btn-primary" href="user.php#stories">Történeteim</a>
    </div>
  <?php endif; ?>

  <?php if ($story): ?>
    <article class="card story-result">
      <header class="story-result-head">
        <h2>A te legendád</h2>
        <?php if ($source === 'local'): ?>
          <span class="badge" title="Nincs beállítva OpenAI kulcs — a beépített mesélő írta">
            beépített mesélő
          </span>
        <?php else: ?>
          <span class="badge badge-ice">AI</span>
        <?php endif; ?>
      </header>

      <p class="story-byline muted">
        <?= e($form['name']) ?> · <?= e($form['provenance']) ?> ·
        ⚔ <?= e($form['weapon']) ?> · 🐉 <?= e($form['dragon']) ?>
      </p>

      <div class="story-body"><?= nl2br(e($story)) ?></div>

      <div class="flex-center mt-2">
        <a class="btn" href="user.php#stories">Elmentve a profilodba</a>
      </div>
    </article>
  <?php endif; ?>
</div>

<?php require __DIR__ . '/footer.php';
