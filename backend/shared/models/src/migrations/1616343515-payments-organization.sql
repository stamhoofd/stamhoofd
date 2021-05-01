CREATE INDEX `createdAt` ON `payments` (`createdAt`) USING BTREE;
ALTER TABLE `payments` ADD COLUMN `organizationId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT '';
ALTER TABLE `payments` ADD COLUMN `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT '';
ALTER TABLE `payments` ADD FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE CASCADE;
ALTER TABLE `payments` ADD FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;