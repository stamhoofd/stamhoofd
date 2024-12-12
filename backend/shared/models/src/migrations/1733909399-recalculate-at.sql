ALTER TABLE `cached_outstanding_balances`
ADD COLUMN `nextDueAt` datetime NULL AFTER `amountPending`,
ADD INDEX `nextDueAt` (`nextDueAt`) USING BTREE;
