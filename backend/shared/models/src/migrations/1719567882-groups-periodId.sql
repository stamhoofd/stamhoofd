ALTER TABLE `groups` ADD COLUMN `periodId` varchar(36) CHARACTER SET utf8mb4 COLLATE utf8mb4_unicode_ci NULL;
ALTER TABLE `groups` ADD FOREIGN KEY (`periodId`) REFERENCES `registration_periods` (`id`) ON UPDATE CASCADE ON DELETE RESTRICT;
