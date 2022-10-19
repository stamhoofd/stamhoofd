ALTER TABLE `members` 
	ADD COLUMN `birthDay` varchar(10) NULL AFTER `id`,
	ADD COLUMN `lastName` varchar(200) NOT NULL AFTER `id`,
    ADD COLUMN `firstName` varchar(200) NOT NULL AFTER `id`;