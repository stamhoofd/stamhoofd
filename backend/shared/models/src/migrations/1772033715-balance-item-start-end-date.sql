ALTER TABLE `balance_items`
ADD COLUMN `startDate` datetime NULL AFTER `status`,
ADD COLUMN `endDate` datetime NULL AFTER `startDate`;
