CREATE TABLE `groups` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `name` varchar(100) COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` int unsigned NOT NULL,
  `cycle` int unsigned NOT NULL DEFAULT '0' COMMENT 'Increased every time a new registration period started',
  PRIMARY KEY (`id`),
  UNIQUE KEY `groupCycle` (`cycle`,`id`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;