ALTER TABLE `payments` 
  ADD COLUMN `stripeAccountId` varchar(36) NULL, 
  ADD CONSTRAINT `stripeAccountId` FOREIGN KEY (`stripeAccountId`) REFERENCES `stripe_accounts` (`id`) ON DELETE RESTRICT ON UPDATE CASCADE;