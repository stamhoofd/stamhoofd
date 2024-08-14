
ALTER TABLE `payments` ADD FOREIGN KEY (`payingOrganizationId`) REFERENCES `organizations` (`id`) ON UPDATE CASCADE ON DELETE SET NULL;
