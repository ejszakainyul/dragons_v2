<?php
/**
 * A jóslat.
 *
 * Alapból a 3D-s utazás fut (script/journey.js). Ha nincs WebGL, a játékos
 * csökkentett mozgást kért, vagy kifejezetten az egyszerű nézetet választotta,
 * a korábbi 2D-s kérdőív indul helyette.
 */
require_once __DIR__ . '/inc/bootstrap.php';
require_login();

$conn = db();

$stmt = $conn->prepare("SELECT quiz_taken FROM sarkanyok_users WHERE id = ?");
$stmt->bind_param('i', $_SESSION['user_id']);
$stmt->execute();
$quizTaken = (int)($stmt->get_result()->fetch_assoc()['quiz_taken'] ?? 0);
$stmt->close();

$pageTitle  = 'A jóslat — Sárkányok és Vikingek';
$pageStyles = $quizTaken ? [] : ['style/question.css', 'style/cursor.css', 'style/journey.css'];
$bodyClass  = 'page-body quiz-page';
require __DIR__ . '/header.php';
?>

<?php if ($quizTaken): ?>

  <div class="wrap">
    <div class="card empty-state" style="max-width:620px;margin:0 auto;text-align:center;padding:56px 30px">
      <span style="font-size:3.2rem;display:block;margin-bottom:14px">🔮</span>
      <h1 style="font-size:1.7rem">A köd már felfedte a sorsodat</h1>
      <p class="muted">A jóslatot csak egyszer lehet kérni. A sárkányod ott vár a gyűjteményedben —
        a műhelyben viszont annyi újat építhetsz, amennyit csak akarsz.</p>
      <div class="flex-center mt-2">
        <a class="btn btn-primary" href="user.php">A gyűjteményem</a>
        <a class="btn" href="nyitott.php">Műhely</a>
      </div>
    </div>
  </div>

<?php else: ?>

  <!-- ============ 3D-s utazás ============ -->
  <div id="journeyRoot" hidden>
    <canvas id="journeyCanvas"></canvas>
    <div class="j-ui"></div>
  </div>

  <!-- ============ Egyszerű (2D) kérdőív — tartalék ============ -->
  <div class="quiz-stage" id="classicStage" hidden>
    <div class="quiz-progress"><span id="quizProgress"></span></div>

    <div class="quiz-container" id="quizContainer">
      <p class="quiz-step" id="quizStep"></p>
      <div id="question" class="question"></div>
      <div class="options"></div>
    </div>

    <div class="result" id="result"></div>
  </div>

  <script>
    window.QUIZ = {
      saveUrl:  'save_dragon.php',
      partsDir: <?= json_encode(part_dir()) ?>,
      partsExt: <?= json_encode(part_ext()) ?>,
      csrf:     <?= json_encode(csrf_token()) ?>,
      // Amiből a jóslat válogathat. Részenként külön, hogy ne egy
      // kész szettet kapj, hanem tényleg kevert sárkányt.
      pools: {
        head:  <?= json_encode(normal_part_ids('fej')) ?>,
        body:  <?= json_encode(normal_part_ids('test')) ?>,
        legs:  <?= json_encode(normal_part_ids('lab')) ?>,
        wings: <?= json_encode(normal_part_ids('szarny')) ?>
      }
    };
  </script>

  <!-- A válaszok kiértékelése: mindkét kérdőív (3D és egyszerű) ezt használja -->
  <script src="<?= asset('script/pick_parts.js') ?>"></script>

  <?php
  /*
   * Az importmap a 3D almodulokat is verziózza. A journey.js-re tett ?v=
   * csak magára a belépő fájlra hat — az általa importált modulokat a
   * böngésző enélkül a gyorsítótárból venné, és egy javítás után is a
   * régi kód futna.
   */
  // Minden almodul automatikusan — új fájlnál se maradjon ki a verzió
  $journeyModules = array_map('basename', glob(__DIR__ . '/script/journey/*.js') ?: []);
  $importMap = [
      'three'         => './vendor/three/three.module.js',
      'three/addons/' => './vendor/three/addons/',
  ];
  foreach ($journeyModules as $m) {
      $file = __DIR__ . '/script/journey/' . $m;
      $importMap['./script/journey/' . $m] = './script/journey/' . $m . '?v=' . (int)@filemtime($file);
  }
  ?>
  <script type="importmap">
  <?= json_encode(['imports' => $importMap], JSON_PRETTY_PRINT | JSON_UNESCAPED_SLASHES) ?>
  </script>

  <script>
  (() => {
    const journeyRoot  = document.getElementById('journeyRoot');
    const classicStage = document.getElementById('classicStage');

    const webgl = (() => {
      try {
        const c = document.createElement('canvas');
        return !!(window.WebGLRenderingContext &&
          (c.getContext('webgl2') || c.getContext('webgl')));
      } catch { return false; }
    })();

    const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const wantsClassic = sessionStorage.getItem('quizClassic') === '1';
    const modules      = HTMLScriptElement.supports
                       ? HTMLScriptElement.supports('importmap')
                       : true;

    /** A régi, 2D-s kérdőív betöltése. */
    const loadClassic = () => {
      classicStage.hidden = false;
      document.body.classList.remove('journey-active');
      journeyRoot.remove();

      ['style/question.css', 'style/cursor.css'].forEach((href) => {
        if (!document.querySelector(`link[href^="${href}"]`)) {
          const l = document.createElement('link');
          l.rel = 'stylesheet';
          l.href = href;
          document.head.appendChild(l);
        }
      });

      ['script/dragon.js', 'script/cursor.js', 'script/question.js'].forEach((src) => {
        const s = document.createElement('script');
        s.src = src;
        document.body.appendChild(s);
      });
    };

    if (webgl && !reduceMotion && !wantsClassic && modules) {
      journeyRoot.hidden = false;
      journeyRoot.addEventListener('journey:unavailable', loadClassic);

      const s = document.createElement('script');
      s.type = 'module';
      s.src  = 'script/journey.js?v=<?= (int)@filemtime(__DIR__ . '/script/journey.js') ?>';
      s.onerror = loadClassic;
      document.body.appendChild(s);
    } else {
      sessionStorage.removeItem('quizClassic');
      loadClassic();
    }
  })();
  </script>

<?php endif; ?>

<?php require __DIR__ . '/footer.php';
