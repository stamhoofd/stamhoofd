ALTER TABLE `payments`
ADD COLUMN `ibanName` varchar(128) NULL AFTER `iban`;