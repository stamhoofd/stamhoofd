DROP TABLE IF EXISTS `groups`;
CREATE TABLE `groups` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `cycle` int unsigned NOT NULL DEFAULT '0' COMMENT 'Increased every time a new registration period started',
  PRIMARY KEY (`id`),
  UNIQUE KEY `groupCycle` (`cycle`,`id`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `groups_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `members`;
CREATE TABLE `members` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `encrypted` mediumtext CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci COMMENT 'Contains the encrypted data of this member in JSON format.',
  `createdOn` datetime NOT NULL,
  `updatedOn` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `members_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `members_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `migrations`;
CREATE TABLE `migrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `file` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `executedOn` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `file` (`file`) USING BTREE
) ENGINE=InnoDB AUTO_INCREMENT=17 DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `organizations`;
CREATE TABLE `organizations` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `name` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `uri` varchar(50) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `registerDomain` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `website` varchar(100) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `meta` json NOT NULL,
  `createdOn` datetime NOT NULL,
  `updatedOn` datetime DEFAULT NULL,
  `publicKey` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `uri` (`uri`) USING BTREE,
  UNIQUE KEY `registerDomain` (`registerDomain`) USING BTREE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `registrations`;
CREATE TABLE `registrations` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `memberId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `groupId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `registeredOn` datetime NOT NULL COMMENT 'Date of the registration or renewal',
  `deactivatedOn` datetime DEFAULT NULL COMMENT 'Set if the registration was canceled or deactivated during the group cycle. Keep this null at the end of the group cycle.',
  `cycle` int unsigned NOT NULL COMMENT 'Cycle of the group the registration is for',
  PRIMARY KEY (`id`),
  UNIQUE KEY `groupCycleMember` (`groupId`,`cycle`,`memberId`) USING BTREE,
  KEY `memberId` (`memberId`) USING BTREE,
  CONSTRAINT `registrations_ibfk_1` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `registrations_ibfk_2` FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `tokens`;
CREATE TABLE `tokens` (
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `accessToken` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `refreshToken` varchar(256) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `accessTokenValidUntil` datetime NOT NULL,
  `refreshTokenValidUntil` datetime NOT NULL,
  `createdOn` datetime NOT NULL,
  PRIMARY KEY (`accessToken`),
  UNIQUE KEY `refreshToken` (`refreshToken`),
  KEY `userId` (`userId`),
  CONSTRAINT `tokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;

DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `publicKey` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `encryptedPrivateKey` varchar(255) COLLATE utf8mb4_unicode_ci NOT NULL,
  `password` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `createdOn` datetime NOT NULL,
  `updatedOn` datetime NOT NULL,
  `permissions` json NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `emailOrganizaton` (`email`,`organizationId`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;