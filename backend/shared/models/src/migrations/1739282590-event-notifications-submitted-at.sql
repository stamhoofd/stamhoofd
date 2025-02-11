ALTER TABLE `event_notifications`
ADD COLUMN `submittedAt` datetime NULL AFTER `submittedBy`,
ADD INDEX `submittedAt` (`submittedAt` DESC) USING BTREE;
