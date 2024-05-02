CREATE TABLE `statistics` (
  `id` varchar(36) NOT NULL,
  `date` date NOT NULL,
  `organizationId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci DEFAULT NULL COMMENT 'Contains the total aggegated date if organization is null',
  `activeWebshops` int NOT NULL,
  `memberCount` int NOT NULL,
  `orderCount` int NOT NULL,
  `webshopRevenue` int NOT NULL,
  `activeAdmins` int NOT NULL,
  `activeOrganizations` int DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `date` (`date`,`organizationId`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;