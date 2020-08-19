CREATE TABLE `password_tokens` (
  `token` varchar(256) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `validUntil` datetime NOT NULL,
  `userId` varchar(256) CHARACTER SET ascii COLLATE ascii_general_ci NOT NULL,
  `createdAt` datetime NOT NULL,
  PRIMARY KEY (`token`),
  KEY `userId` (`userId`),
  CONSTRAINT `password_tokens_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;