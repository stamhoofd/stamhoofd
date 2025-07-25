ALTER TABLE `payments`
ADD COLUMN `serviceFeePayout` int NOT NULL DEFAULT '0' AFTER `stripeAccountId`,
ADD COLUMN `serviceFeeManual` int NOT NULL DEFAULT '0' AFTER `stripeAccountId`,
ADD COLUMN `serviceFeeManualCharged` int NOT NULL DEFAULT '0' AFTER `stripeAccountId`;