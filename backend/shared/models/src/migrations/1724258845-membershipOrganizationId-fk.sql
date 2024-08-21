ALTER TABLE `platform` ADD FOREIGN KEY (`membershipOrganizationId`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
