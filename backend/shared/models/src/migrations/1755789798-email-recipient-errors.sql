ALTER TABLE `email_recipients`
ADD COLUMN `failError` json NULL AFTER `failErrorMessage`;
