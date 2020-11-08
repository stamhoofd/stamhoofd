CREATE TABLE `webshop_counters` (
  `webshopId` varchar(36) CHARACTER SET ascii NOT NULL,
  `nextNumber` bigint unsigned NOT NULL,
  PRIMARY KEY (`webshopId`),
  CONSTRAINT `order_numbers_ibfk_1` FOREIGN KEY (`webshopId`) REFERENCES `webshops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
