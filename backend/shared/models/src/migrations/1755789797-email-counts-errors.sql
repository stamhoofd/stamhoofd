ALTER TABLE `emails`
ADD COLUMN `succeededCount` int NOT NULL DEFAULT '0' AFTER `recipientCount`,
ADD COLUMN `softFailedCount` int NOT NULL DEFAULT '0' AFTER `recipientCount`,
ADD COLUMN `failedCount` int NOT NULL DEFAULT '0' AFTER `recipientCount`,
ADD COLUMN `membersCount` int NOT NULL DEFAULT '0' AFTER `recipientCount`,
ADD COLUMN `recipientsErrors` json NULL AFTER `recipientsStatus`,
ADD COLUMN `emailErrors` json NULL AFTER `status`;
