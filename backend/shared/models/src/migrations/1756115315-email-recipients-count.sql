ALTER TABLE `emails`
CHANGE `recipientCount` `emailRecipientsCount` int NULL,
ADD COLUMN `otherRecipientsCount` int NULL AFTER `emailRecipientsCount`;
