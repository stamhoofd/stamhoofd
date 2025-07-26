ALTER TABLE `webshop_uitpas_numbers`
ADD COLUMN `ticketSaleId` varchar(255) NULL DEFAULT NULL,
ADD COLUMN `uitpasEventUrl` varchar(255) NULL DEFAULT NULL,
ADD COLUMN `basePrice` int NOT NULL,
ADD COLUMN `basePriceLabel` varchar(255) NOT NULL,
ADD COLUMN `reducedPrice` int NOT NULL,
ADD COLUMN `reducedPriceUitpas` int NULL DEFAULT NULL,
ADD COLUMN `uitpasTariffId` varchar(255) NULL DEFAULT NULL,
ADD COLUMN `registeredAt` datetime NULL DEFAULT NULL;
