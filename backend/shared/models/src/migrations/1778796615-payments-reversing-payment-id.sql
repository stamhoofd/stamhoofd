ALTER TABLE `payments`
ADD COLUMN `reversingPaymentId` varchar(36) NULL AFTER `invoiceId`,
ADD FOREIGN KEY (`reversingPaymentId`) REFERENCES `payments` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
