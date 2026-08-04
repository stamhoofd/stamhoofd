ALTER TABLE `tokens`
ADD COLUMN `impersonatedUserId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL AFTER `userId`,
ADD KEY `impersonatedUserId` (`impersonatedUserId`),
ADD CONSTRAINT `tokens_ibfk_2` FOREIGN KEY (`impersonatedUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
