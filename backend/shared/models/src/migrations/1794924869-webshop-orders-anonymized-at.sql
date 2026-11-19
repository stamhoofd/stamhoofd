ALTER TABLE `webshop_orders` ADD COLUMN `anonymizedAt` datetime DEFAULT NULL, ADD KEY `anonymizedAt` (`anonymizedAt`);
