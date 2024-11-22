CREATE TABLE `audit_logs` (
  `id` varchar(36) NOT NULL DEFAULT '',
  `type` varchar(36) NOT NULL,
  `organizationId` varchar(36) DEFAULT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `objectId` varchar(36) DEFAULT NULL,
  `description` text,
  `replacements` json NOT NULL,
  `patchList` json NOT NULL,
  `createdAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `createdAt` (`createdAt` DESC) USING BTREE,
  KEY `objectId` (`objectId`,`createdAt` DESC) USING BTREE,
  KEY `organizationId` (`organizationId`),
  KEY `userId` (`userId`),
  CONSTRAINT `audit_logs_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `audit_logs_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
