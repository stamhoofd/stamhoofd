ALTER TABLE `cached_outstanding_balances`
ADD COLUMN `amountPaid` int NOT NULL DEFAULT '0' AFTER `organizationId`;
