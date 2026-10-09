CREATE TABLE `mailchimp_syncs` (
  `id` varchar(36) NOT NULL,
  `organizationId` varchar(36) DEFAULT NULL,
  `userId` varchar(36) DEFAULT NULL,
  `request` json NOT NULL,
  `status` varchar(36) NOT NULL,
  `result` json NOT NULL,
  `errorMessage` text,
  `finishedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId_createdAt` (`organizationId`,`createdAt`),
  CONSTRAINT `mailchimp_syncs_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `mailchimp_syncs_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
