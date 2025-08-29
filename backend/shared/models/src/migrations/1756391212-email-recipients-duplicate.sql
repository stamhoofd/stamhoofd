ALTER TABLE `email_recipients`
ADD COLUMN `duplicateOfRecipientId` varchar(36) NULL,
ADD FOREIGN KEY (`duplicateOfRecipientId`) REFERENCES `email_recipients` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
