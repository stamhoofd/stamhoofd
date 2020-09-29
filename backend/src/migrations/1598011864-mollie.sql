CREATE TABLE `mollie_tokens` (
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `accessToken` text,
  `refreshToken` text,
  `expiresOn` datetime DEFAULT NULL,
  PRIMARY KEY (`organizationId`),
  UNIQUE KEY `organizationId` (`organizationId`),
  CONSTRAINT `mollie_tokens_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;