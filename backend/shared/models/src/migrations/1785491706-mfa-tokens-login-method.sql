ALTER TABLE `mfa_tokens`
ADD COLUMN `loginMethod` varchar(32) NOT NULL DEFAULT 'Password' AFTER `purpose`;
