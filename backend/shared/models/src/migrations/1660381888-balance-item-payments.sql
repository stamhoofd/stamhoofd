CREATE TABLE `balance_item_payments` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT '',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `balanceItemId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `price` int NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  KEY `balanceItemId` (`balanceItemId`),
  KEY `paymentId` (`paymentId`),
  CONSTRAINT `balance_item_payments_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `balance_item_payments_ibfk_2` FOREIGN KEY (`balanceItemId`) REFERENCES `balance_items` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `balance_item_payments_ibfk_3` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;