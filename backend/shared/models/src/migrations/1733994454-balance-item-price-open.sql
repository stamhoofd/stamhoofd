ALTER TABLE `balance_items`
ADD COLUMN `priceOpen` int NOT NULL DEFAULT '0' AFTER `pricePending`;
