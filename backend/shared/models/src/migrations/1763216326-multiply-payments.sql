update `payments` 
set 
    `price` = `price` * 100,
    `freeContribution` = `freeContribution` * 100,
    `serviceFeeManualCharged` = `serviceFeeManualCharged` * 100,
    `serviceFeeManual` = `serviceFeeManual` * 100,
    `serviceFeePayout` = `serviceFeePayout` * 100,
    `transferFee` = `transferFee` * 100;
