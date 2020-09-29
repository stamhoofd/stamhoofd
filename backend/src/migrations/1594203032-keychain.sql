SET FOREIGN_KEY_CHECKS=0;
DROP TABLE IF EXISTS `keychain`;
CREATE TABLE `keychain` (
  `id` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL,
  `publicKey` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL COMMENT 'The public key a user has received access to',
  `encryptedPrivateKey` varchar(255) CHARACTER SET ascii COLLATE ascii_general_ci DEFAULT NULL COMMENT 'The private key associated with this public key, encrypted with the private key of the user',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `publicKeyPerUser` (`publicKey`,`userId`) USING BTREE,
  KEY `userId` (`userId`),
  CONSTRAINT `keychain_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
SET FOREIGN_KEY_CHECKS=1;