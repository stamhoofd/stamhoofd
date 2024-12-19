ALTER TABLE `cached_outstanding_balances`
CHANGE `amount` `amountOpen` int NOT NULL DEFAULT '0';
