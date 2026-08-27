ALTER TABLE `organizations`
ADD COLUMN `language` varchar(2) NULL DEFAULT NULL AFTER `website`;
