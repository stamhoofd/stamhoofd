SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS `users`;
CREATE TABLE `users` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `email` varchar(255) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NOT NULL,
  `verified` tinyint(1) NOT NULL DEFAULT '0',
  `publicAuthKey` varchar(255) COLLATE utf8mb4_unicode_ci DEFAULT NULL,
  `publicKey` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  `permissions` json DEFAULT NULL,
  `authSignKeyConstants` json DEFAULT NULL,
  `authEncryptionKeyConstants` json DEFAULT NULL,
  `encryptedPrivateKey` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `id` (`id`),
  UNIQUE KEY `emailOrganizaton` (`email`,`organizationId`) USING BTREE,
  KEY `organizationId` (`organizationId`),
  CONSTRAINT `users_ibfk_1` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;
SET FOREIGN_KEY_CHECKS=1;