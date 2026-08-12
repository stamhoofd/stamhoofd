ALTER TABLE `settlement_charges` ADD CONSTRAINT `settlement_charges_ibfk_4` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
