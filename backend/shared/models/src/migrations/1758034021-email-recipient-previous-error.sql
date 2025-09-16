ALTER TABLE `email_recipients`
ADD COLUMN `previousFailError` json NULL AFTER `failError`;
