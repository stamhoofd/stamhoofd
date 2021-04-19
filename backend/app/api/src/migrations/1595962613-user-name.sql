ALTER TABLE `users` ADD COLUMN `firstName` varchar(100) NULL COMMENT '' AFTER `email`;
ALTER TABLE `users` ADD COLUMN `lastName` varchar(100) NULL COMMENT '' AFTER `firstName`;
