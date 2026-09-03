CREATE TABLE `notification_recipients` (
  `id` varchar(36) NOT NULL,
  `notificationId` varchar(36) NOT NULL,
  `userId` varchar(36) NOT NULL,
  `readCount` int NOT NULL DEFAULT '0',
  `readAt` datetime DEFAULT NULL,
  `seenAt` datetime DEFAULT NULL,
  `dismissedAt` datetime DEFAULT NULL,
  `createdAt` datetime NOT NULL,
  PRIMARY KEY (`id` DESC),
  UNIQUE KEY `notificationId_userId` (`notificationId`,`userId`),
  KEY `userId_id` (`userId`,`id` DESC) USING BTREE,
  KEY `userId_readAt` (`userId`,`readAt`),
  CONSTRAINT `notification_recipients_ibfk_1` FOREIGN KEY (`notificationId`) REFERENCES `notifications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `notification_recipients_ibfk_2` FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_0900_ai_ci;
