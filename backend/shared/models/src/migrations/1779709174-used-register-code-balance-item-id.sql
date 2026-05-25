ALTER TABLE `used_register_codes`
ADD COLUMN `balanceItemId` varchar(36) NULL AFTER `code`,
ADD FOREIGN KEY (`balanceItemId`) REFERENCES `balance_items` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
