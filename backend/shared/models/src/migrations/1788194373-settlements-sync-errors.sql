ALTER TABLE `settlements` ADD COLUMN `syncErrors` json NULL AFTER `syncFailureCount`;
