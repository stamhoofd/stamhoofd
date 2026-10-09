CREATE TABLE `mailchimp_credentials` (
  `id` varchar(36) NOT NULL,
  `organizationId` varchar(36) DEFAULT NULL,
  `apiKey` varchar(255) NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `organizationId` (`organizationId`),
  CONSTRAINT `mailchimp_credentials_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
