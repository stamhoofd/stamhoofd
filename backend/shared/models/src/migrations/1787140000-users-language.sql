ALTER TABLE `users`
ADD COLUMN `language` varchar(2) NULL DEFAULT NULL AFTER `lastName`;
