ALTER TABLE `payments`
ADD COLUMN `mandateId` varchar(36) NULL AFTER `stripeAccountId`;
