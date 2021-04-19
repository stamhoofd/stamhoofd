ALTER TABLE `organizations` ADD COLUMN `mailDomain` varchar(100) NULL COMMENT '';
ALTER TABLE `organizations` ADD COLUMN `dnsRecords` json NOT NULL DEFAULT (json_array());