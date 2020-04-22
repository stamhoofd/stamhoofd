CREATE TABLE `registrations` (
  `id` int unsigned NOT NULL AUTO_INCREMENT,
  `memberId` int unsigned NOT NULL,
  `groupId` int unsigned NOT NULL,
  `registeredOn` datetime NOT NULL COMMENT 'Date of the registration or renewal',
  `deactivatedOn` datetime DEFAULT NULL COMMENT 'Set if the registration was canceled or deactivated during the group cycle. Keep this null at the end of the group cycle.',
  `cycle` int unsigned NOT NULL COMMENT 'Cycle of the group the registration is for',
  PRIMARY KEY (`id`),
  UNIQUE KEY `groupCycleMember` (`groupId`,`cycle`,`memberId`) USING BTREE,
  KEY `memberId` (`memberId`) USING BTREE,
  CONSTRAINT `registrations_ibfk_1` FOREIGN KEY (`memberId`) REFERENCES `members` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
  CONSTRAINT `registrations_ibfk_2` FOREIGN KEY (`groupId`) REFERENCES `groups` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci;