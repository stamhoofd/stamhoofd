ALTER TABLE `audit_logs`
ADD COLUMN `externalId` varchar(200) NULL AFTER `id`,
ADD UNIQUE INDEX `externalId` (`externalId`) USING BTREE;
