ALTER TABLE `emails`
ADD COLUMN `deletedAt` datetime NULL AFTER `updatedAt`;
