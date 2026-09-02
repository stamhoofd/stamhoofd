ALTER TABLE `invoices` ADD COLUMN `isReceipt` tinyint(1) NOT NULL DEFAULT '0' AFTER `comments`;
