ALTER TABLE `payments`
ADD COLUMN `iban` varchar(40) NULL AFTER `settlement`;