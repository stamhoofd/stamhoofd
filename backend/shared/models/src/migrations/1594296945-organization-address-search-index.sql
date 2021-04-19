ALTER TABLE `organizations` ADD COLUMN `address` json NOT NULL COMMENT '';
ALTER TABLE `organizations` ADD COLUMN `searchIndex` text NOT NULL COMMENT '';