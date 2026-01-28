ALTER TABLE `payments`
ADD COLUMN `roundingAmount` int NOT NULL DEFAULT '0' AFTER `price`;
