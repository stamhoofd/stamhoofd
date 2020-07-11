CREATE TABLE `challenges` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `email` varchar(255) NOT NULL,
  `challenge` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `expiresAt` datetime NOT NULL,
  `authSignKeyConstants` json DEFAULT NULL,
  `tries` int unsigned NOT NULL DEFAULT '0',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `email` (`email`,`organizationId`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `challenges_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;