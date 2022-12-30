CREATE TABLE `stripe_payment_intents` (
  `id` varchar(36) NOT NULL,
  `paymentId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `stripeIntentId` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `organizationId` varchar(36) DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `stripeIntentId` (`stripeIntentId`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;