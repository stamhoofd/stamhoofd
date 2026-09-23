ALTER TABLE `documents`
ADD COLUMN `parentId` varchar(36) NULL AFTER `registrationId`;
