CREATE TABLE `buckaroo_payments` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'ascii_general_ci',
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `transactionKey` varchar(54) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `paymentId` (`paymentId`) USING BTREE,
  CONSTRAINT `buckaroo_payments_ibfk_1` FOREIGN KEY (`paymentId`) REFERENCES `payments` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;