ALTER TABLE `balance_items` ADD COLUMN `dependingBalanceItemId` varchar(36) NULL;
ALTER TABLE `balance_items` ADD FOREIGN KEY (`dependingBalanceItemId`) REFERENCES `balance_items` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
