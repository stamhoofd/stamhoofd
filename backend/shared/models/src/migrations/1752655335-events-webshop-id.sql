ALTER TABLE `events`
ADD COLUMN `webshopId` varchar(36) NULL AFTER `groupId`,
ADD FOREIGN KEY (`webshopId`) REFERENCES `webshops` (`id`) ON UPDATE CASCADE ON DELETE CASCADE;
