ALTER TABLE `balance_items`
ADD COLUMN `VATPercentage` int NULL AFTER `unitPrice`,
ADD COLUMN `VATIncluded` tinyint NOT NULL DEFAULT '1' AFTER `VATPercentage`,
ADD COLUMN `VATExcempt` varchar(36) NULL AFTER `VATIncluded`;
