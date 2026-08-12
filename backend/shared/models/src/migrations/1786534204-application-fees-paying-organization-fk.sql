ALTER TABLE `application_fees` ADD CONSTRAINT `application_fees_ibfk_2` FOREIGN KEY (`payingOrganizationId`) REFERENCES `organizations` (`id`) ON DELETE SET NULL ON UPDATE CASCADE;
