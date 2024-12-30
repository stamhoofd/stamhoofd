ALTER TABLE `emails`
ADD INDEX `createdAt` (`createdAt` DESC) USING BTREE,
ADD INDEX `sentAt` (`sentAt` DESC) USING BTREE;
