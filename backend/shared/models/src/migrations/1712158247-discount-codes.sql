CREATE TABLE `webshop_discount_codes` (
  `id` varchar(36) NOT NULL,
  `description` text NOT NULL,
  `code` varchar(128) NOT NULL,
  `webshopId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `discounts` json NOT NULL,
  `usageCount` bigint unsigned NOT NULL,
  `maximumUsage` bigint unsigned DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `code` (`webshopId`,`code`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `webshop_discount_codes_ibfk_1` FOREIGN KEY (`webshopId`) REFERENCES `webshops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `webshop_discount_codes_ibfk_2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;