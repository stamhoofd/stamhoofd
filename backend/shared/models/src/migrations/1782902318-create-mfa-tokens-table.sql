CREATE TABLE `mfa_tokens` (
	`token` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`userId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`purpose` varchar(32) NOT NULL,
	`tries` int NOT NULL DEFAULT '0',
	`webauthnChallenge` text NULL DEFAULT NULL,
	`expiresAt` datetime NOT NULL,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	PRIMARY KEY (`token`),
	KEY `idx_userId` (`userId`) USING BTREE,
	CONSTRAINT `mfa_tokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
