CREATE TABLE `email_verification_codes` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `email` varchar(255) NOT NULL,
  `code` varchar(20) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `token` varchar(256) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `expiresAt` datetime NOT NULL,
  `generatedCount` int unsigned NOT NULL DEFAULT '0',
  `tries` int unsigned NOT NULL DEFAULT '0',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `userId` (`userId`) USING BTREE,
  UNIQUE KEY `token` (`token`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `email_verification_codes_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `email_verification_codes_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;