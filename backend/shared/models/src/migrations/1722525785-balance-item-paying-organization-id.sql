SET FOREIGN_KEY_CHECKS=0;
ALTER TABLE `balance_items` ADD COLUMN `payingOrganizationId` varchar(36) NULL;
ALTER TABLE `balance_items` ADD FOREIGN KEY (`payingOrganizationId`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
SET FOREIGN_KEY_CHECKS=1;
