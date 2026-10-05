<?php
/**
 * A testrész-katalógus egyetlen forrása.
 *
 * Innen készül a 36+ SVG rajz ÉS a sql/seed.sql is, így a név, a
 * statisztika és a rajz nem tud elcsúszni egymástól.
 *
 * Fontos: a 9-es azonosító a TITKOS sárkány darabja minden résznél
 * (erre épül a secret-save.php easter egg), a többi szabadon keverhető.
 */

const SECRET_ID = 9;

/**
 * Minden rész: [id => [nev, hp, dmg, forma, ...stílusparaméterek]]
 *
 * Az 1–9 azonosítók értékei szándékosan változatlanok maradtak, hogy a
 * már elmentett sárkányok statisztikái ne csússzanak el.
 */
function parts_table(): array
{
    return [

/* ===================================================================== */
'fej' => [
  1  => ['Kölyökfej',    25, 10, 'shape'=>'blunt',   'horn'=>'none',    'jaw'=>'closed', 'eye'=>1.40, 'frill'=>0],
  2  => ['Szarvas fej',  30, 13, 'shape'=>'snout',   'horn'=>'pair',    'jaw'=>'closed', 'eye'=>1.05, 'frill'=>0],
  3  => ['Tüskés fej',   28, 16, 'shape'=>'snout',   'horn'=>'crown',   'jaw'=>'open',   'eye'=>0.95, 'frill'=>0],
  4  => ['Jégagyar',     42, 12, 'shape'=>'crystal', 'horn'=>'crystal', 'jaw'=>'closed', 'eye'=>1.00, 'frill'=>0],
  5  => ['Lávapofa',     26, 21, 'shape'=>'blunt',   'horn'=>'pair',    'jaw'=>'open',   'eye'=>0.90, 'frill'=>0],
  6  => ['Viharszem',    35, 18, 'shape'=>'crest',   'horn'=>'swept',   'jaw'=>'closed', 'eye'=>1.10, 'frill'=>0],
  7  => ['Ősi koponya',  48, 15, 'shape'=>'horned',  'horn'=>'crown',   'jaw'=>'open',   'eye'=>0.95, 'frill'=>0],
  8  => ['Árnyékfej',    30, 25, 'shape'=>'skull',   'horn'=>'swept',   'jaw'=>'open',   'eye'=>1.20, 'frill'=>0],
  9  => ['Titkos fej',  100, 15, 'shape'=>'crest',   'horn'=>'crystal', 'jaw'=>'closed', 'eye'=>1.15, 'frill'=>1],

  10 => ['Csőrös fej',   32, 19, 'shape'=>'beak',    'horn'=>'none',    'jaw'=>'closed', 'eye'=>1.15, 'frill'=>0],
  11 => ['Taréjos fej',  38, 14, 'shape'=>'crest',   'horn'=>'antler',  'jaw'=>'closed', 'eye'=>1.05, 'frill'=>0],
  12 => ['Kígyófej',     22, 23, 'shape'=>'viper',   'horn'=>'none',    'jaw'=>'open',   'eye'=>1.25, 'frill'=>0],
  13 => ['Kristályfej',  45, 11, 'shape'=>'crystal', 'horn'=>'crystal', 'jaw'=>'closed', 'eye'=>0.95, 'frill'=>0],
  14 => ['Sörényes fej', 36, 16, 'shape'=>'snout',   'horn'=>'spiral',  'jaw'=>'closed', 'eye'=>1.10, 'frill'=>1],
  15 => ['Agyaras fej',  44, 17, 'shape'=>'horned',  'horn'=>'pair',    'jaw'=>'open',   'eye'=>0.90, 'frill'=>0],
  16 => ['Bölcs koponya',52,  9, 'shape'=>'crest',   'horn'=>'antler',  'jaw'=>'closed', 'eye'=>1.20, 'frill'=>1],
  17 => ['Vasálarc',     50, 13, 'shape'=>'blunt',   'horn'=>'crown',   'jaw'=>'closed', 'eye'=>0.85, 'frill'=>0],
  18 => ['Parázsfej',    24, 27, 'shape'=>'viper',   'horn'=>'swept',   'jaw'=>'open',   'eye'=>1.00, 'frill'=>0],
],

/* ===================================================================== */
'test' => [
  1  => ['Karcsú test',   45,  5, 'shape'=>'standard', 'bulk'=>0.80, 'ridge'=>'nub',    'tail'=>'tuft',   'skin'=>'soft'],
  2  => ['Pikkelyes test',60,  7, 'shape'=>'standard', 'bulk'=>0.95, 'ridge'=>'soft',   'tail'=>'plain',  'skin'=>'plate'],
  3  => ['Páncélos test', 85,  4, 'shape'=>'stocky',   'bulk'=>1.10, 'ridge'=>'plates', 'tail'=>'club',   'skin'=>'plate'],
  4  => ['Jégpáncél',     78,  6, 'shape'=>'arched',   'bulk'=>1.05, 'ridge'=>'shards', 'tail'=>'shard',  'skin'=>'facet'],
  5  => ['Izzó test',     55, 14, 'shape'=>'standard', 'bulk'=>1.00, 'ridge'=>'plates', 'tail'=>'fin',    'skin'=>'crack'],
  6  => ['Viharbőr',      62, 10, 'shape'=>'arched',   'bulk'=>0.90, 'ridge'=>'fin',    'tail'=>'fin',    'skin'=>'streak'],
  7  => ['Ősi test',      92,  8, 'shape'=>'stocky',   'bulk'=>1.18, 'ridge'=>'plates', 'tail'=>'spiked', 'skin'=>'plate'],
  8  => ['Árnyéktest',    50, 16, 'shape'=>'skeletal', 'bulk'=>0.70, 'ridge'=>'spikes', 'tail'=>'whip',   'skin'=>'bone'],
  9  => ['Titkos test',  100, 15, 'shape'=>'arched',   'bulk'=>1.02, 'ridge'=>'sail',   'tail'=>'fan',    'skin'=>'facet'],

  10 => ['Kígyótest',     40, 18, 'shape'=>'serpent',  'bulk'=>0.72, 'ridge'=>'fin',    'tail'=>'whip',   'skin'=>'streak'],
  11 => ['Zömök test',    88,  6, 'shape'=>'stocky',   'bulk'=>1.22, 'ridge'=>'nub',    'tail'=>'club',   'skin'=>'soft'],
  12 => ['Bordás test',   66, 12, 'shape'=>'skeletal', 'bulk'=>0.86, 'ridge'=>'spikes', 'tail'=>'arrow',  'skin'=>'bone'],
  13 => ['Íves hát',      58, 13, 'shape'=>'arched',   'bulk'=>0.94, 'ridge'=>'sail',   'tail'=>'fan',    'skin'=>'plate'],
  14 => ['Vasbordájú',    95,  5, 'shape'=>'long',     'bulk'=>1.14, 'ridge'=>'plates', 'tail'=>'spiked', 'skin'=>'plate'],
  15 => ['Mohos test',    72,  9, 'shape'=>'long',     'bulk'=>1.00, 'ridge'=>'frill',  'tail'=>'tuft',   'skin'=>'soft'],
  16 => ['Ködtest',       48, 15, 'shape'=>'serpent',  'bulk'=>0.78, 'ridge'=>'none',   'tail'=>'fin',    'skin'=>'streak'],
  17 => ['Csontváz',      42, 20, 'shape'=>'skeletal', 'bulk'=>0.66, 'ridge'=>'shards', 'tail'=>'arrow',  'skin'=>'bone'],
  18 => ['Vitorlás hát',  64, 11, 'shape'=>'standard', 'bulk'=>0.96, 'ridge'=>'sail',   'tail'=>'fin',    'skin'=>'facet'],
],

/* ===================================================================== */
'lab' => [
  1  => ['Kölyökláb',   20,  4, 'shape'=>'digit',  'bulk'=>0.80, 'claw'=>0.70, 'spur'=>0],
  2  => ['Karmos láb',  28,  9, 'shape'=>'digit',  'bulk'=>0.95, 'claw'=>1.10, 'spur'=>0],
  3  => ['Vastag láb',  46,  5, 'shape'=>'pillar', 'bulk'=>1.02, 'claw'=>0.85, 'spur'=>0],
  4  => ['Jégkarom',    34, 11, 'shape'=>'digit',  'bulk'=>1.00, 'claw'=>1.25, 'spur'=>1],
  5  => ['Lávatalp',    30, 13, 'shape'=>'pillar', 'bulk'=>0.95, 'claw'=>1.00, 'spur'=>0],
  6  => ['Viharláb',    38,  8, 'shape'=>'lanky',  'bulk'=>0.88, 'claw'=>0.95, 'spur'=>1],
  7  => ['Ősi mancs',   50, 10, 'shape'=>'pillar', 'bulk'=>1.08, 'claw'=>1.30, 'spur'=>0],
  8  => ['Árnyékkarom', 26, 17, 'shape'=>'lanky',  'bulk'=>0.68, 'claw'=>1.35, 'spur'=>1],
  9  => ['Titkos láb', 100, 15, 'shape'=>'grasp',  'bulk'=>1.05, 'claw'=>1.20, 'spur'=>1],

  10 => ['Pataláb',     44,  6, 'shape'=>'hoof',   'bulk'=>1.00, 'claw'=>0.00, 'spur'=>0],
  11 => ['Nyurga láb',  24, 12, 'shape'=>'lanky',  'bulk'=>0.74, 'claw'=>0.90, 'spur'=>0],
  12 => ['Sarkantyús',  32, 14, 'shape'=>'digit',  'bulk'=>0.92, 'claw'=>1.15, 'spur'=>1],
  13 => ['Markoló karom',29,16, 'shape'=>'grasp',  'bulk'=>0.85, 'claw'=>1.40, 'spur'=>0],
  14 => ['Oszlopláb',   54,  4, 'shape'=>'pillar', 'bulk'=>1.12, 'claw'=>0.75, 'spur'=>0],
  15 => ['Tüskés láb',  36, 12, 'shape'=>'digit',  'bulk'=>1.00, 'claw'=>1.05, 'spur'=>1],
  16 => ['Bőrtalp',     40,  7, 'shape'=>'hoof',   'bulk'=>0.95, 'claw'=>0.00, 'spur'=>1],
  17 => ['Vaskarom',    48, 11, 'shape'=>'grasp',  'bulk'=>1.04, 'claw'=>1.25, 'spur'=>0],
  18 => ['Futóláb',     22, 15, 'shape'=>'lanky',  'bulk'=>0.78, 'claw'=>1.00, 'spur'=>0],
],

/* ===================================================================== */
'szarny' => [
  1  => ['Kölyökszárny',  15,  6, 'shape'=>'bat',     'size'=>0.70, 'fingers'=>3],
  2  => ['Bőrszárny',     22,  9, 'shape'=>'bat',     'size'=>0.95, 'fingers'=>3],
  3  => ['Széles szárny', 34,  7, 'shape'=>'bat',     'size'=>1.15, 'fingers'=>4],
  4  => ['Jégvitorla',    30, 10, 'shape'=>'crystal', 'size'=>1.05, 'fingers'=>3],
  5  => ['Parázsszárny',  18, 18, 'shape'=>'torn',    'size'=>1.00, 'fingers'=>4],
  6  => ['Viharszárny',   26, 14, 'shape'=>'feather', 'size'=>1.10, 'fingers'=>4],
  7  => ['Ősi szárny',    40, 12, 'shape'=>'bat',     'size'=>1.25, 'fingers'=>4],
  8  => ['Árnyékszárny',  20, 22, 'shape'=>'torn',    'size'=>1.08, 'fingers'=>4],
  9  => ['Titkos szárny',100, 15, 'shape'=>'crystal', 'size'=>1.15, 'fingers'=>4],

  10 => ['Tollas szárny', 32, 11, 'shape'=>'feather', 'size'=>1.12, 'fingers'=>5],
  11 => ['Rovarszárny',   17, 20, 'shape'=>'insect',  'size'=>1.00, 'fingers'=>2],
  12 => ['Uszonyszárny',  36,  6, 'shape'=>'fin',     'size'=>0.90, 'fingers'=>3],
  13 => ['Kettős szárny', 28, 16, 'shape'=>'double',  'size'=>0.95, 'fingers'=>3],
  14 => ['Kristályszárny',38,  9, 'shape'=>'crystal', 'size'=>1.18, 'fingers'=>4],
  15 => ['Szakadt szárny',19, 21, 'shape'=>'torn',    'size'=>1.12, 'fingers'=>4],
  16 => ['Csökevényes',   12,  8, 'shape'=>'fin',     'size'=>0.55, 'fingers'=>2],
  17 => ['Sarlószárny',   24, 19, 'shape'=>'insect',  'size'=>1.15, 'fingers'=>3],
  18 => ['Köpenyszárny',  42,  8, 'shape'=>'bat',     'size'=>1.20, 'fingers'=>5],
],

    ];
}

/** A rész-kulcs → fájlnév-előtag. */
const PART_FILE_PREFIX = [
    'fej'    => 'head',
    'test'   => 'body',
    'lab'    => 'legs',
    'szarny' => 'wings',
];

/** A rész-kulcs → adatbázistábla. */
const PART_TABLE = [
    'fej'    => 'sarkanyok_fej',
    'test'   => 'sarkanyok_test',
    'lab'    => 'sarkanyok_lab',
    'szarny' => 'sarkanyok_szarny',
];
