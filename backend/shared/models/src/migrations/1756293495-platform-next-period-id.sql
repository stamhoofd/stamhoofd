ALTER TABLE `platform`
ADD COLUMN `nextPeriodId` varchar(36) NULL AFTER `previousPeriodId`,
ADD FOREIGN KEY (`nextPeriodId`) REFERENCES `registration_periods` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
