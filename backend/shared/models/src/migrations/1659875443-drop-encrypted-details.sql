ALTER TABLE `members`
DROP COLUMN `encryptedDetails`,
DROP COLUMN `firstName`;

ALTER TABLE `members` CHANGE `details` `details` json NOT NULL;