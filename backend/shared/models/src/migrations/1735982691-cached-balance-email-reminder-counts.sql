ALTER TABLE `cached_outstanding_balances`
ADD COLUMN `lastReminderEmail` datetime NULL,
ADD COLUMN `lastReminderAmountOpen` int NOT NULL DEFAULT '0',
ADD COLUMN `reminderEmailCount` int NOT NULL DEFAULT '0';
