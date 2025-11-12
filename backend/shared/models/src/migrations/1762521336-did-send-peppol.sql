ALTER TABLE
    `stamhoofd_invoices`
ADD
    COLUMN `didSendPeppol` tinyint(1) NOT NULL DEFAULT '0'
AFTER
    `paidAt`;