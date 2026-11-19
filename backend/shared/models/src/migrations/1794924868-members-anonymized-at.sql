ALTER TABLE `members` ADD COLUMN `anonymizedAt` datetime DEFAULT NULL, ADD KEY `anonymizedAt` (`anonymizedAt`);
