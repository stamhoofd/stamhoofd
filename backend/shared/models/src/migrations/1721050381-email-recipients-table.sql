CREATE TABLE `email_recipients` (
  `id` varchar(36) NOT NULL,
  `emailId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `firstName` varchar(128) DEFAULT NULL,
  `lastName` varchar(128) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL,
  `email` text CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `replacements` json NOT NULL,
  `failErrorMessage` text,
  `failCount` int NOT NULL DEFAULT '0',
  `firstFailedAt` datetime DEFAULT NULL,
  `lastFailedAt` datetime DEFAULT NULL,
  `sentAt` datetime DEFAULT NULL,
  `updatedAt` datetime NOT NULL,
  `createdAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `emailId` (`emailId`),
  CONSTRAINT `email_recipients_ibfk_1` FOREIGN KEY (`emailId`) REFERENCES `emails` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
