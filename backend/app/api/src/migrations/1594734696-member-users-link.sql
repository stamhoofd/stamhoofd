SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS `members`;
CREATE TABLE `members` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `encryptedForOrganization` mediumtext CHARACTER SET ascii COLLATE ascii_general_ci COMMENT 'Contains the encrypted data of this member in JSON format.',
  `encryptedForMember` mediumtext CHARACTER SET ascii COLLATE ascii_general_ci COMMENT 'Contains the encrypted data of this member in JSON format.',
  `publicKey` varchar(250) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `members_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SET FOREIGN_KEY_CHECKS=1;
CREATE TABLE `_members_users` (
  `id` bigint unsigned NOT NULL AUTO_INCREMENT,
  `membersId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `usersId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  KEY `membersId` (`membersId`),
  KEY `usersId` (`usersId`),
  CONSTRAINT `_members_users_ibfk_1` FOREIGN KEY (`membersId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `_members_users_ibfk_2` FOREIGN KEY (`usersId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;