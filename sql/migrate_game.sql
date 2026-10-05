-- =====================================================================
--  Sárkányok és Vikingek — a kalandjáték táblái (kaland.php)
--
--  Futtatás (idempotens, többször is lefuttatható):
--    mysql -u root --default-character-set=utf8mb4 < sql/migrate_game.sql
--
--  Ugyanez a sql/schema.sql végén is szerepel az új telepítésekhez.
-- =====================================================================
SET NAMES utf8mb4;
USE `sarkanyok`;

-- A tenyésztett sárkányok nemzedéke és örökölt vonásai.
-- A műhelyben épített és a kérdőívből kapott sárkány 0. nemzedék.
ALTER TABLE `sarkanyok`
  ADD COLUMN IF NOT EXISTS `generacio` TINYINT UNSIGNED NOT NULL DEFAULT 0 AFTER `losses`,
  ADD COLUMN IF NOT EXISTS `vonasok`   VARCHAR(120)     NOT NULL DEFAULT '' AFTER `generacio`;

-- A játékállás (hely a térképen, szilánkok, gyógyfüvek, felderített
-- terület, legyőzött barlangok). JSON, a kliens írja — egyjátékos mód,
-- a csalás csak a saját játékot rontaná. Ami a közös adatbázisba kerül
-- (új sárkány), azt mindig a szerver dönti el.
CREATE TABLE IF NOT EXISTS `sarkanyok_jatek` (
  `user_id`    INT(11)    NOT NULL,
  `allas`      MEDIUMTEXT NOT NULL,
  `szelidites` DATETIME   NULL DEFAULT NULL,      -- utolsó szelídítés (gyakoriság-korlát)
  `frissitve`  TIMESTAMP  NOT NULL DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  PRIMARY KEY (`user_id`),
  CONSTRAINT `fk_jatek_user` FOREIGN KEY (`user_id`)
    REFERENCES `sarkanyok_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

-- Keltetés alatt álló tojások. A kikelő sárkány testrészeit a szerver
-- a tojásrakáskor dönti el (a kliens csak a kikeléskor látja őket).
CREATE TABLE IF NOT EXISTS `sarkanyok_tojasok` (
  `id`         INT UNSIGNED     NOT NULL AUTO_INCREMENT,
  `user_id`    INT(11)          NOT NULL,
  `feszek`     TINYINT UNSIGNED NOT NULL,
  `szulo_a`    VARCHAR(60)      NOT NULL DEFAULT '',
  `szulo_b`    VARCHAR(60)      NOT NULL DEFAULT '',
  `fej_id`     INT(11)          NOT NULL DEFAULT 0,
  `test_id`    INT(11)          NOT NULL DEFAULT 0,
  `lab_id`     INT(11)          NOT NULL DEFAULT 0,
  `szarny_id`  INT(11)          NOT NULL DEFAULT 0,
  `szin`       VARCHAR(7)       NOT NULL DEFAULT '#ff8a3d',
  `generacio`  TINYINT UNSIGNED NOT NULL DEFAULT 1,
  `vonasok`    VARCHAR(120)     NOT NULL DEFAULT '',
  `mutacio`    VARCHAR(60)      NOT NULL DEFAULT '',   -- mely testrészek mutálódtak
  `kesz`       DATETIME         NOT NULL,
  `letrehozva` TIMESTAMP        NOT NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_tojas_feszek` (`user_id`, `feszek`),
  CONSTRAINT `fk_tojas_user` FOREIGN KEY (`user_id`)
    REFERENCES `sarkanyok_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;
