CREATE TABLE `testModels` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(50) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `isActive` tinyint DEFAULT NULL,
  `createdOn` datetime DEFAULT NULL,
  `count` int DEFAULT NULL,
  `birthDay` date DEFAULT NULL,
  `partnerId` int unsigned DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `partnerId` (`partnerId`),
  CONSTRAINT `testmodels_ibfk_1` FOREIGN KEY (`partnerId`) REFERENCES `testModels` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

CREATE TABLE `_testModels_testModels` (
  `testModelsIdA` int unsigned NOT NULL,
  `testModelsIdB` int unsigned NOT NULL,
  PRIMARY KEY (`testModelsIdA`,`testModelsIdB`),
  KEY `testModelsIdB` (`testModelsIdB`),
  CONSTRAINT `_testmodels_testmodels_ibfk_1` FOREIGN KEY (`testModelsIdA`) REFERENCES `testModels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_testmodels_testmodels_ibfk_2` FOREIGN KEY (`testModelsIdB`) REFERENCES `testModels` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;