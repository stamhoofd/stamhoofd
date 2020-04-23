ALTER TABLE `stamhoofd`.`users` ADD COLUMN `publicKey` varchar(255) NOT NULL COMMENT '' AFTER `email`;
ALTER TABLE `stamhoofd`.`users` ADD COLUMN `updatedOn` datetime NOT NULL COMMENT '' AFTER `createdOn`;
ALTER TABLE `stamhoofd`.`users` ADD COLUMN `adminSignature` varchar(255) NULL COMMENT '' AFTER `password`;