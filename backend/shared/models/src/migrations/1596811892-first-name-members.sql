ALTER TABLE `members` ADD COLUMN `firstName` varchar(100) NOT NULL COMMENT '';
ALTER TABLE `members` ADD COLUMN `placeholder` tinyint(1) NOT NULL DEFAULT '0' COMMENT '';
ALTER TABLE `payments` CHANGE `method` `method` varchar(36) NULL COMMENT '';
ALTER TABLE `registrations` ADD COLUMN `canRegister` tinyint(1) NOT NULL DEFAULT '0' COMMENT '';