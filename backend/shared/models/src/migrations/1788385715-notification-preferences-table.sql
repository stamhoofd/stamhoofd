CREATE TABLE `notification_preferences` (
  `id` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `notificationType` varchar(64) NOT NULL,
  `channel` varchar(32) NOT NULL,
  `enabled` tinyint(1) NOT NULL DEFAULT '1',
  `createdAt` datetime NOT NULL,
  `updatedAt` datetime NOT NULL,
  PRIMARY KEY (`id`),
  UNIQUE KEY `userId_type_channel` (`userId`,`notificationType`,`channel`),
  CONSTRAINT `notification_preferences_ibfk_1` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
