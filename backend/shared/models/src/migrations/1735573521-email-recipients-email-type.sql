ALTER TABLE `email_recipients`
ADD COLUMN `emailType` varchar(255) NULL AFTER `emailId`,
ADD COLUMN `objectId` varchar(36) NULL AFTER `emailId`,
ADD INDEX `objectId` (`objectId`, `sentAt` DESC) USING BTREE;
