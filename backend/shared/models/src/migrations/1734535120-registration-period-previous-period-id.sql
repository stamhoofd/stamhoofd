ALTER TABLE `registration_periods`
ADD COLUMN `previousPeriodId` varchar(36) NULL,
ADD FOREIGN KEY (`previousPeriodId`) REFERENCES `registration_periods` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
