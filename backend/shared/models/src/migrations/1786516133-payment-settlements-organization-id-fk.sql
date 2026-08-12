ALTER TABLE `payment_settlements` ADD CONSTRAINT `payment_settlements_ibfk_3` FOREIGN KEY (`organizationId`) REFERENCES `organizations` (`id`) ON DELETE CASCADE ON UPDATE CASCADE;
