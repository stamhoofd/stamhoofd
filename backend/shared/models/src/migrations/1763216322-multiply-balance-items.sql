update `balance_items` 
set 
    `unitPrice` = `unitPrice` * 100,
    `pricePaid` = `pricePaid` * 100,
    `pricePending` = `pricePending` * 100,
    `priceOpen` = `priceOpen` * 100;
