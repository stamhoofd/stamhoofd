ALTER TABLE `documents`
ADD COLUMN `isLocked` tinyint(1) NOT NULL DEFAULT '0' AFTER `number`;
