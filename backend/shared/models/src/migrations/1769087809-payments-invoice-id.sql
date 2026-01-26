ALTER TABLE `payments`
ADD COLUMN `invoiceId` varchar(36) NULL AFTER `customer`,
ADD FOREIGN KEY (`invoiceId`) REFERENCES `invoices` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
