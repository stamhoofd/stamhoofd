CREATE TABLE `document_templates` (
  `id` varchar(36) NOT NULL DEFAULT '',
  `html` longtext NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `status` varchar(36) NOT NULL,
  `settings` json NOT NULL,
  `privateSettings` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `updatesEnabled` tinyint(1) NOT NULL DEFAULT '1',
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `document_templates_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;