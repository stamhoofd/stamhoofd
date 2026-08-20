CREATE TABLE `user_sessions` (
    `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    `userId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    `clientType` varchar(32) NOT NULL,
    `startedAt` datetime NOT NULL,
    `loginMethod` varchar(32) NOT NULL,
    `deviceType` varchar(32) NOT NULL,
    `deviceName` varchar(255) NULL,
    `osName` varchar(32) NULL,
    `osVersion` varchar(64) NULL,
    `appVersion` varchar(64) NULL,
    `nativeAppVersion` varchar(64) NULL,
    `browserName` varchar(64) NULL,
    `lastUsedTokenId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    `lastActiveTokenId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
    PRIMARY KEY (`id`),
    KEY `user_sessions_userId_index` (`userId`),
    CONSTRAINT `user_sessions_userId_foreign` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
