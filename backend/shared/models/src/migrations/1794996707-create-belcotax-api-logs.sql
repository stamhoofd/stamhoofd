CREATE TABLE `belcotax_api_logs` (
  `id` varchar(36) NOT NULL,
  `organizationId` varchar(36) DEFAULT NULL,
  `connectionId` varchar(36) DEFAULT NULL,
  `companyNumber` varchar(10) DEFAULT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `action` varchar(36) NOT NULL,
  `method` varchar(10) NOT NULL,
  `url` varchar(1024) NOT NULL,
  `statusCode` int DEFAULT NULL,
  `success` tinyint(1) NOT NULL,
  `error` text,
  `representativeName` varchar(255) DEFAULT NULL,
  `durationMs` int DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId_createdAt` (`organizationId`,`createdAt`),
  KEY `createdAt` (`createdAt`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
