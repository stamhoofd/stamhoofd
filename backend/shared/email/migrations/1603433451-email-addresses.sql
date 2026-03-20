CREATE TABLE `email_addresses` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `email` varchar(255) DEFAULT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `markedAsSpam` tinyint(1) DEFAULT NULL,
  `hardBounce` tinyint(1) DEFAULT NULL,
  `unsubscribedMarketing` tinyint(1) DEFAULT NULL,
  `unsubscribedAll` tinyint(1) DEFAULT NULL,
  `token` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `email` (`email`,`organizationId`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;