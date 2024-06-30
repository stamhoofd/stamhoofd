CREATE TABLE `registration_periods` (
  `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL DEFAULT '',
  `startDate` datetime NOT NULL,
  `endDate` datetime NOT NULL,
  `locked` tinyint NOT NULL DEFAULT '0',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `settings` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `registration_periods_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
