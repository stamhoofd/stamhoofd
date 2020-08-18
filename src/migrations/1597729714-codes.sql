CREATE TABLE `registerCodes` (
  `code` varchar(100) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL DEFAULT 'utf8mb4_unicode_ci',
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `value` int NOT NULL DEFAULT '0',
  PRIMARY KEY (`code`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;