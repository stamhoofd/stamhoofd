ALTER TABLE `webshop_orders`
ADD COLUMN `userId` varchar(36) CHARACTER SET ascii COLLATE ascii_general_ci NULL AFTER `organizationId`,
ADD FOREIGN KEY (`userId`) REFERENCES `users` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;