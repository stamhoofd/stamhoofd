ALTER TABLE `groups`
ADD COLUMN `eventId` varchar(36) NULL AFTER `organizationId`,
ADD FOREIGN KEY (`eventId`) REFERENCES `events` (`id`) ON UPDATE CASCADE ON DELETE CASCADE;
