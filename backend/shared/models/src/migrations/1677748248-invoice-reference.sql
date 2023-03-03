ALTER TABLE `stamhoofd_invoices`
ADD COLUMN `reference` varchar(128) NULL AFTER `meta`,
ADD INDEX `reference` (`reference`) USING BTREE;