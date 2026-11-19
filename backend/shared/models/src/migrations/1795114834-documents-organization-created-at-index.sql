ALTER TABLE `documents`
ADD INDEX `organizationId_createdAt` (`organizationId`, `createdAt`);
