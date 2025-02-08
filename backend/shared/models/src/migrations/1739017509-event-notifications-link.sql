CREATE TABLE `_event_notifications_events` (
    `id` bigint unsigned NOT NULL AUTO_INCREMENT,
    `eventNotificationsId` varchar(36) NOT NULL,
    `eventsId` varchar(36) NOT NULL,
    PRIMARY KEY (`id`),
    KEY `eventNotificationsId` (`eventNotificationsId`),
    KEY `eventsId` (`eventsId`),
    CONSTRAINT `eventNotificationsId` FOREIGN KEY (`eventNotificationsId`) REFERENCES `event_notifications` (`id`) ON DELETE CASCADE ON UPDATE CASCADE,
    CONSTRAINT `eventsId` FOREIGN KEY (`eventsId`) REFERENCES `events` (`id`) ON DELETE CASCADE ON UPDATE CASCADE
) ENGINE = InnoDB DEFAULT CHARSET = utf8mb4 COLLATE = utf8mb4_0900_ai_ci;
