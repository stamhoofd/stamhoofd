ALTER TABLE `webauthn_credentials`
ADD COLUMN `providerId` varchar(255) NULL AFTER `name`,
ADD COLUMN `providerName` varchar(255) NULL AFTER `providerId`;
