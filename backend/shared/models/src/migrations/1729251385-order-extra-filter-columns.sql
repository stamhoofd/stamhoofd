ALTER TABLE `webshop_orders`
ADD COLUMN `totalPrice` int NULL,
ADD COLUMN `amount` int NULL,
ADD COLUMN `timeSlotTime` varchar(8) NULL;
