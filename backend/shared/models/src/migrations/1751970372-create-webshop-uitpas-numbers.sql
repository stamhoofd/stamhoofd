CREATE TABLE `webshop_uitpas_numbers` (
   `id` varchar(36) NOT NULL,
   `uitpasNumber` varchar(36) NOT NULL,
   `webshopId` varchar(36) NOT NULL,
   `productId` varchar(36) NOT NULL,
   `orderId` varchar(36) NOT NULL,
   PRIMARY KEY (id),
   CONSTRAINT `fk_webshop` FOREIGN KEY (`webshopId`) REFERENCES `webshops` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
   CONSTRAINT `fk_order` FOREIGN KEY (`orderId`) REFERENCES `orders` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
);
