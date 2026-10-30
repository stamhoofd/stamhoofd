ALTER TABLE `balance_items`
  ADD COLUMN `nameJson` json NULL AFTER `name`,
  ADD COLUMN `descriptionJson` json NULL AFTER `description`;
UPDATE `balance_items` SET
  `nameJson` = JSON_OBJECT('value', `name`, 'version', 0),
  `descriptionJson` = JSON_OBJECT('value', IFNULL(`description`, ''), 'version', 0);
ALTER TABLE `balance_items`
  DROP COLUMN `name`,
  DROP COLUMN `description`;
ALTER TABLE `balance_items`
  CHANGE COLUMN `nameJson` `name` json NOT NULL,
  CHANGE COLUMN `descriptionJson` `description` json NOT NULL;
