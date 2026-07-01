CREATE TABLE `webauthn_challenges` (
	`id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`userId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`challenge` varchar(512) NOT NULL,
	`expiresAt` datetime NOT NULL,
	`createdAt` datetime NOT NULL,
	PRIMARY KEY (`id`),
	KEY `idx_userId` (`userId`) USING BTREE,
	CONSTRAINT `webauthn_challenges_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
