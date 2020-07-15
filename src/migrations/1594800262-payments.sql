CREATE TABLE `payments` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `method` varchar(36) NOT NULL,
  `status` varchar(36) NOT NULL,
  `price` int NOT NULL,
  `transferDescription` varchar(50) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `paidAt` datetime DEFAULT NULL,
  PRIMARY KEY (`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
ALTER TABLE `registrations` ADD COLUMN `paymentId` varchar(36) NULL COMMENT '';
ALTER TABLE `registrations` CHANGE `paymentId` `paymentId` varchar(36) CHARACTER SET ascii NULL COMMENT '';
ALTER TABLE `registrations` ADD FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;