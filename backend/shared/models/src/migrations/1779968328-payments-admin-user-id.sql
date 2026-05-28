ALTER TABLE `payments`
ADD COLUMN `adminUserId` varchar(36) NULL AFTER `organizationId`,
ADD FOREIGN KEY (`adminUserId`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
