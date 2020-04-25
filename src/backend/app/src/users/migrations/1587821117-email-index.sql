ALTER TABLE `stamhoofd`.`users` DROP INDEX `email`;
CREATE UNIQUE INDEX `emailOrganizaton` ON `stamhoofd`.`users` (`email`,`organizationId`) USING BTREE;