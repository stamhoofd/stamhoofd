ALTER TABLE `user_sessions`
ADD COLUMN `impersonatedUserId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NULL DEFAULT NULL AFTER `userId`,
ADD KEY `user_sessions_impersonatedUserId_index` (`impersonatedUserId`),
ADD CONSTRAINT `user_sessions_impersonatedUserId_foreign` FOREIGN KEY (`impersonatedUserId`) REFERENCES `users` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
