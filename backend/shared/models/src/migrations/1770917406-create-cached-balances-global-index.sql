ALTER TABLE `cached_outstanding_balances`
ADD INDEX `globalObjectId` (`objectId`,`objectType`) USING BTREE;
