update `cached_outstanding_balances` 
set 
    `amountPaid` = `amountPaid` * 100,
    `amountOpen` = `amountOpen` * 100,
    `amountPending` = `amountPending` * 100,
    `lastReminderAmountOpen` = `lastReminderAmountOpen` * 100;
