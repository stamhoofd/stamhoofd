CREATE TABLE `mfa_recovery_codes` (
	`id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`userId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`codeHash` varchar(255) NOT NULL,
	`usedAt` datetime NULL DEFAULT NULL,
	`createdAt` datetime NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_userId` (`userId`) USING BTREE,
	CONSTRAINT `mfa_recovery_codes_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
