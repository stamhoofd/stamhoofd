ALTER TABLE `events` ADD COLUMN `nameJson` json NULL AFTER `typeId`;
UPDATE `events` SET `nameJson` = JSON_OBJECT('value', `name`, 'version', 0);
ALTER TABLE `events` DROP COLUMN `name`;
ALTER TABLE `events` CHANGE COLUMN `nameJson` `name` json NOT NULL;
