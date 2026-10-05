-- =====================================================================
--  Sárkányok és Vikingek — teljes adatbázis séma
--  Visszaépítve a kódban használt lekérdezésekből + a mentett
--  DESCRIBE kimenetekből (Új Szöveges dokumentum.txt).
--
--  Futtatás:  mysql -u root < sql/schema.sql
--  vagy:      böngészőben nyisd meg az install.php-t
-- =====================================================================


-- A fájl UTF-8. Ezt kötelező közölni a szerverrel: a parancssori
-- mysql kliens különben a Windows konzol kódlapját (pl. cp852)
-- feltételezi, és az ékezetek duplán kódolódnak ('Kölyökfej' -> 'K├Âly├Âkfej').
SET NAMES utf8mb4;
CREATE DATABASE IF NOT EXISTS `sarkanyok`
  DEFAULT CHARACTER SET utf8mb4
  COLLATE utf8mb4_hungarian_ci;

USE `sarkanyok`;

SET FOREIGN_KEY_CHECKS = 0;

-- ---------------------------------------------------------------------
--  Felhasználók
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sarkanyok_users` (
  `id`            INT(11)      NOT NULL AUTO_INCREMENT,
  `name`          VARCHAR(255) NOT NULL,
  `email`         VARCHAR(255) NOT NULL,
  `password`      VARCHAR(255) NOT NULL,
  `is_admin`      TINYINT(1)   NOT NULL DEFAULT 0,
  `quiz_taken`    TINYINT(1)   NOT NULL DEFAULT 0,
  `reset_token`   VARCHAR(64)  DEFAULT NULL,
  `reset_expires` DATETIME     DEFAULT NULL,
  `created_at`    TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_users_email` (`email`),
  UNIQUE KEY `uq_users_name`  (`name`),
  KEY `idx_users_reset_token` (`reset_token`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

-- ---------------------------------------------------------------------
--  Testrész-katalógusok (fej / test / láb / szárny)
--  Mind 1–8 normál + 9 = titkos rész.
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sarkanyok_fej` (
  `id`     BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nev`    VARCHAR(64)  NOT NULL DEFAULT '',
  `image`  VARCHAR(255) NOT NULL,
  `dmg`    INT(11)      NOT NULL DEFAULT 0,
  `hp`     INT(11)      NOT NULL DEFAULT 0,
  `ritka`  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

CREATE TABLE IF NOT EXISTS `sarkanyok_test` (
  `id`     BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nev`    VARCHAR(64)  NOT NULL DEFAULT '',
  `image`  VARCHAR(255) NOT NULL,
  `dmg`    INT(11)      NOT NULL DEFAULT 0,
  `hp`     INT(11)      NOT NULL DEFAULT 0,
  `ritka`  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

CREATE TABLE IF NOT EXISTS `sarkanyok_lab` (
  `id`     BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nev`    VARCHAR(64)  NOT NULL DEFAULT '',
  `image`  VARCHAR(255) NOT NULL,
  `dmg`    INT(11)      NOT NULL DEFAULT 0,
  `hp`     INT(11)      NOT NULL DEFAULT 0,
  `ritka`  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

CREATE TABLE IF NOT EXISTS `sarkanyok_szarny` (
  `id`     BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `nev`    VARCHAR(64)  NOT NULL DEFAULT '',
  `image`  VARCHAR(255) NOT NULL,
  `dmg`    INT(11)      NOT NULL DEFAULT 0,
  `hp`     INT(11)      NOT NULL DEFAULT 0,
  `ritka`  TINYINT(1)   NOT NULL DEFAULT 0,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

-- ---------------------------------------------------------------------
--  Sárkányok
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sarkanyok` (
  `id`         BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `user_id`    INT(11)      NOT NULL,
  `nev`        VARCHAR(255) NOT NULL,
  `szin`       VARCHAR(32)  NOT NULL DEFAULT '#ff0000',
  `test_id`    INT(11)      NOT NULL DEFAULT 0,
  `szarny_id`  INT(11)      NOT NULL DEFAULT 0,
  `lab_id`     INT(11)      NOT NULL DEFAULT 0,
  `fej_id`     INT(11)      NOT NULL DEFAULT 0,
  `hp`         INT(11)      NOT NULL DEFAULT 0,
  `dmg`        INT(11)      NOT NULL DEFAULT 0,
  `xp`         INT(11)      NOT NULL DEFAULT 0,
  `wins`       INT(11)      NOT NULL DEFAULT 0,
  `losses`     INT(11)      NOT NULL DEFAULT 0,
  `generacio`  TINYINT UNSIGNED NOT NULL DEFAULT 0,   -- tenyésztési nemzedék (kaland.php)
  `vonasok`    VARCHAR(120) NOT NULL DEFAULT '',       -- örökölt vonások, vesszővel
  `created_at` TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_dragons_user` (`user_id`),
  CONSTRAINT `fk_dragons_user` FOREIGN KEY (`user_id`)
    REFERENCES `sarkanyok_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

-- ---------------------------------------------------------------------
--  AI-generált történetek
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sarkanyok_story` (
  `id`         INT(11)      NOT NULL AUTO_INCREMENT,
  `user_id`    INT(11)      DEFAULT NULL,
  `story`      MEDIUMTEXT   DEFAULT NULL,
  `name`       VARCHAR(255) NOT NULL,
  `provenance` VARCHAR(255) NOT NULL,
  `weapon`     VARCHAR(255) NOT NULL,
  `dragon`     VARCHAR(255) NOT NULL,
  `created_at` TIMESTAMP    NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_story_user` (`user_id`),
  CONSTRAINT `fk_story_user` FOREIGN KEY (`user_id`)
    REFERENCES `sarkanyok_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

-- ---------------------------------------------------------------------
--  Barátságok  (status: 0 = függő kérelem, 1 = elfogadott)
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sarkanyok_friends` (
  `id`         INT(11)   NOT NULL AUTO_INCREMENT,
  `user_id`    INT(11)   NOT NULL,
  `friend_id`  INT(11)   NOT NULL,
  `status`     TINYINT(1) NOT NULL DEFAULT 0,
  `created_at` TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uq_friend_pair` (`user_id`, `friend_id`),
  KEY `idx_friend_friend` (`friend_id`),
  CONSTRAINT `fk_friend_user`   FOREIGN KEY (`user_id`)
    REFERENCES `sarkanyok_users` (`id`) ON DELETE CASCADE,
  CONSTRAINT `fk_friend_friend` FOREIGN KEY (`friend_id`)
    REFERENCES `sarkanyok_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

-- ---------------------------------------------------------------------
--  Aréna — lejátszott csaták naplója
-- ---------------------------------------------------------------------
CREATE TABLE IF NOT EXISTS `sarkanyok_battles` (
  `id`            BIGINT(20) UNSIGNED NOT NULL AUTO_INCREMENT,
  `attacker_id`   BIGINT(20) UNSIGNED NOT NULL,
  `defender_id`   BIGINT(20) UNSIGNED NOT NULL,
  `winner_id`     BIGINT(20) UNSIGNED NOT NULL,
  `rounds`        INT(11)   NOT NULL DEFAULT 0,
  `log`           MEDIUMTEXT DEFAULT NULL,
  `created_at`    TIMESTAMP NULL DEFAULT CURRENT_TIMESTAMP,
  PRIMARY KEY (`id`),
  KEY `idx_battle_attacker` (`attacker_id`),
  KEY `idx_battle_defender` (`defender_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;

-- ---------------------------------------------------------------------
-- A kalandjáték (kaland.php)
-- ---------------------------------------------------------------------
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

SET FOREIGN_KEY_CHECKS = 1;
