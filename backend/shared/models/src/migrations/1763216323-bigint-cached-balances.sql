ALTER TABLE `cached_outstanding_balances`
CHANGE `amountPaid` `amountPaid` bigint NOT NULL DEFAULT '0',
CHANGE `amountOpen` `amountOpen` bigint NOT NULL DEFAULT '0',
CHANGE `amountPending` `amountPending` bigint NOT NULL DEFAULT '0',
CHANGE `lastReminderAmountOpen` `lastReminderAmountOpen` bigint NOT NULL DEFAULT '0';
