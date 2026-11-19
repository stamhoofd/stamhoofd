CREATE TABLE `data_retention_runs` (
  `id` varchar(36) NOT NULL,
  `tenantId` varchar(36) NOT NULL,
  `phase` varchar(36) DEFAULT NULL,
  `cursor` varchar(36) DEFAULT NULL,
  `progress` json NOT NULL,
  `result` json NOT NULL,
  `startedAt` datetime DEFAULT NULL,
  `finishedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `tenantId` (`tenantId`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
