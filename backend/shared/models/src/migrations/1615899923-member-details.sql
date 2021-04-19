ALTER TABLE `members` CHANGE `publicKey` `publicKey` varchar(250) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT '';
ALTER TABLE `members` CHANGE `organizationPublicKey` `organizationPublicKey` varchar(250) CHARACTER SET ascii COLLATE ascii_general_ci NULL COMMENT '';
ALTER TABLE `members` DROP COLUMN `placeholder`;
ALTER TABLE `members` ADD COLUMN `encryptedDetails` json NOT NULL DEFAULT (json_array()) COMMENT '' AFTER `organizationId`;