ALTER TABLE `tokens`
MODIFY COLUMN `id` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
MODIFY COLUMN `sessionId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci NOT NULL,
ADD UNIQUE KEY `tokens_id_unique` (`id`),
ADD KEY `tokens_sessionId_index` (`sessionId`),
ADD CONSTRAINT `tokens_sessionId_foreign` FOREIGN KEY (`sessionId`) REFERENCES `user_sessions` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
