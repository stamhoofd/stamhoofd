ALTER TABLE `cached_outstanding_balances`
ADD COLUMN `recalculateAt` datetime NULL AFTER `amountPending`,
ADD INDEX `recalculateAt` (`recalculateAt`) USING BTREE;
