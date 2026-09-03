CREATE TABLE `notifications` (
  `id` varchar(36) NOT NULL,
  `type` varchar(64) NOT NULL,
  `organizationId` varchar(36) DEFAULT NULL,
  `subjectType` varchar(36) DEFAULT NULL,
  `subjectId` varchar(36) DEFAULT NULL,
  `payload` json NOT NULL,
  `groupKey` varchar(255) DEFAULT NULL,
  `groupResourceCount` int NOT NULL DEFAULT '0',
  `groupResources` json NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id` DESC),
  KEY `groupKey` (`organizationId`,`type`,`groupKey`,`createdAt` DESC) USING BTREE,
  CONSTRAINT `notifications_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
