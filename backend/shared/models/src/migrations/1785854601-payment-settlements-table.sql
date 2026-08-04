CREATE TABLE `payment_settlements` (
  `id` varchar(36) NOT NULL,
  `settlementId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `paymentId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `amount` bigint NOT NULL DEFAULT '0',
  `externalId` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `occurredAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `settlementExternalId` (`settlementId`,`externalId`),
  KEY `paymentId` (`paymentId`),
  CONSTRAINT `payment_settlements_ibfk_1` FOREIGN KEY (`settlementId`) REFERENCES `settlements` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `payment_settlements_ibfk_2` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
