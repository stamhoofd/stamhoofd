ALTER TABLE `registrations` ADD FOREIGN KEY (`payingOrganizationId`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
