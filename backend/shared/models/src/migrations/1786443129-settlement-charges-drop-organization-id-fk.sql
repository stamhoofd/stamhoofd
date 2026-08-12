-- The stored constraint sets the column to NULL on delete, which the NOT NULL below can't accept
ALTER TABLE `settlement_charges` DROP FOREIGN KEY `settlement_charges_ibfk_4`;
