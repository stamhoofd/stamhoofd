-- Session properties that have to survive a refresh token rotation, so the total length of
-- a session can be limited instead of only the length of a single token.
ALTER TABLE `tokens`
ADD COLUMN `sessionStartedAt` datetime NULL AFTER `authenticatedAt`,
ADD COLUMN `isNativeApp` tinyint(1) NOT NULL DEFAULT '0' AFTER `sessionStartedAt`,
ADD COLUMN `loginMethod` varchar(32) NOT NULL DEFAULT 'password' AFTER `isNativeApp`;
