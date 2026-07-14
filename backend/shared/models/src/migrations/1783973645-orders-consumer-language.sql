ALTER TABLE `webshop_orders`
ADD COLUMN `consumerLanguage` varchar(36) NOT NULL DEFAULT 'nl' AFTER `status`;
