CREATE TABLE `used_register_codes` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `code` varchar(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'utf8mb4_unicode_ci',
  `creditId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizationId` (`organizationId`) USING BTREE,
  KEY `creditId` (`creditId`),
  KEY `code` (`code`),
  CONSTRAINT `used_register_codes_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `used_register_codes_ibfk_2` FOREIGN KEY (`creditId`) REFERENCES `stamhoofd_credits` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `used_register_codes_ibfk_3` FOREIGN KEY (`code`) REFERENCES `register_codes` (`code`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;