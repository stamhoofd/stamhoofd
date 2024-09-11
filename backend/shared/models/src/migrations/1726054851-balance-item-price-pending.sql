ALTER TABLE `balance_items`
ADD COLUMN `pricePending` int NOT NULL DEFAULT '0' AFTER `pricePaid`;
