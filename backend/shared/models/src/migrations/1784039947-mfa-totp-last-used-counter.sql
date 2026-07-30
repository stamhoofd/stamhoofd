ALTER TABLE `mfa_totp`
ADD COLUMN `lastUsedCounter` int NULL DEFAULT NULL AFTER `lastUsedAt`;
