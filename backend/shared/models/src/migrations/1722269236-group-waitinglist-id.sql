ALTER TABLE `groups`
ADD COLUMN `waitingListId` varchar(36) NULL AFTER `defaultAgeGroupId`;

ALTER TABLE `groups` ADD FOREIGN KEY (`waitingListId`) REFERENCES `groups` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
