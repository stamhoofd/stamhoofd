ALTER TABLE `cached_outstanding_balances`
DROP INDEX `objectId`,
ADD UNIQUE INDEX `objectId` (`organizationId`,`objectId`,`objectType`) USING BTREE;
