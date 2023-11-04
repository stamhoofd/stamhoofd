ALTER TABLE `groups`
ADD COLUMN `status` varchar(36) NOT NULL DEFAULT 'Open' AFTER `deletedAt`;