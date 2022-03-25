ALTER TABLE `payments`
ADD COLUMN `transferSettings` json NULL AFTER `price`;