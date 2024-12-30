ALTER TABLE `emails`
ADD COLUMN `emailType` varchar(255) NULL AFTER `recipientFilter`;
