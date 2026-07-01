ALTER TABLE `tokens`
ADD COLUMN `authenticatedAt` datetime NULL DEFAULT NULL AFTER `refreshTokenValidUntil`;
