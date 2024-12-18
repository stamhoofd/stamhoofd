ALTER TABLE `platform`
ADD COLUMN `previousPeriodId` varchar(36) NULL AFTER `periodId`,
ADD FOREIGN KEY (`previousPeriodId`) REFERENCES `registration_periods` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
