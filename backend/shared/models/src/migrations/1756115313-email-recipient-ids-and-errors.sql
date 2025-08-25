ALTER TABLE `email_recipients`
ADD COLUMN `spamComplaintError` text NULL AFTER `objectId`,
ADD COLUMN `softBounceError` text NULL AFTER `objectId`,
ADD COLUMN `hardBounceError` text NULL AFTER `objectId`,
ADD COLUMN `organizationId` varchar(36) NULL AFTER `objectId`,
ADD COLUMN `memberId` varchar(36) NULL AFTER `objectId`,
ADD COLUMN `userId` varchar(36) NULL AFTER `objectId`,
ADD FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
ADD FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON UPDATE CASCADE ON DELETE SET NULL,
ADD FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
