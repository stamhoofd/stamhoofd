ALTER TABLE `balance_items`
ADD COLUMN `priceInvoiced` int NOT NULL DEFAULT '0' AFTER `priceOpen`;
