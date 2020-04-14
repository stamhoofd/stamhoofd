CREATE TABLE `tokens` (
  `accessToken` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `refreshToken` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `accessTokenValidUntil` datetime NOT NULL,
  `refreshTokenValidUntil` datetime NOT NULL,
  `userId` int unsigned NOT NULL,
  `deviceId` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `deviceName` varchar(256) COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdOn` datetime NOT NULL,
  PRIMARY KEY (`accessToken`),
  UNIQUE KEY `refreshToken` (`refreshToken`),
  UNIQUE KEY `deviceClient` (`deviceId`,`userId`) USING BTREE,
  KEY `userId` (`userId`),
  CONSTRAINT `tokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;