CREATE TABLE `belcotax_connections` (
  `id` varchar(36) NOT NULL,
  `organizationId` varchar(36) NOT NULL,
  `companyNumber` varchar(10) NOT NULL,
  `refreshToken` text,
  `validUntil` datetime NOT NULL,
  `representativeName` varchar(255) NOT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizationId_companyNumber` (`organizationId`,`companyNumber`),
  KEY `companyNumber` (`companyNumber`),
  CONSTRAINT `belcotax_connections_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `belcotax_connections_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
