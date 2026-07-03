ALTER TABLE `payments`
ADD COLUMN `reference` varchar(128) NULL AFTER `stripeAccountId`;
