ALTER TABLE `payments`
ADD COLUMN `transferFeeManual` int NOT NULL DEFAULT '0' AFTER `transferFee`,
ADD COLUMN `transferFeeManualCharged` int NOT NULL DEFAULT '0' AFTER `transferFeeManual`;
