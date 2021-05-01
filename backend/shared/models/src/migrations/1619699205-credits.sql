CREATE TABLE `stamhoofd_credits` (
  `id` varchar(36) NOT NULL DEFAULT 'utf8mb4_0900_ai_ci',
  `organizationId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL DEFAULT 'ascii_general_ci',
  `expireAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `description` varchar(255) NOT NULL,
  `change` int NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`,`createdAt`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;