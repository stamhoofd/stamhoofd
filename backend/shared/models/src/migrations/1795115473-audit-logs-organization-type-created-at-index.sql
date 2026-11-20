ALTER TABLE `audit_logs`
ADD INDEX `organizationId_type_createdAt` (`organizationId`, `type`, `createdAt`), ALGORITHM=INPLACE, LOCK=NONE;
