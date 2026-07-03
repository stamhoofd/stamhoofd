ALTER TABLE `members`
ADD COLUMN `lastRegisteredAt` datetime NULL AFTER `updatedAt`,
ADD INDEX `lastRegisteredAt` (`lastRegisteredAt`) USING BTREE;
