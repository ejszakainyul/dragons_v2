<?php
/**
 * Közös fejléc: megnyitja a HTML dokumentumot és kirajzolja a navigációt.
 *
 * Használat az oldalak tetején:
 *   $pageTitle  = 'Oldal címe';
 *   $pageStyles = ['style/profile.css'];   // opcionális extra CSS
 *   $bodyClass  = 'page-body';             // opcionális
 *   require __DIR__ . '/header.php';
 */

require_once __DIR__ . '/inc/bootstrap.php';

$pageTitle  = $pageTitle  ?? 'Sárkányok és Vikingek';
$pageStyles = $pageStyles ?? [];
$bodyClass  = $bodyClass  ?? 'page-body';
$navActive  = basename($_SERVER['PHP_SELF'] ?? '');

/*
 * A menüpontok ikonjai idősebb futhark rúnák — mindegyik a jelentése
 * miatt került oda (a title-ben olvasható):
 */
$navItems = [
    'index.php'   => ['Főoldal',  'ᛟ', 'Othala — az ősi otthon'],
    'quiz.php'    => ['Kérdőív',  'ᛈ', 'Perthro — a sors titka'],
    'nyitott.php' => ['Műhely',   'ᚲ', 'Kenaz — a mesterség fáklyája'],
    'arena.php'   => ['Aréna',    'ᛏ', 'Tiwaz — Týr, a harc rúnája'],
    'kaland.php'  => ['Kaland',   'ᚹ', 'Wunjo — öröm: a Sárkányok Völgye'],
    'story.php'   => ['Történet', 'ᚨ', 'Ansuz — Odin, a szó és a mese'],
];

/** Egy rúna-ikon a menühöz. */
function nav_rune(string $rune, string $meaning): string
{
    return '<span class="nav-ico rune-ico" aria-hidden="true" title="' . e($meaning) . '">' . $rune . '</span>';
}
?>
<!doctype html>
<html lang="hu">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="description" content="Sárkányok és Vikingek — nevelj saját sárkányt, harcolj az arénában, és írd meg a legendádat.">
<meta name="theme-color" content="#05070f">
<title><?= e($pageTitle) ?></title>
<link rel="icon" href="dragons/head[8].png">
<script>
  /* Könnyített háttér gyengébb gépen — MÉG a festés előtt, hogy ne
     induljon el fölöslegesen egyetlen drága réteg sem. */
  (function () {
    var n = navigator, c = n.connection || {};
    if ((n.hardwareConcurrency || 4) < 4 || (n.deviceMemory || 4) < 4 || c.saveData) {
      document.documentElement.classList.add('realm-lite');
    }
  })();
</script>
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Cinzel:wght@500;700;900&family=Cinzel+Decorative:wght@700;900&family=Inter:wght@400;500;600;700&family=Noto+Sans+Runic&display=swap">
<link rel="stylesheet" href="<?= asset('style/theme.css') ?>">
<link rel="stylesheet" href="<?= asset('style/realm.css') ?>">
<link rel="stylesheet" href="<?= asset('style/nav.css') ?>">
<link rel="stylesheet" href="<?= asset('style/cookies.css') ?>">
<?php foreach ($pageStyles as $css): ?>
<link rel="stylesheet" href="<?= asset($css) ?>">
<?php endforeach; ?>
</head>
<body class="<?= e($bodyClass) ?>">

<?php require __DIR__ . '/inc/realm.php'; ?>

<a class="skip-link" href="#main">Ugrás a tartalomra</a>

<header class="site-nav" id="siteNav">
  <div class="nav-inner">

    <a class="nav-brand" href="index.php">
      <span class="brand-mark" aria-hidden="true">
        <svg viewBox="0 0 64 64" class="brand-shield">
          <defs>
            <radialGradient id="bsWood" cx=".4" cy=".35" r=".75">
              <stop offset="0" stop-color="#3a2b22"/><stop offset="1" stop-color="#140e0c"/>
            </radialGradient>
            <linearGradient id="bsIron" x1="0" y1="0" x2="1" y2="1">
              <stop offset="0" stop-color="#c9d3ea"/><stop offset="1" stop-color="#58617c"/>
            </linearGradient>
          </defs>
          <circle cx="32" cy="32" r="29" fill="url(#bsWood)" stroke="url(#bsIron)" stroke-width="3"/>
          <path d="M32 3v58M3 32h58" stroke="#0c0806" stroke-width="1.2" opacity=".7"/>
          <path d="M11 11l42 42M53 11L11 53" stroke="#0c0806" stroke-width="1" opacity=".45"/>
          <!-- kígyózó sárkány (Jörmungandr) a pajzs körül -->
          <path d="M32 9a23 23 0 1 1-16.3 6.7" fill="none" stroke="#ff8a3d" stroke-width="3" stroke-linecap="round"/>
          <path d="M15.7 15.7l-4.6-1.2 2.1 4.6z" fill="#ff8a3d"/>
          <circle cx="32" cy="32" r="8.5" fill="url(#bsIron)" stroke="#0c0806" stroke-width="1.4"/>
          <path d="M29 28.5l3 7 3-7M29.8 31h4.4" fill="none" stroke="#0c0806" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <img class="brand-ring" src="<?= realm_img('ring-ember.svg') ?>" alt="">
      </span>
      <span class="brand-text">
        <strong>Sárkányok</strong>
        <small>és Vikingek</small>
      </span>
    </a>

    <nav class="nav-links" id="navLinks" aria-label="Fő navigáció">
      <?php foreach ($navItems as $href => $item): [$label, $icon] = $item; ?>
        <a href="<?= e($href) ?>" class="<?= $navActive === $href ? 'active' : '' ?>">
          <?= nav_rune($icon, $item[2]) ?><?= e($label) ?>
        </a>
      <?php endforeach; ?>

      <!-- Csak mobilon: a fiók-műveletek is a lenyíló menübe kerülnek,
           hogy ne csússzanak ki a fejlécből -->
      <div class="nav-links-auth">
        <?php if (is_logged_in()): ?>
          <a href="user.php"><?= nav_rune('ᛗ', 'Mannaz — az ember, önmagad') ?>Profil</a>
          <?php if (is_admin()): ?>
            <a href="dataeditor.php"><?= nav_rune('ᛉ', 'Algiz — oltalom') ?>Adatkezelő</a>
          <?php endif; ?>
          <a href="logout.php"><?= nav_rune('ᚱ', 'Raidho — útra kelni') ?>Kilépés</a>
        <?php else: ?>
          <a href="login.php"><?= nav_rune('ᛞ', 'Dagaz — hajnal, átkelés') ?>Belépés</a>
          <a href="register.php"><?= nav_rune('ᚠ', 'Fehu — új kezdet') ?>Regisztráció</a>
        <?php endif; ?>
      </div>
    </nav>

    <div class="nav-actions">
      <label class="sound-toggle" title="Háttérzene">
        <input type="checkbox" id="toggleSwitch">
        <span class="sound-track"><span class="sound-knob"></span></span>
      </label>

      <?php if (is_logged_in()): ?>
        <a class="nav-user" href="user.php">
          <span class="nav-avatar"><?= e(mb_substr((string)($_SESSION['name'] ?? '?'), 0, 1)) ?></span>
          <span class="nav-user-name"><?= e($_SESSION['name'] ?? '') ?></span>
        </a>
        <?php if (is_admin()): ?>
          <a class="btn btn-sm btn-ghost" href="dataeditor.php">Adatkezelő</a>
        <?php endif; ?>
        <a class="btn btn-sm btn-ghost" href="logout.php">Kilépés</a>
      <?php else: ?>
        <a class="btn btn-sm btn-ghost" href="login.php">Belépés</a>
        <a class="btn btn-sm btn-primary" href="register.php">Regisztráció</a>
      <?php endif; ?>

      <button class="nav-burger" id="navBurger" aria-label="Menü" aria-expanded="false" aria-controls="navLinks">
        <span></span><span></span><span></span>
      </button>
    </div>

  </div>
</header>

<div id="youtubePlayer" hidden></div>

<main id="main">
