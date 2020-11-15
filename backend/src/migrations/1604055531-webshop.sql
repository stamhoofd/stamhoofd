CREATE TABLE `webshops` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `products` json NOT NULL,
  `categories` json NOT NULL,
  `uri` varchar(50) NOT NULL,
  `domain` varchar(100) DEFAULT NULL,
  `meta` json NOT NULL,
  `privateMeta` json NOT NULL DEFAULT (json_object()),
  `serverMeta` json NOT NULL DEFAULT (json_object()),
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `webshops_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;