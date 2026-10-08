ALTER TABLE `webshop_discount_codes`
ADD COLUMN `email` varchar(255) NULL AFTER `description`,
ADD INDEX `webshopId_email` (`webshopId`, `email`);
