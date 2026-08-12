ALTER TABLE `settlement_charges`
  DROP FOREIGN KEY `settlement_charges_ibfk_3`,
  DROP KEY `balanceItemId`,
  DROP COLUMN `balanceItemId`;
