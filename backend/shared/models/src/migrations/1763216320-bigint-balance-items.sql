ALTER TABLE `balance_items`
CHANGE `unitPrice` `unitPrice` bigint NOT NULL DEFAULT '0',
CHANGE `pricePaid` `pricePaid` bigint NOT NULL DEFAULT '0',
CHANGE `pricePending` `pricePending` bigint NOT NULL DEFAULT '0',
CHANGE `priceOpen` `priceOpen` bigint NOT NULL DEFAULT '0';
