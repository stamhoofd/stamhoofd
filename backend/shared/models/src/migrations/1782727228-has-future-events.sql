ALTER TABLE `organizations`
ADD COLUMN `hasFutureEvents` tinyint(1) NOT NULL DEFAULT '1' AFTER `periodId`;
