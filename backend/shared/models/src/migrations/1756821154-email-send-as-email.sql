ALTER TABLE `emails`
ADD COLUMN `sendAsEmail` tinyint(1) NOT NULL DEFAULT '1' AFTER `fromName`,
ADD COLUMN `showInMemberPortal` tinyint(1) NOT NULL DEFAULT '1' AFTER `sendAsEmail`;
