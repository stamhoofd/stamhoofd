ALTER TABLE
    `stamhoofd_invoices`
ADD
    COLUMN `negativeInvoiceId` varchar(36) NULL,
ADD
    FOREIGN KEY (`negativeInvoiceId`) REFERENCES `stamhoofd_invoices` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;