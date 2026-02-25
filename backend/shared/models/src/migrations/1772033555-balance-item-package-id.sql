ALTER TABLE `balance_items`
ADD COLUMN `packageId` varchar(36) NULL AFTER `memberId`,
ADD FOREIGN KEY (`packageId`) REFERENCES `stamhoofd_packages` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
