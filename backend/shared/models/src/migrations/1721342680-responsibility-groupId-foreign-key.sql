ALTER TABLE `member_responsibility_records` ADD FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON UPDATE CASCADE ON DELETE CASCADE;
