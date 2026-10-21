-- =====================================================================
--  Nyílt nap — bemutató fiókok (nyiltnap.php, nyiltnap_admin.php)
--
--  Nem kötelező lefuttatni: az első használatkor a tábla magától
--  létrejön (inc/openday.php). Idempotens.
--    mysql -u root --default-character-set=utf8mb4 < sql/migrate_openday.sql
-- =====================================================================
SET NAMES utf8mb4;
USE `sarkanyok`;

CREATE TABLE IF NOT EXISTS `sarkanyok_nyiltnap` (
  `user_id`  INT(11)     NOT NULL,
  `kod`      VARCHAR(8)  NOT NULL,                  -- belépőkód, pl. THOR4
  `aktiv`    TINYINT(1)  NOT NULL DEFAULT 1,        -- 0: a kód nem enged be
  `korszak`  INT         NOT NULL DEFAULT 1,        -- nullázáskor lép: a régi oldalak visszaugranak
  `lepesek`  VARCHAR(80) NOT NULL DEFAULT '',       -- teljesített állomások, vesszővel
  `utoljara` DATETIME    NULL DEFAULT NULL,         -- utolsó aktivitás (a vezérlő „épp játszik" jelzője)
  PRIMARY KEY (`user_id`),
  UNIQUE KEY `uq_nyiltnap_kod` (`kod`),
  CONSTRAINT `fk_nyiltnap_user` FOREIGN KEY (`user_id`)
    REFERENCES `sarkanyok_users` (`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_hungarian_ci;
