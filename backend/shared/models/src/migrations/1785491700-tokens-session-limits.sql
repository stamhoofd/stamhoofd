-- Session properties that have to survive a refresh token rotation, so the total length of
-- a session can be limited instead of only the length of a single token.
ALTER TABLE `tokens`
ADD COLUMN `sessionStartedAt` datetime NULL AFTER `authenticatedAt`,
ADD COLUMN `isNativeApp` tinyint(1) NOT NULL DEFAULT '0' AFTER `sessionStartedAt`,
ADD COLUMN `loginMethod` varchar(32) NOT NULL DEFAULT 'password' AFTER `isNativeApp`;

-- Existing sessions start counting from the token they are on right now. Tokens rotate
-- every hour, so this is at most an hour of extra session length.
UPDATE `tokens` SET `sessionStartedAt` = `createdAt`;

ALTER TABLE `tokens`
MODIFY COLUMN `sessionStartedAt` datetime NOT NULL;

-- The session is only created after the second factor, so the login method of the primary
-- credential has to travel with the challenge.
ALTER TABLE `mfa_tokens`
ADD COLUMN `loginMethod` varchar(32) NOT NULL DEFAULT 'password' AFTER `purpose`;
