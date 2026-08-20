INSERT INTO `user_sessions` (`id`, `userId`, `clientType`, `startedAt`, `loginMethod`, `deviceType`, `lastUsedTokenId`, `lastActiveTokenId`)
SELECT `sessionId`, `userId`, 'Browser', `createdAt`, 'Password', 'Desktop', `id`, `id`
FROM `tokens`;
