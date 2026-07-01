ALTER TABLE `users`
ADD COLUMN `lastActiveAt` datetime NULL AFTER `updatedAt`;
