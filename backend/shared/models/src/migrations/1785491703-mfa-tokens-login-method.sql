-- The session is only created after the second factor, so the login method of the primary
-- credential has to travel with the challenge.
ALTER TABLE `mfa_tokens`
ADD COLUMN `loginMethod` varchar(32) NOT NULL DEFAULT 'Password' AFTER `purpose`;
