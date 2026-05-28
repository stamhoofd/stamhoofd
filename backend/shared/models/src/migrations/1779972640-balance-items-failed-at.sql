ALTER TABLE `balance_items`
ADD COLUMN `failedAt` datetime NULL AFTER `paidAt`;
