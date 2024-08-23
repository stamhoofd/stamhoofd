ALTER TABLE `member_platform_memberships` ADD FOREIGN KEY (`balanceItemId`) REFERENCES `balance_items` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
