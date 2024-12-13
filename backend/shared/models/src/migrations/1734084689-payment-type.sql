ALTER TABLE `payments`
ADD COLUMN `type` varchar(36) NOT NULL DEFAULT 'Payment' AFTER `id`;
