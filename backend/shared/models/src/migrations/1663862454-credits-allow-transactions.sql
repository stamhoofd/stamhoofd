ALTER TABLE `stamhoofd_credits`
ADD COLUMN `allowTransactions` int NOT NULL DEFAULT '0' AFTER `description`;