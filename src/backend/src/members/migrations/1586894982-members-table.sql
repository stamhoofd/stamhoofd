CREATE TABLE `members` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `organizationId` int unsigned NOT NULL,
  `userId` int unsigned DEFAULT NULL,
  `encrypted` mediumtext COLLATE utf8mb4_unicode_ci COMMENT 'Contains the encrypted data of this member in JSON format.',
  `createdOn` datetime NOT NULL,
  `updatedOn` datetime DEFAULT NULL,
  PRIMARY KEY (`id`),
  KEY `userId` (`userId`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `members_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE SET NULL ON UPDATE CASCADE,
  CONSTRAINT `members_ibfk_3` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;