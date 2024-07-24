ALTER TABLE `groups`
ADD COLUMN `type` varchar(36) NOT NULL DEFAULT 'Membership' AFTER `id`;
