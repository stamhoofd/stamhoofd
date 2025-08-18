ALTER TABLE `emails`
ADD COLUMN `senderId` varchar(36) NULL AFTER `organizationId`;
