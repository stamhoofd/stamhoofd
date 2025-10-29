ALTER TABLE `stamhoofd_invoices`
DROP INDEX `organizationId`,
ADD INDEX `payingOrganizationId` (`payingOrganizationId`) USING BTREE;
