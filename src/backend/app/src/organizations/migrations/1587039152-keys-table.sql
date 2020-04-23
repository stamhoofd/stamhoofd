CREATE TABLE `keys` (
  `publicKey` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  `userId` int unsigned NOT NULL,
  `encryptedSecret` varchar(250) COLLATE utf8mb4_unicode_ci NOT NULL,
  PRIMARY KEY (`publicKey`),
  UNIQUE KEY `userKeys` (`userId`,`publicKey`) USING BTREE,
  CONSTRAINT `keys_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;