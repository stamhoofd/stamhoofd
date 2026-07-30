CREATE TABLE `mfa_totp` (
	`id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`userId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`name` varchar(255) NOT NULL DEFAULT '',
	`secret` text NOT NULL,
	`confirmedAt` datetime NULL DEFAULT NULL,
	`lastUsedAt` datetime NULL DEFAULT NULL,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_userId` (`userId`) USING BTREE,
	CONSTRAINT `mfa_totp_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
