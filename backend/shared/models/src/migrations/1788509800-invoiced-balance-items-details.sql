ALTER TABLE `invoiced_balance_items`
  ADD COLUMN `type` varchar(36) NOT NULL DEFAULT 'Other' AFTER `balanceItemId`,
  ADD COLUMN `relations` json NOT NULL DEFAULT (json_object()) AFTER `description`,
  ADD COLUMN `startDate` datetime NULL AFTER `relations`,
  ADD COLUMN `endDate` datetime NULL AFTER `startDate`;
