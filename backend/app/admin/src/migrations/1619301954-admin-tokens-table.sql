CREATE TABLE `admin_tokens` (
  `adminId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
  `accessToken` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `refreshToken` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `accessTokenValidUntil` datetime NOT NULL,
  `refreshTokenValidUntil` datetime NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`accessToken`),
  UNIQUE KEY `refreshToken` (`refreshToken`),
  KEY `adminId` (`adminId`) USING BTREE,
  CONSTRAINT `admin_tokens_ibfk_1` FOREIGN KEY (`adminId`) REFERENCES `admins` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;