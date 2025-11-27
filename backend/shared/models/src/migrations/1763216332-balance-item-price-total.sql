ALTER TABLE `balance_items`
ADD COLUMN `priceTotal` int NOT NULL DEFAULT '0' AFTER `priceOpen`;
