ALTER TABLE `payments`
ADD COLUMN `createMandate` json NULL AFTER `stripeAccountId`;
