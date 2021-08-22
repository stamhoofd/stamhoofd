CREATE TABLE `webshop_tickets` (
  `id` varchar(36) NOT NULL,
  `secret` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `itemId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `orderId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `webshopId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `scannedAt` datetime DEFAULT NULL,
  `scannedBy` varchar(100) DEFAULT NULL,
  `index` int NOT NULL,
  `total` int NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `secret` (`secret`,`webshopId`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  KEY `orderId` (`orderId`),
  KEY `updatedAt` (`webshopId`,`updatedAt`) USING BTREE,
  CONSTRAINT `webshop_tickets_ibfk_1` FOREIGN KEY (`webshopId`) REFERENCES `webshops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `webshop_tickets_ibfk_2` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `webshop_tickets_ibfk_3` FOREIGN KEY (`orderId`) REFERENCES `webshop_orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
CREATE UNIQUE INDEX `updatedAt` ON `webshop_orders` (`webshopId`,`updatedAt`,`number`) USING BTREE;