-- A fee of a payer we can no longer reach (its organization is deleted, or its Stripe account is)
-- is still our income: the row has to survive without its payer links
ALTER TABLE `application_fees` DROP FOREIGN KEY `application_fees_ibfk_2`;
