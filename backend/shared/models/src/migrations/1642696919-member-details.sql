ALTER TABLE `stamhoofd`.`members`
ADD COLUMN `details` json NULL DEFAULT NULL AFTER `organizationId`;