

ALTER TABLE `organizations` DROP COLUMN `dnsRecords`;
ALTER TABLE `organizations` DROP COLUMN `mailDomain`;
ALTER TABLE `organizations` ADD COLUMN `privateMeta` json NOT NULL DEFAULT (json_object());
ALTER TABLE `organizations` ADD COLUMN `serverMeta` json NOT NULL DEFAULT (json_object());