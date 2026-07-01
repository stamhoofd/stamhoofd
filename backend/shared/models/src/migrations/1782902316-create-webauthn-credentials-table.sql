CREATE TABLE `webauthn_credentials` (
	`id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`userId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`credentialId` varchar(512) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
	`publicKey` text NOT NULL,
	`counter` int unsigned NOT NULL DEFAULT '0',
	`transports` text NULL DEFAULT NULL,
	`backedUp` tinyint(1) NOT NULL DEFAULT '0',
	`name` varchar(255) NOT NULL DEFAULT '',
	`lastUsedAt` datetime NULL DEFAULT NULL,
	`createdAt` datetime NOT NULL,
	`updatedAt` datetime NOT NULL,
	PRIMARY KEY (`id`),
	UNIQUE KEY `uk_credentialId` (`credentialId`),
	KEY `idx_userId` (`userId`) USING BTREE,
	CONSTRAINT `webauthn_credentials_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_unicode_ci;
