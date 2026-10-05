-- =====================================================================
--  Sárkányok és Vikingek — testrész-katalógus
--
--  FIGYELEM: ez a fájl GENERÁLT. Ne kézzel szerkeszd — a forrás a
--  tools/parts_table.php, és a `php tools/build_svg.php` írja újra
--  (a rajzokkal együtt, hogy a név, a statisztika és a kép ne
--  csúszhasson el egymástól).
--
--  A 9-es azonosító minden résznél a TITKOS sárkányé (about.php easter egg).
-- =====================================================================

-- A fájl UTF-8. Ezt kötelező közölni a szerverrel: a parancssori mysql
-- kliens különben a Windows konzol kódlapját (pl. cp852) feltételezi,
-- és az ékezetek duplán kódolódnak.
SET NAMES utf8mb4;
USE `sarkanyok`;

-- ---------------------------------------------------------------------
INSERT INTO `sarkanyok_fej` (`id`,`nev`,`image`,`hp`,`dmg`,`ritka`) VALUES
  (1,'Kölyökfej','head[1].png',25,10,0),
  (2,'Szarvas fej','head[2].png',30,13,0),
  (3,'Tüskés fej','head[3].png',28,16,0),
  (4,'Jégagyar','head[4].png',42,12,0),
  (5,'Lávapofa','head[5].png',26,21,0),
  (6,'Viharszem','head[6].png',35,18,0),
  (7,'Ősi koponya','head[7].png',48,15,0),
  (8,'Árnyékfej','head[8].png',30,25,0),
  (9,'Titkos fej','head[9].png',100,15,1),
  (10,'Csőrös fej','head[10].png',32,19,0),
  (11,'Taréjos fej','head[11].png',38,14,0),
  (12,'Kígyófej','head[12].png',22,23,0),
  (13,'Kristályfej','head[13].png',45,11,0),
  (14,'Sörényes fej','head[14].png',36,16,0),
  (15,'Agyaras fej','head[15].png',44,17,0),
  (16,'Bölcs koponya','head[16].png',52,9,0),
  (17,'Vasálarc','head[17].png',50,13,0),
  (18,'Parázsfej','head[18].png',24,27,0)
ON DUPLICATE KEY UPDATE
  `nev`=VALUES(`nev`), `image`=VALUES(`image`),
  `hp`=VALUES(`hp`), `dmg`=VALUES(`dmg`), `ritka`=VALUES(`ritka`);

-- ---------------------------------------------------------------------
INSERT INTO `sarkanyok_test` (`id`,`nev`,`image`,`hp`,`dmg`,`ritka`) VALUES
  (1,'Karcsú test','body[1].png',45,5,0),
  (2,'Pikkelyes test','body[2].png',60,7,0),
  (3,'Páncélos test','body[3].png',85,4,0),
  (4,'Jégpáncél','body[4].png',78,6,0),
  (5,'Izzó test','body[5].png',55,14,0),
  (6,'Viharbőr','body[6].png',62,10,0),
  (7,'Ősi test','body[7].png',92,8,0),
  (8,'Árnyéktest','body[8].png',50,16,0),
  (9,'Titkos test','body[9].png',100,15,1),
  (10,'Kígyótest','body[10].png',40,18,0),
  (11,'Zömök test','body[11].png',88,6,0),
  (12,'Bordás test','body[12].png',66,12,0),
  (13,'Íves hát','body[13].png',58,13,0),
  (14,'Vasbordájú','body[14].png',95,5,0),
  (15,'Mohos test','body[15].png',72,9,0),
  (16,'Ködtest','body[16].png',48,15,0),
  (17,'Csontváz','body[17].png',42,20,0),
  (18,'Vitorlás hát','body[18].png',64,11,0)
ON DUPLICATE KEY UPDATE
  `nev`=VALUES(`nev`), `image`=VALUES(`image`),
  `hp`=VALUES(`hp`), `dmg`=VALUES(`dmg`), `ritka`=VALUES(`ritka`);

-- ---------------------------------------------------------------------
INSERT INTO `sarkanyok_lab` (`id`,`nev`,`image`,`hp`,`dmg`,`ritka`) VALUES
  (1,'Kölyökláb','legs[1].png',20,4,0),
  (2,'Karmos láb','legs[2].png',28,9,0),
  (3,'Vastag láb','legs[3].png',46,5,0),
  (4,'Jégkarom','legs[4].png',34,11,0),
  (5,'Lávatalp','legs[5].png',30,13,0),
  (6,'Viharláb','legs[6].png',38,8,0),
  (7,'Ősi mancs','legs[7].png',50,10,0),
  (8,'Árnyékkarom','legs[8].png',26,17,0),
  (9,'Titkos láb','legs[9].png',100,15,1),
  (10,'Pataláb','legs[10].png',44,6,0),
  (11,'Nyurga láb','legs[11].png',24,12,0),
  (12,'Sarkantyús','legs[12].png',32,14,0),
  (13,'Markoló karom','legs[13].png',29,16,0),
  (14,'Oszlopláb','legs[14].png',54,4,0),
  (15,'Tüskés láb','legs[15].png',36,12,0),
  (16,'Bőrtalp','legs[16].png',40,7,0),
  (17,'Vaskarom','legs[17].png',48,11,0),
  (18,'Futóláb','legs[18].png',22,15,0)
ON DUPLICATE KEY UPDATE
  `nev`=VALUES(`nev`), `image`=VALUES(`image`),
  `hp`=VALUES(`hp`), `dmg`=VALUES(`dmg`), `ritka`=VALUES(`ritka`);

-- ---------------------------------------------------------------------
INSERT INTO `sarkanyok_szarny` (`id`,`nev`,`image`,`hp`,`dmg`,`ritka`) VALUES
  (1,'Kölyökszárny','wings[1].png',15,6,0),
  (2,'Bőrszárny','wings[2].png',22,9,0),
  (3,'Széles szárny','wings[3].png',34,7,0),
  (4,'Jégvitorla','wings[4].png',30,10,0),
  (5,'Parázsszárny','wings[5].png',18,18,0),
  (6,'Viharszárny','wings[6].png',26,14,0),
  (7,'Ősi szárny','wings[7].png',40,12,0),
  (8,'Árnyékszárny','wings[8].png',20,22,0),
  (9,'Titkos szárny','wings[9].png',100,15,1),
  (10,'Tollas szárny','wings[10].png',32,11,0),
  (11,'Rovarszárny','wings[11].png',17,20,0),
  (12,'Uszonyszárny','wings[12].png',36,6,0),
  (13,'Kettős szárny','wings[13].png',28,16,0),
  (14,'Kristályszárny','wings[14].png',38,9,0),
  (15,'Szakadt szárny','wings[15].png',19,21,0),
  (16,'Csökevényes','wings[16].png',12,8,0),
  (17,'Sarlószárny','wings[17].png',24,19,0),
  (18,'Köpenyszárny','wings[18].png',42,8,0)
ON DUPLICATE KEY UPDATE
  `nev`=VALUES(`nev`), `image`=VALUES(`image`),
  `hp`=VALUES(`hp`), `dmg`=VALUES(`dmg`), `ritka`=VALUES(`ritka`);

