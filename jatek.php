<?php
/**
 * A játékmodul beléptetője.
 *
 * Amíg a Godot build (godot.php) nem érhető el, ez az oldal jelenik meg.
 * Amint a godot.php visszakerül a projektmappába, ez automatikusan
 * továbbenged rá — a navigációban nem kell semmit átírni.
 */
require_once __DIR__ . '/inc/bootstrap.php';

if (is_file(__DIR__ . '/godot.php')) {
    header('Location: godot.php');
    exit;
}

$pageTitle = 'A játék — Sárkányok és Vikingek';
require __DIR__ . '/header.php';
?>

<div class="wrap" style="max-width:720px">
  <div class="card" style="text-align:center;padding:56px 34px">
    <span style="font-size:3.4rem;display:block;margin-bottom:16px" aria-hidden="true">🎮</span>
    <h1 style="font-size:1.8rem">A játékmodul fejlesztés alatt</h1>
    <p class="muted">
      A Godot-alapú harcrendszer épp átalakítás alatt áll. Addig is az
      <strong>arénában</strong> megmérkőzhetsz — körökre osztott csata,
      kitéréssel, kritikus találattal és élő csatanaplóval.
    </p>
    <div class="flex-center mt-2">
      <a class="btn btn-primary" href="arena.php">⚔ Irány az aréna</a>
      <a class="btn" href="nyitott.php">Műhely</a>
    </div>
  </div>
</div>

<?php require __DIR__ . '/footer.php';
