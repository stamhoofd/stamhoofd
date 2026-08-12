-- Deleting the payer's organization takes its settlement_charges with it: the fee rows that point
-- at them are ours and stay, so this may no longer be RESTRICT
ALTER TABLE `application_fees` ADD CONSTRAINT `application_fees_ibfk_5` FOREIGN KEY (`settlementChargeId`) REFERENCES `settlement_charges` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
